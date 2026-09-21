function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function settlementRow(recordId, settlement) {
  return {
    source: { type: 'record', id: recordId },
    settlement,
  };
}

function splitComponents(allocations, serviceAmount, tips) {
  let serviceLeft = money(serviceAmount);
  let tipsLeft = money(tips);
  const result = [];
  for (const allocation of allocations) {
    let left = money(allocation.amount);
    const service = Math.min(left, serviceLeft);
    if (service > 0) {
      result.push({ ...allocation, amount: service, component: 'service' });
      left = money(left - service);
      serviceLeft = money(serviceLeft - service);
    }
    const tip = Math.min(left, tipsLeft);
    if (tip > 0) {
      result.push({ ...allocation, amount: tip, component: 'tips' });
      tipsLeft = money(tipsLeft - tip);
    }
  }
  return result;
}

export function paymentFixture({
  id,
  recordId,
  settlement,
  allocations,
  serviceAmount = null,
  tips = 0,
  status = 'completed',
  occurredAt = '2026-09-20T10:00:00.000Z',
  person = { name: 'Тест' },
  workplace = 'Тест',
} = {}) {
  const total = money((allocations || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const service = money(serviceAmount == null ? total - tips : serviceAmount);
  const components = splitComponents(allocations || [], service, tips);
  const operation = {
    operationId: id,
    kind: 'payment',
    status,
    source: { type: 'record', id: recordId },
    originalOperationId: '',
    occurredAt,
    data: { allocations, total, serviceAmount: service, tips, settlement, person, workplace },
  };
  const ledger = components.map((entry, index) => ({
    entryId: `${id}-entry-${index + 1}`,
    operationId: id,
    walletId: entry.walletId,
    walletName: entry.walletName,
    direction: 'IN',
    economicType: entry.component === 'tips' ? 'TIPS' : 'SERVICE_REVENUE',
    amount: entry.amount,
    occurredAt,
    source: { type: 'record', id: recordId },
    component: entry.component,
    relatedOperationId: '',
  }));
  const income = {
    id,
    status,
    movementType: 'income',
    incomeType: 'payment',
    source: { type: 'record', id: recordId },
    workplace,
    person,
    allocations,
    walletId: allocations?.length === 1 ? allocations[0].walletId : '',
    walletName: allocations?.length === 1 ? allocations[0].walletName : '',
    total,
    serviceAmount: service,
    tips,
    finance: settlement,
    createdAt: occurredAt,
    paidAt: occurredAt,
  };
  return { operation, ledger, income };
}

export function refundFixture({
  id,
  paymentId,
  recordId,
  settlement,
  walletId,
  walletName,
  serviceAmount = 0,
  tips = 0,
  status = 'completed',
  occurredAt = '2026-09-20T11:00:00.000Z',
  person = { name: 'Тест' },
  workplace = 'Тест',
} = {}) {
  const total = money(serviceAmount + tips);
  const operation = {
    operationId: id,
    kind: 'refund',
    status,
    source: { type: 'record', id: recordId },
    originalOperationId: paymentId,
    occurredAt,
    data: { walletId, walletName, total, serviceAmount, tips, settlement, person, workplace },
  };
  const ledger = [
    ...(serviceAmount > 0 ? [{
      entryId: `${id}-service`,
      operationId: id,
      walletId,
      walletName,
      direction: 'OUT',
      economicType: 'SERVICE_REFUND',
      amount: money(serviceAmount),
      occurredAt,
      source: { type: 'record', id: recordId },
      component: 'service',
      relatedOperationId: '',
    }] : []),
    ...(tips > 0 ? [{
      entryId: `${id}-tips`,
      operationId: id,
      walletId,
      walletName,
      direction: 'OUT',
      economicType: 'TIPS_REFUND',
      amount: money(tips),
      occurredAt,
      source: { type: 'record', id: recordId },
      component: 'tips',
      relatedOperationId: '',
    }] : []),
  ];
  const expense = {
    id,
    status: status === 'cancelled' ? 'cancelled' : 'refund',
    movementType: 'expense',
    expenseType: 'refund',
    originalPaymentId: paymentId,
    source: { type: 'record', id: recordId },
    workplace,
    person,
    walletId,
    walletName,
    total,
    serviceAmount: money(serviceAmount),
    tips: money(tips),
    finance: settlement,
    createdAt: occurredAt,
    refundedAt: occurredAt,
  };
  return { operation, ledger, expense };
}

export function reversalFixture({
  id,
  originalOperationId,
  recordId,
  entries = [],
  occurredAt = '2026-09-20T12:00:00.000Z',
} = {}) {
  const operation = {
    operationId: id,
    kind: 'cancel',
    status: 'completed',
    source: { type: 'record', id: recordId },
    originalOperationId,
    occurredAt,
    data: { cancelledOperationId: originalOperationId },
  };
  const ledger = entries.map((entry, index) => ({
    entryId: `${id}-entry-${index + 1}`,
    operationId: id,
    walletId: entry.walletId,
    walletName: entry.walletName,
    direction: entry.direction === 'IN' ? 'OUT' : 'IN',
    economicType: 'REVERSAL',
    amount: entry.amount,
    occurredAt,
    source: { type: 'record', id: recordId },
    component: entry.component,
    relatedOperationId: originalOperationId,
  }));
  return { operation, ledger };
}

export function canonicalFinanceState({
  settlements = [],
  payments = [],
  refunds = [],
  reversals = [],
} = {}) {
  return {
    version: 6,
    settlements,
    operations: [
      ...payments.map((item) => item.operation),
      ...refunds.map((item) => item.operation),
      ...reversals.map((item) => item.operation),
    ],
    ledger: [
      ...payments.flatMap((item) => item.ledger),
      ...refunds.flatMap((item) => item.ledger),
      ...reversals.flatMap((item) => item.ledger),
    ],
    income: payments.map((item) => item.income),
    expense: refunds.map((item) => item.expense),
  };
}
