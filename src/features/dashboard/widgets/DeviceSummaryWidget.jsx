import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { key: 'networkCnt', label: '네트워크', category: '네트워크', icon: 'bi-diagram-3-fill', cls: 'network' },
  { key: 'serverCnt',  label: '서버',     category: '서버',     icon: 'bi-hdd-stack-fill', cls: 'server' },
  { key: 'tranCnt',    label: '전송',     category: '전송',     icon: 'bi-arrow-left-right', cls: 'transfer' },
  { key: 'fmsCnt',     label: 'FMS',      category: 'FMS',      icon: 'bi-building-fill', cls: 'fms' },
];

export default function DeviceSummaryWidget({ cntData, isEditMode }) {
  const navigate = useNavigate();
  const data = cntData || {};

  return (
    <div className="widget-content-inner">
      <div className="device-summary-grid">
        {CATEGORIES.map(({ key, label, category, icon, cls }) => (
          <div
            key={key}
            className="device-card"
            style={{ cursor: isEditMode ? 'default' : 'pointer' }}
            onClick={() => !isEditMode && navigate(`/mgmt/assets?category=${encodeURIComponent(category)}`)}
          >
            <div className={`device-icon ${cls}`}><i className={`bi ${icon}`}></i></div>
            <div className="device-content">
              <div className="device-count">{data[key] ?? 0}</div>
              <div className="device-label">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
