// 숫자/단위 포맷팅 — 도메인 무관 표시 변환

export function fmtPct(n) {
  if (n == null) return '-';
  return `${Math.round(n * 10) / 10}`;
}

export function fmtBps(bps) {
  if (bps == null) return '-';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)}G`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)}K`;
  return `${Math.round(bps)}`;
}

// 날짜 입력을 ko-KR 짧은 표기 (YYYY. MM. DD).
export function formatDateKo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// 바이트 → 사람-친화 단위 (B/KB/MB/GB).
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 날짜+시간을 ko-KR locale 표기 (`2024. 12. 25. 오후 03:42:18` 형태).
export function formatDateTimeKo(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// timestamp/Date 입력을 'YYYY-MM-DD HH:mm' 표기.
export function formatDateTimeMin(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return dateStr;
  }
}

// timestamp/Date 입력을 HH:mm:ss 로 표기. 비-Date 입력은 원본 반환.
export function formatTimeHHMMSS(timeValue) {
  if (!timeValue) return '';
  const date = new Date(timeValue);
  if (isNaN(date.getTime())) return timeValue;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// SNMP hrStorage 등에서 KB 단위로 들어오는 메모리 값을 적절한 단위로 표기.
// v < 1024 → 그대로, < 1e6 → KB, < 1e9 → MB, < 1e12 → GB, 그 이상 → TB.
export function formatMemory(value) {
  if (value == null || value === '' || value === 0) return '-';
  const v = Number(value);
  if (isNaN(v)) return '-';
  if (v < 1024) return `${v}`;
  if (v >= 1e12) return (v / 1e12).toFixed(2) + ' TB';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' GB';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' GB';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + ' MB';
  return v + ' KB';
}

// bps 단위 (Kbps/Mbps/Gbps) 표기. 단위 suffix 포함.
export function formatBpsValue(bps) {
  if (bps == null || isNaN(bps)) return '0 bps';
  if (bps >= 1e9) return (bps / 1e9).toFixed(2) + ' Gbps';
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + ' Mbps';
  if (bps >= 1e3) return (bps / 1e3).toFixed(2) + ' Kbps';
  return bps.toFixed(0) + ' bps';
}

// K/M/G 단위 표기. unit이 'bps' / 'byte' 인 경우 동일 룩업.
export function formatLargeValue(value, unit = '') {
  if (value == null || isNaN(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'G';
  if (abs >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  if (abs > 0 && abs < 0.1) return value.toFixed(2);
  return value.toFixed(1);
}
