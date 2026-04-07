import { useState, useEffect, useCallback } from 'react';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '../hooks/useNotifications';
import { useAlertStore } from '../stores/alertStore';
import EmailNotificationSettings from './EmailNotificationSettings';
import '../styles/NotificationSettings.css';

const ALERT_TYPES = [
  { key: 'NOTIFY_SNMP', label: 'SNMP 장애', desc: 'SNMP 연결 실패', icon: 'bi-hdd-network' },
  { key: 'NOTIFY_ICMP', label: 'ICMP 장애', desc: 'Ping 응답 없음', icon: 'bi-wifi-off' },
  { key: 'NOTIFY_PORT', label: '포트 상태', desc: 'UP/DOWN 변경', icon: 'bi-ethernet' },
  { key: 'NOTIFY_CPU_MEM', label: 'CPU/Memory', desc: '사용률 알림', icon: 'bi-cpu' },
  { key: 'NOTIFY_TRAFFIC', label: 'Traffic', desc: '트래픽 이상', icon: 'bi-bar-chart-line' },
  { key: 'NOTIFY_URGENT', label: '긴급 공지', desc: '관리자 긴급 공지', icon: 'bi-megaphone' },
];

const SEVERITY_LEVELS = [
  { key: 'NOTIFY_CRITICAL', label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { key: 'NOTIFY_MAJOR', label: 'Major', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'NOTIFY_MINOR', label: 'Minor', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { key: 'NOTIFY_WARNING', label: 'Warning', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
];

const SOUND_TYPES = [
  { value: 'SINE', label: 'Sine' },
  { value: 'BEEP', label: 'Beep' },
  { value: 'CHIME', label: 'Chime' },
  { value: 'ALARM', label: 'Alarm' },
];

function playPreviewSound(type, volume) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = (volume || 30) / 100;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freqMap = { SINE: 440, BEEP: 880, CHIME: 523, ALARM: 660 };
    osc.frequency.value = freqMap[type] || 440;
    osc.type = type === 'ALARM' ? 'sawtooth' : type === 'BEEP' ? 'square' : 'sine';
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* ignore */ }
}

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-switch-slider" />
    </label>
  );
}

const TABS = [
  { key: 'alert', label: '알림', icon: 'bi-bell' },
  { key: 'email', label: '이메일', icon: 'bi-envelope-at' },
];

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

      {/* ===== 탭 ===== */}
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
        <div className="page-panels-wrapper ns-panels">
          <div className="page-main-content ns-content">
            {/* ===== 상단: 알림 유형 + 장애 등급 ===== */}
            <div className="ns-row">
              {/* 알림 유형 */}
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

              {/* 장애 등급 */}
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
              {/* 사운드 */}
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

              {/* 기타 설정 */}
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
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="page-panels-wrapper ns-panels">
          <div className="page-main-content ns-content ns-email-tab-content">
            <EmailNotificationSettings />
          </div>
        </div>
      )}
    </div>
  );
}
