/**
 * Returns true when endTime is set and endTime <= startTime (HH:mm strings).
 * Returns false when either value is empty/nullish.
 */
export function isEndTimeNotAfterStart(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  return endTime <= startTime;
}
