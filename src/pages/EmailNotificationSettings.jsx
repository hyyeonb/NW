import { useState, useEffect, useCallback, useRef } from 'react';
import { useEmailPreferences, useSaveEmailPreferences, useSaveEmailDevicePrefs, useDeleteEmailDevicePrefs } from '../hooks/useNotifications';
import { devicesApi } from '../api/devices';
import { useAuthStore } from '../stores/authStore';

// ===== 상수 =====

import { DELIVERY_MODES, DIGEST_INTERVAL_OPTIONS, ALL_ALERT_TYPES, CONNECTIVITY_TYPES, PERFORMANCE_TYPES, SEVERITIES, SEVERITY_COLORS } from '../features/email-notification/model/constants';
import { buildDefaultTypePrefs, makeTypeKey, buildTypePrefMap } from '../features/email-notification/lib/typePrefs';
import { Toggle, ModeSelect, SeverityBadge, DeviceSearchModal, DeviceOverrideCard } from '../features/email-notification/components';

// ===== 소형 컴포넌트 =====
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

  const initialLoadRef = useRef(true);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    // 최초 1회만 state 초기화 (autoSave로 인한 data 갱신 시 재설정 방지)
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    setEmailEnabled(!!data.pref?.EMAIL_ENABLED);
    setDigestMinutes(data.pref?.DIGEST_MINUTES ?? 5);

    // 기본값 + 저장된 값 merge (저장된 값이 우선)
    const defaultMap = buildTypePrefMap(buildDefaultTypePrefs());
    const savedMap = buildTypePrefMap(data.typePrefs || []);
    setTypePrefMap({ ...defaultMap, ...savedMap });

    setDevicePrefs(data.devicePrefs || []);
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

  // 초기 로드 시 기본값 merge된 상태로 자동 저장 (기존 유저 설정 보정, 1회만)
  useEffect(() => {
    if (!initialLoadRef.current || !dataLoadedRef.current) return;
    if (Object.keys(typePrefMap).length === 0) return;
    const defaultMap = buildTypePrefMap(buildDefaultTypePrefs());
    const savedMap = buildTypePrefMap(data?.typePrefs || []);
    const hasNewDefaults = Object.keys(defaultMap).some(k => !(k in savedMap));
    if (hasNewDefaults) {
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
