/**
 * Converts a `Date` object into a YYYY-MM-DD string.
 */
export function DateToYMDString(date: Date): string {
  return date.toISOString().split("T")[0];
}
