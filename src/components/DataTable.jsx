import { useMemo, useState, useEffect, useCallback } from 'react';
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

// 드래그 가능한 헤더 셀 컴포넌트
function DraggableHeader({ column, children, sortable, onSort, sort, enableReorder }) {
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
    width: column.columnDef.width,
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
      className={`${sortable ? 'sortable' : ''} ${isDragging ? 'dragging' : ''} ${column.columnDef.className || ''}`}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      <span className="th-label">{children}</span>
      {renderSortIcon()}
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

  // TanStack Table 컬럼 정의 변환
  const tableColumns = useMemo(() => {
    // 선택 컬럼
    const selectColumn = selectable ? [{
      id: '_select',
      header: selectMode === 'multi' ? 'checkbox' : '',
      width: '40px',
      enableSorting: false,
    }] : [];

    // 데이터 컬럼 (순서에 따라 정렬)
    const orderedColumns = columnOrder
      .map(key => columns.find(c => c.key === key))
      .filter(Boolean)
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
  }, [columns, columnOrder, selectable, selectMode]);

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

  // 드래그 가능한 컬럼 ID 목록 (선택 컬럼 제외)
  const draggableColumnIds = columnOrder;

  return (
    <div className={`data-table-container ${className}`}>
      {/* 컬럼 순서 초기화 버튼 (개발/디버그용, 필요시 활성화) */}
      {/*
      {enableColumnReorder && (
        <div className="column-order-controls">
          <button onClick={resetColumnOrder} className="btn-reset-columns">
            <i className="bi bi-arrow-counterclockwise"></i> 컬럼 순서 초기화
          </button>
        </div>
      )}
      */}

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
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={draggableColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => {
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
        />
      )}

    </div>
  );
}
