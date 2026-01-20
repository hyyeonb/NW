import { useMemo } from 'react';

/**
 * 공통 페이지네이션 컴포넌트
 *
 * @param {Object} props
 * @param {number} props.pageSize - 페이지당 표시할 데이터 개수 (필수)
 * @param {number} props.currentPage - 현재 페이지 (1부터 시작)
 * @param {number} props.totalItems - 전체 데이터 개수
 * @param {function} props.onPageChange - 페이지 변경 콜백 (newPage) => void
 * @param {function} [props.onPageSizeChange] - 페이지 크기 변경 콜백 (newSize) => void
 * @param {number[]} [props.pageSizeOptions] - 페이지 크기 옵션 배열 (기본: [10, 20, 50, 100])
 * @param {boolean} [props.showPageSizeSelector] - 페이지 크기 선택기 표시 여부 (기본: true)
 * @param {boolean} [props.showPageNumbers] - 페이지 번호 버튼 표시 여부 (기본: false)
 * @param {number} [props.maxPageButtons] - 표시할 최대 페이지 버튼 수 (기본: 5)
 */
export default function Pagination({
  pageSize,
  currentPage = 1,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showPageNumbers = true,
  maxPageButtons = 5,
}) {
  // 전체 페이지 수 계산
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  // 표시할 페이지 번호 배열 계산
  const pageNumbers = useMemo(() => {
    if (!showPageNumbers) return [];

    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // 시작 페이지 조정
    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }, [currentPage, totalPages, maxPageButtons, showPageNumbers]);

  // 페이지 변경 핸들러
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      onPageChange(newPage);
    }
  };

  // 페이지 크기 변경 핸들러
  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
  };

  // 현재 표시 중인 항목 범위
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-controls">
      {/* 좌측: 페이지 크기 선택 및 표시 정보 */}
      <div className="pagination-left">
        {showPageSizeSelector && (
          <div className="items-per-page">
            <label htmlFor="pagination-page-size">개수:</label>
            <select
              id="pagination-page-size"
              value={pageSize}
              onChange={handlePageSizeChange}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="pagination-info">
          {totalItems > 0 ? `${startItem}-${endItem} / ${totalItems}` : '0개'}
        </span>
      </div>

      {/* 우측: 페이지 네비게이션 */}
      <div className="pagination">
        {/* 첫 페이지 버튼 */}
        <button
          className="pagination-btn pagination-first"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          title="첫 페이지"
        >
          <i className="bi bi-chevron-double-left"></i>
        </button>

        {/* 이전 페이지 버튼 */}
        <button
          className="pagination-btn pagination-prev"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="이전 페이지"
        >
          <i className="bi bi-chevron-left"></i>
        </button>

        {/* 페이지 번호 버튼 (옵션) */}
        {showPageNumbers && pageNumbers.length > 0 && (
          <div className="pagination-pages">
            {pageNumbers[0] > 1 && (
              <>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(1)}
                >
                  1
                </button>
                {pageNumbers[0] > 2 && <span className="pagination-ellipsis">...</span>}
              </>
            )}
            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                className={`pagination-btn ${pageNum === currentPage ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="pagination-ellipsis">...</span>
                )}
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
        )}

        {/* 페이지 번호 텍스트 (페이지 버튼 미사용 시) */}
        {!showPageNumbers && (
          <span className="pagination-text">{currentPage} / {totalPages}</span>
        )}

        {/* 다음 페이지 버튼 */}
        <button
          className="pagination-btn pagination-next"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="다음 페이지"
        >
          <i className="bi bi-chevron-right"></i>
        </button>

        {/* 마지막 페이지 버튼 */}
        <button
          className="pagination-btn pagination-last"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="마지막 페이지"
        >
          <i className="bi bi-chevron-double-right"></i>
        </button>
      </div>
    </div>
  );
}
