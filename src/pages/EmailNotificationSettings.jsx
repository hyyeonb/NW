import { useState, useEffect, useCallback, useRef } from 'react';
import { useEmailPreferences, useSaveEmailPreferences, useSaveEmailDevicePrefs, useDeleteEmailDevicePrefs } from '../hooks/useNotifications';
import { devicesApi } from '../api';
import { useAuthStore } from '../stores/authStore';

// ===== 상수 =====

const DELIVERY_MODES = [
  { value: 'IMMEDIATE', label: '즉시' },
  { value: 'DIGEST', label: '요약' },
  { value: 'OFF', label: 'OFF' },
];

const DIGEST_INTERVAL_OPTIONS = [
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 30, label: '30분' },
];

// 통합 장애 유형 (fixedSeverity가 있으면 해당 등급만 활성)
const ALL_ALERT_TYPES = [
  { alertType: 'ICMP', label: 'ICMP (Ping)', icon: 'bi-wifi-off', fixedSeverity: 'CRITICAL' },
  { alertType: 'SNMP', label: 'SNMP', icon: 'bi-hdd-network', fixedSeverity: 'MAJOR' },
  { alertType: 'PORT', label: 'Port DOWN', icon: 'bi-ethernet', fixedSeverity: 'MAJOR' },
  { alertType: 'CPU_MEM', label: 'CPU/Memory', icon: 'bi-cpu', fixedSeverity: null },
  { alertType: 'TRAFFIC', label: 'Traffic', icon: 'bi-bar-chart-line', fixedSeverity: null },
  { alertType: 'TEMPERATURE', label: 'Temperature', icon: 'bi-thermometer-half', fixedSeverity: null },
  { alertType: 'HUMIDITY', label: 'Humidity', icon: 'bi-droplet', fixedSeverity: null },
];

// 하위 호환용
const CONNECTIVITY_TYPES = ALL_ALERT_TYPES.filter(t => t.fixedSeverity);
const PERFORMANCE_TYPES = ALL_ALERT_TYPES.filter(t => !t.fixedSeverity);

const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'];

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MAJOR: '#f97316',
  MINOR: '#f59e0b',
  WARNING: '#3b82f6',
};

