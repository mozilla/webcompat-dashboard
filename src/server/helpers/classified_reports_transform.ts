import _ from "underscore";
import { getBqConnection } from "../helpers/bigquery";
import { isIP } from "node:net";
import { parentPort } from "node:worker_threads";
import { UrlPattern, ClassifiedReport } from "../../shared/types";
import psl from "psl";
import type { Logger } from "winston";

export async function fetchClassifiedReports(projectId: string, paramFrom: string, paramTo: string, logger: Logger) {
  logger.verbose("Connecting to BigQuery...");
  const bq = getBqConnection(projectId);

  logger.verbose("Starting queries...");
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
          reports.metrics.string.broken_site_report_tab_info_antitracking_block_list AS tp_status,
          reports.metrics.text2.broken_site_report_browser_info_app_default_useragent_string as ua_string,
          reports.metrics.text2.broken_site_report_description AS comments,
          reports.metrics.url2.broken_site_report_url AS url,
          reports.normalized_app_name AS app_name,
          reports.normalized_channel AS app_channel,
          reports.metadata.user_agent.version AS app_major_version,
          ARRAY(
            SELECT label
            FROM webcompat_user_reports.labels
            WHERE report_uuid = reports.document_id
          ) as labels,
          bp.label as prediction,
          bp.probability as prob,
          action.type AS action,
          ml_trans.translated_text AS translated_comments,
          ml_trans.language_code AS translated_from,

          # If the report is from Windows, we have to use a bit of mozfun to figure out the human-readable Windows
          # version for the build number. But this function only works on Windows pings, so we have to gate it.
          IF (
            client_info.windows_build_number IS NOT NULL,
            mozfun.norm.windows_version_info('Windows_NT', client_info.os_version, client_info.windows_build_number),
            reports.normalized_os
          ) as os
        FROM moz-fx-data-shared-prod.firefox_desktop.broken_site_report as reports
        LEFT JOIN webcompat_user_reports.bugbug_predictions AS bp ON reports.document_id = bp.report_uuid
        LEFT JOIN webcompat_user_reports.translations AS ml_trans ON reports.document_id = ml_trans.report_uuid
        LEFT JOIN 
        (SELECT 
             report_uuid,
             type,
             created_at,
             ROW_NUMBER() OVER (PARTITION BY report_uuid ORDER BY created_at DESC) AS rn
         FROM 
         webcompat_user_reports.report_actions
        ) AS action ON reports.document_id = action.report_uuid AND action.rn = 1
        WHERE
          reports.submission_timestamp BETWEEN TIMESTAMP(?) and TIMESTAMP(DATE_ADD(?, interval 1 day))
          AND reports.metrics.text2.broken_site_report_description != "";
      `,
      params: [paramFrom, paramTo],
    }),
    bq.query({
      query: [
        "SELECT patterns.*, bugs.title",
        "FROM webcompat_knowledge_base.url_patterns AS patterns",
        "LEFT JOIN webcompat_knowledge_base.bugzilla_bugs AS bugs ON patterns.bug = bugs.number",
      ].join(" "),
    }),
  ]);
  logger.verbose(`Received ${rawReports.length} user reports and ${rawUrlPatterns.length} URL patterns.`);

  return {
    rawReports,
    rawUrlPatterns,
  };
}

export function transformClassifiedReports(
  rawReports: any[],
  rawUrlPatterns: any[],
  paramPrediction: string,
  logger: Logger,
) {
  logger.verbose("Pre-processing URL patterns...");
  const preprocessedUrlPatterns = rawUrlPatterns.map((pattern: UrlPattern) => {
    const newPattern = Object.assign({}, pattern);

    // [ToDo] We probably should build actual RegExp matching, so this should
    // generate a matchable RegExp
    newPattern.url_pattern = pattern.url_pattern.replace("*", "");

    return newPattern;
  });

  const normalizeHostname = _.memoize((hostname: string) => {
    if (isIP(hostname)) {
      return hostname;
    }

    const parsedDomain = psl.parse(hostname);
    return (parsedDomain as psl.ParsedDomain).domain || "[unknown]";
  });

  logger.verbose("Pre-processing classified reports...");
  const preprocessedReports = rawReports
    .filter((report: ClassifiedReport) => {
      // [ToDo] some reports currently don't have a URL attached. This breaks
      // all kinds of assumptions here, so let's remove them for now. Tom is
      // investigating why this happens.
      return !!report.url;
    })
    .filter((report: ClassifiedReport) => {
      if (!paramPrediction || paramPrediction === "all") {
        return true;
      }
      return report.prediction === paramPrediction;
    })
    .map((report: ClassifiedReport) => {
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

      const parsedUrl = new URL(newReport.url);
      newReport.root_domain = normalizeHostname(parsedUrl.hostname);

      return newReport;
    });

  logger.verbose("Writing response...");

  const soredReports = preprocessedReports.sort((a, b) => {
    if (paramPrediction === "invalid" || paramPrediction === "valid") {
      return a.prob - b.prob;
    }

    if (a.prediction === b.prediction) {
      // If labels are the same, sort by descending probability for 'valid'
      // and ascending probability for 'invalid'
      return a.prediction === "valid" ? b.prob - a.prob : a.prob - b.prob;
    }
    // Prioritize 'valid' over 'invalid'
    return a.prediction === "valid" ? -1 : 1;
  });

  return JSON.stringify(soredReports);
}

// If this module is used in a worker, set up a listener for the 'fetch' message
// which will fetch and transform bigquery data before posting back to parent.
if (parentPort) {
  parentPort.on("message", async ({ type, projectId, paramFrom, paramTo, paramPrediction, port }) => {
    if (type == "fetch") {
      const logger = {
        verbose(msg: string) {
          port.postMessage({ type: "verbose", msg });
        },
      };

      try {
        const { rawReports, rawUrlPatterns } = await fetchClassifiedReports(
          projectId,
          paramFrom,
          paramTo,
          logger as Logger,
        );
        const result = transformClassifiedReports(rawReports, rawUrlPatterns, paramPrediction, logger as Logger);
        port.postMessage({ type: "done", result });
      } catch (error) {
        port.postMessage({ type: "error", error });
      }
    }
  });
}
