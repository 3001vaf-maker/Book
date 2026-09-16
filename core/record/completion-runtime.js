import { getRecords } from './read.js';
import { completeRecord } from './service.js';
import { recordAppointmentTime } from './state.js';

const COMPLETION_ROLLOUT_DATE = '2026-09-16';
const COMPLETION_POLL_MS = 30_000;
let sweeping = false;

function shouldComplete(record, now) {
  if (!record?.id) return false;
  if (String(record.date || '').slice(0, 10) < COMPLETION_ROLLOUT_DATE) return false;
  if (record.status === 'cancelled' || record.attendance === 'no-show' || record.completed) return false;
  const endAt = recordAppointmentTime(record, 'to');
  return endAt > 0 && endAt <= now;
}

export function sweepCompletedRecords(now = Date.now()) {
  if (sweeping) return 0;
  sweeping = true;
  let completed = 0;
  try {
    for (const record of getRecords()) {
      if (!shouldComplete(record, now)) continue;
      const endAt = recordAppointmentTime(record, 'to');
      const result = completeRecord(record.id, { at: new Date(endAt).toISOString() });
      if (result?.completed) completed += 1;
    }
  } finally {
    sweeping = false;
  }
  return completed;
}

function runSweep() {
  sweepCompletedRecords(Date.now());
}

runSweep();
window.setInterval(runSweep, COMPLETION_POLL_MS);
window.addEventListener('focus', runSweep, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') runSweep();
});
window.addEventListener('book:records-changed', runSweep);
