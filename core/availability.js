// Canonical availability queries over WorkPlan + neutral TimeGrid + occupancy sources.
// UI and business entities ask this module; they do not rebuild time availability themselves.
import { getDay, getDayTime, getDays } from './day.js';
import { getWorkplaces } from './workplace-time.js';
import { getTimeUsagesForScope } from './time-usage.js';
import {
  createTimeGrid,
  getTimeGridMinuteState,
  getTimeGridRangeState,
  listTimeGridAvailableEnds,
  listTimeGridAvailableStarts,
} from './time-grid.js';

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

export function getAvailabilityGrid({ date, workplaceId } = {}) {
  const day = dateKey(date);
  const workplace = String(workplaceId || '');
  const workingDay = getDay(getDays(), workplace, day);
  const plan = getDayTime(workingDay, getWorkplaces());
  const usages = getTimeUsagesForScope({ date: day, workplaceId: workplace });
  return createTimeGrid({ date: day, workplaceId: workplace, plan, usages });
}

export function checkTimeAvailability({ date, workplaceId, from, to, excludeId = '' } = {}) {
  const grid = getAvailabilityGrid({ date, workplaceId });
  return { ...getTimeGridRangeState(grid, { from, to, excludeId }), grid };
}

export function getTimeAvailabilityAt({ date, workplaceId, time, excludeId = '' } = {}) {
  const grid = getAvailabilityGrid({ date, workplaceId });
  return { ...getTimeGridMinuteState(grid, time, { excludeId }), grid };
}

export function listAvailableStartTimes({
  date,
  workplaceId,
  duration,
  step = 5,
  from = '',
  to = '',
  excludeId = '',
} = {}) {
  const grid = getAvailabilityGrid({ date, workplaceId });
  return listTimeGridAvailableStarts(grid, { duration, step, from, to, excludeId });
}

export function listAvailableEndTimes({
  date,
  workplaceId,
  from,
  step = 5,
  to = '',
  excludeId = '',
} = {}) {
  const grid = getAvailabilityGrid({ date, workplaceId });
  return listTimeGridAvailableEnds(grid, { from, step, to, excludeId });
}
