import _ from "underscore";
import { Request, Response } from "express";
import psl from "psl";

import { endWithStatusAndBody, getParsedUrl } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";
import { UrlPattern, UserReport } from "../../shared/types";

export default async function handleUserReports(req: Request, res: Response) {
  const searchParams = getParsedUrl(req).searchParams;
  if (!(searchParams.has("from") && searchParams.has("to"))) {
    return endWithStatusAndBody(res, 400, "`from` and `to` query parameters required");
  }

  const bq = getBqConnection();
  try {
    // Note: this looks weird - but it makes sure the queries run in parallel.
    // Since BQ has some initial latency when responding, this matters.
    // [ToDo] Investigate whether using QueryJobs makes sense here.
    const [[rawReports], [rawUrlPatterns]] = await Promise.all([
      bq.query({
        query: `
          SELECT reports.*,
            ARRAY(
              SELECT label
              FROM webcompat_user_reports.labels
              WHERE report_uuid = reports.uuid
            ) as labels,
            bp.label as prediction,
            bp.probability as prob
          FROM webcompat_user_reports.user_reports_prod as reports
          LEFT JOIN webcompat_user_reports.bugbug_predictions AS bp ON reports.uuid = bp.report_uuid
          WHERE
            reports.reported_at BETWEEN ? and DATE_ADD(?, interval 1 day)

            # Exclude reports that have a tracked action, i.e. reports hidden
            # or reports that have been investigated
            AND NOT EXISTS (SELECT 1 FROM webcompat_user_reports.report_actions WHERE report_actions.report_uuid = reports.uuid)
            ORDER BY 
            CASE
              WHEN prediction = 'valid' THEN 1
              WHEN prediction = 'invalid' THEN 2
              ELSE 3
            END,
              CASE WHEN prediction = 'valid' THEN prob END DESC,
              CASE WHEN prediction = 'invalid' THEN prob END ASC;
        `,
        params: [searchParams.get("from")!, searchParams.get("to")!],
      }),
      bq.query({
        query: [
          "SELECT patterns.*, bugs.title",
          "FROM webcompat_knowledge_base.url_patterns AS patterns",
          "LEFT JOIN webcompat_knowledge_base.bugzilla_bugs AS bugs ON patterns.bug = bugs.number",
        ].join(" "),
      }),
    ]);

    const preprocessedUrlPatterns = rawUrlPatterns.map((pattern: UrlPattern) => {
      const newPattern = Object.assign({}, pattern);

      // [ToDo] We probably should build actual RegExp matching, so this should
      // generate a matchable RegExp
      newPattern.url_pattern = pattern.url_pattern.replace("*", "");

      return newPattern;
    });

    const preprocessedReports = rawReports
      .filter((report: UserReport) => {
        // [ToDo] some reports currently don't have a URL attached. This breaks
        // all kinds of assumptions here, so let's remove them for now. Tom is
        // investigating why this happens.
        return !!report.url;
      })
      .map((report: UserReport) => {
        const newReport = Object.assign({}, report);

        // For some reason, the reported_at as it comes out of the database is
        // actually an object {value: "[timestamp]"}.
        // [ToDo] figure out why, and if this is something that could change
        newReport.reported_at = (report as any).reported_at.value;

        // Details are stored as JSON-as-String, so let's parse
        newReport.details = JSON.parse(report.details as any);

        newReport.related_bugs = preprocessedUrlPatterns
          .filter((pattern) => report.url.includes(pattern.url_pattern))
          .map((pattern) => ({
            number: pattern.bug,
            title: pattern.title,
          }));

        return newReport;
      });

    const groupedByDomain = _.groupBy(preprocessedReports, (report) => {
      try {
        const parsedUrl = new URL(report.url);
        const parsedDomain = psl.parse(parsedUrl.hostname);
        return (parsedDomain as psl.ParsedDomain).domain || "[unknown]";
      } catch {
        return "[unknown]";
      }
    });

    const partitioned = Object.entries(groupedByDomain).map(([key, value]) => {
      const [known_reports, unknown_reports] = _.partition(value, (report) => report.related_bugs.length > 0);
      return {
        root_domain: key,
        known_reports,
        unknown_reports,
      };
    });

    const sorted = partitioned.sort((a, b) => b.unknown_reports.length - a.unknown_reports.length);
    res.write(JSON.stringify(sorted));
  } catch (error: any) {
    return endWithStatusAndBody(res, 500, error.toString());
  }

  res.end();
}
