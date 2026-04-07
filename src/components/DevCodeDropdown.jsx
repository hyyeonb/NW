import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * 2-depth 장비코드 호버 드롭다운
 * - 1뎁스: 상위 코드 (네트워크, 서버, 전송, FMS)
 * - 2뎁스: 하위 코드 (상위 호버 시 오른쪽에 별도 패널로 표시)
 */
export default function DevCodeDropdown({ devCodes = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hoveredParent, setHoveredParent] = useState(null);
  const [subPos, setSubPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const parentRefs = useRef({});

  const findLabel = (codes, id) => {
    if (!id) return '전체';
    for (const code of codes) {
      if (String(code.DEV_CODE_ID) === String(id)) return code.CODE_NM;
      if (code.children) {
        for (const child of code.children) {
          if (String(child.DEV_CODE_ID) === String(id)) return child.CODE_NM;
        }
      }
    }
    return '전체';
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        const sub = document.querySelector('.devcode-submenu-portal');
        if (sub && sub.contains(e.target)) return;
        setOpen(false);
        setHoveredParent(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleHoverParent = useCallback((parentId) => {
    setHoveredParent(parentId);
    const el = parentRefs.current[parentId];
    if (el) {
      const rect = el.getBoundingClientRect();
      setSubPos({ top: rect.top, left: rect.right + 2 });
    }
  }, []);

  const handleSelect = (codeId) => {
    onChange(codeId ? String(codeId) : '');
    setOpen(false);
    setHoveredParent(null);
  };

  const hoveredParentData = devCodes.find(c => c.DEV_CODE_ID === hoveredParent);

  return (
    <div className="devcode-dropdown" ref={containerRef}>
      <button
        type="button"
        className="devcode-trigger"
        onClick={() => setOpen(!open)}
      >
        <span>{findLabel(devCodes, value)}</span>
        <i className="bi bi-chevron-down devcode-arrow" />
      </button>

      {open && (
        <div className="devcode-menu">
          <div
            className={`devcode-item ${!value ? 'active' : ''}`}
            onClick={() => handleSelect('')}
          >
            전체
          </div>

          {devCodes.map((parent) => (
            <div
              key={parent.DEV_CODE_ID}
              ref={(el) => { parentRefs.current[parent.DEV_CODE_ID] = el; }}
              className={`devcode-item devcode-parent ${String(parent.DEV_CODE_ID) === String(value) ? 'active' : ''} ${hoveredParent === parent.DEV_CODE_ID ? 'hovered' : ''}`}
              onMouseEnter={() => handleHoverParent(parent.DEV_CODE_ID)}
              onMouseLeave={() => {}}
              onClick={() => handleSelect(parent.DEV_CODE_ID)}
            >
              <span>{parent.CODE_NM}</span>
              {parent.children && parent.children.length > 0 && (
                <i className="bi bi-chevron-right devcode-sub-arrow" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2뎁스 서브메뉴 - Portal로 body에 렌더링 */}
      {open && hoveredParent && hoveredParentData?.children?.length > 0 && createPortal(
        <div
          className="devcode-submenu-portal"
          style={{ top: subPos.top, left: subPos.left }}
          onMouseEnter={() => setHoveredParent(hoveredParent)}
          onMouseLeave={() => setHoveredParent(null)}
        >
          {hoveredParentData.children.map((child) => (
            <div
              key={child.DEV_CODE_ID}
              className={`devcode-item ${String(child.DEV_CODE_ID) === String(value) ? 'active' : ''}`}
              onClick={() => handleSelect(child.DEV_CODE_ID)}
            >
              {child.CODE_NM}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
