import { useMemo } from 'react';
import Pagination from '@mui/material/Pagination';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useThemeStore } from '../stores/themeStore';

// 다크 테마
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
    },
  },
  components: {
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: '#7c8ba3',
            fontSize: '13px',
            fontWeight: 500,
            minWidth: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            backgroundColor: 'rgba(22, 27, 45, 0.98)',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              borderColor: 'rgba(99, 102, 241, 0.35)',
              color: '#a5b4fc',
            },
          },
          '& .MuiPaginationItem-page.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderColor: 'rgba(99, 102, 241, 0.5)',
            color: '#ffffff',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(129, 140, 248, 0.9)',
            },
          },
          '& .MuiPaginationItem-ellipsis': {
            border: 'none',
            backgroundColor: 'transparent',
            color: '#5a6780',
          },
          '& .MuiPaginationItem-previousNext, & .MuiPaginationItem-firstLast': {
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(99, 102, 241, 0.2)',
            borderRadius: '8px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(99, 102, 241, 0.4)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6366f1',
            borderWidth: '1px',
          },
        },
        select: {
          padding: '4px 24px 4px 8px',
          fontSize: '12px',
          color: '#d1d9e8',
          backgroundColor: 'rgba(22, 27, 45, 0.98)',
          borderRadius: '6px',
          minWidth: '32px',
        },
        icon: {
          color: '#7c8ba3',
          right: 2,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          color: '#d1d9e8',
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.25)',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(22, 27, 45, 0.98)',
          backgroundImage: 'none',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
      },
    },
  },
});

// 라이트 테마
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4f46e5',
      light: '#6366f1',
      dark: '#3730a3',
    },
  },
  components: {
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: '#475569',
            fontSize: '13px',
            fontWeight: 500,
            minWidth: '32px',
            height: '32px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(79, 70, 229, 0.08)',
              borderColor: 'rgba(79, 70, 229, 0.3)',
              color: '#4f46e5',
            },
          },
          '& .MuiPaginationItem-page.Mui-selected': {
            backgroundColor: '#4f46e5',
            borderColor: '#4f46e5',
            color: '#ffffff',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#4338ca',
            },
          },
          '& .MuiPaginationItem-ellipsis': {
            border: 'none',
            backgroundColor: 'transparent',
            color: '#94a3b8',
          },
          '& .MuiPaginationItem-previousNext, & .MuiPaginationItem-firstLast': {
            '&.Mui-disabled': {
              opacity: 0.4,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
            borderRadius: '8px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(79, 70, 229, 0.4)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4f46e5',
            borderWidth: '1px',
          },
        },
        select: {
          padding: '4px 24px 4px 8px',
          fontSize: '12px',
          color: '#1e293b',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          minWidth: '32px',
        },
        icon: {
          color: '#64748b',
          right: 2,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          color: '#1e293b',
          '&:hover': {
            backgroundColor: 'rgba(79, 70, 229, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(79, 70, 229, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(79, 70, 229, 0.16)',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          backgroundImage: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        },
      },
    },
  },
});

/**
 * 공통 페이지네이션 컴포넌트 (MUI 기반)
 * - MUI Pagination + MUI Select
 * - 다크/라이트 테마 자동 전환
 */
export default function PaginationComponent({
  pageSize,
  currentPage = 1,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  onExport,
  extraButtons,
}) {
  // 테마 상태
  const { resolvedTheme } = useThemeStore();
  const theme = resolvedTheme === 'light' ? lightTheme : darkTheme;

  // 전체 페이지 수 계산
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  // 페이지 변경 핸들러
  const handlePageChange = (event, newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      onPageChange(newPage);
    }
  };

  // 페이지 크기 변경 핸들러
  const handlePageSizeChange = (event) => {
    const newSize = Number(event.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
  };

  // 현재 표시 중인 항목 범위
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <ThemeProvider theme={theme}>
      <div className="pagination-controls">
        {/* 좌측: 페이지 크기 선택 및 표시 정보 */}
        <div className="pagination-left">
          {showPageSizeSelector && (
            <div className="items-per-page">
              <span className="page-size-label">개수:</span>
              <FormControl size="small">
                <Select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  variant="outlined"
                  MenuProps={{
                    sx: { zIndex: 1000001 },
                    PaperProps: {
                      sx: {
                        mt: 0.5,
                      },
                    },
                  }}
                >
                  {pageSizeOptions.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          )}
          <span className="pagination-info">
            {totalItems > 0 ? `${startItem}-${endItem} / ${totalItems}` : '0개'}
          </span>
        </div>

        {/* 중앙: MUI 페이지네이션 */}
        <Pagination
          count={totalPages}
          page={currentPage}
          onChange={handlePageChange}
          shape="rounded"
          size="medium"
          showFirstButton
          showLastButton
          siblingCount={1}
          boundaryCount={1}
        />

        {/* 우측: 추가 버튼 + 내보내기 버튼 */}
        <div className="pagination-right">
          {extraButtons}
          {onExport && (
            <button
              className="btn-export"
              onClick={onExport}
              title="데이터 내보내기"
            >
              <i className="bi bi-download"></i>
            </button>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}
