// WorkPlan Day persistence gateway.
// Storage only: no schedule rules, time calculations, occupancy or UI decisions.
const TIMETABLE_STATE_KEY = 'book:timetable-state';

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeState(state) {
  localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify(state || { workingDays: [] }));
}

export function getDayRows() {
  const state = readState();
  return (Array.isArray(state.workingDays) ? state.workingDays : []).map((row) => clone(row));
}

export function replaceDayRows(rows = []) {
  const stored = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  writeState({ workingDays: stored });
  return stored.map((row) => clone(row));
}
