import { resolveBookingPublicRoute } from '../core/account/index.js';
import { renderGlobalClient } from './booking.js';
import { renderOnlineBookingX as renderOnlineBooking } from './booking-x.js';
import { startAccountRuntime } from './account-runtime.js';

const app = document.querySelector('#app');
let disposeView = () => {};

function syncViewport() {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  const width = vv?.width || window.innerWidth;
  document.documentElement.style.setProperty('--visual-vh', `${height}px`);
  document.documentElement.style.setProperty('--visual-vw', `${width}px`);
  document.documentElement.classList.toggle('keyboard-open', vv ? height < window.innerHeight * 0.78 : false);
}

function setThemeColor(value) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
}

function bookingRouteQuery(params) {
  return {
    procedureIds: String(params.get('procedures') || '').split(',').map((value) => value.trim()).filter(Boolean),
    telegramEntry: String(params.get('tg_entry') || '').trim(),
    entry: String(params.get('entry') || '').trim(),
  };
}

function publicBookingPath() {
  const segments = String(location.pathname || '/')
    .split('/')
    .filter(Boolean)
    .map((value) => {
      try { return decodeURIComponent(value); } catch { return value; }
    });
  if (!segments.length) return null;
  if (segments.length > 2) return { invalid: true, profileSlug: '', workplaceSlug: '' };
  return {
    invalid: false,
    profileSlug: String(segments[0] || '').trim(),
    workplaceSlug: String(segments[1] || '').trim(),
  };
}

async function bookingRoute() {
  const params = new URLSearchParams(location.search);
  const pathRoute = publicBookingPath();
  if (!pathRoute) return null;
  if (pathRoute.invalid || !pathRoute.profileSlug) {
    return { tenantId: '', workplaceKey: '', ...bookingRouteQuery(params) };
  }

  try {
    const resolved = await resolveBookingPublicRoute(pathRoute.profileSlug, pathRoute.workplaceSlug);
    return {
      tenantId: String(resolved?.tenantId || ''),
      workplaceKey: String(resolved?.workplaceKey || ''),
      ...bookingRouteQuery(params),
    };
  } catch {
    return { tenantId: '', workplaceKey: '', ...bookingRouteQuery(params) };
  }
}

async function renderGlobalClientRoot(initial = {}) {
  disposeView();
  disposeView = () => {};
  setThemeColor('#2F3338');
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content" id="app-content"></main>';
  await renderGlobalClient(document.querySelector('#app-content'), initial);
  syncViewport();
}

async function renderPublicBooking(route) {
  disposeView();
  setThemeColor('#2F3338');
  app.classList.add('app-shell--booking');
  app.innerHTML = '<main class="booking-content" id="app-content"></main>';
  disposeView = await startAccountRuntime(route);
  await renderOnlineBooking(document.querySelector('#app-content'), {
    ...route,
    onExitToAccount: (target = {}) => {
      history.replaceState({}, '', '/');
      void renderGlobalClientRoot(target);
    },
  });
  syncViewport();
}

window.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

syncViewport();
const publicBooking = await bookingRoute();
if (publicBooking) await renderPublicBooking(publicBooking);
else await renderGlobalClientRoot();
