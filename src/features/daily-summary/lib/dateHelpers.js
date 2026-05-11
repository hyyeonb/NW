import { DEBUG_DATE } from '../model/constants';

export function getYesterdayString() {
  if (DEBUG_DATE) return DEBUG_DATE;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStorageKey(dateStr) {
  return `nms_daily_modal_${dateStr}`;
}

export function fmtDate(yyyyMMdd) {
  if (!yyyyMMdd || yyyyMMdd.length < 10) return '';
  const [, m, d] = yyyyMMdd.split('-');
  return `${parseInt(m)}월 ${parseInt(d)}일`;
}
