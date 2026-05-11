import { getDateRange } from '../../../shared/lib/timeRange';
import { PERIOD_OPTIONS } from '../model/constants';

const fmtLocal = (d) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const computePickerPos = (btnRect, itemCount) => {
  const width = 280;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, btnRect.right - width));
  const estH = 50 + Math.min(itemCount, 7) * 50;
  const spaceBelow = window.innerHeight - btnRect.bottom;
  const top = spaceBelow >= estH + 12 || btnRect.top < estH + 12
    ? btnRect.bottom + 6
    : btnRect.top - estH - 6;
  return { top, left };
};

// 모달의 기간 선택/포트 picker 토글 핸들러를 한 곳에 묶음.
// hook으로 만든 이유: 컴포넌트 본문 길이 한계를 넘지 않도록 핸들러 응집.
export function useModalControls(ctx) {
  const {
    modalCustomStart, modalCustomEnd,
    modalShowPortPicker, modalAvailablePorts,
    modalPortBtnRef,
    setModalPeriod, setModalAppliedRange,
    setModalShowPortPicker, setModalPortPickerPos,
  } = ctx;

  const handlePeriodClick = (id) => {
    setModalPeriod(id);
    if (id === 'custom') return;
    const r = getDateRange(id, PERIOD_OPTIONS);
    if (r) setModalAppliedRange(r);
  };

  const applyCustom = () => {
    if (!modalCustomStart || !modalCustomEnd) return;
    setModalAppliedRange({
      startDate: fmtLocal(modalCustomStart),
      endDate: fmtLocal(modalCustomEnd),
    });
    setModalPeriod('custom');
  };

  const togglePortPicker = () => {
    if (modalShowPortPicker) { setModalShowPortPicker(false); return; }
    const r = modalPortBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setModalPortPickerPos(computePickerPos(r, modalAvailablePorts.length));
    setModalShowPortPicker(true);
  };

  return { handlePeriodClick, applyCustom, togglePortPicker };
}
