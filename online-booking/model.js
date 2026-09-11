import { createTimeGrid, listTimeGridAvailableStarts, timeToMinutes, minutesToTime } from '../core/time/index.js';

function key(value) {
  return String(value || '');
}

export function getBookingWorkplace(context = {}, workplaceKey = '') {
  const target = key(workplaceKey);
  return (Array.isArray(context.workplaces) ? context.workplaces : [])
    .find((item) => key(item?.key) === target) || null;
}

export function procedureWorkplaceAssignment(procedure = {}, workplaceKey = '') {
  const target = key(workplaceKey);
  return (Array.isArray(procedure.workplaces) ? procedure.workplaces : [])
    .find((item) => key(item?.workplaceId ?? item?.key ?? item?.id) === target) || null;
}

export function getBookingProcedures(context = {}, workplaceKey = '') {
  return (Array.isArray(context.procedures) ? context.procedures : [])
    .filter((procedure) => procedureWorkplaceAssignment(procedure, workplaceKey));
}

export function bookingProcedureCost(procedure = {}, workplaceKey = '') {
  const assignment = procedureWorkplaceAssignment(procedure, workplaceKey);
  const assigned = assignment?.cost;
  const base = procedure?.cost;
  const hasAssigned = assigned && typeof assigned === 'object' && !assigned.free && (
    assigned.amount !== '' && assigned.amount != null
    || assigned.from !== '' && assigned.from != null
    || assigned.to !== '' && assigned.to != null
  );
  const cost = hasAssigned ? assigned : base;
  if (cost == null || cost?.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

export function bookingSelection(context = {}, workplaceKey = '', ids = []) {
  const selected = new Set((Array.isArray(ids) ? ids : []).map(key));
  return getBookingProcedures(context, workplaceKey).filter((procedure) => selected.has(key(procedure.id)));
}

export function bookingDuration(context = {}, workplaceKey = '', ids = []) {
  return bookingSelection(context, workplaceKey, ids)
    .reduce((sum, procedure) => sum + Math.max(0, Number(procedure.duration || 0)), 0);
}

export function getBookingWorkingDates(context = {}, workplaceKey = '', { fromDate = '' } = {}) {
  const target = key(workplaceKey);
  const minimum = String(fromDate || '').slice(0, 10);
  return [...new Set((Array.isArray(context.days) ? context.days : [])
    .filter((day) => key(day?.workplaceId) === target)
    .map((day) => String(day?.date || '').slice(0, 10))
    .filter((date) => date && (!minimum || date >= minimum)))]
    .sort();
}

export function getBookingDayPlan(context = {}, workplaceKey = '', date = '') {
  const target = key(workplaceKey);
  const dayKey = String(date || '').slice(0, 10);
  const day = (Array.isArray(context.days) ? context.days : [])
    .find((item) => key(item?.workplaceId) === target && String(item?.date || '').slice(0, 10) === dayKey);
  if (!day) return null;
  const workplace = getBookingWorkplace(context, target);
  const from = String(day.from || workplace?.from || '');
  const to = String(day.to || workplace?.to || '');
  return from && to ? { from, to } : null;
}

export function getBookingOccupancy(context = {}, workplaceKey = '', date = '') {
  const target = key(workplaceKey);
  const dayKey = String(date || '').slice(0, 10);
  return (Array.isArray(context.occupancy) ? context.occupancy : [])
    .filter((item) => key(item?.workplaceId) === target && String(item?.date || '').slice(0, 10) === dayKey)
    .map((item) => ({
      sourceId: key(item?.id),
      type: String(item?.type || 'usage'),
      rigidity: 'hard',
      from: String(item?.from || ''),
      to: String(item?.to || ''),
    }));
}

export function getBookingSlots(context = {}, { workplaceKey = '', date = '', procedureIds = [], step = 15 } = {}) {
  const duration = bookingDuration(context, workplaceKey, procedureIds);
  const plan = getBookingDayPlan(context, workplaceKey, date);
  if (!plan || duration <= 0) return [];
  const grid = createTimeGrid({
    date,
    workplaceId: workplaceKey,
    plan,
    usages: getBookingOccupancy(context, workplaceKey, date),
  });
  return listTimeGridAvailableStarts(grid, { duration, step }).map((from) => ({
    from,
    to: minutesToTime((timeToMinutes(from) ?? 0) + duration),
  }));
}

export function requiredBookingDocuments(context = {}) {
  return (Array.isArray(context.documents) ? context.documents : []).filter((document) => Boolean(document?.clientConsent));
}

export function hasRequiredBookingConsents(context = {}, consents = []) {
  const accepted = Array.isArray(consents) ? consents : [];
  return requiredBookingDocuments(context).filter((document) => document.required).every((document) => accepted.some((fact) => (
    String(fact?.documentId || '') === String(document.id || '')
    && Number(fact?.documentVersion || 1) === Number(document.version || 1)
    && Boolean(fact?.accepted)
  )));
}
