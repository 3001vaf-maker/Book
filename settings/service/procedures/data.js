import { queueOperationalDataset } from '../../../core/business-persistence.js';

const KEY = 'book.procedures';
const HISTORY_KEY = 'book.procedures.history';
let proceduresState = null;
let historyState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacy(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function readRawProcedures() {
  const value = proceduresState === null ? readLegacy(KEY, []) : proceduresState;
  return Array.isArray(value) ? clone(value) : [];
}

function readHistory() {
  const value = historyState === null ? readLegacy(HISTORY_KEY, []) : historyState;
  return Array.isArray(value) ? clone(value) : [];
}

function writeProcedures(value) {
  proceduresState = Array.isArray(value) ? clone(value) : [];
  void queueOperationalDataset('procedures', proceduresState);
}

function writeHistory(value) {
  historyState = Array.isArray(value) ? clone(value) : [];
  void queueOperationalDataset('procedureHistory', historyState);
}

export function readLegacyProcedureSnapshot() {
  return {
    procedures: Array.isArray(readLegacy(KEY, [])) ? clone(readLegacy(KEY, [])) : [],
    procedureHistory: Array.isArray(readLegacy(HISTORY_KEY, [])) ? clone(readLegacy(HISTORY_KEY, [])) : [],
  };
}

export function hydrateProceduresFromServer({ procedures = [], procedureHistory = [] } = {}) {
  proceduresState = Array.isArray(procedures) ? clone(procedures) : [];
  historyState = Array.isArray(procedureHistory) ? clone(procedureHistory) : [];
  return { procedures: clone(proceduresState), procedureHistory: clone(historyState) };
}

export function getProcedures() {
  return readRawProcedures().filter((item) => !item.deletedAt);
}

export function saveProcedure(item) {
  const values = readRawProcedures();
  const exists = values.some((value) => value.id === item.id);
  writeProcedures(exists ? values.map((value) => value.id === item.id ? item : value) : [...values, item]);
  return item;
}

export function pushProcedureHistory(record, action) {
  const history = readHistory();
  history.push({ ...record, historyAction: action, historyAt: new Date().toISOString() });
  writeHistory(history);
}

export function deleteProcedure(id) {
  const values = readRawProcedures();
  const found = values.find((item) => item.id === id && !item.deletedAt);
  if (!found) return false;
  pushProcedureHistory(found, 'deleted');
  writeProcedures(values.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item));
  return true;
}
