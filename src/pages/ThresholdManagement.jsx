import { useState, useEffect, useMemo, useCallback } from 'react';
import { useThresholds, useUpdateThresholds } from '../hooks/useAdmin';
import '../styles/ThresholdManagement.css';

import { SEVERITIES, SEV_META, TYPES } from '../features/threshold-management/model/constants';

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
      const max = next[idx].MAX_VALUE || 100;
      let v = parseInt(val);
      if (isNaN(v)) v = 0;
      if (v < 0) v = 0;
      if (v > max) v = max;
      next[idx] = { ...next[idx], [sev]: v };
      return next;
    });
  }, []);

  const handleSave = async () => {
    setMsg(null);
    // 순서 검증 (값 범위는 input에서 이미 제한됨)
    for (const t of form) {
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
