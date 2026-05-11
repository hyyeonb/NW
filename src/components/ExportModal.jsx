import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getRenderedValue, SortableTableHeader, ColumnFilterDropdown } from '../features/export-modal/parts';


export default function ExportModal({
  open, onClose, columns = [], data = [], loading = false, defaultFileName = 'export', excludeColumns = [],
}) {
  const [fileName, setFileName] = useState(defaultFileName);
  const [format, setFormat] = useState('xlsx');
  const [exportColumns, setExportColumns] = useState([]);
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const [filterPosition, setFilterPosition] = useState({ top: 0, left: 0 });
  const safeData = useMemo(() => Array.isArray(data) ? data : [], [data]);

  useEffect(() => {
    if (open && columns.length > 0) {
      setFileName(defaultFileName);
      const excluded = new Set(['_select', 'actions', ...excludeColumns]);
      setExportColumns(
        columns
          .filter(c => !excluded.has(c.key))
          .map(c => ({ key: c.key, label: c.label || c.key, render: c.render, visible: true }))
      );
      setSortKey('');
      setSortDirection('asc');
      setFilters({});
      setOpenFilter(null);
    }
  }, [open, columns, defaultFileName]);

  const tableSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleTableDragStart = useCallback(() => setOpenFilter(null), []);
  const handleTableDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setExportColumns(prev => {
        const oldIndex = prev.findIndex(c => c.key === active.id);
        const newIndex = prev.findIndex(c => c.key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const visibleColumns = useMemo(() => exportColumns.filter(c => c.visible), [exportColumns]);
  const allColumnIds = useMemo(() => exportColumns.map(c => c.key), [exportColumns]);

  // ─── Column toggle ───
  const handleToggleColumn = useCallback((key) => {
    setExportColumns(prev => {
      const visCount = prev.filter(c => c.visible).length;
      const col = prev.find(c => c.key === key);
      if (col?.visible && visCount <= 1) return prev;
      return prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
    });
  }, []);

  // ─── Cell value / Sort / Filter ───
  const getCellValue = useCallback((col, row) => getRenderedValue(col, row), []);
  const getFilterValueFn = useCallback((col) => (row) => getRenderedValue(col, row), []);

  const handleHeaderSort = useCallback((key) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortKey(''); setSortDirection('asc'); }
    } else { setSortKey(key); setSortDirection('asc'); }
  }, [sortKey, sortDirection]);

  const handleFilterChange = useCallback((columnKey, filterSet) => {
    setFilters(prev => {
      const next = { ...prev };
      if (filterSet === undefined) delete next[columnKey];
      else next[columnKey] = filterSet;
      return next;
    });
  }, []);

  const hasActiveFilter = useCallback((key) => filters[key] !== undefined, [filters]);

  const handleOpenFilter = useCallback((colKey, e) => {
    if (openFilter === colKey) { setOpenFilter(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPosition({ top: rect.bottom + 4, left: rect.left });
    setOpenFilter(colKey);
  }, [openFilter]);

  // ─── Processed data ───
  const processedData = useMemo(() => {
    if (safeData.length === 0) return [];
    let result = [...safeData];
    const filterKeys = Object.keys(filters);
    if (filterKeys.length > 0) {
      result = result.filter(row =>
        filterKeys.every(key => {
          const filterSet = filters[key];
          if (!filterSet) return true;
          const col = exportColumns.find(c => c.key === key);
          const val = col ? getRenderedValue(col, row) : row[key];
          const str = val == null || val === '' ? '(빈 값)' : String(val);
          return filterSet.has(str);
        })
      );
    }
    if (sortKey) {
      const sortCol = exportColumns.find(c => c.key === sortKey);
      result.sort((a, b) => {
        let aVal = sortCol ? getRenderedValue(sortCol, a) : a[sortKey];
        let bVal = sortCol ? getRenderedValue(sortCol, b) : b[sortKey];
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (typeof aVal === 'number' && typeof bVal === 'number')
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        return sortDirection === 'asc'
          ? String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase(), 'ko')
          : String(bVal).toLowerCase().localeCompare(String(aVal).toLowerCase(), 'ko');
      });
    }
    return result;
  }, [safeData, filters, sortKey, sortDirection, exportColumns]);

  const previewData = useMemo(() => processedData.slice(0, 100), [processedData]);

  // ─── Export ───
  const handleExportCSV = useCallback(() => {
    const cols = visibleColumns;
    const headers = cols.map(c => c.label);
    const rows = processedData.map(row =>
      cols.map(c => {
        const str = String(getCellValue(c, row));
        if (str.includes(',') || str.includes('"') || str.includes('\n'))
          return `"${str.replace(/"/g, '""')}"`;
        return str;
      })
    );
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName || defaultFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [visibleColumns, processedData, getCellValue, fileName, defaultFileName]);

  const handleExportExcel = useCallback(() => {
    const cols = visibleColumns;
    const headers = cols.map(c => c.label);
    const rows = processedData.map(row => cols.map(c => getCellValue(c, row)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(row => { const len = String(row[i] || '').length; if (len > maxLen) maxLen = len; });
      return { wch: Math.min(maxLen + 2, 50) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fileName || defaultFileName);
    XLSX.writeFile(wb, `${fileName || defaultFileName}.xlsx`);
  }, [visibleColumns, processedData, getCellValue, fileName, defaultFileName]);

  const handleDownload = useCallback(() => {
    if (format === 'csv') handleExportCSV(); else handleExportExcel();
  }, [format, handleExportCSV, handleExportExcel]);

  if (!open) return null;

  const activeFilterCount = Object.keys(filters).length;

  return createPortal(
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="export-modal-header">
          <div className="export-modal-title">
            <i className="bi bi-table"></i>
            <span>데이터 내보내기</span>
          </div>

          <div className="export-header-toolbar">
            <div className="export-header-filename">
              <i className="bi bi-pencil"></i>
              <input
                type="text" value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="파일명"
              />
            </div>

            {activeFilterCount > 0 && (
              <>
                <div className="export-header-divider" />
                <button className="export-toolbar-btn warning" onClick={() => setFilters({})} title="모든 필터 초기화">
                  <i className="bi bi-funnel"></i>
                  <span>필터 초기화</span>
                  <span className="export-toolbar-badge warning">{activeFilterCount}</span>
                </button>
              </>
            )}
          </div>

          <button className="export-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body: table */}
        <div className="export-modal-body">
          {loading ? (
            <div className="export-preview-loading">
              <div className="loading-spinner"></div>
              <span>데이터를 불러오는 중...</span>
            </div>
          ) : (
            <div className="export-preview-table-wrapper">
              <DndContext sensors={tableSensors} collisionDetection={closestCenter}
                onDragStart={handleTableDragStart} onDragEnd={handleTableDragEnd}>
                <table className="export-preview-table">
                  <thead>
                    <SortableContext items={allColumnIds} strategy={horizontalListSortingStrategy}>
                      <tr>
                        <th className="export-row-num">#</th>
                        {exportColumns.map(col => (
                          <SortableTableHeader key={col.key} id={col.key}>
                            <input
                              type="checkbox"
                              className="export-th-checkbox"
                              checked={col.visible}
                              onChange={() => handleToggleColumn(col.key)}
                              onClick={(e) => e.stopPropagation()}
                              title={col.visible ? '내보내기에서 제외' : '내보내기에 포함'}
                            />
                            <span className={`export-th-label ${!col.visible ? 'dimmed' : ''}`} onClick={() => handleHeaderSort(col.key)} title="클릭하여 정렬">
                              {col.label}
                              {sortKey === col.key && (
                                <i className={`bi ${sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} export-sort-icon`}></i>
                              )}
                            </span>
                            <span
                              className={`export-th-filter ${hasActiveFilter(col.key) ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); handleOpenFilter(col.key, e); }}
                              title="필터"
                            >
                              <i className="bi bi-funnel-fill"></i>
                            </span>
                            {openFilter === col.key && (
                              <ColumnFilterDropdown
                                columnKey={col.key} label={col.label} data={safeData}
                                getValueFn={getFilterValueFn(col)} filters={filters}
                                onFilterChange={handleFilterChange} onClose={() => setOpenFilter(null)}
                                position={filterPosition}
                              />
                            )}
                          </SortableTableHeader>
                        ))}
                      </tr>
                    </SortableContext>
                  </thead>
                  <tbody>
                    {previewData.length === 0 ? (
                      <tr>
                        <td colSpan={exportColumns.length + 1} className="export-preview-empty">
                          {activeFilterCount > 0 ? '필터 조건에 맞는 데이터가 없습니다' : '데이터가 없습니다'}
                        </td>
                      </tr>
                    ) : previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="export-row-num">{idx + 1}</td>
                        {exportColumns.map(col => (
                          <td key={col.key} className={!col.visible ? 'export-td-dimmed' : ''}>{getCellValue(col, row)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DndContext>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="export-modal-footer">
          <div className="export-footer-info">
            <span className="export-footer-stat">
              <i className="bi bi-grid-3x3"></i>
              {activeFilterCount > 0 ? (
                <><strong>{processedData.length.toLocaleString()}</strong>건 / {safeData.length.toLocaleString()}건</>
              ) : (
                <><strong>{processedData.length.toLocaleString()}</strong>건</>
              )}
            </span>
            <span className="export-footer-stat">
              <i className="bi bi-layout-three-columns"></i>
              {visibleColumns.length}개 컬럼
            </span>
            {previewData.length < processedData.length && (
              <span className="export-footer-stat muted">미리보기 {previewData.length}행</span>
            )}
          </div>
          <div className="export-footer-actions">
            <button className="btn btn-ghost export-cancel-btn" onClick={onClose}>취소</button>
            <div className="export-download-group">
              <div className="export-format-toggle">
                <button className={`export-format-btn ${format === 'xlsx' ? 'active' : ''}`}
                  onClick={() => setFormat('xlsx')} title="Excel (.xlsx)">
                  <i className="bi bi-file-earmark-spreadsheet"></i> xlsx
                </button>
                <button className={`export-format-btn ${format === 'csv' ? 'active' : ''}`}
                  onClick={() => setFormat('csv')} title="CSV (.csv)">
                  <i className="bi bi-filetype-csv"></i> csv
                </button>
              </div>
              <button className="btn btn-primary export-download-btn"
                onClick={handleDownload} disabled={loading || processedData.length === 0}>
                <i className="bi bi-download"></i> 다운로드
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
