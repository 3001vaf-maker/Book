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

export function repriceFinancialPlan(procedures = [], currentFinance = null) {
  const priorItems = Array.isArray(currentFinance?.items) ? currentFinance.items : [];
  const bySource = new Map(priorItems.map((item) => [String(item?.sourceId || ''), item]));
  const defaultDiscount = currentFinance?.discountPercent == null ? 0 : clampPercent(currentFinance.discountPercent);
  const items = (Array.isArray(procedures) ? procedures : []).map((procedure, index) => {
    const prior = bySource.get(String(procedure?.id || '')) || priorItems[index] || null;
    const base = {
      sourceType: 'procedure',
      sourceId: String(procedure?.id || ''),
      name: String(procedure?.name || ''),
      price: Math.max(0, numberValue(procedure?.cost)),
    };
    if (!prior) return { ...base, discountMode: defaultDiscount > 0 ? 'percent' : 'none', discountPercent: defaultDiscount };
    if (prior.discountMode === 'money') return { ...base, discountMode: 'money', discountMoney: prior.discountMoney };
    if (prior.discountMode === 'percent' || numberValue(prior.discountPercent) > 0) {
      return { ...base, discountMode: 'percent', discountPercent: prior.discountPercent };
    }
    return { ...base, discountMode: 'none' };
  });
  return calculateFinancialPlan(items, { discountPercent: defaultDiscount });
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

function movementServiceAmount(item = null) {
  if (!item) return 0;
  if (item?.movementType === 'income') {
    const total = Math.max(0, numberValue(item?.total));
    const tips = Math.max(0, numberValue(item?.tips));
    return Math.max(0, numberValue(item?.serviceAmount ?? (total - tips)));
  }
  return Math.max(0, numberValue(item?.serviceAmount ?? item?.total));
}

export function calculateFinancialFact(plan = null, movements = []) {
  const income = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
  const expense = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
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

function paymentNet(payment, movements = []) {
  const refunded = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense'
      && item?.expenseType === 'refund'
      && String(item?.originalPaymentId || '') === String(payment?.id || ''))
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.total)), 0);
  return Math.max(0, numberValue(payment?.total) - refunded);
}

export function getRecordPaymentState(record = null, { discountPercent = 0 } = {}) {
  const plan = resolveRecordFinancialPlan(record, { discountPercent });
  const movements = record?.id ? getDDSMovementsForSource('record', record.id) : [];
  const fact = calculateFinancialFact(plan, movements);
  const paidTotal = Math.max(0, numberValue(fact.factTotal));
  const remaining = Math.max(0, numberValue(plan?.planTotal) - paidTotal);
  const tipsIncome = movements
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.tips)), 0);
  const tipsExpense = movements
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + Math.max(0, numberValue(item?.tips)), 0);
  const tipsTotal = Math.max(0, tipsIncome - tipsExpense);
  const payments = movements
    .filter((item) => item?.movementType === 'income' && paymentNet(item, movements) > 0.009)
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  const fullyPaid = numberValue(plan?.planTotal) > 0 && remaining <= 0.009;
  return {
    ...fact,
    paidTotal,
    remaining,
    tipsTotal,
    fullyPaid,
    partiallyPaid: paidTotal > 0.009 && !fullyPaid,
    hasPayments: payments.length > 0,
    payments,
    latestPayment: payments.length ? payments[payments.length - 1] : null,
  };
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
  return movementServiceAmount(movement) * (itemPlan / totalPlan);
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
