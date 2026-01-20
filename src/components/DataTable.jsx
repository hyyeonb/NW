import { useMemo } from 'react';
import Pagination from './Pagination';

/**
 * 공통 DataTable 컴포넌트
 *
 * @param {Object} props
 * @param {Array} props.columns - 컬럼 정의 배열
 *   - key: 데이터 키 (필수)
 *   - label: 헤더 표시 텍스트 (필수)
 *   - width: 컬럼 너비 (예: '100px', '15%')
 *   - sortable: 정렬 가능 여부 (기본: false)
 *   - align: 텍스트 정렬 ('left', 'center', 'right')
 *   - render: 커스텀 렌더 함수 (value, row, index) => ReactNode
 *   - headerRender: 커스텀 헤더 렌더 함수 () => ReactNode
 *   - className: 셀에 적용할 추가 클래스
 * @param {Array} props.data - 테이블 데이터 배열
 * @param {string} props.rowKey - 행 고유 키로 사용할 데이터 필드명 (기본: 'id')
 * @param {boolean} props.loading - 로딩 상태
 * @param {string} props.loadingText - 로딩 텍스트 (기본: '데이터를 불러오는 중...')
 * @param {string} props.emptyText - 빈 상태 텍스트 (기본: '데이터가 없습니다')
 * @param {string} props.emptyIcon - 빈 상태 아이콘 클래스 (기본: 'bi-inbox')
 *
 * @param {Object} props.sort - 정렬 상태
 *   - field: 현재 정렬 필드
 *   - order: 정렬 방향 ('asc' | 'desc')
 * @param {function} props.onSort - 정렬 변경 콜백 (field) => void
 *
 * @param {boolean} props.selectable - 행 선택 가능 여부
 * @param {string} props.selectMode - 선택 모드 ('single' | 'multi') 기본: 'multi'
 * @param {Array} props.selectedRows - 선택된 행 키 배열
 * @param {function} props.onSelectChange - 선택 변경 콜백 (selectedKeys) => void
 * @param {function} props.onRowClick - 행 클릭 콜백 (row, index) => void
 *
 * @param {Object} props.pagination - 페이지네이션 설정 (null이면 비활성화)
 *   - currentPage: 현재 페이지
 *   - pageSize: 페이지당 항목 수
 *   - totalItems: 전체 항목 수
 *   - onPageChange: 페이지 변경 콜백
 *   - onPageSizeChange: 페이지 크기 변경 콜백
 *   - pageSizeOptions: 페이지 크기 옵션 배열
 *
 * @param {string} props.className - 추가 컨테이너 클래스
 * @param {string} props.maxHeight - 테이블 최대 높이 (예: 'calc(100vh - 300px)')
 * @param {boolean} props.stickyHeader - 헤더 고정 여부 (기본: true)
 * @param {function} props.rowClassName - 행별 클래스 반환 함수 (row, index) => string
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
}) {
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

  // 정렬 아이콘 렌더링
  const renderSortIcon = (field) => {
    if (!sort) return null;
    if (sort.field !== field) {
      return <i className="bi bi-chevron-expand sort-icon inactive"></i>;
    }
    return sort.order === 'asc'
      ? <i className="bi bi-chevron-up sort-icon active"></i>
      : <i className="bi bi-chevron-down sort-icon active"></i>;
  };

  // 정렬 핸들러
  const handleSort = (field) => {
    if (onSort) {
      onSort(field);
    }
  };

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
  const handleRowClick = (row, index) => {
    if (onRowClick) {
      onRowClick(row, index);
    }
  };

  // 행 클래스 계산
  const getRowClassName = (row, index) => {
    const classes = [];
    if (onRowClick) classes.push('clickable');
    if (selectable && selectedRows.includes(row[rowKey])) classes.push('selected');
    if (rowClassName) {
      const customClass = rowClassName(row, index);
      if (customClass) classes.push(customClass);
    }
    return classes.join(' ');
  };

  // 셀 값 렌더링
  const renderCell = (column, row, index) => {
    const value = row[column.key];
    if (column.render) {
      return column.render(value, row, index);
    }
    return value ?? '-';
  };

  return (
    <div className={`data-table-container ${className}`}>
      {/* 테이블 영역 */}
      <div
        className={`data-table-wrapper ${stickyHeader ? 'sticky-header' : ''}`}
        style={{ maxHeight: maxHeight }}
      >
        <table className="data-table">
          <thead>
            <tr>
              {/* 선택 체크박스 컬럼 */}
              {selectable && selectMode === 'multi' && (
                <th className="select-cell" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {selectable && selectMode === 'single' && (
                <th className="select-cell" style={{ width: '40px' }}></th>
              )}

              {/* 데이터 컬럼 헤더 */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.sortable ? 'sortable' : ''} ${column.className || ''}`}
                  style={{
                    width: column.width,
                    textAlign: column.align || 'left',
                  }}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  {column.headerRender ? column.headerRender() : column.label}
                  {column.sortable && renderSortIcon(column.key)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* 로딩 상태 */}
            {loading && (
              <tr className="loading-row">
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
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
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <div className="table-empty">
                    <i className={`bi ${emptyIcon}`}></i>
                    <span>{emptyText}</span>
                  </div>
                </td>
              </tr>
            )}

            {/* 데이터 행 */}
            {!loading && data.map((row, index) => (
              <tr
                key={row[rowKey] ?? index}
                className={getRowClassName(row, index)}
                onClick={() => handleRowClick(row, index)}
              >
                {/* 선택 체크박스 */}
                {selectable && (
                  <td className="select-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type={selectMode === 'multi' ? 'checkbox' : 'radio'}
                      checked={selectedRows.includes(row[rowKey])}
                      onChange={(e) => handleSelectRow(row[rowKey], e)}
                    />
                  </td>
                )}

                {/* 데이터 셀 */}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.className || ''}
                    style={{ textAlign: column.align || 'left' }}
                    title={typeof row[column.key] === 'string' ? row[column.key] : undefined}
                  >
                    {renderCell(column, row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
