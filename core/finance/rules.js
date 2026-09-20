// Pure Settlement/Finance rules. No persistence, UI or browser state.
// Legacy persisted fields such as planAmount/planTotal/fact* stay unchanged until the storage migration;
// they are compatibility fields and are not the future Financial Model.

export function financialNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

export function clampFinancialPercent(value) {
  return Math.max(0, Math.min(100, financialNumber(value)));
}

function sourceType(item = null) {
  return String(item?.sourceType || 'procedure');
}

function sourceId(item = null) {
  return String(item?.sourceId || item?.id || '');
}

function sourceKey(item = null) {
  return `${sourceType(item)}:${sourceId(item)}`;
}

function discountMode(item = {}, defaultPercent = 0) {
  if (item?.discountMode === 'percent' || item?.discountMode === 'money' || item?.discountMode === 'none') return item.discountMode;
  if (item?.discountPercent !== '' && item?.discountPercent != null && clampFinancialPercent(item.discountPercent) > 0) return 'percent';
  if (item?.discountMoney !== '' && item?.discountMoney != null && financialNumber(item.discountMoney) > 0) return 'money';
  return defaultPercent > 0 ? 'percent' : 'none';
}

export function recordSettlementItems(record = null) {
  const procedures = Array.isArray(record?.procedures) ? record.procedures : [];
  const products = Array.isArray(record?.products) ? record.products : [];
  return [
    ...procedures.map((item) => ({ ...item, sourceType: 'procedure', sourceId: String(item?.id || '') })),
    ...products.map((item) => ({ ...item, sourceType: 'product', sourceId: String(item?.id || '') })),
  ];
}

export function calculateSettlement(items = [], { discountPercent = 0 } = {}) {
  const defaultPercent = clampFinancialPercent(discountPercent);
  const prepared = (Array.isArray(items) ? items : []).map((item) => {
    const price = Math.max(0, financialNumber(item?.price ?? item?.cost));
    const mode = discountMode(item, defaultPercent);
    const selectedPercent = mode === 'percent'
      ? clampFinancialPercent(item?.discountPercent === '' || item?.discountPercent == null ? defaultPercent : item.discountPercent)
      : 0;
    const discountMoney = Math.max(0, Math.min(price,
      mode === 'money' ? financialNumber(item?.discountMoney) : price * selectedPercent / 100));
    const resolvedPercent = price > 0
      ? (mode === 'money' ? discountMoney / price * 100 : selectedPercent)
      : 0;
    return {
      sourceType: sourceType(item),
      sourceId: sourceId(item),
      name: String(item?.name || ''),
      price,
      discountMode: mode,
      discountPercent: clampFinancialPercent(resolvedPercent),
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

export function repriceSettlement(sources = [], currentFinance = null) {
  const priorItems = Array.isArray(currentFinance?.items) ? currentFinance.items : [];
  const bySource = new Map(priorItems.map((item) => [sourceKey(item), item]));
  const defaultDiscount = currentFinance?.discountPercent == null ? 0 : clampFinancialPercent(currentFinance.discountPercent);
  const items = (Array.isArray(sources) ? sources : []).map((source, index) => {
    const type = sourceType(source);
    const id = sourceId(source);
    const prior = bySource.get(`${type}:${id}`)
      || (id ? priorItems.find((item) => String(item?.sourceId || '') === id && (!item?.sourceType || sourceType(item) === type)) : priorItems[index])
      || null;
    const base = {
      sourceType: type,
      sourceId: id,
      name: String(source?.name || ''),
      price: Math.max(0, financialNumber(source?.cost ?? source?.price)),
    };
    if (!prior) return { ...base, discountMode: defaultDiscount > 0 ? 'percent' : 'none', discountPercent: defaultDiscount };
    if (prior.discountMode === 'money') return { ...base, discountMode: 'money', discountMoney: prior.discountMoney };
    if (prior.discountMode === 'percent' || financialNumber(prior.discountPercent) > 0) {
      return { ...base, discountMode: 'percent', discountPercent: prior.discountPercent };
    }
    return { ...base, discountMode: 'none' };
  });
  return calculateSettlement(items, { discountPercent: defaultDiscount });
}

export function isStoredSettlement(value = null) {
  return Boolean(value && typeof value === 'object'
    && Array.isArray(value.items)
    && Number.isFinite(Number(value.planTotal ?? value.dueTotal)));
}

export function normalizeStoredSettlement(value = null) {
  if (!isStoredSettlement(value)) return null;
  return calculateSettlement(value.items, { discountPercent: value.discountPercent ?? 0 });
}

export function movementServiceAmount(item = null) {
  if (!item) return 0;
  if (item?.movementType === 'income') {
    const total = Math.max(0, financialNumber(item?.total));
    const tips = Math.max(0, financialNumber(item?.tips));
    return Math.max(0, financialNumber(item?.serviceAmount ?? (total - tips)));
  }
  return Math.max(0, financialNumber(item?.serviceAmount ?? item?.total));
}

export function calculateSettlementTotals(settlement = null, movements = []) {
  const income = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
  const expense = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
  return { ...(settlement || {}), factIncome: income, factExpense: expense, factTotal: income - expense };
}

export function normalizedAllocations(payment = null) {
  if (Array.isArray(payment?.allocations) && payment.allocations.length) {
    return payment.allocations.map((item) => ({
      walletId: String(item?.walletId || ''),
      walletName: String(item?.walletName || ''),
      amount: Math.max(0, financialNumber(item?.amount)),
    })).filter((item) => item.walletId && item.amount > 0);
  }
  if (!payment?.walletId) return [];
  return [{
    walletId: String(payment.walletId || ''),
    walletName: String(payment.walletName || ''),
    amount: Math.max(0, financialNumber(payment.total)),
  }];
}

export function paymentNet(payment, movements = []) {
  const refunded = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense'
      && item?.expenseType === 'refund'
      && String(item?.originalPaymentId || '') === String(payment?.id || ''))
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.total)), 0);
  return Math.max(0, financialNumber(payment?.total) - refunded);
}

