/**
 * Returns either a singular or a plural version of a word given a counter. Note
 * that this function assumes that the entire world speaks English.
 */
export function Pluralize(count: number, singular: string, plural: string): string {
  return count == 1 ? singular : plural;
}
