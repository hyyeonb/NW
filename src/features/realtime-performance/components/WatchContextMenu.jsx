import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function WatchContextMenu({ x, y, group, onClose, onAdd, onAddChild, onRename, onEditDevices, onDelete, onSetIcon }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 메뉴 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;

      if (rect.right > window.innerWidth) {
        newX = x - rect.width;
      }
      if (rect.bottom > window.innerHeight) {
        newY = y - rect.height;
      }

      menuRef.current.style.left = `${newX}px`;
      menuRef.current.style.top = `${newY}px`;
    }
  }, [x, y]);

  // 그룹이 없으면 추가 메뉴만 표시
  if (!group) {
    return createPortal(
      <div
        ref={menuRef}
        className="watch-context-menu"
        style={{ left: x, top: y }}
      >
        <div
          className="watch-context-menu-item"
          onClick={() => {
            onAdd();
            onClose();
          }}
        >
          <i className="bi bi-plus-lg"></i>
          <span>그룹 추가</span>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="watch-context-menu"
      style={{ left: x, top: y }}
    >
      <div
        className="watch-context-menu-item"
        onClick={() => { onSetIcon(group); onClose(); }}
      >
        <i className="bi bi-palette"></i>
        <span>아이콘 설정</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onRename(group); onClose(); }}
      >
        <i className="bi bi-pencil"></i>
        <span>그룹 이름 변경</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onEditDevices(group); onClose(); }}
      >
        <i className="bi bi-hdd-network"></i>
        <span>관제 장비 설정</span>
      </div>
      <div
        className="watch-context-menu-item"
        onClick={() => { onAddChild(group); onClose(); }}
      >
        <i className="bi bi-plus-lg"></i>
        <span>하위 그룹 추가</span>
      </div>
      <div className="watch-context-menu-divider"></div>
      <div
        className="watch-context-menu-item danger"
        onClick={() => { onDelete(group); onClose(); }}
      >
        <i className="bi bi-trash"></i>
        <span>삭제</span>
      </div>
    </div>,
    document.body
  );
}

export default WatchContextMenu;
