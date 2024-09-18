import { UserReport } from "../../shared/types";
import { useState } from "react";
import ReportActions from "./report_actions";

type UserReportContentsProps = {
  index: number;
  report: UserReport;
  rootDomain: string;
};

export default function UserReportContents({ index, report, rootDomain }: UserReportContentsProps) {
  const [isHidden, setIsHidden] = useState(false);
  const itemStyle: React.CSSProperties = isHidden ? { display: "none" } : {};
  const isInvalid = report.prediction && report.prediction == "invalid" && report.prob > 0.92;
  const itemClassName = isInvalid ? "invalid" : "";

  const shouldShowTranslation = report.translated_comments && report.translated_from && report.translated_from != "en";
  const handleOnActionComplete = () => {
    setIsHidden(true);
  };

  return (
    <tr key={report.uuid} className={`report ${itemClassName}`} style={itemStyle}>
      <td className="index">{index}</td>
      <td className="contents">
        <table>
          <tbody>
            <tr>
              <td>URL</td>
              <td>
                <a href={report.url} target="_blank" rel="noopener noreferrer">
                  {report.url}
                </a>
              </td>
            </tr>
            {report.labels && report.labels.length > 0 && (
              <tr>
                <td>Labels</td>
                <td>{report.labels.sort().join(", ")}</td>
              </tr>
            )}
            {isInvalid && (
              <tr>
                <td>Prediction</td>
                <td>This report is likely invalid with probability {(report.prob * 100).toFixed(2) + "%"}</td>
              </tr>
            )}
            <tr>
              <td>Reported at</td>
              <td>{report.reported_at.toString()}</td>
            </tr>
            {report.comments && shouldShowTranslation ? (
              <tr>
                <td>Comments</td>
                <td>
                  {report.translated_comments}
                  <br />
                  <br />
                  <i>(text was translated from {report.translated_from})</i>
                </td>
              </tr>
            ) : (
              <tr>
                <td>Comments</td>
                <td>{report.comments}</td>
              </tr>
            )}
            {report.breakage_category && (
              <tr>
                <td>Category</td>
                <td>{report.breakage_category}</td>
              </tr>
            )}
            <tr>
              <td>User Agent</td>
              <td>
                {report.app_name} {report.app_version} ({report.app_channel}) on {report.os}
              </td>
            </tr>
            <tr>
              <td>Tracking Protection</td>
              <td>{report.tp_status ? report.tp_status : "disabled"}</td>
            </tr>
            {report.related_bugs?.length > 0 && (
              <tr>
                <td>Related bugs</td>
                <td>
                  <ul>
                    {report.related_bugs.map((bug) => (
                      <li key={bug.number}>
                        <a href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug.number}`} target="_blank">
                          {`Bug ${bug.number} - ${bug.title}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}

            <ReportActions rootDomain={rootDomain} report={report} onActionComplete={handleOnActionComplete} />
          </tbody>
        </table>
      </td>
    </tr>
  );
}