export function calculateSettlementPaymentState(settlement = null, movements = []) {
  const totals = calculateSettlementTotals(settlement, movements);
  const paidTotal = Math.max(0, financialNumber(totals.factTotal));
  const remaining = Math.max(0, financialNumber(settlement?.planTotal) - paidTotal);
  const tipsIncome = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.tips)), 0);
  const tipsExpense = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + Math.max(0, financialNumber(item?.tips)), 0);
  const tipsTotal = Math.max(0, tipsIncome - tipsExpense);
  const payments = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income' && paymentNet(item, movements) > 0.009)
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
  const fullyPaid = financialNumber(settlement?.planTotal) > 0 && remaining <= 0.009;
  return {
    ...totals,
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

function itemSettlementAmount(item = null) {
  if (!item) return 0;
  if (Number.isFinite(Number(item.planAmount))) return Math.max(0, financialNumber(item.planAmount));
  const price = Math.max(0, financialNumber(item.price));
  return Math.max(0, price - Math.max(0, financialNumber(item.discountMoney)));
}

function movementItemAmount(movement = null, sourceTypeValue = '', sourceIdValue = '') {
  const finance = movement?.finance;
  const items = Array.isArray(finance?.items) ? finance.items : [];
  const id = String(sourceIdValue || '');
  const type = String(sourceTypeValue || '');
  if (!id || !items.length) return 0;
  const settlementTotal = Math.max(0, financialNumber(finance?.planTotal ?? finance?.dueTotal));
  if (!settlementTotal) return 0;
  const settlementItemTotal = items
    .filter((item) => String(item?.sourceId || '') === id
      && (!type || !item?.sourceType || String(item.sourceType) === type))
    .reduce((sum, item) => sum + itemSettlementAmount(item), 0);
  if (!settlementItemTotal) return 0;
  return movementServiceAmount(movement) * (settlementItemTotal / settlementTotal);
}

export function calculateSettlementItemTotals(movements = [], sourceTypeValue = '', sourceIdValue = '') {
  let factIncome = 0;
  let factExpense = 0;
  (Array.isArray(movements) ? movements : []).forEach((movement) => {
    const allocated = movementItemAmount(movement, sourceTypeValue, sourceIdValue);
    if (!allocated) return;
    if (movement?.movementType === 'income') factIncome += allocated;
    else if (movement?.movementType === 'expense') factExpense += allocated;
  });
  return { factIncome, factExpense, factTotal: factIncome - factExpense };
}

export function splitRefund(original = null, refunds = [], requestedAmount = null) {
  if (!original) return null;
  const alreadyRefunded = (Array.isArray(refunds) ? refunds : []).reduce((sum, item) => sum + Math.max(0, financialNumber(item?.total)), 0);
  const alreadyTipsRefunded = (Array.isArray(refunds) ? refunds : []).reduce((sum, item) => sum + Math.max(0, financialNumber(item?.tips)), 0);
  const alreadyServiceRefunded = (Array.isArray(refunds) ? refunds : []).reduce((sum, item) => sum + Math.max(0, financialNumber(item?.serviceAmount)), 0);
  const remaining = Math.max(0, financialNumber(original.total) - alreadyRefunded);
  const amount = Math.min(remaining, Math.max(0, requestedAmount == null ? remaining : financialNumber(requestedAmount)));
  if (!amount) return null;
  const tipsRemaining = Math.max(0, financialNumber(original.tips) - alreadyTipsRefunded);
  const serviceRemaining = Math.max(0, financialNumber(original.serviceAmount) - alreadyServiceRefunded);
  const tips = Math.min(amount, tipsRemaining);
  const serviceAmount = Math.min(Math.max(0, amount - tips), serviceRemaining);
  if (tips + serviceAmount <= 0) return null;
  return { remaining, total: tips + serviceAmount, tips, serviceAmount };
}
