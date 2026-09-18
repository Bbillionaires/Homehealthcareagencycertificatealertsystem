/**
 * Shared notification-scheduling logic: given the days-before-expiration
 * milestones an org/credential type is configured for, and the current
 * days-remaining figure, decide whether *today* is a milestone day (or the
 * credential is overdue, which keeps alerting every day until renewed).
 *
 * Used by the nightly job to decide what to generate, and safe to call
 * repeatedly — pair it with a dedupe key so re-running never double-sends.
 */
export const DEFAULT_NOTIFY_SCHEDULE_DAYS = [90, 60, 30, 14, 7, 0];

export function isNotificationMilestoneDay(
  daysRemaining: number,
  scheduleDays: number[] = DEFAULT_NOTIFY_SCHEDULE_DAYS
): boolean {
  if (daysRemaining < 0) {
    // Already expired: alert every day until it's renewed.
    return true;
  }
  return scheduleDays.includes(daysRemaining);
}

export function notificationDedupeKey(
  employeeCredentialId: string,
  daysRemaining: number
): string {
  // Overdue credentials share one "overdue" bucket per day rather than one
  // key per exact day-count, so a job run at any time on an overdue day
  // still dedupes correctly against the same day's earlier run.
  const milestone = daysRemaining < 0 ? `overdue:${daysRemaining}` : `milestone:${daysRemaining}`;
  return `credential:${employeeCredentialId}:${milestone}`;
}
