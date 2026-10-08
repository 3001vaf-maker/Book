type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function settlementNumber(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

export function settlementMoney(value: unknown) {
  return Math.round(Math.max(0, settlementNumber(value)) * 100) / 100;
}

export function settlementPercent(value: unknown) {
  return Math.max(0, Math.min(100, settlementNumber(value)));
}

function sourceType(item: JsonObject) {
  return text(item.sourceType) || 'procedure';
}

function sourceId(item: JsonObject) {
  return text(item.sourceId ?? item.id);
}

function sourceKey(item: JsonObject) {
  return `${sourceType(item)}:${sourceId(item)}`;
}

function explicitCorrectionMode(item: JsonObject) {
  const mode = text(item.correctionMode);
  if (mode === 'percent' || mode === 'money' || mode === 'none') return mode;
  if (item.correctionPercent !== '' && item.correctionPercent != null && settlementPercent(item.correctionPercent) > 0) return 'percent';
  if (item.correctionMoney !== '' && item.correctionMoney != null && settlementMoney(item.correctionMoney) > 0) return 'money';
  return 'none';
}

function correctionForItem(item: JsonObject, price: number) {
  const mode = explicitCorrectionMode(item);
  if (mode === 'percent') {
    const value = settlementPercent(item.correctionPercent);
    return { mode: 'percent', percent: value, money: settlementMoney(Math.min(price, price * value / 100)) };
  }
  if (mode === 'money') {
    const value = settlementMoney(Math.min(price, item.correctionMoney));
    return {
      mode: value > 0 ? 'money' : 'none',
      percent: price > 0 ? settlementPercent(value / price * 100) : 0,
      money: value,
    };
  }
  return { mode: 'none', percent: 0, money: 0 };
}

function pricePercentForItem(item: JsonObject, defaultPercent: number) {
  if (item.pricePercent !== '' && item.pricePercent != null) return settlementPercent(item.pricePercent);
  return settlementPercent(defaultPercent);
}

export function calculateCanonicalSettlement(values: unknown[], discountValue: unknown = 0) {
  const defaultPercent = settlementPercent(discountValue);
  const items = (Array.isArray(values) ? values : []).map((value) => {
    const item = objectValue(value);
    const price = settlementMoney(item.price ?? item.cost);
    const pricePercent = pricePercentForItem(item, defaultPercent);
    const correction = correctionForItem(item, price);
    const correctedPrice = settlementMoney(price - correction.money);
    const pricePercentMoney = settlementMoney(Math.min(correctedPrice, correctedPrice * pricePercent / 100));
    const totalReduction = settlementMoney(correction.money + pricePercentMoney);
    return {
      sourceType: sourceType(item),
      sourceId: sourceId(item),
      name: text(item.name),
      price,
      correctedPrice,
      correctionMode: correction.mode,
      correctionPercent: settlementPercent(correction.percent),
      correctionMoney: correction.money,
      pricePercent,
      pricePercentMoney,
      discountMode: pricePercent > 0 ? 'percent' : correction.money > 0 ? 'money' : 'none',
      discountPercent: pricePercent,
      discountMoney: totalReduction,
      planAmount: settlementMoney(correctedPrice - pricePercentMoney),
    };
  });

  const serviceTotal = settlementMoney(items.reduce((sum, item) => sum + item.price, 0));
  const correctionTotal = settlementMoney(items.reduce((sum, item) => sum + item.correctionMoney, 0));
  const pricePercentTotal = settlementMoney(items.reduce((sum, item) => sum + item.pricePercentMoney, 0));
  const discountTotal = settlementMoney(correctionTotal + pricePercentTotal);
  const planTotal = settlementMoney(items.reduce((sum, item) => sum + item.planAmount, 0));
  const percents = [...new Set(items.map((item) => Math.round(item.pricePercent * 10000) / 10000))];
  return {
    items,
    serviceTotal,
    discountPercent: percents.length === 1 ? percents[0] : null,
    correctionTotal,
    pricePercentTotal,
    discountTotal,
    planTotal,
  };
}

export function repriceCanonicalSettlement(values: unknown[], current: unknown, discountValue: unknown = 0) {
  const previous = objectValue(current);
  const priorItems = Array.isArray(previous.items) ? previous.items.map(objectValue) : [];
  const bySource = new Map(priorItems.map((item) => [sourceKey(item), item]));
  const defaultPercent = settlementPercent(discountValue);
  const items = (Array.isArray(values) ? values : []).map((value, index) => {
    const item = objectValue(value);
    const type = sourceType(item);
    const id = sourceId(item);
    const prior = bySource.get(`${type}:${id}`)
      || (id ? priorItems.find((candidate) => sourceId(candidate) === id && (!candidate.sourceType || sourceType(candidate) === type)) : priorItems[index])
      || null;
    const base = {
      ...item,
      sourceType: type,
      sourceId: id,
      pricePercent: defaultPercent,
    };
    if (!prior) return { ...base, correctionMode: 'none' };
    const priorPrice = settlementMoney(prior.price ?? item.cost ?? item.price);
    const correction = correctionForItem(prior, priorPrice);
    if (correction.mode === 'percent') return { ...base, correctionMode: 'percent', correctionPercent: correction.percent };
    if (correction.money > 0) return { ...base, correctionMode: 'money', correctionMoney: correction.money };
    return { ...base, correctionMode: 'none' };
  });
  return calculateCanonicalSettlement(items, defaultPercent);
}
