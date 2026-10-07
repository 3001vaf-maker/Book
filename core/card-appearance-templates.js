import { queueAuxiliaryDataset } from './business-persistence.js';

const SCOPES = new Set([
  'person',
  'workplace',
  'wallet',
  'loan',
  'investment',
  'procedure',
  'product',
  'loyalty-deposit',
  'loyalty-personal-account',
  'loyalty-certificate',
  'loyalty-subscription',
  'loyalty-referral',
  'loyalty-bonus',
]);
let templatesState = [];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function objectValue(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTemplate(value = {}) {
  const source = objectValue(value);
  const scope = String(source.scope || '').trim();
  if (!SCOPES.has(scope)) return null;
  return {
    scope,
    appearance: clone(objectValue(source.appearance)),
    photo: String(source.photo || ''),
    photoPosition: String(source.photoPosition || '50% 50%'),
    updatedAt: String(source.updatedAt || ''),
  };
}

function normalized(values = []) {
  const byScope = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    const item = normalizeTemplate(value);
    if (item) byScope.set(item.scope, item);
  }
  return [...byScope.values()];
}

export function hydrateCardAppearanceTemplates(values = []) {
  templatesState = normalized(values);
  return getCardAppearanceTemplates();
}

export function getCardAppearanceTemplates() {
  return clone(templatesState);
}

export function getCardAppearanceTemplate(scope = '') {
  const key = String(scope || '').trim();
  const item = templatesState.find((value) => value.scope === key);
  return item ? clone(item) : null;
}

export function saveCardAppearanceTemplate(scope = '', {
  appearance = {},
  photo = '',
  photoPosition = '50% 50%',
} = {}) {
  const key = String(scope || '').trim();
  if (!SCOPES.has(key)) throw new Error('Неизвестный тип карты');
  const next = {
    scope: key,
    appearance: clone(objectValue(appearance)),
    photo: String(photo || ''),
    photoPosition: String(photoPosition || '50% 50%'),
    updatedAt: new Date().toISOString(),
  };
  templatesState = normalized([
    ...templatesState.filter((item) => item.scope !== key),
    next,
  ]);
  void queueAuxiliaryDataset('cardAppearanceTemplates', templatesState);
  return clone(next);
}
