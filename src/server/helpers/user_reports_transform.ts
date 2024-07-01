import _ from "underscore";
import { getBqConnection } from "../helpers/bigquery";
import { isIP } from "node:net";
import { parentPort } from "node:worker_threads";
import { UrlPattern, UserReport } from "../../shared/types";
import psl from "psl";
import type { Logger } from "winston";

export async function fetchUserReports(projectId: string, paramFrom: string, paramTo: string, logger: Logger) {
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
          ml_trans.translated_text AS translated_comments,
          ml_trans.language_code AS translated_from,

          # If the report is from Windows, we have to use a bit of mozfun to figure out the human-readable Windows
          # version for the build number. But this function only works on Windows pings, so we have to gate it.
          IF (
            client_info.windows_build_number IS NOT NULL,
            mozfun.norm.windows_version_info('Windows_NT', client_info.os_version, client_info.windows_build_number),
            reports.normalized_os
          ) as os,

          # We want to exclude reports that have been actioned upon, but we do this later during processing. That's
          # because we want to limit the workload to only the "top 10" reports, and we want to make that list stable, so
          # removing already-actioned reports has to happen after sorting and grouping.
          CASE WHEN EXISTS (SELECT 1 FROM webcompat_user_reports.report_actions WHERE report_actions.report_uuid = reports.document_id)
            THEN true ELSE false END AS has_actions
        FROM moz-fx-data-shared-prod.firefox_desktop.broken_site_report as reports
        LEFT JOIN webcompat_user_reports.bugbug_predictions AS bp ON reports.document_id = bp.report_uuid
        LEFT JOIN webcompat_user_reports.translations AS ml_trans ON reports.document_id = ml_trans.report_uuid
        WHERE
          reports.submission_timestamp BETWEEN TIMESTAMP(?) and TIMESTAMP(DATE_ADD(?, interval 1 day))
        ORDER BY CHAR_LENGTH(comments) DESC
        ;
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

export function transformUserReports(rawReports: any[], rawUrlPatterns: any[], logger: Logger) {
  logger.verbose("Pre-processing URL patterns...");
  const preprocessedUrlPatterns = rawUrlPatterns.map((pattern: UrlPattern) => {
    const newPattern = Object.assign({}, pattern);

    // [ToDo] We probably should build actual RegExp matching, so this should
    // generate a matchable RegExp
    newPattern.url_pattern = pattern.url_pattern.replace("*", "");

    return newPattern;
  });

  logger.verbose("Pre-processing user reports...");
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

  logger.verbose("Grouping reports by root domain...");
  const normalizeHostname = _.memoize((hostname: string) => {
    if (isIP(hostname)) {
      return hostname;
    }

    const parsedDomain = psl.parse(hostname);
    return (parsedDomain as psl.ParsedDomain).domain || "[unknown]";
  });
  const groupedByDomainDict = _.groupBy(preprocessedReports, (report) => {
    try {
      const parsedUrl = new URL(report.url);
      return normalizeHostname(parsedUrl.hostname);
    } catch {
      return "[unknown]";
    }
  });

  logger.verbose("Transforming grouped Dictionary into Object");
  const groupedByDomain = Object.entries(groupedByDomainDict).map(([root_domain, reports]) => {
    const reportSubset = reports
      // First, let's filter out all the reports we don't want to triage:
      //   - anything labeled as invalid by our ML model
      //   - reports without a comment
      .filter((report) => !!report.comments && report.prediction == "valid")
      // Then, slice the first 10 reports out, then remove all reprots that have
      // been actioned upon. We do it in this order to make sure that there there
      // won't be a new set of 10 issues after all of them have been worked on.
      .slice(0, 10)
      .filter((report) => !report.has_actions);

    return {
      root_domain,
      // Note: this is the count of *all* reports, even ones we filtered out.
      reports_count: reports.length,
      reports: reportSubset,
    };
  });

  logger.verbose("Sorting by the total number of reports per domain...");
  const sorted = groupedByDomain.sort((a, b) => b.reports_count - a.reports_count);

  logger.verbose("Writing response...");
  return JSON.stringify(sorted);
}

// If this module is used in a worker, set up a listener for the 'fetch' message
// which will fetch and transform bigquery data before posting back to parent.
if (parentPort) {
  parentPort.on("message", async ({ type, projectId, paramFrom, paramTo, port }) => {
    if (type == "fetch") {
      const logger = {
        verbose(msg: string) {
          port.postMessage({ type: "verbose", msg });
        },
      };

      try {
        const { rawReports, rawUrlPatterns } = await fetchUserReports(projectId, paramFrom, paramTo, logger as Logger);
        const result = transformUserReports(rawReports, rawUrlPatterns, logger as Logger);
        port.postMessage({ type: "done", result });
      } catch (error) {
        port.postMessage({ type: "error", error });
      }
    }
  });
}
