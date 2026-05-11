import { useState, useEffect, useCallback } from 'react';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '../hooks/useNotifications';
import { useAlertStore } from '../stores/alertStore';
import EmailNotificationSettings from './EmailNotificationSettings';
import '../styles/NotificationSettings.css';

import { ALERT_TYPES, SEVERITY_LEVELS, SOUND_TYPES, TABS, playPreviewSound, Toggle } from '../features/notification-settings/parts';

export default function NotificationSettings() {
  const { data, isLoading } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('alert');

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isDirty = (() => {
    if (!data || !form) return false;
    return Object.keys(form).some((k) => {
      if (k === 'USER_ID' || k === 'CREATE_AT' || k === 'MODIFY_AT') return false;
      return form[k] !== data[k];
    });
  })();

  const handleSave = async () => {
    setMsg(null);
    try {
      await updatePrefs.mutateAsync(form);
      useAlertStore.getState().setNotificationPrefs(form);
      setMsg({ type: 'success', text: '알림 설정이 저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || '저장에 실패했습니다.' });
    }
  };

  if (isLoading || !form) {
    return (
      <div className="ns-container"><div className="ns-loading"><i className="bi bi-arrow-repeat" /> 로딩 중...</div></div>
    );
  }

  return (
    <div className="ns-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title"><i className="bi bi-bell"></i> 알림 설정</h1>
          <span className="page-subtitle">알림 유형, 등급, 사운드 및 방해금지를 설정합니다</span>
        </div>
        {activeTab === 'alert' && (
          <div className="page-header-right">
            <button className={`ns-btn-save ${isDirty ? 'dirty' : ''}`} onClick={handleSave} disabled={!isDirty || updatePrefs.isPending}>
              <i className="bi bi-check2" /> {updatePrefs.isPending ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        )}
      </div>

      <div className="page-panels-wrapper ns-panels">
        <div className="page-main-content ns-content">

          {/* ===== 탭바 (카드 상단) ===== */}
          <div className="ns-tab-bar">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`ns-tab-btn${activeTab === t.key ? ' active' : ''}`}
                onClick={() => { setActiveTab(t.key); setMsg(null); }}
              >
                <i className={`bi ${t.icon}`} />
                {t.label}
              </button>
            ))}
          </div>

          {msg && (
            <div className={`ns-message ${msg.type}`}>
              <i className={`bi ${msg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}`} />
              {msg.text}
            </div>
          )}

          {activeTab === 'alert' && (
            <>
              {/* ===== 상단: 알림 유형 + 장애 등급 ===== */}
              <div className="ns-row">
                <div className="ns-card">
                  <h3 className="ns-card-title"><i className="bi bi-funnel" /> 알림 유형</h3>
                  <div className="ns-type-grid">
                    {ALERT_TYPES.map((t) => (
                      <div key={t.key} className={`ns-type-chip ${form[t.key] ? 'on' : 'off'}`}
                        onClick={() => setField(t.key, !form[t.key])}>
                        <i className={`bi ${t.icon}`} />
                        <div className="ns-type-chip-text">
                          <span>{t.label}</span>
                          <small>{t.desc}</small>
                        </div>
                        <Toggle checked={!!form[t.key]} onChange={(v) => setField(t.key, v)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ns-card">
                  <h3 className="ns-card-title"><i className="bi bi-exclamation-triangle" /> 장애 등급</h3>
                  <p className="ns-hint">유형 AND 등급 모두 활성이어야 알림 표시</p>
                  <div className="ns-severity-grid">
                    {SEVERITY_LEVELS.map((s) => (
                      <div key={s.key}
                        className={`ns-severity-chip ${form[s.key] ? 'on' : 'off'}`}
                        style={{ '--sev-color': s.color, '--sev-bg': s.bg }}
                        onClick={() => setField(s.key, !form[s.key])}>
                        <div className="ns-severity-dot" />
                        <span>{s.label}</span>
                        <Toggle checked={!!form[s.key]} onChange={(v) => setField(s.key, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ===== 하단: 사운드 + 기타 설정 ===== */}
              <div className="ns-row ns-row-compact">
                <div className="ns-card">
                  <h3 className="ns-card-title"><i className="bi bi-volume-up" /> 사운드</h3>
                  <div className="ns-toggle-row">
                    <div className="ns-toggle-label"><span>알림 사운드</span></div>
                    <Toggle checked={!!form.SOUND_ENABLED} onChange={(v) => setField('SOUND_ENABLED', v)} />
                  </div>
                  {form.SOUND_ENABLED && (
                    <>
                      <div className="ns-slider-row">
                        <label>볼륨</label>
                        <input type="range" className="ns-slider" min={0} max={100}
                          value={form.SOUND_VOLUME || 30}
                          onChange={(e) => setField('SOUND_VOLUME', parseInt(e.target.value))} />
                        <span className="ns-slider-value">{form.SOUND_VOLUME || 30}%</span>
                      </div>
                      <div className="ns-select-row">
                        <label>효과음</label>
                        <select className="ns-select" value={form.SOUND_TYPE || 'SINE'}
                          onChange={(e) => setField('SOUND_TYPE', e.target.value)}>
                          {SOUND_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <button className="ns-preview-btn" onClick={() => playPreviewSound(form.SOUND_TYPE, form.SOUND_VOLUME)}>
                          <i className="bi bi-play-fill" /> 미리듣기
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="ns-card">
                  <h3 className="ns-card-title"><i className="bi bi-gear" /> 기타 설정</h3>
                  <div className="ns-toggle-row">
                    <div className="ns-toggle-label">
                      <span><i className="bi bi-window" style={{ marginRight: 6 }} />브라우저 푸시 알림</span>
                    </div>
                    <Toggle
                      checked={!!form.BROWSER_NOTIFY}
                      onChange={(v) => {
                        if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                          Notification.requestPermission().then((perm) => setField('BROWSER_NOTIFY', perm === 'granted'));
                        } else {
                          setField('BROWSER_NOTIFY', v);
                        }
                      }}
                    />
                  </div>

                  <div className="ns-divider" />

                  <div className="ns-toggle-row">
                    <div className="ns-toggle-label">
                      <span><i className="bi bi-moon" style={{ marginRight: 6 }} />방해금지 모드</span>
                      <small>설정 시간대에 알림 억제</small>
                    </div>
                    <Toggle checked={!!form.QUIET_ENABLED} onChange={(v) => setField('QUIET_ENABLED', v)} />
                  </div>
                  {form.QUIET_ENABLED && (
                    <div className="ns-time-row">
                      <input type="time" value={form.QUIET_START_TIME || '22:00'}
                        onChange={(e) => setField('QUIET_START_TIME', e.target.value)} />
                      <span className="ns-time-sep">~</span>
                      <input type="time" value={form.QUIET_END_TIME || '07:00'}
                        onChange={(e) => setField('QUIET_END_TIME', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'email' && (
            <div className="ns-email-tab-content">
              <EmailNotificationSettings />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
