import { useMutation } from "@tanstack/react-query";
import { ClassifiedReport } from "../../shared/types";
import { useState } from "react";
import { jsonPostMutation } from "../helpers/request";
import { GetReadableAction } from "../helpers/language";
import LoadingSpinner from "./loading_spinner";
import ReportActions from "./report_actions";
import { actionResultEntry } from "../types/action_result_entry";

type ClassifiedReportContentsProps = {
  index: number;
  report: ClassifiedReport;
};

export default function ClassifiedReportContents({ index, report }: ClassifiedReportContentsProps) {
  const [labels, setLabels] = useState(report.labels);
  const [action, setAction] = useState(report.action);
  const [expanded, setExpanded] = useState(false);

  const handleOnActionComplete = (mutationResult: actionResultEntry) => {
    if ("label" in mutationResult) {
      handleAddLabelSuccess(mutationResult.label);
    }

    if ("action" in mutationResult) {
      handleSetActionSuccess(mutationResult.action);
    }
  };

  const handleAddLabelSuccess = (newLabel) => {
    setLabels([...labels, newLabel]);
  };

  const handleSetActionSuccess = (newAction) => {
    setAction(newAction);
  };

  const predictionClassName = predictClassName(report.prediction, report.prob);

  const addLabelMutation = useMutation({
    mutationFn: async (label: string) => {
      return await jsonPostMutation(report.uuid, "/api/add_label.json", {
        label: label,
      });
    },
    onSuccess: (_, variables) => handleOnActionComplete({ action: variables, label: variables }),
  });

  function predictClassName(prediction, probability) {
    if (prediction === "valid" && probability > 0.6) {
      return "valid";
    } else if (prediction === "invalid" && probability > 0.8) {
      return "invalid";
    }
    return "inconclusive";
  }

  const shouldShowTranslation = report.translated_comments && report.translated_from && report.translated_from != "en";
  const itemStyle: React.CSSProperties = action === "hide" ? { display: "none" } : {};

  return (
    <tr key={report.uuid} className="report" style={itemStyle}>
      <td className="toggle">
        <button className="toggle-area" onClick={() => setExpanded(!expanded)}>
          {expanded ? "-" : "+"}
        </button>
      </td>
      <td className="index">{index}</td>
      <td className="domain toggle-area" onClick={() => setExpanded(!expanded)}>
        {report.root_domain}
      </td>
      <td className="comments">
        <div className="toggle-area" onClick={() => setExpanded(!expanded)}>
          {report.comments && shouldShowTranslation ? (
            <span> {report.translated_comments} </span>
          ) : (
            <span> {report.comments} </span>
          )}
        </div>
        {expanded && report.translated_comments && (
          <table className="classified-details">
            <tbody>
              {report.comments && shouldShowTranslation && (
                <tr>
                  <td>
                    <i>(text was translated from {report.translated_from})</i>
                  </td>
                </tr>
              )}
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
              <tr>
                <td>Reported at</td>
                <td>{report.reported_at.toString()}</td>
              </tr>
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
              {action ? (
                <tr>
                  <td>Actions</td>
                  <td> This report has been marked as {GetReadableAction(action)} </td>
                </tr>
              ) : (
                <ReportActions
                  report={report}
                  rootDomain={report.root_domain}
                  onActionComplete={handleOnActionComplete}
                />
              )}
            </tbody>
          </table>
        )}
      </td>
      <td className={`prediction ${predictionClassName}`}> {report.prediction} </td>
      <td className="probability"> {(report.prob * 100).toFixed(2) + "%"} </td>
      <td className="action-buttons">
        {addLabelMutation.isPending ? (
          <LoadingSpinner />
        ) : (
          <>
            {labels.length ? (
              <span> {labels.join(", ")} </span>
            ) : (
              <>
                {addLabelMutation.isError && <p>An error occurred: {addLabelMutation.error.message}</p>}

                <button
                  className="action-valid"
                  title="label as valid"
                  onClick={() => {
                    addLabelMutation.mutate("valid");
                  }}
                >
                  v
                </button>
                <button
                  className="action-invalid"
                  title="label as invalid"
                  onClick={() => {
                    addLabelMutation.mutate("invalid");
                  }}
                >
                  x
                </button>
              </>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
