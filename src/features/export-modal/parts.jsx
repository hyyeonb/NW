/* eslint-disable react-refresh/only-export-components */
// ExportModal 헬퍼: text extraction + render value + sortable header + column filter dropdown.

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';

function extractText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node.props) return extractText(node.props.children);
  return '';
}

function getRenderedValue(col, row) {
  const rawVal = row[col.key];
  if (!col.render) return rawVal == null ? '' : rawVal;
  try {
    const rendered = col.render(rawVal, row);
    if (rendered == null) return '';
    if (typeof rendered === 'string' || typeof rendered === 'number') return rendered;
    return extractText(rendered);
  } catch {
    return rawVal == null ? '' : rawVal;
  }
}

// ─── Sortable table header ───
function SortableTableHeader({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const contentStyle = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, 0, 0)` : undefined,
    transition,
  };
  return (
    <th ref={setNodeRef} className={`export-th ${isDragging ? 'export-th-dragging' : ''}`} {...attributes} {...listeners}>
      <div className="export-th-content" style={contentStyle}>{children}</div>
    </th>
  );
}

// ─── Filter dropdown (portal) ───
function ColumnFilterDropdown({ columnKey, label, data, getValueFn, filters, onFilterChange, onClose, position }) {
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const uniqueValues = useMemo(() => {
    const counts = {};
    data.forEach(row => {
      const val = getValueFn(row);
      const str = val == null || val === '' ? '(빈 값)' : String(val);
      counts[str] = (counts[str] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([value, count]) => ({ value, count }));
  }, [data, getValueFn]);

  const filteredValues = useMemo(() => {
    if (!search.trim()) return uniqueValues;
    const q = search.toLowerCase();
    return uniqueValues.filter(v => v.value.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  const currentFilter = filters[columnKey];
  const isChecked = (value) => !currentFilter || currentFilter.has(value);
  const handleToggle = (value) => {
    let newSet;
    if (!currentFilter) {
      newSet = new Set(uniqueValues.map(v => v.value));
      newSet.delete(value);
    } else {
      newSet = new Set(currentFilter);
      if (newSet.has(value)) newSet.delete(value);
      else newSet.add(value);
    }
    onFilterChange(columnKey, newSet.size === uniqueValues.length ? undefined : newSet);
  };
  const allChecked = !currentFilter;
  const noneChecked = currentFilter && currentFilter.size === 0;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return createPortal(
    <div className="export-filter-dropdown" ref={ref} onClick={(e) => e.stopPropagation()} style={{ top: position.top, left: position.left }}>
      <div className="export-filter-title">'{label}' 필터</div>
      <div className="export-filter-search">
        <i className="bi bi-search"></i>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색..." autoFocus />
      </div>
      <div className="export-filter-actions-row">
        <button onClick={() => onFilterChange(columnKey, undefined)} disabled={allChecked}>전체 선택</button>
        <button onClick={() => onFilterChange(columnKey, new Set())} disabled={noneChecked}>전체 해제</button>
      </div>
      <div className="export-filter-list">
        {filteredValues.length === 0 ? (
          <div className="export-filter-empty">결과 없음</div>
        ) : filteredValues.map(item => (
          <label key={item.value} className="export-filter-item">
            <input type="checkbox" checked={isChecked(item.value)} onChange={() => handleToggle(item.value)} />
            <span className="export-filter-value">{item.value}</span>
            <span className="export-filter-count">{item.count}</span>
          </label>
        ))}
      </div>
    </div>,
    document.body
  );
}

export { extractText, getRenderedValue, SortableTableHeader, ColumnFilterDropdown };
