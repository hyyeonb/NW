/* eslint-disable react-refresh/only-export-components */
// IconSelectorModal 헬퍼: 탭 데이터 + 카테고리 캐시 + 아이콘 렌더 컴포넌트.

import {
  fontAwesomeIconsByCategory,
  materialIconsByCategory,
  bootstrapIconsByCategory,
} from '../../data/iconData';

export const TAB_DATA = {
  fontawesome: { icons: fontAwesomeIconsByCategory, type: 'fa', label: 'Font Awesome' },
  material: { icons: materialIconsByCategory, type: 'mat', label: 'Material Icons' },
  bootstrap: { icons: bootstrapIconsByCategory, type: 'bi', label: 'Bootstrap Icons' },
};

export const CATEGORIES_CACHE = Object.fromEntries(
  Object.entries(TAB_DATA).map(([key, { icons }]) => [
    key,
    ['전체', ...Object.keys(icons)],
  ])
);

export const ALL_ICONS_CACHE = Object.fromEntries(
  Object.entries(TAB_DATA).map(([key, { icons }]) => [
    key,
    Object.values(icons).flat(),
  ])
);

export function IconItem({ iconName, type, onSelect }) {
  const handleClick = () => onSelect(iconName, type);
  let content;
  if (type === 'fa') {
    content = <i className={`fa-solid ${iconName}`} />;
  } else if (type === 'mat') {
    content = <span className="material-icons">{iconName}</span>;
  } else {
    content = <i className={iconName} />;
  }
  return (
    <div className="icon-item" title={iconName} onClick={handleClick}>
      {content}
    </div>
  );
}
