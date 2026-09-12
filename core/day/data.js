// WorkPlan Day persistence gateway.
// Storage only: no schedule rules, time calculations, occupancy or UI decisions.
import { queueOperationalDataset } from '../business-persistence.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';
let dayRowsState = null;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readLegacyState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function legacyRows() {
  const state = readLegacyState();
  return (Array.isArray(state.workingDays) ? state.workingDays : []).map((row) => clone(row));
}

export function readLegacyDaySnapshot() {
  return legacyRows();
}

export function hydrateDaysFromServer(rows = []) {
  dayRowsState = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  return dayRowsState.map((row) => clone(row));
}

export function getDayRows() {
  const rows = dayRowsState === null ? legacyRows() : dayRowsState;
  return rows.map((row) => clone(row));
}

export function replaceDayRows(rows = []) {
  const stored = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  if (dayRowsState === null) {
    localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify({ workingDays: stored }));
  } else {
    dayRowsState = stored.map((row) => clone(row));
    void queueOperationalDataset('days', dayRowsState);
  }
  return stored.map((row) => clone(row));
}
