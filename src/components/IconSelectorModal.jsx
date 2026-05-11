import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useGroupStore } from '../stores/groupStore';
import { useAlert } from './CustomAlert';
import { useUpdateGroupIcon } from '../hooks/useGroups';
import { TAB_DATA, CATEGORIES_CACHE, ALL_ICONS_CACHE, IconItem } from '../features/icon-selector/parts';

export default function IconSelectorModal({ onClose, onSuccess }) {
  const { error: showError } = useAlert();
  const { iconModalGroup, hideIconModal } = useGroupStore();
  const updateIconMutation = useUpdateGroupIcon();
  const modalRef = useRef(null);

  const [activeTab, setActiveTab] = useState('fontawesome');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCategory, setCurrentCategory] = useState('전체');

  // 비동기 지연 값 (검색어 변경 시 렌더 지연 → 타이핑 반응성 확보)
  const deferredSearch = useDeferredValue(searchTerm);

  // 탭 전환 시 검색어/카테고리 초기화
  useEffect(() => {
    setSearchTerm('');
    setCurrentCategory('전체');
  }, [activeTab]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    hideIconModal();
    if (onClose) onClose();
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
      if (window.reloadGroupTree) window.reloadGroupTree();
      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('아이콘 설정 오류:', error);
      showError('아이콘 설정에 실패했습니다.');
    }
  };

  // 현재 탭의 필터된 아이콘 (메모이제이션)
  const filteredIcons = useMemo(() => {
    const { icons } = TAB_DATA[activeTab];
    const lowerSearch = deferredSearch.toLowerCase();

    let list;
    if (currentCategory === '전체') {
      list = ALL_ICONS_CACHE[activeTab];
    } else {
      list = icons[currentCategory] || [];
    }

    if (lowerSearch) {
      list = list.filter((icon) => icon.toLowerCase().includes(lowerSearch));
    }

    return list;
  }, [activeTab, currentCategory, deferredSearch]);

  const currentCategories = CATEGORIES_CACHE[activeTab];
  const currentType = TAB_DATA[activeTab].type;

  if (!iconModalGroup) return null;

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div ref={modalRef} className="modal-content icon-modal-content">
        <span className="close-btn" onClick={handleClose}>&times;</span>

        <div className="icon-tab-container">
          {/* 탭 버튼 */}
          <div className="icon-tab-buttons">
            {Object.entries(TAB_DATA).map(([key, { label }]) => (
              <button
                key={key}
                className={`icon-tab-button ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 활성 탭만 렌더링 (나머지는 DOM에 없음) */}
          <div className="icon-tab-content active">
            {/* 검색창 */}
            <div className="icon-search-container">
              <input
                type="text"
                className="icon-search-input"
                placeholder="아이콘 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 카테고리 버튼 */}
            <div className="icon-category-buttons">
              {currentCategories.map((category) => (
                <button
                  key={category}
                  className={`icon-category-btn ${currentCategory === category ? 'active' : ''}`}
                  onClick={() => setCurrentCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* 아이콘 그리드 */}
            <div className="icon-grid">
              {filteredIcons.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'rgba(226, 232, 240, 0.5)' }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredIcons.map((iconName) => (
                  <IconItem
                    key={iconName}
                    iconName={iconName}
                    type={currentType}
                    onSelect={handleSelectIcon}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
