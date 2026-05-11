// User-Agent 문자열 → 브라우저 이름 추출.
export function parseBrowser(ua) {
  if (!ua) return '-';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/')) return 'Safari';
  return 'Browser';
}
