// 트래픽 row 컬럼 추출 — High 값 우선, 없으면 일반 값 폴백 (COALESCE 패턴).

const num = (v) => (v != null ? Number(v) : 0);

export const getInBps = (r) => num(r.IN_HIGH_BPS ?? r.IN_BPS);
export const getOutBps = (r) => num(r.OUT_HIGH_BPS ?? r.OUT_BPS);
export const getInPercent = (r) => num(r.IN_HIGH_USED_PERCENT ?? r.IN_USED_PERCENT);
export const getOutPercent = (r) => num(r.OUT_HIGH_USED_PERCENT ?? r.OUT_USED_PERCENT);

export const hasPercentData = (rows) => {
  if (!rows || rows.length === 0) return false;
  return rows.some(r => r.IN_HIGH_USED_PERCENT != null || r.IN_USED_PERCENT != null);
};
