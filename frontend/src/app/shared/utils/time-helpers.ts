import { format } from 'date-fns';

export function snapToHalfHour(hour: number): number {
  return Math.round(hour * 2) / 2;
}

export function snapToGrid(hour: number, snapMinutes: number): number {
  const step = snapMinutes / 60;
  return Math.round(hour / step) * step;
}

export function hourToStr(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour % 1) * 60);
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

export function formatTime(date: Date): string {
  return format(new Date(date), 'HH:mm');
}
