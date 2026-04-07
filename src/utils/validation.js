/**
 * IP 주소 유효성 검사 (IPv4)
 * @param {string} ip
 * @returns {boolean}
 */
export function isValidIPv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * IP 입력 중간 상태 허용 (타이핑 중)
 * 완전한 IP가 아니어도 유효한 입력 과정인지 체크
 */
export function isPartialIPv4(ip) {
  if (!ip) return true;
  return /^[\d.]*$/.test(ip) && ip.split('.').length <= 4;
}
