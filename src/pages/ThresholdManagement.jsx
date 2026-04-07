import { useState, useEffect, useMemo, useCallback } from 'react';
import { useThresholds, useUpdateThresholds } from '../hooks/useAdmin';
import '../styles/ThresholdManagement.css';

const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'];
const SEV_META = {
  CRITICAL: { label: 'Critical', color: '#ef4444' },
  MAJOR:    { label: 'Major',    color: '#f97316' },
  MINOR:    { label: 'Minor',    color: '#f59e0b' },
  WARNING:  { label: 'Warning',  color: '#3b82f6' },
};
const TYPES = [
  { key: 'CPU',     label: 'CPU',     icon: 'bi-cpu' },
  { key: 'MEM',     label: 'Memory',  icon: 'bi-memory' },
  { key: 'TRAFFIC', label: 'Traffic', icon: 'bi-bar-chart-line' },
];

export default function ThresholdManagement() {
  const { data: thresholds, isLoading } = useThresholds();
  const updateMut = useUpdateThresholds();
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (thresholds) setForm(thresholds.map(t => ({ ...t })));
  }, [thresholds]);

  const dirty = useMemo(() => {
    if (!thresholds || !form) return false;
    return form.some((f, i) => SEVERITIES.some(s => f[s] !== thresholds[i]?.[s]));
  }, [form, thresholds]);

  const setVal = useCallback((idx, sev, val) => {
    setForm(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [sev]: parseInt(val) || 0 };
      return next;
    });
  }, []);

  const handleSave = async () => {
    setMsg(null);
    // 프론트 검증: MAX_VALUE 초과, 음수, 순서
    for (const t of form) {
      const max = t.MAX_VALUE || 100;
      const vals = [t.CRITICAL, t.MAJOR, t.MINOR, t.WARNING];
      const unit = t.TYPE === 'TEMPERATURE' ? '°C' : t.TYPE === 'HUMIDITY' ? '%RH' : '%';
      for (const v of vals) {
        if (v < 0) {
          setMsg({ type: 'error', text: `${t.TYPE}: 임계치 값은 0 미만일 수 없습니다.` });
          return;
        }
        if (v > max) {
          setMsg({ type: 'error', text: `${t.TYPE}: 임계치 값은 최대 ${max}${unit}을(를) 초과할 수 없습니다.` });
          return;
        }
      }
      if (t.CRITICAL < t.MAJOR || t.MAJOR < t.MINOR || t.MINOR < t.WARNING) {
        setMsg({ type: 'error', text: `${t.TYPE}: Critical > Major > Minor > Warning 순서여야 합니다.` });
        return;
      }
    }
    try {
      await updateMut.mutateAsync(form);
      setMsg({ type: 'success', text: '시스템 임계치가 저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || '저장 실패' });
    }
  };

  if (isLoading || !form) {
    return <div className="thr-container"><div className="thr-loading"><i className="bi bi-arrow-repeat" /> 로딩 중...</div></div>;
  }

  return (
    <div className="thr-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title"><i className="bi bi-speedometer2" /> 임계치 관리</h1>
          <span className="page-subtitle">시스템 기본 임계치를 관리합니다</span>
        </div>
        <div className="page-header-right">
          <button className={`thr-btn-save ${dirty ? 'dirty' : ''}`} onClick={handleSave} disabled={!dirty || updateMut.isPending}>
            <i className="bi bi-check2" /> {updateMut.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`thr-msg ${msg.type}`}>
          <i className={`bi ${msg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}`} />
          {msg.text}
        </div>
      )}

      <div className="page-panels-wrapper thr-panels">
        <div className="page-main-content thr-content">
          <table className="thr-table">
            <thead>
              <tr>
                <th className="thr-th-type">유형</th>
                {SEVERITIES.map(s => (
                  <th key={s}><span className="thr-th-sev"><span className="thr-dot" style={{ background: SEV_META[s].color }} />{SEV_META[s].label}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.map((t, idx) => {
                const meta = TYPES.find(m => m.key === t.TYPE) || { label: t.TYPE, icon: 'bi-gear' };
                return (
                  <tr key={t.TYPE}>
                    <td className="thr-td-type"><i className={`bi ${meta.icon}`} />{meta.label}</td>
                    {SEVERITIES.map(s => (
                      <td key={s} className="thr-td-input">
                        <div className="thr-input-wrap">
                          <input type="number" min={0} max={t.MAX_VALUE || 100} value={t[s] ?? ''} onChange={e => setVal(idx, s, e.target.value)} />
                          <span className="thr-unit">{t.TYPE === 'TEMPERATURE' ? '°C' : t.TYPE === 'HUMIDITY' ? '%RH' : '%'}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="thr-footnote"><i className="bi bi-info-circle" /> Critical &gt; Major &gt; Minor &gt; Warning 순서 필수. 장비별 임계치는 자산관리 &gt; 장비설정에서 개별 설정 가능.</p>
        </div>
      </div>
    </div>
  );
}