// 기본 설정값 (백엔드 없을 때 fallback)
function buildDefaultTypePrefs() {
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

function makeTypeKey(alertType, severity) {
  return `${alertType}__${severity}`;
}

// typePrefs 배열 → Map(key → DELIVERY_MODE)
function buildTypePrefMap(typePrefs) {
  const map = {};
  if (!Array.isArray(typePrefs)) return map;
  for (const p of typePrefs) {
    map[makeTypeKey(p.ALERT_TYPE, p.SEVERITY)] = p.DELIVERY_MODE;
  }
  return map;
}

// ===== 소형 컴포넌트 =====

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`toggle-switch${disabled ? ' email-toggle-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-switch-slider" />
    </label>
  );
}

function ModeSelect({ value, onChange, disabled }) {
  return (
    <select
      className="email-mode-select"
      value={value || 'OFF'}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {DELIVERY_MODES.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}

function SeverityBadge({ severity }) {
  return (
    <span
      className="email-fixed-severity"
      style={{ color: SEVERITY_COLORS[severity], background: `${SEVERITY_COLORS[severity]}18`, border: `1px solid ${SEVERITY_COLORS[severity]}44` }}
    >
      {severity}
    </span>
  );
}

// ===== 장비 검색 모달 =====

function DeviceSearchModal({ onSelect, onClose, alreadyAdded }) {
  const [query, setQuery] = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await devicesApi.getAllDevices();
      const list = res.data?.data || res.data || [];
      const lower = q.toLowerCase();
      const filtered = lower
        ? list.filter(
            (d) =>
              (d.DEVICE_NAME || '').toLowerCase().includes(lower) ||
              (d.DEVICE_IP || '').toLowerCase().includes(lower)
          )
        : list;
      setDevices(filtered);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search('');
  }, [search]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  return (
    <div className="email-modal-overlay" onClick={onClose}>
      <div className="email-modal" onClick={(e) => e.stopPropagation()}>
        <div className="email-modal-header">
          <span><i className="bi bi-hdd-network" /> 장비 선택</span>
          <button className="email-modal-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="email-modal-body">
          <input
            className="email-search-input"
            placeholder="장비명 또는 IP 검색..."
            value={query}
            onChange={handleQueryChange}
            autoFocus
          />
          <div className="email-device-list">
            {loading && (
              <div className="email-device-empty"><i className="bi bi-arrow-repeat email-spin" /> 로딩 중...</div>
            )}
            {!loading && devices.length === 0 && (
              <div className="email-device-empty">검색 결과가 없습니다.</div>
            )}
            {!loading && devices.map((d) => {
              const added = alreadyAdded.has(d.DEVICE_ID);
              return (
                <div
                  key={d.DEVICE_ID}
                  className={`email-device-row${added ? ' email-device-row-added' : ''}`}
                  onClick={() => !added && onSelect(d)}
                >
                  <div className="email-device-row-info">
                    <span className="email-device-row-name">{d.DEVICE_NAME}</span>
                    <span className="email-device-row-ip">{d.DEVICE_IP}</span>
                  </div>
                  {added && <span className="email-device-row-badge">추가됨</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 장비별 오버라이드 카드 =====

function DeviceOverrideCard({ device, globalMap, onSave, onDelete, disabled }) {
  // device = { DEVICE_ID, DEVICE_NAME, DEVICE_IP, overrides: [...] }
  const [localMap, setLocalMap] = useState({});
  const [showAddRow, setShowAddRow] = useState(false);
  const [addAlertType, setAddAlertType] = useState(CONNECTIVITY_TYPES[0].alertType);
  const fixedSevForType = (type) => ALL_ALERT_TYPES.find(t => t.alertType === type)?.fixedSeverity || null;
  const [addSeverity, setAddSeverity] = useState(fixedSevForType(CONNECTIVITY_TYPES[0].alertType) || 'CRITICAL');
  const [addMode, setAddMode] = useState('IMMEDIATE');
  const [saving, setSaving] = useState(false);

  const ALL_TYPES = [
    ...CONNECTIVITY_TYPES.map((t) => t.alertType),
    ...PERFORMANCE_TYPES.map((t) => t.alertType),
  ];
  const ALL_TYPE_LABELS = Object.fromEntries([
    ...CONNECTIVITY_TYPES.map((t) => [t.alertType, t.label]),
    ...PERFORMANCE_TYPES.map((t) => [t.alertType, t.label]),
  ]);

  useEffect(() => {
    const m = {};
    if (Array.isArray(device.overrides)) {
      for (const ov of device.overrides) {
        m[makeTypeKey(ov.ALERT_TYPE, ov.SEVERITY)] = ov.DELIVERY_MODE;
      }
    }
    setLocalMap(m);
  }, [device.overrides]);

  const isDifferentFromGlobal = (alertType, severity, mode) => {
    const globalMode = globalMap[makeTypeKey(alertType, severity)] || 'OFF';
    return mode !== globalMode;
  };

  const handleChange = (alertType, severity, mode) => {
    setLocalMap((prev) => ({ ...prev, [makeTypeKey(alertType, severity)]: mode }));
  };

  const handleSave = async () => {
    setSaving(true);
    const prefs = Object.entries(localMap).map(([key, mode]) => {
      const [alertType, severity] = key.split('__');
      return { ALERT_TYPE: alertType, SEVERITY: severity, DELIVERY_MODE: mode };
    });
    try {
      await onSave(device.DEVICE_ID, prefs);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    const key = makeTypeKey(addAlertType, addSeverity);
    setLocalMap((prev) => ({ ...prev, [key]: addMode }));
    setShowAddRow(false);
  };

  const handleRemoveRow = (key) => {
    setLocalMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const overrideEntries = Object.entries(localMap);

  return (
    <div className={`email-device-card${disabled ? ' email-disabled' : ''}`}>
      <div className="email-device-header">
        <div className="email-device-header-info">
          <i className="bi bi-hdd-network" />
          <span className="email-device-header-name">{device.DEVICE_NAME}</span>
          <span className="email-device-header-ip">{device.DEVICE_IP}</span>
        </div>
        <div className="email-device-header-actions">
          <button
            className="email-btn-sm email-btn-save"
            onClick={handleSave}
            disabled={disabled || saving}
          >
            {saving ? <i className="bi bi-arrow-repeat email-spin" /> : <i className="bi bi-check2" />}
            저장
          </button>
          <button
            className="email-btn-sm email-btn-danger"
            onClick={() => onDelete(device.DEVICE_ID)}
            disabled={disabled}
          >
            <i className="bi bi-trash3" /> 삭제
          </button>
        </div>
      </div>

      <div className="email-device-body">
        {overrideEntries.length === 0 && !showAddRow && (
          <div className="email-device-empty-hint">오버라이드 없음 — 전역 설정 적용</div>
        )}
        {overrideEntries.map(([key, mode]) => {
          const [alertType, severity] = key.split('__');
          const diff = isDifferentFromGlobal(alertType, severity, mode);
          return (
            <div key={key} className={`email-override-row${diff ? ' email-override-highlight' : ''}`}>
              <span className="email-override-type">{ALL_TYPE_LABELS[alertType] || alertType}</span>
              <SeverityBadge severity={severity} />
              <ModeSelect value={mode} onChange={(v) => handleChange(alertType, severity, v)} disabled={disabled} />
              <button className="email-override-remove" onClick={() => handleRemoveRow(key)} disabled={disabled}>
                <i className="bi bi-x" />
              </button>
            </div>
          );
        })}

        {showAddRow && (
          <div className="email-override-row email-override-add-row">
            <select className="email-mode-select" value={addAlertType} onChange={(e) => {
              const type = e.target.value;
              setAddAlertType(type);
              const fixed = fixedSevForType(type);
              if (fixed) setAddSeverity(fixed);
            }}>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{ALL_TYPE_LABELS[t]}</option>)}
            </select>
            <select className="email-mode-select" value={addSeverity} onChange={(e) => setAddSeverity(e.target.value)} disabled={!!fixedSevForType(addAlertType)}>
              {fixedSevForType(addAlertType)
                ? <option value={fixedSevForType(addAlertType)}>{fixedSevForType(addAlertType)} (고정)</option>
                : SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)
              }
            </select>
            <ModeSelect value={addMode} onChange={setAddMode} />
            <button className="email-btn-sm email-btn-save" onClick={handleAddRow}>
              <i className="bi bi-plus" /> 추가
            </button>
            <button className="email-btn-sm" onClick={() => setShowAddRow(false)}>
              <i className="bi bi-x" />
            </button>
          </div>
        )}

        {!showAddRow && (
          <button className="email-add-row-btn" onClick={() => setShowAddRow(true)} disabled={disabled}>
            <i className="bi bi-plus-circle" /> 유형 추가
          </button>
        )}
      </div>
    </div>
  );
}

// ===== 메인 컴포넌트 =====

export default function EmailNotificationSettings() {
  const { data, isLoading } = useEmailPreferences();
  const savePrefs = useSaveEmailPreferences();
  const saveDevicePrefs = useSaveEmailDevicePrefs();
  const deleteDevicePrefs = useDeleteEmailDevicePrefs();

  // 유저 이메일 확인
  const user = useAuthStore((s) => s.user);
  const userEmail = user?.EMAIL;
  const hasEmail = !!userEmail && userEmail.trim() !== '';

  // 전역 설정 폼 상태
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [immediateEnabled, setImmediateEnabled] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestMinutes, setDigestMinutes] = useState(5);
  const [typePrefMap, setTypePrefMap] = useState({});

  // 장비 오버라이드 목록
  const [devicePrefs, setDevicePrefs] = useState([]);

  // 장비 검색 모달
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // 저장 메시지
  const [msg, setMsg] = useState(null);

  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    setEmailEnabled(!!data.pref?.EMAIL_ENABLED);
    setDigestMinutes(data.pref?.DIGEST_MINUTES ?? 5);

    // 기본값 + 저장된 값 merge (저장된 값이 우선)
    const defaultMap = buildTypePrefMap(buildDefaultTypePrefs());
    const savedMap = buildTypePrefMap(data.typePrefs || []);
    setTypePrefMap({ ...defaultMap, ...savedMap });

    setDevicePrefs(data.devicePrefs || []);
    initialLoadRef.current = true;
  }, [data]);

  // 자동 저장 (변경 시 즉시 백엔드 반영, 디바운스 1초)
  const autoSaveTimer = useRef(null);
  const autoSave = useCallback((overrideEnabled, overrideMinutes, overrideMap) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const en = overrideEnabled ?? emailEnabled;
      const dm = overrideMinutes ?? digestMinutes;
      const map = overrideMap ?? typePrefMap;
      try {
        const typePrefs = Object.entries(map).map(([key, mode]) => {
          const [alertType, severity] = key.split('__');
          const fixedSev = ALL_ALERT_TYPES.find(t => t.alertType === alertType)?.fixedSeverity;
          return { ALERT_TYPE: alertType, SEVERITY: fixedSev || severity, DELIVERY_MODE: mode };
        });
        await savePrefs.mutateAsync({ emailEnabled: en, digestMinutes: dm, typePrefs });
      } catch (err) {
        setMsg({ type: 'error', text: err.response?.data?.message || '저장에 실패했습니다.' });
      }
    }, 1000);
  }, [emailEnabled, digestMinutes, typePrefMap, savePrefs]);

  // 초기 로드 시 기본값 merge된 상태로 자동 저장 (기존 유저 설정 보정)
  useEffect(() => {
    if (!initialLoadRef.current) return;
    if (!data) return;
    const defaultMap = buildTypePrefMap(buildDefaultTypePrefs());
    const savedMap = buildTypePrefMap(data.typePrefs || []);
    const hasNewDefaults = Object.keys(defaultMap).some(k => !(k in savedMap));
    if (hasNewDefaults && Object.keys(typePrefMap).length > 0) {
      autoSave(undefined, undefined, typePrefMap);
    }
    initialLoadRef.current = false;
  }, [typePrefMap]);

  const handleModeChange = useCallback((alertType, severity, mode) => {
    setTypePrefMap((prev) => {
      const next = { ...prev, [makeTypeKey(alertType, severity)]: mode };
      autoSave(undefined, undefined, next);
      return next;
    });
  }, [autoSave]);

  const handleAddDevice = (device) => {
    setDevicePrefs((prev) => {
      if (prev.find((d) => d.DEVICE_ID === device.DEVICE_ID)) return prev;
      return [...prev, { DEVICE_ID: device.DEVICE_ID, DEVICE_NAME: device.DEVICE_NAME, DEVICE_IP: device.DEVICE_IP, overrides: [] }];
    });
    setShowDeviceModal(false);
  };

  const handleSaveDevicePrefs = async (deviceId, prefs) => {
    setMsg(null);
    try {
      await saveDevicePrefs.mutateAsync({ deviceId, prefs });
      setMsg({ type: 'success', text: '장비별 설정이 저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || '저장에 실패했습니다.' });
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    setMsg(null);
    try {
      await deleteDevicePrefs.mutateAsync(deviceId);
      setDevicePrefs((prev) => prev.filter((d) => d.DEVICE_ID !== deviceId));
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || '삭제에 실패했습니다.' });
    }
  };

  const disabled = !emailEnabled;
  const alreadyAdded = new Set(devicePrefs.map((d) => d.DEVICE_ID));

  if (isLoading) {
    return <div className="ns-loading"><i className="bi bi-arrow-repeat email-spin" /> 로딩 중...</div>;
  }

  const getModeClass = (mode) => {
    if (mode === 'IMMEDIATE') return 'email-mode-immediate';
    if (mode === 'DIGEST') return 'email-mode-digest';
    return 'email-mode-off';
  };

  return (
    <div className="email-ns-root">
      {/* ===== 헤더 ===== */}
      <div className="email-section-header">
        <div className="email-section-header-left">
          <i className="bi bi-envelope-at" />
          <div>
            <div className="email-section-title">이메일 알림</div>
            <div className="email-section-subtitle">장애 유형별 이메일 발송 방식을 설정합니다</div>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`ns-message ${msg.type}`}>
          <i className={`bi ${msg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}`} />
          {msg.text}
        </div>
      )}

      {/* ===== 기본 설정 ===== */}
      <div className="email-card">

          {!hasEmail && (
            <div className="email-no-email-warn">
              <i className="bi bi-exclamation-triangle" />
              이메일 미등록 — 계정 설정에서 등록 필요
            </div>
          )}

          <div className="ns-toggle-row">
            <div className="ns-toggle-label">
              <span>이메일 알림</span>
              <small>{hasEmail ? userEmail : '미등록'}</small>
            </div>
            <Toggle checked={emailEnabled} onChange={(v) => { setEmailEnabled(v); autoSave(v, undefined, undefined); }} disabled={!hasEmail} />
          </div>

          <div className="ns-divider" />

          <div className={`email-mode-inline${disabled ? ' email-disabled' : ''}`}>
            <div className="email-mode-inline-item">
              <i className="bi bi-lightning-charge email-icon-immediate" />
              <span>즉시 알림</span>
              <Toggle checked={immediateEnabled} onChange={setImmediateEnabled} disabled={disabled} />
            </div>
            <div className="email-mode-inline-sep" />
            <div className="email-mode-inline-item">
              <i className="bi bi-collection email-icon-digest" />
              <span>요약 알림</span>
              <Toggle checked={digestEnabled} onChange={(v) => setDigestEnabled(v)} disabled={disabled} />
              {digestEnabled && (
                <>
                  <span className="email-digest-sep">/</span>
                  <span className="email-digest-label-sm">주기</span>
                  <select
                    className="email-digest-select"
                    value={digestMinutes}
                    onChange={(e) => { const v = Number(e.target.value); setDigestMinutes(v); autoSave(undefined, v, undefined); }}
                    disabled={disabled}
                  >
                    <option value={5}>5분</option>
                    <option value={10}>10분</option>
                    <option value={15}>15분</option>
                    <option value={30}>30분</option>
                    <option value={60}>60분</option>
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

      {/* ===== 장애 알림 설정 ===== */}
      <div className={`email-card${disabled ? ' email-disabled' : ''}`}>
        <div className="email-matrix-header">
          <h3 className="ns-card-title"><i className="bi bi-bell" /> 장애 알림 설정</h3>
          <div className="email-legend">
            <span className="email-legend-item"><span className="email-legend-dot email-mode-immediate" />즉시</span>
            <span className="email-legend-item"><span className="email-legend-dot email-mode-digest" />요약</span>
            <span className="email-legend-item"><span className="email-legend-dot email-mode-off" />OFF</span>
            <span className="email-legend-item"><i className="bi bi-lock" /> 고정</span>
          </div>
        </div>

          <div className="email-matrix-wrapper">
            <table className="email-matrix">
              <thead>
                <tr>
                  <th>유형</th>
                  {SEVERITIES.map((s) => (
                    <th key={s}>
                      <span className="email-sev-header" style={{ '--sev-color': SEVERITY_COLORS[s] }}>
                        <span className="email-sev-dot" style={{ background: SEVERITY_COLORS[s] }} />
                        {s}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ALERT_TYPES.map((t) => (
                  <tr key={t.alertType}>
                    <td className="email-matrix-type-cell">
                      <i className={`bi ${t.icon}`} /> {t.label}
                    </td>
                    {SEVERITIES.map((sev) => {
                      const isFixed = t.fixedSeverity != null;
                      const isActiveCell = !isFixed || t.fixedSeverity === sev;
                      const key = makeTypeKey(t.alertType, sev);
                      const mode = typePrefMap[key] || (isActiveCell && isFixed ? 'IMMEDIATE' : isActiveCell ? 'OFF' : 'OFF');
                      return (
                        <td key={sev} className={isActiveCell ? `email-cell-active ${getModeClass(mode)}` : 'email-cell-locked'}>
                          {isActiveCell ? (
                            <ModeSelect value={mode} onChange={(v) => handleModeChange(t.alertType, sev, v)} disabled={disabled} />
                          ) : (
                            <i className="bi bi-lock email-lock-icon" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {/* ===== 장비별 오버라이드 ===== */}
      <div className={`email-card${disabled ? ' email-disabled' : ''}`}>
        <div className="email-override-section-header">
          <div>
            <h3 className="ns-card-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              <i className="bi bi-sliders2" /> 장비별 오버라이드
            </h3>
            <p className="ns-hint" style={{ marginTop: 4 }}>특정 장비에 대한 발송 방식을 전역 설정과 다르게 지정합니다</p>
          </div>
          <button
            className="email-btn-add-device"
            onClick={() => !disabled && setShowDeviceModal(true)}
            disabled={disabled}
          >
            <i className="bi bi-plus-circle" /> 장비 추가
          </button>
        </div>

        {devicePrefs.length === 0 && (
          <div className="email-device-override-empty">
            <i className="bi bi-inbox" />
            <span>장비별 오버라이드가 없습니다</span>
          </div>
        )}

        <div className="email-device-cards">
          {devicePrefs.map((device) => (
            <DeviceOverrideCard
              key={device.DEVICE_ID}
              device={device}
              globalMap={typePrefMap}
              onSave={handleSaveDevicePrefs}
              onDelete={handleDeleteDevice}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* ===== 장비 검색 모달 ===== */}
      {showDeviceModal && (
        <DeviceSearchModal
          onSelect={handleAddDevice}
          onClose={() => setShowDeviceModal(false)}
          alreadyAdded={alreadyAdded}
        />
      )}
    </div>
  );
}
