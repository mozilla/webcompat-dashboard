import { useMutation } from "@tanstack/react-query";
import { UserReport } from "../../shared/types";
import { useState } from "react";
import LoadingSpinner from "./loading_spinner";

type UserReportContentsProps = {
  index: number;
  report: UserReport;
};

export default function UserReportContents({ index, report }: UserReportContentsProps) {
  const [isHidden, setIsHidden] = useState(false);
  const itemStyle: React.CSSProperties = isHidden ? { display: "none" } : {};
  const isInvalid = report.prediction && report.prediction == "invalid" && report.prob > 0.92;
  const itemClassName = isInvalid ? "invalid" : "";

  const trackReportActionMutation = useMutation({
    mutationFn: async (actionType: string) => {
      const payload = {
        report_uuid: report.uuid,
        type: actionType,
      };

      const res = await fetch(`${import.meta.env.VITE_BACKEND_WEB_ROOT}/api/track_action.json`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status == 201) {
        setIsHidden(true);
      }

      return await res.json();
    },
  });

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
                <td>This report is likely invalid</td>
              </tr>
            )}
            <tr>
              <td>Reported at</td>
              <td>{report.reported_at.toString()}</td>
            </tr>
            {report.comments && (
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
              <td>{report.ua_string}</td>
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
            <tr>
              <td></td>
              <td className="actions">
                {trackReportActionMutation.isPending ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    {trackReportActionMutation.isError && (
                      <p>An error occurred: {trackReportActionMutation.error.message}</p>
                    )}

                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("hide");
                      }}
                    >
                      Hide report
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("investigated");
                      }}
                    >
                      Mark as actively investigated
                    </button>
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
