import {
  addMinutes, addHours, isAfter, isBefore, setHours, setMinutes,
  getDay, differenceInMinutes, startOfDay, format,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { LeadTier } from '../types/lead';

const TIMEZONE = 'America/New_York';

interface DaySchedule {
  day: string;
  start: string; // "09:00"
  end: string;   // "18:00"
  enabled: boolean;
}

interface BusinessHours {
  timezone: string;
  schedule: DaySchedule[];
}

interface SLAConfig {
  hotLeadMinutes: number;
  warmLeadMinutes: number;
  coldLeadMinutes: number;
}

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 'Sunday', start: '09:00', end: '18:00', enabled: false },
  { day: 'Monday', start: '09:00', end: '18:00', enabled: true },
  { day: 'Tuesday', start: '09:00', end: '18:00', enabled: true },
  { day: 'Wednesday', start: '09:00', end: '18:00', enabled: true },
  { day: 'Thursday', start: '09:00', end: '18:00', enabled: true },
  { day: 'Friday', start: '09:00', end: '18:00', enabled: true },
  { day: 'Saturday', start: '09:00', end: '18:00', enabled: false },
];

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: TIMEZONE,
  schedule: DEFAULT_SCHEDULE,
};

const DEFAULT_SLA: SLAConfig = {
  hotLeadMinutes: 30,
  warmLeadMinutes: 1440, // 24 hours
  coldLeadMinutes: 480,  // 8 hours
};

function getSLAMinutes(tier: LeadTier, slaConfig: SLAConfig = DEFAULT_SLA): number {
  switch (tier) {
    case 'hot': return slaConfig.hotLeadMinutes;
    case 'warm': return slaConfig.warmLeadMinutes;
    case 'cold': return slaConfig.coldLeadMinutes;
    default: return slaConfig.coldLeadMinutes;
  }
}

function getDaySchedule(date: Date, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): DaySchedule | null {
  const dayIndex = getDay(date); // 0=Sun, 1=Mon, ...
  const schedule = businessHours.schedule[dayIndex];
  return schedule && schedule.enabled ? schedule : null;
}

function getStartOfBusinessDay(date: Date, schedule: DaySchedule): Date {
  const [startHour, startMin] = schedule.start.split(':').map(Number);
  return setMinutes(setHours(startOfDay(date), startHour), startMin);
}

function getEndOfBusinessDay(date: Date, schedule: DaySchedule): Date {
  const [endHour, endMin] = schedule.end.split(':').map(Number);
  return setMinutes(setHours(startOfDay(date), endHour), endMin);
}

function getNextBusinessDayStart(date: Date, businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS): Date {
  let current = addHours(startOfDay(date), 24);
  for (let i = 0; i < 10; i++) {
    const schedule = getDaySchedule(current, businessHours);
    if (schedule) {
      return getStartOfBusinessDay(current, schedule);
    }
    current = addHours(startOfDay(current), 24);
  }
  // Fallback: return next day 9 AM
  return setMinutes(setHours(addHours(startOfDay(date), 24), 9), 0);
}

export function calculateSLADeadline(
  createdAt: Date,
  tier: LeadTier,
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  slaConfig: SLAConfig = DEFAULT_SLA,
): Date {
  const tz = businessHours.timezone || TIMEZONE;
  let remainingMinutes = getSLAMinutes(tier, slaConfig);
  let current = toZonedTime(createdAt, tz);

  for (let safety = 0; safety < 100 && remainingMinutes > 0; safety++) {
    const schedule = getDaySchedule(current, businessHours);

    if (!schedule) {
      // Not a business day — advance to next business day
      current = getNextBusinessDayStart(current, businessHours);
      continue;
    }

    const dayStart = getStartOfBusinessDay(current, schedule);
    const dayEnd = getEndOfBusinessDay(current, schedule);

    if (isBefore(current, dayStart)) {
      // Before business hours — move to start
      current = dayStart;
    }

    if (isAfter(current, dayEnd) || current >= dayEnd) {
      // After business hours — move to next business day
      current = getNextBusinessDayStart(current, businessHours);
      continue;
    }

    // We're within business hours
    const minutesLeftInDay = differenceInMinutes(dayEnd, current);

    if (remainingMinutes <= minutesLeftInDay) {
      // Deadline falls within this business day
      const deadline = addMinutes(current, remainingMinutes);
      return fromZonedTime(deadline, tz);
    }

    // Consume remaining business minutes for this day
    remainingMinutes -= minutesLeftInDay;
    current = getNextBusinessDayStart(current, businessHours);
  }

  // Fallback
  return fromZonedTime(addMinutes(current, remainingMinutes), tz);
}
