import { useRef, useCallback } from 'react';

/**
 * 세그먼트 IP 입력 컴포넌트
 * [___] . [___] . [___] . [___]
 * - . 또는 Enter → 다음 칸 이동
 * - 3자리 입력 시 자동 이동
 * - Backspace on empty → 이전 칸 이동
 */
export default function IpInput({ value = '', onChange, disabled = false, className = '' }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const octets = (() => {
    const parts = (value || '').split('.');
    return [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || ''];
  })();

  const emitChange = useCallback((newOctets) => {
    const ip = newOctets.join('.');
    // 모든 칸이 비어있으면 빈 문자열
    if (newOctets.every(o => o === '')) {
      onChange('');
    } else {
      onChange(ip);
    }
  }, [onChange]);

  const handleChange = useCallback((index, e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');

    // 0~255 범위 제한
    if (val.length > 0) {
      const num = parseInt(val, 10);
      if (num > 255) val = '255';
    }

    // 3자리 제한
    if (val.length > 3) val = val.slice(0, 3);

    const newOctets = [...octets];
    newOctets[index] = val;
    emitChange(newOctets);

    // 3자리 입력 시 다음 칸 이동
    if (val.length === 3 && index < 3) {
      refs[index + 1].current?.focus();
      refs[index + 1].current?.select();
    }
  }, [octets, emitChange, refs]);

  const handleKeyDown = useCallback((index, e) => {
    // . 또는 Enter → 다음 칸 이동
    if ((e.key === '.' || e.key === 'Enter') && index < 3) {
      e.preventDefault();
      refs[index + 1].current?.focus();
      refs[index + 1].current?.select();
    }

    // Backspace on empty → 이전 칸 이동
    if (e.key === 'Backspace' && octets[index] === '' && index > 0) {
      e.preventDefault();
      refs[index - 1].current?.focus();
      // 이전 칸의 마지막 문자 삭제
      const newOctets = [...octets];
      newOctets[index - 1] = newOctets[index - 1].slice(0, -1);
      emitChange(newOctets);
    }

    // Tab은 기본 동작 유지
  }, [octets, emitChange, refs]);

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData.getData('text').trim();
    const parts = pasted.split('.');
    if (parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && parseInt(p) <= 255)) {
      e.preventDefault();
      emitChange(parts);
      refs[3].current?.focus();
    }
  }, [emitChange, refs]);

  return (
    <div className={`ip-input-segmented ${className}`}>
      {octets.map((octet, i) => (
        <span key={i} className="ip-segment-group">
          {i > 0 && <span className="ip-dot">.</span>}
          <input
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            className="ip-segment"
            value={octet}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            maxLength={3}
          />
        </span>
      ))}
    </div>
  );
}
