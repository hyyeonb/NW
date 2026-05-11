import { PERIOD_OPTIONS } from '../model/constants';

// 모달 상단: LED + 장비 정보 + 기간 segment + 줌 리셋 + 닫기
export default function PEDetailHeader({
  device, ledStatus, modalPeriod, onPeriodClick, onReset, onClose,
}) {
  const ledClass = ledStatus === 'crit' ? 'crit' : ledStatus === 'warn' ? 'warn' : '';
  const subInfo = `${device.deviceIp}${device.modelName ? ` · ${device.modelName}` : ''}`;

  return (
    <div className="pe-detail-head">
      <div className="pe-detail-title">
        <span className={`pe-card-led ${ledClass}`} />
        <div>
          <div className="pe-detail-name">{device.deviceName}</div>
          <div className="pe-detail-ip">{subInfo}</div>
        </div>
      </div>
      <div className="pe-detail-head-right">
        <div className="pe-segment">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={modalPeriod === opt.id ? 'active' : ''}
              onClick={() => onPeriodClick(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button className="pe-detail-reset" onClick={onReset} title="줌 리셋">
          <i className="bi bi-arrow-counterclockwise" /> 리셋
        </button>
        <button className="pe-detail-close" onClick={onClose} title="닫기">
          <i className="bi bi-x-lg" />
        </button>
      </div>
    </div>
  );
}
