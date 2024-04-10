import { Request, Response } from "express";
import type { Logger } from "winston";

import { endWithStatusAndBody, getParsedUrl } from "../helpers/http";
import { getBqConnection } from "../helpers/bigquery";
import { transformUserReports } from "../helpers/user_reports_transform";

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

    const results = transformUserReports(rawReports, rawUrlPatterns, childLogger);
    res.write(results);
    childLogger.verbose("Handler done.");
  } catch (error: any) {
    childLogger.error("Handler failed", { error });
    return endWithStatusAndBody(res, 500, error.toString());
  }

  res.end();
}
