import { useState, useEffect, useCallback, useRef } from 'react';
import { devicesApi } from '../api/devices';
import { ITEMS, INIT_STATES, buildItemState, CheckRow } from '../features/connectivity-check/parts';


export default function ConnectivityCheckModal({ device, onClose }) {
  const [overallStatus, setOverallStatus] = useState('idle'); // idle | checking | done | error
  const [itemStates, setItemStates] = useState(INIT_STATES);
  const [errorMsg, setErrorMsg] = useState('');
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const runCheck = useCallback(async () => {
    if (!device?.DEVICE_ID) return;
    clearTimers();

    setOverallStatus('checking');
    setItemStates([{ phase: 'checking' }, { phase: 'pending' }, { phase: 'pending' }]);
    setErrorMsg('');

    try {
      const res = await devicesApi.checkConnectivity(device.DEVICE_ID);
      const data = res.data?.data;
      if (!data) throw new Error('응답 데이터가 없습니다.');

      const s0 = buildItemState('ping', data);
      const s1 = buildItemState('snmp', data);
      const s2 = buildItemState('ssh', data);

      // 즉시: PING 결과 공개 + SNMP 체크 중
      setItemStates([s0, { phase: 'checking' }, { phase: 'pending' }]);

      const t1 = setTimeout(() => {
        // 450ms: SNMP 결과 공개 + SSH 체크 중
        setItemStates([s0, s1, { phase: 'checking' }]);
      }, 450);

      const t2 = setTimeout(() => {
        // 900ms: SSH 결과 공개
        setItemStates([s0, s1, s2]);
      }, 900);

      const t3 = setTimeout(() => {
        setOverallStatus('done');
      }, 1050);

      timersRef.current = [t1, t2, t3];
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || '체크 중 오류가 발생했습니다.');
      setOverallStatus('error');
    }
  }, [device?.DEVICE_ID]);

  useEffect(() => {
    runCheck();
    return () => clearTimers();
  }, [runCheck]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isChecking = overallStatus === 'checking';

  return (
    <div className="cc-backdrop" onClick={handleBackdropClick}>
      <div className="cc-modal-content">
        {/* Close */}
        <span className="cc-close-btn" onClick={onClose}>&times;</span>

        {/* Title */}
        <h3 className="cc-title">
          <i className="bi bi-activity" />
          장비 점검
        </h3>

        {/* Device Info */}
        <div className="cc-device-bar">
          <div className="cc-device-bar-left">
            <i className="bi bi-hdd-network" />
            <span className="cc-device-name">{device?.DEVICE_NAME || '-'}</span>
          </div>
          <span className="cc-device-ip">{device?.DEVICE_IP || '-'}</span>
        </div>

        {/* Body */}
        <div className="cc-body">
          {/* 진행 바 (체크 중일 때만) */}
          {isChecking && (
            <div className="cc-progress-wrap">
              <div className="cc-progress-bar" />
            </div>
          )}

          {/* 에러 */}
          {overallStatus === 'error' && (
            <div className="cc-error-state">
              <i className="bi bi-exclamation-triangle-fill cc-error-icon" />
              <p className="cc-error-text">{errorMsg}</p>
            </div>
          )}

          {/* 체크 항목 (checking 중이거나 done이면 항상 표시) */}
          {(isChecking || overallStatus === 'done') && (
            <div className="cc-check-rows">
              {ITEMS.map((item, idx) => (
                <CheckRow
                  key={item.key}
                  label={item.label}
                  iconClass={item.icon}
                  state={itemStates[idx]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cc-footer">
          <button
            className="cc-retry-btn"
            onClick={runCheck}
            disabled={isChecking}
          >
            <i className="bi bi-arrow-clockwise" />
            다시 체크
          </button>
          <button className="btn btn-primary cc-confirm-btn" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
