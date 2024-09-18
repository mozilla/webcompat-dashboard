import { useMutation } from "@tanstack/react-query";
import { UserReport } from "../../shared/types";
import { actionResultEntry } from "../types/action_result_entry";
import LoadingSpinner from "./loading_spinner";
import { jsonPostMutation } from "../helpers/request";
import {
  EtpStrictReportDescription,
  NewBugDefaultParams,
  OpenPrefilledBugzillaBug,
  SiteReportDescription,
} from "../helpers/bugzilla";

type ReportActionsProps = {
  report: UserReport;
  rootDomain: string;
  onActionComplete?: (result: actionResultEntry) => void;
};

export default function ReportActions({ report, rootDomain, onActionComplete }: ReportActionsProps) {
  const handleMutationSuccess = (result: actionResultEntry) => {
    if (onActionComplete) onActionComplete(result);
  };

  const trackReportActionMutation = useMutation({
    mutationFn: async (actionType: string) => {
      return await jsonPostMutation(report.uuid, "/api/track_action.json", {
        type: actionType,
      });
    },
    onSuccess: (_, variables: string) => handleMutationSuccess({ action: variables }),
  });

  const addLabelMutation = useMutation({
    mutationFn: async (label: string) => {
      return await jsonPostMutation(report.uuid, "/api/add_label.json", {
        label: label,
      });
    },
    onSuccess: (_, variables: string) => handleMutationSuccess({ action: variables, label: variables }),
  });

  return (
    <>
      {addLabelMutation.isPending || trackReportActionMutation.isPending ? (
        <tr>
          <td></td>
          <td>
            <LoadingSpinner />
          </td>
        </tr>
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
                    ["query_format", "advanced"],
                    ["resolution", "---"],
                    ["j_top", "OR"],
                    ["f1", "OP"],
                    ["o2", "equals"],
                    ["f2", "product"],
                    ["v2", "Web Compatibility"],
                    ["o3", "equals"],
                    ["f3", "component"],
                    ["v3", "Site Reports"],
                    ["f4", "CP"],
                    ["f5", "OP"],
                    ["o6", "equals"],
                    ["f6", "product"],
                    ["v6", "Web Compatibility"],
                    ["o7", "equals"],
                    ["f7", "component"],
                    ["v7", "Privacy: Site Reports"],
                    ["f8", "CP"],
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
                  searchParams.append("product", "Web Compatibility");
                  searchParams.append("component", "Site Reports");

                  searchParams.append("comment", SiteReportDescription(report));
                  OpenPrefilledBugzillaBug(searchParams);
                }}
              >
                Prepare new Site Report bug
              </button>
              <button
                onClick={() => {
                  const searchParams = NewBugDefaultParams(report, rootDomain);
                  searchParams.append("product", "Web Compatibility");
                  searchParams.append("component", "Privacy: Site Reports");
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
              {addLabelMutation.isError && <p>An error occurred: {addLabelMutation.error.message}</p>}
              {trackReportActionMutation.isError && <p>An error occurred: {trackReportActionMutation.error.message}</p>}

              <button
                onClick={() => {
                  addLabelMutation.mutate("invalid");
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
    </>
  );
}
