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

        if (entry.reports.length < 1) {
          return;
        }

        return (
          <div className="item" key={entry.root_domain}>
            <div className="header" onClick={() => setExpandedRootDomain(isExpanded ? null : entry.root_domain)}>
              <span className="toggler">{isExpanded ? "▼" : "▶"}</span>
              <span className="domain">{entry.root_domain}</span>
              <span>
                {entry.reports_count == entry.reports.length ? (
                  <>
                    ({entry.reports_count} {Pluralize(entry.reports.length, "report", "reports")})
                  </>
                ) : (
                  <>
                    ({entry.reports_count} {Pluralize(entry.reports.length, "report", "reports")},{" "}
                    {entry.reports.length} shown)
                  </>
                )}
              </span>
            </div>
            {isExpanded && (
              <div className="report-container">
                <table className="report-list">
                  <tbody>
                    {entry.reports.map((report, index) => (
                      <UserReportContents
                        key={report.uuid}
                        index={index + 1}
                        rootDomain={entry.root_domain}
                        report={report}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
