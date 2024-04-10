import { parentPort, workerData } from "node:worker_threads";
import _ from "underscore";
import psl from "psl";
import { UrlPattern, UserReport } from "../../shared/types";
import type { Logger } from "winston";

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
  const groupedByDomain = _.groupBy(preprocessedReports, (report) => {
    try {
      const parsedUrl = new URL(report.url);
      const parsedDomain = psl.parse(parsedUrl.hostname);
      return (parsedDomain as psl.ParsedDomain).domain || "[unknown]";
    } catch {
      return "[unknown]";
    }
  });

  logger.verbose("Partitioning reports into known/unknown...");
  const partitioned = Object.entries(groupedByDomain).map(([key, value]) => {
    const [known_reports, unknown_reports] = _.partition(value, (report) => report.related_bugs.length > 0);
    return {
      root_domain: key,
      known_reports,
      unknown_reports,
    };
  });

  logger.verbose("Sorting by the total number of reports per domain...");
  const sorted = partitioned.sort((a, b) => b.unknown_reports.length - a.unknown_reports.length);

  logger.verbose("Writing response...");
  return JSON.stringify(sorted);
}

// If this module is used in a worker, automatically call the transform
// code using the `workerData` as arguments and post back the result.
if (parentPort) {
  const logger = {
    verbose(msg: string) {
      parentPort?.postMessage({ type: "verbose", msg });
    },
  };

  const { rawReports, rawUrlPatterns } = workerData;
  const result = transformUserReports(rawReports, rawUrlPatterns, logger);
  parentPort?.postMessage({ type: "done", result });
}
