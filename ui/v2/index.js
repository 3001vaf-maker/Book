export { v2Header } from './header.js';
export { v2CardDeck } from './card-deck.js';
export { v2Shell, v2Section, v2HorizontalRail, v2RailCard } from './shell.js';
export { v2Sticker } from './sticker.js';
export { v2ZLayer, mountV2ZLayer } from './z-stack.js';
export { v2ZHeader, v2ZBody, v2QHeader, v2QBody, v2ZBodySection, v2ZBodySections, v2ZFrame, v2QFrame, setV2ZHeaderRows, clearV2ZHeaderRows } from './z-layout.js';
export { v2Layer, mountV2Layer } from './modal-portal.js';
export { initV2Swipe, initV2StickerSwipe } from './swipe.js';

import { v2ZFrame } from './z-layout.js';
import { setV2DeckOpen as setV2DeckOpenOwner, initV2WorkspaceInteraction } from './workspace-navigation.js';

function rootApp(root) {
  return root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
}

function ensureRootZFrame(root) {
  const app = rootApp(root);
  const z = app?.querySelector?.('[data-v2-front] > [data-v2-z]');
  if (!z) return null;
  const header = z.querySelector(':scope > [data-v2-z-header]');
  const body = z.querySelector(':scope > [data-v2-z-body]');
  if (header && body) return z;

  const content = z.innerHTML;
  z.innerHTML = v2ZFrame(content);
  return z;
}

export function setV2DeckOpen(root, open) {
  ensureRootZFrame(root);
  return setV2DeckOpenOwner(root, open);
}

export { initV2WorkspaceInteraction };
