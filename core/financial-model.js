import { getDDSMovements, getDDSMovementsForSource } from './dds.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const clampPercent = (value) => Math.max(0, Math.min(100, numberValue(value)));

function discountMode(item = {}, defaultPercent = 0) {
  if (item?.discountMode === 'percent' || item?.discountMode === 'money' || item?.discountMode === 'none') return item.discountMode;
  if (item?.discountPercent !== '' && item?.discountPercent != null && clampPercent(item.discountPercent) > 0) return 'percent';
  if (item?.discountMoney !== '' && item?.discountMoney != null && numberValue(item.discountMoney) > 0) return 'money';
  return defaultPercent > 0 ? 'percent' : 'none';
}

export function calculateFinancialPlan(items = [], { discountPercent = 0 } = {}) {
  const defaultPercent = clampPercent(discountPercent);
  const prepared = (Array.isArray(items) ? items : []).map((item) => {
    const price = Math.max(0, numberValue(item?.price ?? item?.cost));
    const mode = discountMode(item, defaultPercent);
    const selectedPercent = mode === 'percent'
      ? clampPercent(item?.discountPercent === '' || item?.discountPercent == null ? defaultPercent : item.discountPercent)
      : 0;
    const discountMoney = Math.max(0, Math.min(price,
      mode === 'money' ? numberValue(item?.discountMoney) : price * selectedPercent / 100));
    const resolvedPercent = price > 0
      ? (mode === 'money' ? discountMoney / price * 100 : selectedPercent)
      : 0;
    return {
      sourceType: String(item?.sourceType || 'procedure'),
      sourceId: String(item?.sourceId || item?.id || ''),
      name: String(item?.name || ''),
      price,
      discountMode: mode,
      discountPercent: clampPercent(resolvedPercent),
      discountMoney,
      planAmount: Math.max(0, price - discountMoney),
    };
  });

  const serviceTotal = prepared.reduce((sum, item) => sum + item.price, 0);
  const discountTotal = prepared.reduce((sum, item) => sum + item.discountMoney, 0);
  const planTotal = prepared.reduce((sum, item) => sum + item.planAmount, 0);
  const percents = [...new Set(prepared.map((item) => Math.round(item.discountPercent * 10000) / 10000))];

  return {
    items: prepared,
    serviceTotal,
    discountPercent: percents.length === 1 ? percents[0] : null,
    discountTotal,
    planTotal,
  };
}

function isStoredPlan(value = null) {
  return Boolean(value && typeof value === 'object'
    && Array.isArray(value.items)
    && Number.isFinite(Number(value.planTotal ?? value.dueTotal)));
}

function normalizeStoredPlan(value = null) {
  if (!isStoredPlan(value)) return null;
  return calculateFinancialPlan(value.items, { discountPercent: value.discountPercent ?? 0 });
}

function latestHistoricalPlanForSource(type, id) {
  const movements = getDDSMovementsForSource(type, id)
    .filter((movement) => movement?.finance && isStoredPlan(movement.finance))
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  if (!movements.length) return null;
  return normalizeStoredPlan(movements[movements.length - 1].finance);
}

export function resolveRecordFinancialPlan(record = null, { discountPercent = 0 } = {}) {
  const stored = normalizeStoredPlan(record?.finance);
  if (stored) return stored;

  if (record?.id) {
    const historical = latestHistoricalPlanForSource('record', record.id);
    if (historical) return historical;
  }

  return calculateFinancialPlan(record?.procedures || [], { discountPercent });
}

export function calculateFinancialFact(plan = null, movements = []) {
  const income = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.total)), 0);
  const expense = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.total)), 0);
  return {
    ...(plan || {}),
    factIncome: income,
    factExpense: expense,
    factTotal: income - expense,
  };
}

export function getRecordFinancialPlanFact(record = null, { discountPercent = 0 } = {}) {
  const plan = resolveRecordFinancialPlan(record, { discountPercent });
  if (!record?.id) return calculateFinancialFact(plan, []);
  return calculateFinancialFact(plan, getDDSMovementsForSource('record', record.id));
}

export function getFinancialFactForRecords(recordIds = []) {
  const ids = new Set((Array.isArray(recordIds) ? recordIds : []).map((id) => String(id || '')).filter(Boolean));
  const movements = getDDSMovements().filter((movement) => movement?.source?.type === 'record' && ids.has(String(movement?.source?.id || '')));
  return calculateFinancialFact(null, movements);
}

function itemPlanAmount(item = null) {
  if (!item) return 0;
  if (Number.isFinite(Number(item.planAmount))) return Math.max(0, numberValue(item.planAmount));
  const price = Math.max(0, numberValue(item.price));
  return Math.max(0, price - Math.max(0, numberValue(item.discountMoney)));
}

function movementItemAmount(movement = null, sourceType = '', sourceId = '') {
  const finance = movement?.finance;
  const items = Array.isArray(finance?.items) ? finance.items : [];
  const id = String(sourceId || '');
  const type = String(sourceType || '');
  if (!id || !items.length) return 0;
  const totalPlan = Math.max(0, numberValue(finance?.planTotal ?? finance?.dueTotal));
  if (!totalPlan) return 0;
  const itemPlan = items
    .filter((item) => String(item?.sourceId || '') === id
      && (!type || !item?.sourceType || String(item.sourceType) === type))
    .reduce((sum, item) => sum + itemPlanAmount(item), 0);
  if (!itemPlan) return 0;
  return Math.max(0, numberValue(movement?.total)) * (itemPlan / totalPlan);
}

export function getFinancialItemFact(sourceType, sourceId) {
  let factIncome = 0;
  let factExpense = 0;
  getDDSMovements().forEach((movement) => {
    const allocated = movementItemAmount(movement, sourceType, sourceId);
    if (!allocated) return;
    if (movement?.movementType === 'income') factIncome += allocated;
    else if (movement?.movementType === 'expense') factExpense += allocated;
  });
  return {
    factIncome,
    factExpense,
    factTotal: factIncome - factExpense,
  };
}

export function recordPlanTotal(record = null) {
  return resolveRecordFinancialPlan(record).planTotal;
}
