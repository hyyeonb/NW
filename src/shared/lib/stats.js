// 시계열 배열에 대한 기본 통계

export function statsOf(arr) {
  const xs = arr.filter(v => v != null && !isNaN(v));
  if (!xs.length) return { avg: null, max: null, min: null, count: 0 };
  const sum = xs.reduce((a, b) => a + b, 0);
  return {
    avg: sum / xs.length,
    max: Math.max(...xs),
    min: Math.min(...xs),
    count: xs.length,
  };
}
