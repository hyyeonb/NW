// 시간 범위 / granularity / 시계열 갭 처리 — 도메인 무관

const PAD = n => String(n).padStart(2, '0');

// 백엔드 DB는 KST 로컬 시간을 raw 문자열로 저장하므로 로컬 시간 포맷으로 전달 (UTC 변환 금지)
const fmtLocal = d =>
  `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}T${PAD(d.getHours())}:${PAD(d.getMinutes())}`;

// quickPeriods: { id, minutes } 배열. id === 'custom' 인 경우 customStart/customEnd 사용.
export function getDateRange(period, quickPeriods, customStart, customEnd) {
  if (period === 'custom') return { startDate: customStart, endDate: customEnd };
  const opt = quickPeriods.find(p => p.id === period);
  if (!opt) return null;
  const end = new Date();
  const start = new Date(end.getTime() - opt.minutes * 60 * 1000);
  return { startDate: fmtLocal(start), endDate: fmtLocal(end) };
}

export function autoGranularity(startDate, endDate) {
  if (!startDate || !endDate) return 'auto';
  const ms = new Date(endDate) - new Date(startDate);
  const hours = ms / (1000 * 60 * 60);
  if (hours <= 6) return 'raw';
  if (hours <= 48) return '5min';
  if (hours <= 14 * 24) return '30min';
  return '1hour';
}

// 기간(ms) 기준 expected 수집 간격 (granularity 기준).
// 인자 없을 때 default 5min — 차트 gap 계산 baseline 보존.
export function expectedIntervalMs(startDate, endDate) {
  if (!startDate || !endDate) return 5 * 60 * 1000;
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  const hours = ms / 3600000;
  if (hours <= 6) return 60 * 1000;          // raw 1min
  if (hours <= 48) return 5 * 60 * 1000;     // 5min
  if (hours <= 14 * 24) return 30 * 60 * 1000; // 30min
  return 60 * 60 * 1000;                     // 1hour
}

// 시계열 포인트 배열에서 gapThresholdMs 초과 간격 발견 시 null 포인트를 삽입.
// ECharts 라인 차트에서 끊김(gap) 표현용.
// 입력 timestamp는 ISO string 또는 numeric 모두 지원, 출력 형식은 입력과 동일하게 유지.
export function insertGaps(points, gapThresholdMs) {
  if (!points || points.length < 2) return points || [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const prevRaw = prev?.[0];
    const curRaw = cur?.[0];
    const prevTs = typeof prevRaw === 'string' ? new Date(prevRaw).getTime() : prevRaw;
    const curTs = typeof curRaw === 'string' ? new Date(curRaw).getTime() : curRaw;
    if (prevTs != null && curTs != null && curTs - prevTs > gapThresholdMs) {
      const gapTs = prevTs + 1;
      const gapKey = typeof prevRaw === 'string' ? new Date(gapTs).toISOString() : gapTs;
      out.push([gapKey, null]);
    }
    out.push(cur);
  }
  return out;
}
