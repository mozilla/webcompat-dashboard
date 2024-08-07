import { useMutation } from "@tanstack/react-query";
import { UserReport } from "../../shared/types";
import { useState } from "react";
import LoadingSpinner from "./loading_spinner";
import {
  EtpStrictReportDescription,
  NewBugDefaultParams,
  OpenPrefilledBugzillaBug,
  SiteReportDescription,
} from "../helpers/bugzilla";

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

  const jsonPostMutation = async (endpoint: string, additionalBodyFields?: any) => {
    const payload = Object.assign(
      {},
      {
        report_uuid: report.uuid,
      },
      additionalBodyFields,
    );

    const res = await fetch(`${import.meta.env.VITE_BACKEND_WEB_ROOT}${endpoint}`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status == 201) {
      setIsHidden(true);
      return await res.json();
    } else {
      const body = await res.text();
      throw new Error(`Unexpected status code: ${res.status}, body: "${body}"`);
    }
  };

  const trackReportActionMutation = useMutation({
    mutationFn: async (actionType: string) => {
      return await jsonPostMutation("/api/track_action.json", {
        type: actionType,
      });
    },
  });

  const markInvalidMutation = useMutation({
    mutationFn: async () => {
      return await jsonPostMutation("/api/mark_invalid.json");
    },
  });

  const shouldShowTranslation = report.translated_comments && report.translated_from && report.translated_from != "en";

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

            {markInvalidMutation.isPending || trackReportActionMutation.isPending ? (
              <LoadingSpinner />
            ) : (
              <>
                <tr>
                  <td></td>
                  <td className="actions">
                    <button
                      onClick={() => {
                        const searchParams = new URLSearchParams([
                          ["bug_file_loc_type", "allwordssubstr"],
                          ["bug_file_loc", rootDomain],
                          ["component", "Site Reports"],
                          ["product", "Web Compatibility"],
                          ["query_format", "advanced"],
                          ["resolution", "---"],
                        ]);

                        const url = new URL("https://bugzilla.mozilla.org/buglist.cgi");
                        url.search = searchParams.toString();
                        window.open(url.toString(), "_blank");
                      }}
                    >
                      List open bugs for domain
                    </button>
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td className="actions">
                    <button
                      onClick={() => {
                        const searchParams = NewBugDefaultParams(report, rootDomain);
                        searchParams.append("comment", SiteReportDescription(report));
                        OpenPrefilledBugzillaBug(searchParams);
                      }}
                    >
                      Prepare new Site Report bug
                    </button>
                    <button
                      onClick={() => {
                        const searchParams = NewBugDefaultParams(report, rootDomain);
                        searchParams.append("comment", EtpStrictReportDescription(report));
                        searchParams.append("dependson", "tp-breakage");
                        OpenPrefilledBugzillaBug(searchParams);
                      }}
                    >
                      Prepare new ETP Strict bug
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("filed");
                      }}
                    >
                      Mark as "filed on Bugzilla"
                    </button>
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td className="actions">
                    {markInvalidMutation.isError && <p>An error occurred: {markInvalidMutation.error.message}</p>}
                    {trackReportActionMutation.isError && (
                      <p>An error occurred: {trackReportActionMutation.error.message}</p>
                    )}

                    <button
                      onClick={() => {
                        markInvalidMutation.mutate();
                      }}
                    >
                      Mark as invalid/spam
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("not_actionable");
                      }}
                    >
                      Mark as "not actionable"
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("worksforme");
                      }}
                    >
                      Mark as "worksforme"
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("duplicate");
                      }}
                    >
                      Mark as "duplicate"
                    </button>
                    <button
                      onClick={() => {
                        trackReportActionMutation.mutate("hide");
                      }}
                    >
                      Hide report
                    </button>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </td>
    </tr>
  );
}
