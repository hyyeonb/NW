import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function RegularGroupContextMenu({ x, y, group, onClose, onEditDevices }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    // setTimeout으로 다음 틱에 등록해야 열리자마자 닫히는 것 방지
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x, newY = y;
      if (rect.right > window.innerWidth) newX = x - rect.width;
      if (rect.bottom > window.innerHeight) newY = y - rect.height;
      menuRef.current.style.left = `${newX}px`;
      menuRef.current.style.top = `${newY}px`;
    }
  }, [x, y]);

  return createPortal(
    <div ref={menuRef} className="watch-context-menu" style={{ left: x, top: y, zIndex: 9999 }}>
      <div
        className="watch-context-menu-item"
        onClick={() => { onEditDevices(group); onClose(); }}
      >
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
    </div>,
    document.body
  );
}

export default RegularGroupContextMenu;
