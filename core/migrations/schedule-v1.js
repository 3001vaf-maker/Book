import { createDay, getDay, saveDays } from '../day.js';
import { isValidRange } from '../time.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';
const LEGACY_TIME_WORKS_KEY = 'book.timeWorks';

function parseObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function dateValue(value) { return String(value || '').slice(0, 10); }
function workplaceIdValue(value) { return String(value || ''); }

function workplaceFor(workplaces, workplaceId) {
  return (Array.isArray(workplaces) ? workplaces : []).find((item) => workplaceIdValue(item?.key) === workplaceIdValue(workplaceId)) || null;
}

function legacyTimeFor(legacyTimeWorks, workplaceId, date) {
  return (Array.isArray(legacyTimeWorks) ? legacyTimeWorks : []).find((item) =>
    workplaceIdValue(item?.workplaceId) === workplaceIdValue(workplaceId)
    && dateValue(item?.date) === dateValue(date)
    && isValidRange(item?.from, item?.to)
  ) || null;
}

function normalizedDay(day, workplaces, legacyTimeWorks) {
  const workplaceId = workplaceIdValue(day?.workplaceId);
  const date = dateValue(day?.date);
  if (!workplaceId || !date) return null;

  if (isValidRange(day?.from, day?.to)) {
    return { ...day, workplaceId, date, from: String(day.from), to: String(day.to) };
  }

  const legacy = legacyTimeFor(legacyTimeWorks, workplaceId, date);
  if (legacy) return { ...day, workplaceId, date, from: String(legacy.from), to: String(legacy.to) };

  const workplace = workplaceFor(workplaces, workplaceId);
  if (isValidRange(workplace?.from, workplace?.to)) {
    return { ...day, workplaceId, date, from: String(workplace.from), to: String(workplace.to) };
  }

  return { ...day, workplaceId, date };
}

function addIfMissing(days, candidate) {
  if (!candidate?.workplaceId || !candidate?.date) return;
  if (getDay(days, candidate.workplaceId, candidate.date)) return;
  days.push(candidate);
}

export function migrateScheduleV1(workplaces = []) {
  try {
    const state = parseObject(localStorage.getItem(TIMETABLE_STATE_KEY));
    if (!state) return { migrated: false, reason: 'invalid-state' };

    const legacyTimeWorks = parseList(localStorage.getItem(LEGACY_TIME_WORKS_KEY));
    const legacyDates = Array.isArray(state.workingDates) ? state.workingDates.map(dateValue).filter(Boolean) : [];
    const existingDays = Array.isArray(state.workingDays) ? state.workingDays : [];

    const hasIncompleteDay = existingDays.some((day) => !isValidRange(day?.from, day?.to));
    const hasLegacy = legacyDates.length > 0 || legacyTimeWorks.length > 0;
    if (!hasLegacy && !hasIncompleteDay) return { migrated: false, reason: 'already-canonical' };

    const days = existingDays.map((day) => normalizedDay(day, workplaces, legacyTimeWorks)).filter(Boolean);
    const defaultWorkplaceId = workplaceIdValue(workplaces?.[0]?.key);

    for (const item of legacyTimeWorks) {
      const workplaceId = workplaceIdValue(item?.workplaceId);
      const date = dateValue(item?.date);
      if (!workplaceId || !date || !isValidRange(item?.from, item?.to)) continue;
      addIfMissing(days, createDay({ workplaceId, date, from: item.from, to: item.to }));
    }

    if (defaultWorkplaceId) {
      const workplace = workplaceFor(workplaces, defaultWorkplaceId);
      for (const date of legacyDates) {
        if (getDay(days, defaultWorkplaceId, date)) continue;
        const legacy = legacyTimeFor(legacyTimeWorks, defaultWorkplaceId, date);
        const from = legacy?.from || workplace?.from;
        const to = legacy?.to || workplace?.to;
        if (isValidRange(from, to)) addIfMissing(days, createDay({ workplaceId: defaultWorkplaceId, date, from, to }));
        else addIfMissing(days, { workplaceId: defaultWorkplaceId, date });
      }
    }

    saveDays(days);
    localStorage.removeItem(LEGACY_TIME_WORKS_KEY);
    return { migrated: true, days: days.length };
  } catch {
    return { migrated: false, reason: 'migration-failed' };
  }
}
