import { UserReport } from "../../shared/types";

/**
 * Used here only to un-indent multi-line strings, because I refuse to have
 * the description templates strings in here with weird indentations.
 */
function trimStartAll(input: string): string {
  return input
    .split("\n")
    .map((l) => l.trimStart())
    .join("\n");
}

/**
 * Builds the default URLSearchParams used to file a new bug and returns it so
 * it can be extended.
 */
export function NewBugDefaultParams(report: UserReport, rootDomain: string): URLSearchParams {
  return new URLSearchParams([
    ["bug_file_loc", report.url],
    ["component", "Site Reports"],
    ["op_sys", `${report.os}`],
    ["product", "Web Compatibility"],
    ["rep_platform", "Desktop"],
    ["short_desc", `${rootDomain} - CHANGE_ME`],
    ["status_whiteboard", "[webcompat-source:product]"],
    ["version", `Firefox ${report.app_major_version}`],
  ]);
}

/**
 * Opens a new tab/window to Bugzilla with a prefilled bug form
 */
export function OpenPrefilledBugzillaBug(searchParams: URLSearchParams) {
  const url = new URL("https://bugzilla.mozilla.org/enter_bug.cgi");
  url.search = searchParams.toString();
  window.open(url.toString(), "_blank");
}

/**
 * Generates a pre-filled Bugzilla comment for a Site Report issue
 */
export function SiteReportDescription(report: UserReport): string {
  return trimStartAll(`**Environment:**
    Operating system: ${report.os}
    Firefox version: ${report.app_name} ${report.app_version} (${report.app_channel})

    **Preconditions:**
    - Clean profile

    **Steps to reproduce:**
    1. Navigate to: ${report.url}
    2. Step 2

    **Expected Behavior:**
    text

    **Actual Behavior:**
    text

    **Notes:**
    - Reproducible on the latest Firefox Release and Nightly
    - Reproducible regardless of the ETP setting
    - Works as expected using Chrome

    ---

    Created from webcompat-user-report:${report.uuid}`);
}

/**
 * Generates a pre-filled Bugzilla comment for a ETP Strict compat issue
 */
export function EtpStrictReportDescription(report: UserReport): string {
  return trimStartAll(`**Environment:**
    Operating system: ${report.os}
    Firefox version: ${report.app_name} ${report.app_version} (${report.app_channel})

    **Preconditions:**
    - ETP set to STRICT
    - Clean profile

    **Steps to reproduce:**
    1. Navigate to: ${report.url}
    2. Step 2

    **Expected Behavior:**
    text

    **Actual Behavior:**
    text

    **Notes:**
    - Not reproduciblewith ETP STANDARD/turned OFF (both Normal and Private Browsing)
    - Reproducible on the latest Nightly

    ---

    Created from webcompat-user-report:${report.uuid}`);
}
