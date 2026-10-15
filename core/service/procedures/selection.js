export function procedureWorkplaceAssignment(procedure = {}, workplaceId = '') {
  const target = String(workplaceId || '');
  return (Array.isArray(procedure?.workplaces) ? procedure.workplaces : [])
    .find((item) => String(item?.workplaceId ?? item?.key ?? item?.id ?? '') === target) || null;
}

export function procedureForWorkplace(procedure = {}, workplaceId = '') {
  return Boolean(procedureWorkplaceAssignment(procedure, workplaceId));
}

export function proceduresForWorkplace(procedures = [], workplaceId = '') {
  return (Array.isArray(procedures) ? procedures : []).filter((procedure) => procedureForWorkplace(procedure, workplaceId));
}

export function procedureCostForWorkplace(procedure = {}, workplaceId = '') {
  const assignment = procedureWorkplaceAssignment(procedure, workplaceId);
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
