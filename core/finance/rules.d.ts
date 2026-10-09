export type SettlementCorrectionMode = 'none' | 'percent' | 'money';

export type SettlementSource = {
  sourceType?: string;
  sourceId?: string;
  id?: string;
  name?: string;
  price?: number | string;
  cost?: number | string;
  correctionMode?: SettlementCorrectionMode | string;
  correctionPercent?: number | string;
  correctionMoney?: number | string;
  pricePercent?: number | string | null;
  [key: string]: unknown;
};

export type SettlementItem = {
  sourceType: string;
  sourceId: string;
  name: string;
  price: number;
  correctionMode: SettlementCorrectionMode;
  correctionPercent: number;
  correctionMoney: number;
  correctedPrice: number;
  pricePercent: number;
  pricePercentMoney: number;
  planAmount: number;
};

export type Settlement = {
  items: SettlementItem[];
  serviceTotal: number;
  pricePercent: number | null;
  correctionTotal: number;
  pricePercentTotal: number;
  planTotal: number;
  [key: string]: unknown;
};

export function financialNumber(value: unknown): number;
export function financialMoney(value: unknown): number;
export function clampFinancialPercent(value: unknown): number;
export function recordSettlementItems(record?: unknown): SettlementSource[];
export function calculateSettlement(items?: SettlementSource[], options?: { pricePercent?: unknown }): Settlement;
export function repriceSettlement(sources?: SettlementSource[], currentSettlement?: unknown, options?: { pricePercent?: unknown }): Settlement;
export function isStoredSettlement(value?: unknown): boolean;
export function normalizeStoredSettlement(value?: unknown): Settlement | null;
export function movementServiceAmount(item?: unknown): number;
export function calculateSettlementTotals(settlement?: Settlement | null, movements?: unknown[]): Settlement & { factIncome: number; factExpense: number; factTotal: number };
export function normalizedAllocations(payment?: unknown): Array<{ walletId: string; walletName: string; amount: number }>;
export function paymentNet(payment?: unknown, movements?: unknown[]): number;
export function calculateSettlementPaymentState(settlement?: Settlement | null, movements?: unknown[]): Settlement & Record<string, unknown>;
export function calculateSettlementItemTotals(movements?: unknown[], sourceTypeValue?: string, sourceIdValue?: string): { factIncome: number; factExpense: number; factTotal: number };
export function splitRefund(original?: unknown, refunds?: unknown[], requestedAmount?: number | null): { remaining: number; total: number; tips: number; serviceAmount: number } | null;
