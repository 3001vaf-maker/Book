// Pure Settlement/Finance rules. No persistence, UI or browser state.
// Settlement arithmetic is independent from persistence and UI.

export function financialNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

export function financialMoney(value) {
  return Math.round(Math.max(0, financialNumber(value)) * 100) / 100;
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

function correctionMode(item = {}) {
  const explicit = String(item?.correctionMode || '');
  if (explicit === 'percent' || explicit === 'money' || explicit === 'none') return explicit;
  if (item?.correctionPercent !== '' && item?.correctionPercent != null && clampFinancialPercent(item.correctionPercent) > 0) return 'percent';
  if (item?.correctionMoney !== '' && item?.correctionMoney != null && financialNumber(item.correctionMoney) > 0) return 'money';
  return 'none';
}

function legacyCorrectionMoney(item = {}, price = 0, pricePercent = 0) {
  const totalReduction = Math.min(financialMoney(price), financialMoney(item?.discountMoney));
  if (totalReduction <= 0) return 0;
  const rate = clampFinancialPercent(pricePercent) / 100;
  if (rate >= 0.999999) return 0;
  return financialMoney(Math.max(0, Math.min(price, (totalReduction - price * rate) / (1 - rate))));
}

function correctionForItem(item = {}, price = 0, pricePercent = 0) {
  const explicitMode = correctionMode(item);
  if (explicitMode === 'percent') {
    const correctionPercent = clampFinancialPercent(item?.correctionPercent);
    return {
      mode: 'percent',
      percent: correctionPercent,
      money: financialMoney(Math.min(price, price * correctionPercent / 100)),
    };
  }
  if (explicitMode === 'money') {
    const correctionMoney = financialMoney(Math.min(price, item?.correctionMoney));
    return {
      mode: correctionMoney > 0 ? 'money' : 'none',
      percent: price > 0 ? clampFinancialPercent(correctionMoney / price * 100) : 0,
      money: correctionMoney,
    };
  }

  const hasNewCorrection = item?.correctionMode != null || item?.correctionPercent != null || item?.correctionMoney != null;
  if (hasNewCorrection) return { mode: 'none', percent: 0, money: 0 };

  // Compatibility with historical Settlement snapshots: discountMoney used to contain
  // the whole reduction. Reconstruct only the manual price correction from that total.
  const reconstructed = legacyCorrectionMoney(item, price, pricePercent);
  if (reconstructed > 0) {
    return {
      mode: 'money',
      percent: price > 0 ? clampFinancialPercent(reconstructed / price * 100) : 0,
      money: reconstructed,
    };
  }
  return { mode: 'none', percent: 0, money: 0 };
}

function itemPricePercent(item = {}, defaultPercent = 0) {
  if (item?.pricePercent !== '' && item?.pricePercent != null) return clampFinancialPercent(item.pricePercent);
  return clampFinancialPercent(defaultPercent);
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
    const price = financialMoney(item?.price ?? item?.cost);
    const pricePercent = itemPricePercent(item, defaultPercent);
    const correction = correctionForItem(item, price, pricePercent);
    const correctedPrice = financialMoney(price - correction.money);
    const pricePercentMoney = financialMoney(Math.min(correctedPrice, correctedPrice * pricePercent / 100));
    const totalReduction = financialMoney(correction.money + pricePercentMoney);
    return {
      sourceType: sourceType(item),
      sourceId: sourceId(item),
      name: String(item?.name || ''),
      price,
      correctedPrice,
      correctionMode: correction.mode,
      correctionPercent: clampFinancialPercent(correction.percent),
      correctionMoney: correction.money,
      pricePercent,
      pricePercentMoney,
      // Legacy names stay in the snapshot so old Finance/read-only receipt code remains compatible.
      // discountPercent is the automatic condition; discountMoney is the total visible reduction.
      discountMode: pricePercent > 0 ? 'percent' : correction.money > 0 ? 'money' : 'none',
      discountPercent: pricePercent,
      discountMoney: totalReduction,
      planAmount: financialMoney(correctedPrice - pricePercentMoney),
    };
  });

  const serviceTotal = financialMoney(prepared.reduce((sum, item) => sum + item.price, 0));
  const correctionTotal = financialMoney(prepared.reduce((sum, item) => sum + item.correctionMoney, 0));
  const pricePercentTotal = financialMoney(prepared.reduce((sum, item) => sum + item.pricePercentMoney, 0));
  const discountTotal = financialMoney(correctionTotal + pricePercentTotal);
  const planTotal = financialMoney(prepared.reduce((sum, item) => sum + item.planAmount, 0));
  const percents = [...new Set(prepared.map((item) => Math.round(item.pricePercent * 10000) / 10000))];

  return {
    items: prepared,
    serviceTotal,
    discountPercent: percents.length === 1 ? percents[0] : null,
    correctionTotal,
    pricePercentTotal,
    discountTotal,
    planTotal,
  };
}

