import { useState, useEffect, useRef, useCallback } from 'react';
import { useGroupStore } from '../stores';
import { useUpdateGroupIcon } from '../hooks';
import {
  fontAwesomeIconsByCategory,
  materialIconsByCategory,
  bootstrapIconsByCategory,
} from '../data/iconData';

export default function IconSelectorModal({ onClose, onSuccess }) {
  const { iconModalGroup, hideIconModal } = useGroupStore();
  const updateIconMutation = useUpdateGroupIcon();
  const modalRef = useRef(null);

  // 현재 활성 탭
  const [activeTab, setActiveTab] = useState('fontawesome');

  // 검색어
  const [searchTerms, setSearchTerms] = useState({
    fontawesome: '',
    material: '',
    bootstrap: '',
  });

  // 현재 카테고리
  const [currentCategories, setCurrentCategories] = useState({
    fontawesome: '전체',
    material: '전체',
    bootstrap: '전체',
  });

  // 모달 외부 클릭 및 ESC 키 처리
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        handleClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleClose = () => {
    hideIconModal();
    if (onClose) onClose();
  };

  // 탭 데이터 매핑
  const tabData = {
    fontawesome: { icons: fontAwesomeIconsByCategory, type: 'fa', label: 'Font Awesome' },
    material: { icons: materialIconsByCategory, type: 'mat', label: 'Material Icons' },
    bootstrap: { icons: bootstrapIconsByCategory, type: 'bi', label: 'Bootstrap Icons' },
  };

  // 검색어 변경
  const handleSearchChange = (tab, value) => {
    setSearchTerms((prev) => ({ ...prev, [tab]: value }));
  };

  // 카테고리 변경
  const handleCategoryChange = (tab, category) => {
    setCurrentCategories((prev) => ({ ...prev, [tab]: category }));
  };

  // 아이콘 선택
  const handleSelectIcon = async (iconName, iconType) => {
    if (!iconModalGroup) return;

    try {
      await updateIconMutation.mutateAsync({
        groupId: iconModalGroup.GROUP_ID,
        iconName,
        iconType,
      });

      // 성공 시 트리 새로고침
      if (window.reloadGroupTree) {
        window.reloadGroupTree();
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('아이콘 설정 오류:', error);
      alert('아이콘 설정에 실패했습니다.');
    }
  };

  // 아이콘 렌더링
  const renderIcon = (iconName, type) => {
    if (type === 'fa') {
      return <i className={`fa-solid ${iconName}`} />;
    } else if (type === 'mat') {
      return <span className="material-icons">{iconName}</span>;
    } else if (type === 'bi') {
      return <i className={iconName} />;
    }
    return null;
  };

  // 필터된 아이콘 목록 가져오기
  const getFilteredIcons = (tab) => {
    const { icons } = tabData[tab];
    const category = currentCategories[tab];
    const searchTerm = searchTerms[tab].toLowerCase();

    // '전체' 카테고리면 모든 아이콘 합치기
    let iconList = [];
    if (category === '전체') {
      iconList = Object.values(icons).flat();
    } else {
      iconList = icons[category] || [];
    }

    if (searchTerm) {
      iconList = iconList.filter((icon) => icon.toLowerCase().includes(searchTerm));
    }

    return iconList;
  };

  // 카테고리 목록 가져오기 ('전체' 추가)
  const getCategories = (tab) => {
    const { icons } = tabData[tab];
    return ['전체', ...Object.keys(icons)];
  };

  if (!iconModalGroup) return null;

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div ref={modalRef} className="modal-content icon-modal-content">
        <span className="close-btn" onClick={handleClose}>
          &times;
        </span>

        {/* 아이콘 라이브러리 탭 */}
        <div className="icon-tab-container">
          <div className="icon-tab-buttons">
            {Object.entries(tabData).map(([key, { label }]) => (
              <button
                key={key}
                className={`icon-tab-button ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 각 탭의 콘텐츠 */}
          {Object.entries(tabData).map(([tabKey, { icons, type }]) => (
            <div
              key={tabKey}
              className={`icon-tab-content ${activeTab === tabKey ? 'active' : ''}`}
            >
              {/* 검색창 */}
              <div className="icon-search-container">
                <input
                  type="text"
                  className="icon-search-input"
                  placeholder="아이콘 검색..."
                  value={searchTerms[tabKey]}
                  onChange={(e) => handleSearchChange(tabKey, e.target.value)}
                />
              </div>

              {/* 카테고리 버튼 */}
              <div className="icon-category-buttons">
                {getCategories(tabKey).map((category) => (
                  <button
                    key={category}
                    className={`icon-category-btn ${
                      currentCategories[tabKey] === category ? 'active' : ''
                    }`}
                    onClick={() => handleCategoryChange(tabKey, category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* 아이콘 그리드 */}
              <div className="icon-grid">
                {getFilteredIcons(tabKey).length === 0 ? (
                  <div
                    style={{
                      gridColumn: '1/-1',
                      textAlign: 'center',
                      padding: '20px',
                      color: 'rgba(226, 232, 240, 0.5)',
                    }}
                  >
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  getFilteredIcons(tabKey).map((iconName) => (
                    <div
                      key={iconName}
                      className="icon-item"
                      title={iconName}
                      onClick={() => handleSelectIcon(iconName, type)}
                    >
                      {renderIcon(iconName, type)}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
