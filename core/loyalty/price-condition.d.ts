export type PriceConditionSource = {
  type?: string;
  id?: string;
  name?: string;
  percent?: number | string;
  [key: string]: unknown;
};

export type PriceCondition = {
  percent: number;
  source: PriceConditionSource | null;
  sources: PriceConditionSource[];
  conflict: boolean;
};

export function clampPricePercent(value: unknown): number;
export function personalPricePercentSource(person?: unknown): PriceConditionSource | null;
export function resolvePriceConditionSources(sources?: PriceConditionSource[]): PriceCondition;
export function resolvePersonPriceCondition(person?: unknown, programSources?: PriceConditionSource[]): PriceCondition;
export function describePriceConditionConflict(condition?: PriceCondition | null): string;