export function repriceSettlement(sources = [], currentSettlement = null) {
  const priorItems = Array.isArray(currentSettlement?.items) ? currentSettlement.items : [];
  const bySource = new Map(priorItems.map((item) => [sourceKey(item), item]));
  const defaultPricePercent = currentSettlement?.discountPercent == null ? 0 : clampFinancialPercent(currentSettlement.discountPercent);
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
      price: financialMoney(source?.cost ?? source?.price),
      pricePercent: prior?.pricePercent == null ? defaultPricePercent : clampFinancialPercent(prior.pricePercent),
    };
    if (!prior) return { ...base, correctionMode: 'none' };
    const priorPrice = financialMoney(prior?.price ?? source?.cost ?? source?.price);
    const priorPercent = prior?.pricePercent == null ? defaultPricePercent : clampFinancialPercent(prior.pricePercent);
    const correction = correctionForItem(prior, priorPrice, priorPercent);
    if (correction.mode === 'percent') return { ...base, correctionMode: 'percent', correctionPercent: correction.percent };
    if (correction.money > 0) return { ...base, correctionMode: 'money', correctionMoney: correction.money };
    return { ...base, correctionMode: 'none' };
  });
  return calculateSettlement(items, { discountPercent: defaultPricePercent });
}

export function isStoredSettlement(value = null) {
  return Boolean(value && typeof value === 'object'
    && Array.isArray(value.items)
    && Number.isFinite(Number(value.planTotal)));
}

export function normalizeStoredSettlement(value = null) {
  if (!isStoredSettlement(value)) return null;
  return calculateSettlement(value.items, { discountPercent: value.discountPercent ?? 0 });
}

export function movementServiceAmount(item = null) {
  if (!item) return 0;
  if (item?.movementType === 'income') {
    const total = financialMoney(item?.total);
    const tips = financialMoney(item?.tips);
    return financialMoney(item?.serviceAmount ?? (total - tips));
  }
  return financialMoney(item?.serviceAmount ?? item?.total);
}

export function calculateSettlementTotals(settlement = null, movements = []) {
  const income = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'income')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
  const expense = (Array.isArray(movements) ? movements : [])
    .filter((item) => item?.movementType === 'expense')
    .reduce((sum, item) => sum + movementServiceAmount(item), 0);
  return {
    ...(settlement || {}),
    factIncome: financialMoney(income),
    factExpense: financialMoney(expense),
    factTotal: Math.round((income - expense) * 100) / 100,
  };
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
  const paidTotal = financialMoney(totals.factTotal);
  const remaining = financialMoney(financialMoney(settlement?.planTotal) - paidTotal);
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
  const settlementSnapshot = movement?.finance;
  const items = Array.isArray(settlementSnapshot?.items) ? settlementSnapshot.items : [];
  const id = String(sourceIdValue || '');
  const type = String(sourceTypeValue || '');
  if (!id || !items.length) return 0;
  const settlementTotal = Math.max(0, financialNumber(settlementSnapshot?.planTotal));
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