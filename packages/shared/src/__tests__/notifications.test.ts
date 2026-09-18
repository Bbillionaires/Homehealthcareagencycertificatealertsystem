import { describe, expect, it } from "vitest";
import { isNotificationMilestoneDay, notificationDedupeKey, DEFAULT_NOTIFY_SCHEDULE_DAYS } from "../notifications";

describe("isNotificationMilestoneDay", () => {
  it("matches configured milestone days", () => {
    for (const days of DEFAULT_NOTIFY_SCHEDULE_DAYS) {
      expect(isNotificationMilestoneDay(days)).toBe(true);
    }
  });

  it("does not match a non-milestone day", () => {
    expect(isNotificationMilestoneDay(45)).toBe(false);
  });

  it("keeps alerting every day once overdue", () => {
    expect(isNotificationMilestoneDay(-1)).toBe(true);
    expect(isNotificationMilestoneDay(-15)).toBe(true);
  });
});

describe("notificationDedupeKey", () => {
  it("is stable for the same credential and day count (idempotent reruns)", () => {
    const a = notificationDedupeKey("cred-1", 30);
    const b = notificationDedupeKey("cred-1", 30);
    expect(a).toBe(b);
  });

  it("differs across credentials or day counts", () => {
    expect(notificationDedupeKey("cred-1", 30)).not.toBe(notificationDedupeKey("cred-2", 30));
    expect(notificationDedupeKey("cred-1", 30)).not.toBe(notificationDedupeKey("cred-1", 14));
  });

  it("buckets overdue days separately from future milestones", () => {
    expect(notificationDedupeKey("cred-1", -1)).not.toBe(notificationDedupeKey("cred-1", 1));
  });
});
