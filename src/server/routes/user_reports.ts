import _ from "underscore";
import { Request, Response } from "express";
import psl from "psl";
import type { Logger } from "winston";

import { endWithStatusAndBody, getParsedUrl } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";
import { UrlPattern, UserReport } from "../../shared/types";

export default async function handleUserReports(logger: Logger, req: Request, res: Response) {
  const childLogger = logger.child({ handler: "handleUserReports" });
  childLogger.verbose("Entered handler");

  const searchParams = getParsedUrl(req).searchParams;
  if (!(searchParams.has("from") && searchParams.has("to"))) {
    return endWithStatusAndBody(res, 400, "`from` and `to` query parameters required");
  }

  childLogger.verbose("Connecting to BigQuery...");
  const bq = getBqConnection();
  try {
    childLogger.verbose("Starting queries...");
    // Note: this looks weird - but it makes sure the queries run in parallel.
    // Since BQ has some initial latency when responding, this matters.
    // [ToDo] Investigate whether using QueryJobs makes sense here.
    const [[rawReports], [rawUrlPatterns]] = await Promise.all([
      bq.query({
        query: `
          SELECT
            reports.document_id AS uuid,
            CAST(reports.submission_timestamp AS DATETIME) AS reported_at,
            reports.client_info.app_display_version AS app_version,
            reports.metrics.string.broken_site_report_breakage_category AS breakage_category,
            reports.metrics.text2.broken_site_report_browser_info_app_default_useragent_string as ua_string,
            reports.metrics.text2.broken_site_report_description AS comments,
            reports.metrics.url2.broken_site_report_url AS url,
            reports.normalized_app_name AS app_name,
            reports.normalized_channel AS app_channel,
            reports.normalized_os AS os,
            ARRAY(
              SELECT label
              FROM webcompat_user_reports.labels
              WHERE report_uuid = reports.document_id
            ) as labels,
            bp.label as prediction,
            bp.probability as prob
          FROM moz-fx-data-shared-prod.firefox_desktop.broken_site_report as reports
          LEFT JOIN webcompat_user_reports.bugbug_predictions AS bp ON reports.document_id = bp.report_uuid
          WHERE
            reports.submission_timestamp BETWEEN TIMESTAMP(?) and TIMESTAMP(DATE_ADD(?, interval 1 day))

            # Exclude reports that have a tracked action, i.e. reports hidden
            # or reports that have been investigated
            AND NOT EXISTS (SELECT 1 FROM webcompat_user_reports.report_actions WHERE report_actions.report_uuid = reports.document_id)
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
    childLogger.verbose(`Received ${rawReports.length} user reports and ${rawUrlPatterns.length} URL patterns.`);

    childLogger.verbose("Pre-processing URL patterns...");
    const preprocessedUrlPatterns = rawUrlPatterns.map((pattern: UrlPattern) => {
      const newPattern = Object.assign({}, pattern);

      // [ToDo] We probably should build actual RegExp matching, so this should
      // generate a matchable RegExp
      newPattern.url_pattern = pattern.url_pattern.replace("*", "");

      return newPattern;
    });

    childLogger.verbose("Pre-processing user reports...");
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

        newReport.related_bugs = preprocessedUrlPatterns
          .filter((pattern) => report.url.includes(pattern.url_pattern))
          .map((pattern) => ({
            number: pattern.bug,
            title: pattern.title,
          }));

        return newReport;
      });

    childLogger.verbose("Grouping reports by root domain...");
    const groupedByDomain = _.groupBy(preprocessedReports, (report) => {
      try {
        const parsedUrl = new URL(report.url);
        const parsedDomain = psl.parse(parsedUrl.hostname);
        return (parsedDomain as psl.ParsedDomain).domain || "[unknown]";
      } catch {
        return "[unknown]";
      }
    });

    childLogger.verbose("Partitioning reports into known/unknown...");
    const partitioned = Object.entries(groupedByDomain).map(([key, value]) => {
      const [known_reports, unknown_reports] = _.partition(value, (report) => report.related_bugs.length > 0);
      return {
        root_domain: key,
        known_reports,
        unknown_reports,
      };
    });

    childLogger.verbose("Sorting by the total number of reports per domain...");
    const sorted = partitioned.sort((a, b) => b.unknown_reports.length - a.unknown_reports.length);

    childLogger.verbose("Writing response...");
    res.write(JSON.stringify(sorted));
    childLogger.verbose("Handler done.");
  } catch (error: any) {
    childLogger.error("Handler failed", { error });
    return endWithStatusAndBody(res, 500, error.toString());
  }

  res.end();
}
