import { Injectable } from '@nestjs/common';

export type TimeUsage = {
  id?: string;
  sourceId?: string;
  from: string;
  to: string;
};

@Injectable()
export class TimeService {
  timeToMinutes(value: unknown) {
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  minutesToTime(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 24 * 60) return '';
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  containsRange(planFrom: string, planTo: string, from: string, to: string) {
    const start = this.timeToMinutes(planFrom);
    const end = this.timeToMinutes(planTo);
    const candidateStart = this.timeToMinutes(from);
    const candidateEnd = this.timeToMinutes(to);
    return start != null && end != null && candidateStart != null && candidateEnd != null
      && candidateEnd > candidateStart && start <= candidateStart && candidateEnd <= end;
  }

  rangesOverlap(leftFrom: string, leftTo: string, rightFrom: string, rightTo: string) {
    const a = this.timeToMinutes(leftFrom);
    const b = this.timeToMinutes(leftTo);
    const c = this.timeToMinutes(rightFrom);
    const d = this.timeToMinutes(rightTo);
    return a != null && b != null && c != null && d != null && b > a && d > c && a < d && c < b;
  }

  checkAvailability({
    planFrom,
    planTo,
    from,
    to,
    usages = [],
    excludeId = '',
  }: {
    planFrom: string;
    planTo: string;
    from: string;
    to: string;
    usages?: TimeUsage[];
    excludeId?: string;
  }) {
    if (!this.containsRange(planFrom, planTo, from, to)) {
      return { ok: false, reason: 'outside-working-time', conflicts: [] as TimeUsage[] };
    }
    const excluded = String(excludeId || '');
    const conflicts = usages.filter((usage) => {
      const id = String(usage.sourceId ?? usage.id ?? '');
      return (!excluded || id !== excluded) && this.rangesOverlap(from, to, String(usage.from || ''), String(usage.to || ''));
    });
    return conflicts.length
      ? { ok: false, reason: 'occupied', conflicts }
      : { ok: true, reason: '', conflicts: [] as TimeUsage[] };
  }
}
