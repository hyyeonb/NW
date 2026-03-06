import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Pagination from './Pagination';
import ExportModal from './ExportModal';

// 드래그 가능한 헤더 셀 컴포넌트
function DraggableHeader({ column, children, sortable, onSort, sort, enableReorder, resizeHandle, computedWidth, autoWidth }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: !enableReorder,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // X축만 이동 (수평 드래그)
  const style = {
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    transition,
    width: computedWidth || autoWidth || undefined,
    textAlign: column.columnDef.align || 'left',
    zIndex: isDragging ? 100 : undefined,
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = () => {
    if (!sortable || !sort) return null;
    if (sort.field !== column.id) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return sort.order === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  // 클릭 핸들러 (드래그가 아닐 때만 정렬)
  const handleClick = (e) => {
    if (sortable && onSort && !isDragging) {
      onSort(column.id);
    }
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      data-col-id={column.id}
      className={`${sortable ? 'sortable' : ''} ${isDragging ? 'dragging' : ''} ${column.columnDef.className || ''}`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <span className="th-label">{children}</span>
      {renderSortIcon()}
      {resizeHandle}
    </th>
  );
}


/**
 * TanStack Table 기반 DataTable 컴포넌트
 * - 컬럼 드래그 리오더링 지원
 * - MUI Select 기반 페이지 크기 선택
 * - localStorage 컬럼 순서 저장
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  loading = false,
  loadingText = '데이터를 불러오는 중...',
  emptyText = '데이터가 없습니다',
  emptyIcon = 'bi-inbox',
  sort = null,
  onSort,
  selectable = false,
  selectMode = 'multi',
  selectedRows = [],
  onSelectChange,
  onRowClick,
  pagination = null,
  className = '',
  maxHeight = 'calc(100vh - 350px)',
  stickyHeader = true,
  rowClassName,
  // 새로운 props
  tableId = 'default-table', // localStorage 키로 사용
  enableColumnReorder = true, // 컬럼 리오더링 활성화
  onColumnOrderChange, // 외부에서 컬럼 순서 변경 감지
  exportConfig, // { fileName, fetchAllData? }
  tableLayout = 'auto', // 'fixed' | 'auto'
}) {
  // localStorage에서 컬럼 순서 불러오기
  const getStoredColumnOrder = useCallback(() => {
    try {
      const stored = localStorage.getItem(`table-column-order-${tableId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 저장된 순서가 현재 컬럼과 일치하는지 확인
        const currentKeys = columns.map(c => c.key);
        const isValid = parsed.every(key => currentKeys.includes(key)) &&
                       parsed.length === currentKeys.length;
        if (isValid) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load column order:', e);
    }
    return columns.map(c => c.key);
  }, [tableId, columns]);

  // 컬럼 순서 상태
  const [columnOrder, setColumnOrder] = useState(() => getStoredColumnOrder());

  // columns가 변경되면 순서 재설정
  useEffect(() => {
    const currentKeys = columns.map(c => c.key);
    const hasNewColumns = currentKeys.some(key => !columnOrder.includes(key));
    const hasRemovedColumns = columnOrder.some(key => !currentKeys.includes(key));

    if (hasNewColumns || hasRemovedColumns) {
      setColumnOrder(getStoredColumnOrder());
    }
  }, [columns, columnOrder, getStoredColumnOrder]);

  // 컬럼 순서 저장
  const saveColumnOrder = useCallback((newOrder) => {
    try {
      localStorage.setItem(`table-column-order-${tableId}`, JSON.stringify(newOrder));
    } catch (e) {
      console.warn('Failed to save column order:', e);
    }
  }, [tableId]);

  // === 컬럼 너비 조절 ===
  const tableRef = useRef(null);
  const columnWidthsRef = useRef(null);

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const stored = localStorage.getItem(`table-column-widths-${tableId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        columnWidthsRef.current = parsed;
        return parsed;
      }
    } catch (e) {}
    return null;
  });

  // ref 동기화
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  const saveColumnWidths = useCallback((widths) => {
    try {
      if (widths) {
        localStorage.setItem(`table-column-widths-${tableId}`, JSON.stringify(widths));
      } else {
        localStorage.removeItem(`table-column-widths-${tableId}`);
      }
    } catch (e) {}
  }, [tableId]);

  // 현재 렌더된 컬럼 너비 측정
  const initColumnWidths = useCallback(() => {
    if (!tableRef.current) return null;
    const ths = tableRef.current.querySelectorAll('thead th[data-col-id]');
    const widths = {};
    ths.forEach(th => {
      widths[th.dataset.colId] = th.getBoundingClientRect().width;
    });
    return Object.keys(widths).length > 0 ? widths : null;
  }, []);

  // 리사이즈 시작
  const handleResizeStart = useCallback((e, columnId, nextColumnId) => {
    e.preventDefault();
    e.stopPropagation();

    let currentWidths = columnWidthsRef.current;
    if (!currentWidths) {
      currentWidths = initColumnWidths();
      if (!currentWidths) return;
      setColumnWidths(currentWidths);
      columnWidthsRef.current = currentWidths;
    }

    const startX = e.clientX;
    const startWidth = currentWidths[columnId] || 100;
    const nextStartWidth = currentWidths[nextColumnId] || 100;
    const minWidth = 50;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveE) => {
      const delta = moveE.clientX - startX;
      const clampedDelta = Math.min(
        Math.max(delta, -(startWidth - minWidth)),
        nextStartWidth - minWidth
      );

      const newWidths = {
        ...columnWidthsRef.current,
        [columnId]: startWidth + clampedDelta,
        [nextColumnId]: nextStartWidth - clampedDelta,
      };

      setColumnWidths(newWidths);
      columnWidthsRef.current = newWidths;
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      saveColumnWidths(columnWidthsRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [initColumnWidths, saveColumnWidths]);

  // === 컬럼 가시성 ===
  const [showColSettings, setShowColSettings] = useState(false);

  // localStorage에서 컬럼 가시성 불러오기
  const getStoredVisibility = useCallback(() => {
    try {
      const stored = localStorage.getItem(`table-column-visibility-${tableId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load column visibility:', e);
    }
    return {};
  }, [tableId]);

  const [columnVisibility, setColumnVisibility] = useState(() => getStoredVisibility());

  // 컬럼 가시성 저장
  const saveColumnVisibility = useCallback((vis) => {
    try {
      localStorage.setItem(`table-column-visibility-${tableId}`, JSON.stringify(vis));
    } catch (e) {
      console.warn('Failed to save column visibility:', e);
    }
  }, [tableId]);

  // 컬럼 가시성 토글
  const toggleColumnVisibility = useCallback((key) => {
    const col = columns.find(c => c.key === key);
    setColumnVisibility(prev => {
      const isVisible = prev[key] !== undefined
        ? prev[key] !== false
        : !col?.defaultHidden;
      const next = { ...prev, [key]: !isVisible };
      saveColumnVisibility(next);
      return next;
    });
    // 수동 너비 초기화 → 비례 자동 재분배
    setColumnWidths(null);
    columnWidthsRef.current = null;
    saveColumnWidths(null);
  }, [columns, saveColumnVisibility, saveColumnWidths]);

  // 컬럼이 보이는지 확인 (hideable: true가 아닌 컬럼은 항상 보임)
  const isColumnVisible = useCallback((col) => {
    if (col.hideable !== true) return true;
    if (col.key in columnVisibility) return columnVisibility[col.key] !== false;
    return !col.defaultHidden;
  }, [columnVisibility]);

  // hideable: true 컬럼이 하나라도 있을 때만 설정 버튼 표시
  const hasHideableColumns = useMemo(() => {
    return columns.some(c => c.hideable === true);
  }, [columns]);

  // 초기화 (전체 표시 + 순서 + 너비 초기화)
  const handleResetColumns = useCallback(() => {
    setColumnVisibility({});
    saveColumnVisibility({});
    const defaultOrder = columns.map(c => c.key);
    setColumnOrder(defaultOrder);
    saveColumnOrder(defaultOrder);
    setColumnWidths(null);
    columnWidthsRef.current = null;
    saveColumnWidths(null);
  }, [columns, saveColumnVisibility, saveColumnOrder, saveColumnWidths]);


  // 드래그 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 드래그 시작
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 컬럼 Map (O(1) 룩업)
  const columnsMap = useMemo(() => new Map(columns.map(c => [c.key, c])), [columns]);

  // TanStack Table 컬럼 정의 변환
  const tableColumns = useMemo(() => {
    // 선택 컬럼
    const selectColumn = selectable ? [{
      id: '_select',
      header: selectMode === 'multi' ? 'checkbox' : '',
      width: '40px',
      enableSorting: false,
    }] : [];

    // 데이터 컬럼 (순서에 따라 정렬 + 가시성 필터)
    const orderedColumns = columnOrder
      .map(key => columnsMap.get(key))
      .filter(Boolean)
      .filter(col => isColumnVisible(col))
      .map(col => ({
        id: col.key,
        accessorKey: col.key,
        header: col.headerRender ? col.headerRender() : col.label,
        width: col.width,
        align: col.align,
        sortable: col.sortable,
        className: col.className,
        cell: col.render
          ? ({ getValue, row }) => col.render(getValue(), row.original, row.index)
          : ({ getValue }) => getValue() ?? '-',
      }));

    return [...selectColumn, ...orderedColumns];
  }, [columnsMap, columnOrder, selectable, selectMode, isColumnVisible]);

  // === 컬럼 비례 너비 계산 (수동 리사이즈 없을 때) ===
  // px/% 혼용 시: px 컬럼은 고정, % 컬럼은 나머지 공간을 비례 분배
  // 동일 단위(전부 px 또는 전부 %)일 때: 기존 비례 분배
  const autoWidths = useMemo(() => {
    if (columnWidths) return null;
    if (tableLayout === 'auto') return null;
    const visibleDataCols = tableColumns.filter(c => c.id !== '_select');
    if (visibleDataCols.length === 0) return null;

    const hasPx = visibleDataCols.some(c => typeof c.width === 'string' && c.width.endsWith('px'));
    const hasPct = visibleDataCols.some(c => typeof c.width === 'string' && c.width.endsWith('%'));

    // px/% 혼용: px는 고정, %는 나머지 공간 비례 분배
    if (hasPx && hasPct) {
      const result = {};
      let totalFixedPx = 0;
      let totalFlexWeight = 0;
      const flexWeights = {};

      visibleDataCols.forEach(col => {
        const w = col.width;
        if (typeof w === 'string' && w.endsWith('px')) {
          result[col.id] = w;
          totalFixedPx += parseInt(w) || 0;
        } else {
          const weight = parseInt(w) || 100;
          flexWeights[col.id] = weight;
          totalFlexWeight += weight;
        }
      });

      Object.entries(flexWeights).forEach(([id, weight]) => {
        const pct = ((weight / totalFlexWeight) * 100).toFixed(2);
        result[id] = `calc((100% - ${totalFixedPx}px) * ${pct} / 100)`;
      });

      return result;
    }

    // 동일 단위: 기존 비례 분배
    let totalWeight = 0;
    const weights = {};
    visibleDataCols.forEach(col => {
      const w = parseInt(col.width) || 100;
      weights[col.id] = w;
      totalWeight += w;
    });
    const result = {};
    visibleDataCols.forEach(col => {
      result[col.id] = `${((weights[col.id] / totalWeight) * 100).toFixed(2)}%`;
    });
    return result;
  }, [tableColumns, columnWidths]);

  // TanStack Table 인스턴스
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row[rowKey]),
  });

  // 전체 선택 상태 계산
  const allSelected = useMemo(() => {
    if (!selectable || selectMode !== 'multi' || data.length === 0) return false;
    return data.every((row) => selectedRows.includes(row[rowKey]));
  }, [selectable, selectMode, data, selectedRows, rowKey]);

  // 일부 선택 상태 계산
  const someSelected = useMemo(() => {
    if (!selectable || selectMode !== 'multi' || data.length === 0) return false;
    const selectedCount = data.filter((row) => selectedRows.includes(row[rowKey])).length;
    return selectedCount > 0 && selectedCount < data.length;
  }, [selectable, selectMode, data, selectedRows, rowKey]);

  // 전체 선택 핸들러
  const handleSelectAll = () => {
    if (!onSelectChange) return;
    if (allSelected) {
      onSelectChange([]);
    } else {
      onSelectChange(data.map((row) => row[rowKey]));
    }
  };

  // 개별 선택 핸들러
  const handleSelectRow = (key, e) => {
    if (e) e.stopPropagation();
    if (!onSelectChange) return;

    if (selectMode === 'single') {
      onSelectChange(selectedRows.includes(key) ? [] : [key]);
    } else {
      if (selectedRows.includes(key)) {
        onSelectChange(selectedRows.filter((k) => k !== key));
      } else {
        onSelectChange([...selectedRows, key]);
      }
    }
  };

  // 행 클릭 핸들러
  const handleRowClick = (row) => {
    if (onRowClick) {
      onRowClick(row.original, row.index);
    }
  };

  // 행 클래스 계산
  const getRowClassName = (row) => {
    const classes = [];
    if (onRowClick) classes.push('clickable');
    if (selectable && selectedRows.includes(row.original[rowKey])) classes.push('selected');
    if (rowClassName) {
      const customClass = rowClassName(row.original, row.index);
      if (customClass) classes.push(customClass);
    }
    return classes.join(' ');
  };

  // 드래그 종료
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // localStorage에 저장
        saveColumnOrder(newOrder);

        // 외부 콜백 호출
        if (onColumnOrderChange) {
          onColumnOrderChange(newOrder);
        }

        return newOrder;
      });
    }
  };

  // 드래그 가능한 컬럼 ID 목록 (선택 컬럼 제외, visible 컬럼만)
  const draggableColumnIds = columnOrder.filter(key => {
    const col = columnsMap.get(key);
    return col && isColumnVisible(col);
  });

  // === Export 기능 ===
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setShowExportModal(true);

    if (exportConfig?.fetchAllData) {
      // 서버 페이지네이션: 전체 데이터 fetch
      setExportLoading(true);
      try {
        const allData = await exportConfig.fetchAllData();
        setExportData(allData);
      } catch (error) {
        console.error('Export 데이터 로드 실패:', error);
        setExportData([]);
      } finally {
        setExportLoading(false);
      }
    } else {
      // 클라이언트 데이터 그대로 사용
      setExportData(data);
    }
  }, [exportConfig, data]);

  // 컬럼 설정 버튼 (페이지네이션 우측에 렌더)
  const columnSettingsBtn = hasHideableColumns ? (
    <div className="column-settings-wrapper">
      <button
        className="btn-column-settings"
        onClick={() => setShowColSettings(prev => !prev)}
        title="컬럼 표시 설정"
      >
        <i className="bi bi-layout-three-columns"></i>
      </button>
    </div>
  ) : null;

  return (
    <div className={`data-table-container ${className}`}>
      {/* 테이블 영역 */}
      <div
        className={`data-table-wrapper ${stickyHeader ? 'sticky-header' : ''}`}
        style={{ maxHeight: maxHeight }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="data-table" ref={tableRef} style={{ tableLayout }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={draggableColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header, headerIndex) => {
                      // 선택 컬럼
                      if (header.id === '_select') {
                        return (
                          <th key={header.id} className="select-cell" style={{ width: '40px' }}>
                            {selectMode === 'multi' && (
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someSelected;
                                }}
                                onChange={handleSelectAll}
                              />
                            )}
                          </th>
                        );
                      }

                      // 다음 데이터 컬럼 찾기 (리사이즈 대상)
                      const nextDataHeader = headerGroup.headers
                        .slice(headerIndex + 1)
                        .find(h => h.id !== '_select');

                      // 데이터 컬럼 (드래그 가능)
                      const colDef = columns.find(c => c.key === header.id);
                      return (
                        <DraggableHeader
                          key={header.id}
                          column={header.column}
                          sortable={colDef?.sortable}
                          onSort={onSort}
                          sort={sort}
                          enableReorder={enableColumnReorder}
                          computedWidth={columnWidths?.[header.id] ? `${columnWidths[header.id]}px` : undefined}
                          autoWidth={autoWidths?.[header.id]}
                          resizeHandle={nextDataHeader ? (
                            <div
                              className="col-resize-handle"
                              onMouseDown={(e) => handleResizeStart(e, header.id, nextDataHeader.id)}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </DraggableHeader>
                      );
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            <tbody>
              {/* 로딩 상태 */}
              {loading && (
                <tr className="loading-row">
                  <td colSpan={tableColumns.length}>
                    <div className="table-loading">
                      <div className="loading-spinner"></div>
                      <span>{loadingText}</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* 빈 상태 */}
              {!loading && data.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={tableColumns.length}>
                    <div className="table-empty">
                      <i className={`bi ${emptyIcon}`}></i>
                      <span>{emptyText}</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* 데이터 행 */}
              {!loading && table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={getRowClassName(row)}
                  onClick={() => handleRowClick(row)}
                >
                  {row.getVisibleCells().map((cell) => {
                    // 선택 셀
                    if (cell.column.id === '_select') {
                      return (
                        <td
                          key={cell.id}
                          className="select-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type={selectMode === 'multi' ? 'checkbox' : 'radio'}
                            checked={selectedRows.includes(row.original[rowKey])}
                            onChange={(e) => handleSelectRow(row.original[rowKey], e)}
                          />
                        </td>
                      );
                    }

                    // 데이터 셀
                    const colDef = columns.find(c => c.key === cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={colDef?.className || ''}
                        style={{ textAlign: colDef?.align || 'left' }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* 페이지네이션 */}
      {pagination && (
        <Pagination
          pageSize={pagination.pageSize}
          currentPage={pagination.currentPage}
          totalItems={pagination.totalItems}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions}
          showPageSizeSelector={pagination.showPageSizeSelector !== false}
          onExport={exportConfig ? handleExport : undefined}
          extraButtons={columnSettingsBtn}
        />
      )}

      {/* 페이지네이션 없이 exportConfig만 있는 경우 내보내기 버튼 단독 표시 */}
      {!pagination && exportConfig && (
        <div className="pagination-controls export-only">
          <div className="pagination-left">
            <span className="pagination-info">전체 {data.length}건</span>
          </div>
          <div className="pagination-right">
            {columnSettingsBtn}
            <button
              className="btn-export"
              onClick={handleExport}
              title="데이터 내보내기"
            >
              <i className="bi bi-download"></i>
            </button>
          </div>
        </div>
      )}

      {/* 페이지네이션도 export도 없지만 hideable 컬럼이 있는 경우 */}
      {!pagination && !exportConfig && hasHideableColumns && (
        <div className="pagination-controls export-only">
          <div className="pagination-left" />
          <div className="pagination-right">
            {columnSettingsBtn}
          </div>
        </div>
      )}

      {/* Export 모달 */}
      {exportConfig && (
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          columns={columns}
          data={exportData}
          loading={exportLoading}
          defaultFileName={exportConfig.fileName || 'export'}
          excludeColumns={exportConfig.excludeColumns}
        />
      )}

      {/* 컬럼 설정 사이드바 */}
      {hasHideableColumns && (
        <div
          className={`column-sidebar-overlay${showColSettings ? ' open' : ''}`}
          onClick={() => setShowColSettings(false)}
        >
          <div className="column-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="column-sidebar-header">
              <span className="column-sidebar-title">컬럼 표시 설정</span>
              <span className="column-sidebar-close" onClick={() => setShowColSettings(false)}>&times;</span>
            </div>
            <div className="column-sidebar-body">
              {columnOrder
                .map(key => columns.find(c => c.key === key))
                .filter(Boolean)
                .filter(col => col.hideable === true)
                .map(col => (
                  <label key={col.key} className="column-sidebar-item">
                    <input
                      type="checkbox"
                      checked={isColumnVisible(col)}
                      onChange={() => toggleColumnVisibility(col.key)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))
              }
            </div>
            <div className="column-sidebar-footer">
              <button className="btn-reset-columns" onClick={handleResetColumns}>
                <i className="bi bi-arrow-counterclockwise"></i> 초기화
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
