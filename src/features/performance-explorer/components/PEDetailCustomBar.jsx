import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';

// custom 기간 선택 바 — 시작/종료 datepicker + 적용 버튼.
export default function PEDetailCustomBar({
  customStart, customEnd, setCustomStart, setCustomEnd, onApply,
}) {
  const commonProps = {
    showTimeSelect: true,
    timeIntervals: 5,
    dateFormat: 'yyyy-MM-dd HH:mm',
    locale: ko,
    className: 'pe-input',
    popperPlacement: 'bottom-start',
    popperClassName: 'pe-detail-datepicker-popper',
  };

  return (
    <div className="pe-detail-custom-bar">
      <span className="pe-detail-custom-label">기간:</span>
      <DatePicker
        {...commonProps}
        selected={customStart}
        onChange={setCustomStart}
        placeholderText="시작 일시"
      />
      <span className="pe-sep">~</span>
      <DatePicker
        {...commonProps}
        selected={customEnd}
        onChange={setCustomEnd}
        placeholderText="종료 일시"
      />
      <button className="pe-btn-apply" onClick={onApply}>
        <i className="bi bi-check2" /> 적용
      </button>
    </div>
  );
}
