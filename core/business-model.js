import { getDDSMovementsForSource } from './dds.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const clampPercent = (value) => Math.max(0, Math.min(100, numberValue(value)));

export function calculateBusinessPlan(items = [], { discountPercent = 0 } = {}) {
  const defaultPercent = clampPercent(discountPercent);
  const prepared = (Array.isArray(items) ? items : []).map((item) => {
    const price = Math.max(0, numberValue(item?.price ?? item?.cost));
    const hasPercent = item?.discountPercent !== '' && item?.discountPercent != null;
    const hasMoney = item?.discountMoney !== '' && item?.discountMoney != null;
    const selectedPercent = hasPercent ? clampPercent(item.discountPercent) : defaultPercent;
    const discountMoney = Math.max(0, Math.min(price, hasMoney
      ? numberValue(item.discountMoney)
      : price * selectedPercent / 100));
    const resolvedPercent = price > 0
      ? (hasMoney ? discountMoney / price * 100 : selectedPercent)
      : 0;
    return {
      sourceId: String(item?.sourceId || item?.id || ''),
      name: String(item?.name || ''),
      price,
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

export function calculateBusinessFact(plan = null, movements = []) {
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

export function getRecordBusinessPlanFact(record = null) {
  if (!record?.id) return calculateBusinessFact(record?.finance || calculateBusinessPlan(record?.procedures || [], { discountPercent: record?.finance?.discountPercent || 0 }), []);
  const plan = record?.finance || calculateBusinessPlan(record?.procedures || [], { discountPercent: record?.finance?.discountPercent || 0 });
  return calculateBusinessFact(plan, getDDSMovementsForSource('record', record.id));
}

export function recordPlanTotal(record = null) {
  if (record?.finance && Number.isFinite(Number(record.finance.planTotal))) return Math.max(0, Number(record.finance.planTotal));
  return calculateBusinessPlan(record?.procedures || [], { discountPercent: record?.finance?.discountPercent || 0 }).planTotal;
}
