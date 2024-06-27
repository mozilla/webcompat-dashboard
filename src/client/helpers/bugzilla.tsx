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
 * Generates a pre-filled Bugzilla comment for a Site Report issue
 */
export function SiteReportDescription(report: UserReport): string {
  return trimStartAll(`**Environment:**
    Operating system:
    Firefox version:

    **Preconditions:**
    text

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
    Operating system:
    Firefox version:

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
