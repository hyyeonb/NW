import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LEVELS = [
  { key: 'critical', cnt: 'criticalCnt', label: 'Critical', icon: 'bi-exclamation-circle-fill', q: 'C' },
  { key: 'major',    cnt: 'majorCnt',    label: 'Major',    icon: 'bi-exclamation-triangle-fill', q: 'M' },
  { key: 'minor',    cnt: 'minorCnt',    label: 'Minor',    icon: 'bi-info-circle-fill', q: 'N' },
  { key: 'warning',  cnt: 'warningCnt',  label: 'Warning',  icon: 'bi-exclamation-diamond-fill', q: 'W' },
];

const useHighlightOnIncrease = (cntData, isEditMode) => {
  const [prev, setPrev] = useState(null);
  const [highlighted, setHighlighted] = useState(new Set());

  useEffect(() => {
    if (isEditMode || !cntData) return;
    const cur = LEVELS.reduce((acc, l) => ({ ...acc, [l.key]: cntData[l.cnt] ?? 0 }), {});
    if (prev !== null) {
      const next = new Set();
      LEVELS.forEach(l => { if (cur[l.key] > prev[l.key]) next.add(l.key); });
      if (next.size > 0) {
        setHighlighted(next);
        const t = setTimeout(() => setHighlighted(new Set()), 3000);
        return () => clearTimeout(t);
      }
    }
    setPrev(cur);
  }, [cntData, isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return highlighted;
};

export default function AlertSummaryWidget({ cntData, isEditMode }) {
  const navigate = useNavigate();
  const highlighted = useHighlightOnIncrease(cntData, isEditMode);
  const data = cntData || {};

  return (
    <div className="widget-content-inner">
      <div className="alert-summary-grid">
        {LEVELS.map(l => (
          <div
            key={l.key}
            className={`summary-card ${l.key}${highlighted.has(l.key) ? ' card-highlight' : ''}`}
            onClick={() => !isEditMode && navigate(`/fault/realtime?level=${l.q}`)}
            style={{ cursor: isEditMode ? 'default' : 'pointer' }}
          >
            <div className="summary-icon"><i className={`bi ${l.icon}`}></i></div>
            <div className="summary-content">
              <div className="summary-count">{data[l.cnt] ?? 0}</div>
              <div className="summary-label">{l.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
