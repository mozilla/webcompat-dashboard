import { Pluralize } from "../helpers/language";
import { UserReportEntry } from "../types/user_reports";
import { useState } from "react";
import UserReportContents from "./user_report_contents";

type ResultListProps = {
  results: UserReportEntry[];
};

export default function UserReportList({ results }: ResultListProps) {
  const [expandedRootDomain, setExpandedRootDomain] = useState<string | null>(null);

  return (
    <div className="result-list">
      {results.map((entry) => {
        const isExpanded = expandedRootDomain == entry.root_domain;

        return (
          <div className="item" key={entry.root_domain}>
            <div className="header" onClick={() => setExpandedRootDomain(isExpanded ? null : entry.root_domain)}>
              <span className="toggler">{isExpanded ? "▼" : "▶"}</span>
              <span className="domain">{entry.root_domain}</span>
              <span>
                ({entry.unknown_reports.length + entry.known_reports.length}{" "}
                {Pluralize(entry.unknown_reports.length, "report", "reports")}: {entry.unknown_reports.length} unknown,{" "}
                {entry.known_reports.length} known)
              </span>
            </div>
            {isExpanded && (
              <div className="report-container">
                {entry.unknown_reports.length > 0 && (
                  <>
                    <h3>Unknown Reports</h3>
                    <table className="report-list">
                      <tbody>
                        {entry.unknown_reports.map((report, index) => (
                          <UserReportContents key={report.uuid} index={index + 1} report={report} />
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {entry.known_reports.length > 0 && (
                  <>
                    <h3>(Maybe) Known Reports</h3>
                    <table className="report-list">
                      <tbody>
                        {entry.known_reports.map((report, index) => (
                          <UserReportContents key={report.uuid} index={index + 1} report={report} />
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
