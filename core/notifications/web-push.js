import {
  deleteWebPushSubscription,
  getBookingAccountToken,
  getWebPushConfiguration,
  saveWebPushSubscription,
} from '../booking-account/index.js';

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (String(value || '').length % 4)) % 4);
  const base64 = `${String(value || '').replaceAll('-', '+').replaceAll('_', '/')}${padding}`;
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function supported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function getWebPushState(tenantId) {
  if (!supported()) return { supported: false, enabled: false, permission: 'unsupported', subscribed: false };
  if (!getBookingAccountToken(tenantId)) return { supported: true, enabled: false, permission: Notification.permission, subscribed: false };
  const configuration = await getWebPushConfiguration(tenantId);
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  return {
    supported: true,
    enabled: Boolean(configuration?.enabled && configuration?.publicKey),
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function syncWebPush(tenantId, { requestPermission = false } = {}) {
  if (!supported() || !getBookingAccountToken(tenantId)) return getWebPushState(tenantId);

  const configuration = await getWebPushConfiguration(tenantId);
  if (!configuration?.enabled || !configuration?.publicKey) {
    return { supported: true, enabled: false, permission: Notification.permission, subscribed: false };
  }

  if (Notification.permission === 'default' && requestPermission) {
    await Notification.requestPermission();
  }

  const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (Notification.permission !== 'granted') {
    if (subscription) {
      await deleteWebPushSubscription(tenantId, subscription.endpoint).catch(() => null);
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }
    return {
      supported: true,
      enabled: true,
      permission: Notification.permission,
      subscribed: false,
    };
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(configuration.publicKey),
    });
  }

  await saveWebPushSubscription(tenantId, subscription.toJSON());
  return {
    supported: true,
    enabled: true,
    permission: Notification.permission,
    subscribed: true,
  };
}
