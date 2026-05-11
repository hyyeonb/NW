import { useState } from 'react';
import '../styles/tree-design-preview.css';

const SAMPLE_DATA = [
  {
    id: 1, name: '(주) 에스티엔인포텍', count: 23, icon: 'bi-globe2', expanded: true, children: [
      { id: 2, name: 'CEO', count: 1, icon: 'bi-person-badge' },
      {
        id: 3, name: 'STN연구소', count: 8, icon: 'bi-building', expanded: true, children: [
          { id: 4, name: '개발1팀', count: 2, icon: 'bi-folder' },
          { id: 5, name: '개발3팀', count: 17, icon: 'bi-folder' },
          { id: 6, name: '사업개발팀', count: 0, icon: 'bi-folder' },
        ]
      },
      { id: 7, name: '개발2팀', count: 4, icon: 'bi-folder' },
      { id: 8, name: '연구기획실', count: 3, icon: 'bi-folder' },
      { id: 9, name: '경영기획실', count: 0, icon: 'bi-folder' },
      { id: 10, name: '전략기획본부', count: 2, icon: 'bi-folder' },
      { id: 11, name: '영업1본부', count: 5, icon: 'bi-folder' },
      { id: 12, name: '영업2본부', count: 3, icon: 'bi-folder' },
      { id: 13, name: '기술지원본부', count: 6, icon: 'bi-folder' },
    ]
  }
];

function TreeNode({ node, depth = 0, variant, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState(node.expanded ?? depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const iconClass = variant === 'b' || variant === 'd' ? 'bi-folder' : node.icon;

  return (
    <li className={`tdp-node tdp-depth-${depth}`}>
      <div
        className={`tdp-item ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            className={`tdp-chevron ${expanded ? 'expanded' : ''}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            <i className="bi bi-chevron-right" />
          </button>
        ) : (
          <span className="tdp-chevron tdp-chevron-hidden" />
        )}
        {variant !== 'd' && <i className={`bi ${iconClass} tdp-icon`} />}
        <span className="tdp-name">{node.name}</span>
        {node.count > 0 && <span className="tdp-count">{node.count}</span>}
      </div>
      {hasChildren && expanded && (
        <ul className="tdp-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              variant={variant}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function VariantPanel({ variant, title, description, data, selectedId, onSelect }) {
  const [activeTab, setActiveTab] = useState('regular');
  const [search, setSearch] = useState('');

  return (
    <div className={`tdp-variant tdp-variant-${variant}`}>
      <div className="tdp-variant-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="tdp-panel">
        {/* 패널 헤더 (관제 그룹) */}
        <div className="tdp-panel-header">
          <div className="tdp-panel-title">
            <i className="bi bi-folder2-open" />
            <span>관제 그룹</span>
          </div>
          <button className="tdp-panel-collapse" title="접기">
            <i className="bi bi-chevron-left" />
          </button>
        </div>

        {/* 탭 */}
        <div className="tdp-tab-bar">
          <button
            className={`tdp-tab-btn ${activeTab === 'regular' ? 'active' : ''}`}
            onClick={() => setActiveTab('regular')}
          >
            일반 그룹
          </button>
          <button
            className={`tdp-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            커스텀 그룹
          </button>
        </div>

        {/* 검색 */}
        <div className="tdp-search">
          <i className="bi bi-search tdp-search-icon" />
          <input
            type="text"
            className="tdp-search-input"
            placeholder="그룹 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="tdp-search-clear" onClick={() => setSearch('')}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        {/* 트리 */}
        <div className="tdp-tree-wrap">
          <ul className="tdp-tree">
            {data.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                variant={variant}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TreeDesignPreview() {
  const [selectedId, setSelectedId] = useState(5); // 개발3팀 선택 상태

  return (
    <div className="tdp-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-palette"></i>
            관제 사이드바 디자인 시안
          </h1>
          <span className="page-subtitle">헤더 + 탭 + 검색 + 트리까지 포함된 4가지 스타일 — 라이트/다크 모두 확인 가능</span>
        </div>
      </div>

      <div className="tdp-grid">
        <VariantPanel
          variant="a"
          title="A. 모노크롬 미니멀"
          description="무채색 기조 + 굵기·톤으로만 강조. 조용하고 점잖은 탐색창."
          data={SAMPLE_DATA}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <VariantPanel
          variant="b"
          title="B. 노션/VSCode 스타일"
          description="단일 폴더 아이콘, 탭은 하단 인디케이터, 선택은 좌측 3px 바."
          data={SAMPLE_DATA}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <VariantPanel
          variant="c"
          title="C. 카드/필 스타일"
          description="둥근 pill 탭 + 카드형 행. 선택 시 액센트 그라디언트."
          data={SAMPLE_DATA}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <VariantPanel
          variant="d"
          title="D. 컴팩트 / 데이터 우선"
          description="아이콘 최소, 숫자 강조, 좁은 행 간격. 대규모 조직 빠른 스캔."
          data={SAMPLE_DATA}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
