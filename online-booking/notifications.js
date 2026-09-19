// Compatibility bridge retained for older imports.
// Account notifications now render inside the shared Messages UI in
// online-booking/account-shell.js. This module intentionally owns no CSS,
// buttons, modal markup, or floating controls.
export function mountBookingNotifications() {
  return () => {};
}
