import { escapeHtml } from '../utils/escape-html.js';

export function entityCardStack(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="entity-card-stack${className ? ` ${escapeHtml(className)}` : ''}" data-entity-card-stack>${items.join('')}</div>`;
}

export function entityCardRail(cards = [], { className = '' } = {}) {
  const items = Array.isArray(cards) ? cards : [];
  return `<div class="entity-card-rail${className ? ` ${escapeHtml(className)}` : ''}" data-entity-card-rail>${items.join('')}</div>`;
}
