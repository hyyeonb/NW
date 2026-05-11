import { CONNECTIVITY_TYPES, PERFORMANCE_TYPES, SEVERITIES } from '../model/constants';

// 기본 설정값 (백엔드 없을 때 fallback).
export function buildDefaultTypePrefs() {
  const prefs = [];
  for (const t of CONNECTIVITY_TYPES) {
    prefs.push({ ALERT_TYPE: t.alertType, SEVERITY: t.fixedSeverity, DELIVERY_MODE: 'IMMEDIATE' });
  }
  for (const t of PERFORMANCE_TYPES) {
    for (const sev of SEVERITIES) {
      prefs.push({ ALERT_TYPE: t.alertType, SEVERITY: sev, DELIVERY_MODE: 'OFF' });
    }
  }
  return prefs;
}

export function makeTypeKey(alertType, severity) {
  return `${alertType}__${severity}`;
}

// typePrefs 배열 → Map(key → DELIVERY_MODE).
export function buildTypePrefMap(typePrefs) {
  const map = {};
  if (!Array.isArray(typePrefs)) return map;
  for (const p of typePrefs) {
    map[makeTypeKey(p.ALERT_TYPE, p.SEVERITY)] = p.DELIVERY_MODE;
  }
  return map;
}
