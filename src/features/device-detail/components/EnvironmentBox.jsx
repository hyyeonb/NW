import { useState, useEffect } from 'react';
import { devicesApi } from '../../../api/devices';

// 온습도 표시 — CPU/MEM 진행 바 스타일.
function EnvironmentBox({ deviceId, metrics }) {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    devicesApi.getEnvironmentLatest(deviceId)
      .then(r => setLatest(r.data?.data || r.data || []))
      .catch(() => setLatest([]))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const temp = latest.find(d => d.METRIC_CODE === 'TEMPERATURE');
  const hum = latest.find(d => d.METRIC_CODE === 'HUMIDITY');
  const tempVal = temp?.VALUE != null ? Number(temp.VALUE) : null;
  const humVal = hum?.VALUE != null ? Number(hum.VALUE) : null;

  // 온도: 0-50°C 범위를 0-100%로 매핑(상온~경고 범위)
  const tempPct = tempVal != null ? Math.max(0, Math.min(100, (tempVal / 50) * 100)) : 0;
  const humPct = humVal != null ? Math.max(0, Math.min(100, humVal)) : 0;

  return (
    <div className="info-box compact-box">
      <div className="info-box-header"><i className="bi bi-thermometer-half"></i> 온습도</div>
      <div className="info-box-body">
        {loading ? (
          <div style={{ padding: '6px 0', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
            <i className="bi bi-arrow-repeat spinning" /> 로딩 중...
          </div>
        ) : (
          <>
            {metrics.includes('TEMPERATURE') && (
              <div className="resource-bar-row">
                <span className="resource-label temp">TEMP</span>
                <div className="resource-track">
                  <div className="resource-fill temp" style={{ width: `${tempPct}%` }}></div>
                </div>
                <span className="resource-value">{tempVal != null ? `${tempVal.toFixed(1)}°C` : '-'}</span>
              </div>
            )}
            {metrics.includes('HUMIDITY') && (
              <div className="resource-bar-row">
                <span className="resource-label hum">HUM</span>
                <div className="resource-track">
                  <div className="resource-fill hum" style={{ width: `${humPct}%` }}></div>
                </div>
                <span className="resource-value">{humVal != null ? `${humVal.toFixed(1)}%` : '-'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EnvironmentBox;
