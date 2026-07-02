// ─────────────────────────────────────────────────────────────
// SLA Helpers – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import {
  addMinutes,
  differenceInMinutes,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
  getDay,
  addDays,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

import type { LeadTier, SLAStatus } from '../types/lead';
import type { BusinessHours, SLAConfig } from '../types/settings';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_SLA_CONFIG } from './constants';

// ── Internal Helpers ─────────────────────────────────────────

/** Map JS getDay() (0=Sun) → schedule index (0=Mon) */
const JS_DAY_TO_SCHEDULE: Record<number, number> = {
  0: 6, // Sunday
  1: 0, // Monday
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5, // Saturday
};

/**
 * Parse a time string like "09:00" into { hours, minutes }.
 */
function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

/**
 * Set hours and minutes on a date (in the business timezone).
 */
function setTimeOnDate(date: Date, time: string): Date {
  const { hours, minutes } = parseTime(time);
  return setMinutes(setHours(date, hours), minutes);
}

/**
 * Get the number of remaining business minutes in the current day,
 * starting from `currentTime`. Returns 0 if outside business hours.
 */
function getRemainingMinutesToday(
  zonedNow: Date,
  scheduleIndex: number,
  businessHours: BusinessHours,
): number {
  const daySchedule = businessHours.schedule[scheduleIndex];
  if (!daySchedule || !daySchedule.enabled) return 0;

  const dayStart = setTimeOnDate(zonedNow, daySchedule.start);
  const dayEnd = setTimeOnDate(zonedNow, daySchedule.end);

  if (isBefore(zonedNow, dayStart) || isAfter(zonedNow, dayEnd)) return 0;

  return Math.max(0, differenceInMinutes(dayEnd, zonedNow));
}

/**
 * Find the next business-day opening datetime (zoned).
 */
function getNextBusinessOpen(
  zonedNow: Date,
  businessHours: BusinessHours,
): Date {
  let cursor = addDays(zonedNow, 1);

  // Search up to 7 days ahead to find next enabled day
  for (let i = 0; i < 7; i++) {
    const jsDay = getDay(cursor);
    const schedIdx = JS_DAY_TO_SCHEDULE[jsDay];
    const daySchedule = businessHours.schedule[schedIdx];

    if (daySchedule && daySchedule.enabled) {
      return setTimeOnDate(cursor, daySchedule.start);
    }
    cursor = addDays(cursor, 1);
  }

  // Fallback: next day at 09:00
  return setTimeOnDate(addDays(zonedNow, 1), '09:00');
}

/**
 * Get the number of SLA minutes for a given tier.
 */
function getSLAMinutesForTier(tier: LeadTier, slaConfig: SLAConfig): number {
  switch (tier) {
    case 'hot':
      return slaConfig.hotLeadMinutes;
    case 'warm':
      return slaConfig.warmLeadMinutes;
    case 'cold':
    default:
      return slaConfig.coldLeadMinutes;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Calculate the SLA deadline by adding business-hours minutes to `createdAt`.
 *
 * If the lead arrives outside business hours the clock starts at the
 * next business-day opening. Minutes roll over across days.
 */
export function calculateSLADeadline(
  createdAt: Date,
  tier: LeadTier,
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  slaConfig: SLAConfig = DEFAULT_SLA_CONFIG,
): Date {
  const tz = businessHours.timezone;
  let remainingMinutes = getSLAMinutesForTier(tier, slaConfig);

  // Convert to business timezone
  let zonedNow = toZonedTime(createdAt, tz);

  // If currently outside business hours, jump to next opening
  const jsDay = getDay(zonedNow);
  const schedIdx = JS_DAY_TO_SCHEDULE[jsDay];
  const todaySchedule = businessHours.schedule[schedIdx];

  if (!todaySchedule || !todaySchedule.enabled) {
    zonedNow = getNextBusinessOpen(zonedNow, businessHours);
  } else {
    const dayStart = setTimeOnDate(zonedNow, todaySchedule.start);
    const dayEnd = setTimeOnDate(zonedNow, todaySchedule.end);

    if (isBefore(zonedNow, dayStart)) {
      zonedNow = dayStart;
    } else if (isAfter(zonedNow, dayEnd)) {
      zonedNow = getNextBusinessOpen(zonedNow, businessHours);
    }
  }

  // Consume minutes across business days
  while (remainingMinutes > 0) {
    const currentJsDay = getDay(zonedNow);
    const currentSchedIdx = JS_DAY_TO_SCHEDULE[currentJsDay];
    const available = getRemainingMinutesToday(
      zonedNow,
      currentSchedIdx,
      businessHours,
    );

    if (available >= remainingMinutes) {
      // Deadline falls within today
      zonedNow = addMinutes(zonedNow, remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Consume today's remaining minutes and roll to next day
      remainingMinutes -= available;
      zonedNow = getNextBusinessOpen(zonedNow, businessHours);
    }
  }

  // Convert back from zoned time to UTC
  return fromZonedTime(zonedNow, tz);
}

/**
 * Determine SLA health based on the deadline and whether the lead
 * has been contacted.
 */
export function getSLAStatus(
  deadline: Date | null,
  contactedAt: Date | null,
): SLAStatus {
  if (!deadline) return 'ok';
  if (contactedAt && isBefore(contactedAt, deadline)) return 'ok';

  const now = new Date();

  if (isAfter(now, deadline)) return 'overdue';

  const remaining = differenceInMinutes(deadline, now);

  if (remaining <= 15) return 'warning';

  return 'ok';
}

/**
 * Human-readable SLA countdown.
 *
 * Examples:
 * - "15m left"
 * - "2h 30m left"
 * - "Overdue by 1h"
 * - "Overdue by 2h 15m"
 */
export function formatSLARemaining(deadline: Date | null): string {
  if (!deadline) return '—';

  const now = new Date();
  const diff = differenceInMinutes(deadline, now);

  if (diff <= 0) {
    const overdue = Math.abs(diff);
    const hours = Math.floor(overdue / 60);
    const mins = overdue % 60;
    if (hours === 0) return `Overdue by ${mins}m`;
    if (mins === 0) return `Overdue by ${hours}h`;
    return `Overdue by ${hours}h ${mins}m`;
  }

  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours === 0) return `${mins}m left`;
  if (mins === 0) return `${hours}h left`;
  return `${hours}h ${mins}m left`;
}
