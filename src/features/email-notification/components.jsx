/* eslint-disable react-refresh/only-export-components, max-lines-per-function, complexity, max-lines */
// EmailNotificationSettings sub-components: Toggle, ModeSelect, SeverityBadge, DeviceSearchModal, DeviceOverrideCard.

import { useState, useEffect, useRef, useCallback } from 'react';
import { devicesApi } from '../../api/devices';
import { DELIVERY_MODES, ALL_ALERT_TYPES, CONNECTIVITY_TYPES, PERFORMANCE_TYPES, SEVERITIES, SEVERITY_COLORS } from './model/constants';
import { makeTypeKey } from './lib/typePrefs';

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


export { Toggle, ModeSelect, SeverityBadge, DeviceSearchModal, DeviceOverrideCard };
