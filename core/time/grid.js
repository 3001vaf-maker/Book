// Neutral minute-resolution time grid.
// Owns no business entities and stores no application state.
import { containsRange, isValidRange, rangesOverlap, timeToMinutes, minutesToTime } from './math.js';

const RIGIDITY_WEIGHT = Object.freeze({ soft: 1, hard: 2 });

function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

function normalizeUsage(usage = {}) {
  const from = String(usage?.from || '');
  const to = String(usage?.to || '');
  if (!isValidRange(from, to)) return null;
  const rigidity = usage?.rigidity === 'hard' ? 'hard' : 'soft';
  return {
    ...usage,
    sourceId: String(usage?.sourceId ?? usage?.id ?? ''),
    type: String(usage?.type || 'usage'),
    rigidity,
    from,
    to,
  };
}

function normalizePlan(plan = null) {
  if (!plan || !isValidRange(plan?.from, plan?.to)) return null;
  return { from: String(plan.from), to: String(plan.to) };
}

export function createTimeGrid({ date = '', workplaceId = '', plan = null, usages = [] } = {}) {
  return Object.freeze({
    date: normalizeDate(date),
    workplaceId: String(workplaceId || ''),
    plan: normalizePlan(plan),
    usages: Object.freeze((Array.isArray(usages) ? usages : []).map(normalizeUsage).filter(Boolean)),
  });
}

export function getTimeGridMinuteState(grid, time, { excludeId = '' } = {}) {
  const minute = timeToMinutes(time);
  const planStart = timeToMinutes(grid?.plan?.from);
  const planEnd = timeToMinutes(grid?.plan?.to);
  if (minute == null || planStart == null || planEnd == null || minute < planStart || minute >= planEnd) {
    return { state: 'outside-plan', rigidity: '', usage: null };
  }

  const excluded = String(excludeId || '');
  const occupied = (Array.isArray(grid?.usages) ? grid.usages : [])
    .filter((usage) => {
      if (excluded && String(usage?.sourceId || '') === excluded) return false;
      const start = timeToMinutes(usage?.from);
      const end = timeToMinutes(usage?.to);
      return start != null && end != null && start <= minute && minute < end;
    })
    .sort((left, right) => (RIGIDITY_WEIGHT[right?.rigidity] || 0) - (RIGIDITY_WEIGHT[left?.rigidity] || 0));

  const usage = occupied[0] || null;
  if (!usage) return { state: 'free', rigidity: '', usage: null };
  return { state: 'occupied', rigidity: usage.rigidity, usage };
}

export function getTimeGridRangeState(grid, { from, to, excludeId = '' } = {}) {
  if (!isValidRange(from, to)) return { ok: false, reason: 'invalid-time', conflicts: [] };
  const plan = grid?.plan;
  if (!plan) return { ok: false, reason: 'day-not-working', conflicts: [] };
  if (!containsRange(plan.from, plan.to, from, to)) return { ok: false, reason: 'outside-working-time', conflicts: [] };

  const excluded = String(excludeId || '');
  const conflicts = (Array.isArray(grid?.usages) ? grid.usages : [])
    .filter((usage) => (!excluded || String(usage?.sourceId || '') !== excluded)
      && rangesOverlap(from, to, usage?.from, usage?.to))
    .sort((left, right) => (RIGIDITY_WEIGHT[right?.rigidity] || 0) - (RIGIDITY_WEIGHT[left?.rigidity] || 0));

  return conflicts.length
    ? { ok: false, reason: 'occupied', conflicts }
    : { ok: true, reason: '', conflicts: [] };
}

export function listTimeGridAvailableStarts(grid, {
  duration = 0,
  step = 5,
  from = '',
  to = '',
  excludeId = '',
} = {}) {
  const minutes = Math.max(1, Number(duration) || 0);
  const increment = Math.max(1, Number(step) || 1);
  const planStart = timeToMinutes(grid?.plan?.from);
  const planEnd = timeToMinutes(grid?.plan?.to);
  const windowStart = timeToMinutes(from);
  const windowEnd = timeToMinutes(to);
  if (planStart == null || planEnd == null) return [];

  const start = Math.max(planStart, windowStart == null ? planStart : windowStart);
  const end = Math.min(planEnd, windowEnd == null ? planEnd : windowEnd);
  const values = [];
  for (let minute = Math.ceil(start / increment) * increment; minute + minutes <= end; minute += increment) {
    const candidateFrom = minutesToTime(minute);
    const candidateTo = minutesToTime(minute + minutes);
    if (!candidateFrom || !candidateTo) continue;
    if (getTimeGridRangeState(grid, { from: candidateFrom, to: candidateTo, excludeId }).ok) values.push(candidateFrom);
  }
  return values;
}

export function listTimeGridAvailableEnds(grid, {
  from,
  step = 5,
  to = '',
  excludeId = '',
} = {}) {
  const start = timeToMinutes(from);
  const planEnd = timeToMinutes(grid?.plan?.to);
  const windowEnd = timeToMinutes(to);
  const increment = Math.max(1, Number(step) || 1);
  if (start == null || planEnd == null) return [];
  const end = Math.min(planEnd, windowEnd == null ? planEnd : windowEnd);
  const values = [];
  for (let minute = start + increment; minute <= end; minute += increment) {
    const candidateTo = minutesToTime(minute);
    if (!candidateTo) continue;
    if (getTimeGridRangeState(grid, { from, to: candidateTo, excludeId }).ok) values.push(candidateTo);
  }
  return values;
}
