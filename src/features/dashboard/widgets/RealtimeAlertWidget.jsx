/* eslint-disable max-lines-per-function, complexity */
// 후속 PR에서 useAlertList hook + AlertTable / AlertFilters / AlertPagination sub-component 분해 예정.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAlertStore } from '../../../stores/alertStore';
import { faultApi } from '../../../api/fault';

import { ERROR_LEVELS } from '../../../shared/config/errorLevels';

const getLevelClass = (level) => {
  switch (level) {
    case 'C': return 'critical';
    case 'M': return 'major';
    case 'N': return 'minor';
    case 'W': return 'warning';
    default: return '';
  }
};

const getLevelLabel = (level) => {
  switch (level) {
    case 'C': return 'Cr';
    case 'M': return 'Mj';
    case 'N': return 'Mn';
    case 'W': return 'Wr';
    default: return '-';
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    let date;
    if (typeof dateStr === 'number') {
      date = new Date(dateStr);
    } else if (typeof dateStr === 'string') {
      const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      date = new Date(normalized);
    } else {
      date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  } catch {
    return dateStr;
  }
};

export default function RealtimeAlertWidget({ isEditMode, initialData }) {
  const getInitialData = useCallback(() => {
    if (Array.isArray(initialData) && initialData.length > 0) return initialData;
    if (initialData?.list && initialData.list.length > 0) return initialData.list;
    return [];
  }, [initialData]);

  const [apiErrors, setApiErrors] = useState(getInitialData);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState(['C', 'M', 'N', 'W']);
  const [hasFetched, setHasFetched] = useState(false);
  const alerts = useAlertStore((state) => state.alerts);

  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const prevErrorIdsRef = useRef(new Set());

  const [searchFilters, setSearchFilters] = useState({
    deviceName: '',
    deviceIp: '',
    groupName: '',
    errorMessage: '',
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const widgetRef = useRef(null);
  const tableContainerRef = useRef(null);
  const [isWide, setIsWide] = useState(false);
  const [dynamicPageSize, setDynamicPageSize] = useState(20);
  const [alertPage, setAlertPage] = useState(1);

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect || {};
      setIsWide((width || 0) >= 700);
      const availableHeight = (height || 300) - 40 - 36 - 28;
      const rowH = 30;
      const rows = Math.max(5, Math.floor(availableHeight / rowH));
      setDynamicPageSize(rows);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setAlertPage(1); }, [selectedLevels, searchFilters]);

  useEffect(() => {
    if (Array.isArray(initialData)) {
      setApiErrors(initialData);
    } else if (initialData?.list) {
      setApiErrors(initialData.list);
    }
  }, [initialData]);

  useEffect(() => {
    if (isEditMode || apiErrors.length === 0) return;
    const currentErrorIds = new Set(apiErrors.map(e => e.ERROR_ID).filter(Boolean));
    const prevIds = prevErrorIdsRef.current;
    const newIds = new Set();
    currentErrorIds.forEach(id => { if (!prevIds.has(id)) newIds.add(id); });
    if (newIds.size > 0 && prevIds.size > 0) {
      setHighlightedIds(newIds);
      const timer = setTimeout(() => setHighlightedIds(new Set()), 3000);
      prevErrorIdsRef.current = currentErrorIds;
      return () => clearTimeout(timer);
    }
    prevErrorIdsRef.current = currentErrorIds;
  }, [apiErrors, isEditMode]);

  const combinedErrors = useMemo(() => {
    return apiErrors.filter(error => {
      if (!selectedLevels.includes(error.ERROR_LEVEL)) return false;
      const { deviceName, deviceIp, groupName, errorMessage } = searchFilters;
      if (deviceName.trim() && !(error.DEVICE_NAME || '').toLowerCase().includes(deviceName.toLowerCase())) return false;
      if (deviceIp.trim() && !(error.DEVICE_IP || '').toLowerCase().includes(deviceIp.toLowerCase())) return false;
      if (groupName.trim() && !(error.GROUP_NAME || '').toLowerCase().includes(groupName.toLowerCase())) return false;
      if (errorMessage.trim() && !(error.ERROR_MESSAGE || '').toLowerCase().includes(errorMessage.toLowerCase())) return false;
      return true;
    });
  }, [apiErrors, selectedLevels, searchFilters]);

  const fetchErrors = useCallback(async (params = {}) => {
    if (isEditMode) return;
    setIsLoading(true);
    try {
      const response = await faultApi.getErrors(params);
      const data = response.data?.data || {};
      setApiErrors(data.list || []);
    } catch (error) {
      console.error('장애 목록 조회 실패:', error);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode || hasFetched) return;
    const initData = getInitialData();
    if (initData.length === 0) {
      fetchErrors();
    } else {
      setHasFetched(true);
    }
  }, [isEditMode, hasFetched]); // eslint-disable-line react-hooks/exhaustive-deps

  const latestAlert = alerts[0];
  useEffect(() => {
    if (isEditMode || !hasFetched || !latestAlert) return;
    fetchErrors();
  }, [latestAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLevel = (levelId) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== levelId);
      }
      return [...prev, levelId];
    });
  };

  const handleFilterChange = (field, value) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setSearchFilters({ deviceName: '', deviceIp: '', groupName: '', errorMessage: '' });
  };

  const hasActiveFilters = Object.values(searchFilters).some(v => v.trim());

  if (isEditMode) {
    return (
      <div className="realtime-alert-widget edit-mode-placeholder">
        <div className="widget-edit-placeholder">
          <i className="bi bi-exclamation-triangle"></i>
          <span className="placeholder-title">실시간 장애 현황</span>
          <span className="placeholder-desc">편집 모드에서는 장애 목록이 표시되지 않습니다</span>
        </div>
      </div>
    );
  }

  const showFilters = isWide || showAdvancedSearch;
  const totalPages = Math.ceil(combinedErrors.length / dynamicPageSize);
  const pageRows = combinedErrors.slice((alertPage - 1) * dynamicPageSize, alertPage * dynamicPageSize);

  return (
    <div className="realtime-alert-widget" ref={widgetRef}>
      <div className="widget-filter-bar">
        <div className="widget-level-filters">
          {ERROR_LEVELS.map((level) => (
            <button
              key={level.id}
              className={`widget-level-btn ${selectedLevels.includes(level.id) ? 'active' : ''}`}
              style={{ '--level-color': level.color }}
              onClick={() => toggleLevel(level.id)}
              title={level.name}
            >
              {level.label}
            </button>
          ))}
        </div>
        <div className="widget-search-box">
          <label>장비명</label>
          <input
            type="text"
            placeholder="장비명"
            value={searchFilters.deviceName}
            onChange={(e) => handleFilterChange('deviceName', e.target.value)}
          />
        </div>
        {showFilters && (
          <>
            <div className="widget-search-field">
              <label>IP</label>
              <input type="text" placeholder="IP 주소" value={searchFilters.deviceIp} onChange={(e) => handleFilterChange('deviceIp', e.target.value)} />
            </div>
            <div className="widget-search-field">
              <label>그룹</label>
              <input type="text" placeholder="그룹명" value={searchFilters.groupName} onChange={(e) => handleFilterChange('groupName', e.target.value)} />
            </div>
            <div className="widget-search-field">
              <label>내용</label>
              <input type="text" placeholder="장애 내용" value={searchFilters.errorMessage} onChange={(e) => handleFilterChange('errorMessage', e.target.value)} />
            </div>
          </>
        )}
        <div className="widget-filter-actions">
          {!isWide && (
            <button
              className={`widget-filter-toggle ${showAdvancedSearch ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              title="상세 검색"
            >
              <i className="bi bi-filter"></i>
            </button>
          )}
          {hasActiveFilters && (
            <button className="widget-filter-reset" onClick={handleResetFilters} title="검색 초기화">
              <i className="bi bi-x-circle"></i>
            </button>
          )}
        </div>
      </div>

      <div className="widget-alert-table-container" ref={tableContainerRef}>
        {isLoading && combinedErrors.length === 0 ? (
          <div className="widget-loading">
            <div className="loading-spinner"></div>
            <span>로딩 중...</span>
          </div>
        ) : combinedErrors.length === 0 ? (
          <div className="widget-empty">
            <i className="bi bi-check-circle"></i>
            <span>발생한 장애가 없습니다</span>
          </div>
        ) : (
          <table className="widget-alert-table">
            <thead>
              <tr>
                <th className="col-level">등급</th>
                <th className="col-status">상태</th>
                <th className="col-device">장비명</th>
                <th className="col-ip">IP 주소</th>
                <th className="col-group">그룹명</th>
                <th className="col-message">장애 내용</th>
                <th className="col-time">발생 시간</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((error, index) => (
                <tr
                  key={error.ERROR_ID || `error-${index}`}
                  className={`${getLevelClass(error.ERROR_LEVEL)}${highlightedIds.has(error.ERROR_ID) ? ' row-highlight' : ''}`}
                >
                  <td className="col-level">
                    <span className={`level-badge ${getLevelClass(error.ERROR_LEVEL)}`}>{getLevelLabel(error.ERROR_LEVEL)}</span>
                  </td>
                  <td className="col-status">
                    <span className={`status-badge ${error.ERROR_FLAG === 1 ? 'ack' : 'active'}`}>
                      {error.ERROR_FLAG === 1 ? '인지' : '발생'}
                    </span>
                  </td>
                  <td className="col-device" title={error.DEVICE_NAME || '-'}>{error.DEVICE_NAME || '-'}</td>
                  <td className="col-ip" title={error.DEVICE_IP || '-'}>{error.DEVICE_IP || '-'}</td>
                  <td className="col-group" title={error.GROUP_NAME || '-'}>{error.GROUP_NAME || '-'}</td>
                  <td className="col-message" title={error.ERROR_MESSAGE || '-'}>{error.ERROR_MESSAGE || '-'}</td>
                  <td className="col-time" title={formatDateTime(error.OCCUR_AT)}>{formatDateTime(error.OCCUR_AT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {combinedErrors.length > 0 && (
        <div className="widget-pagination">
          <span className="widget-pagination-info">
            {combinedErrors.length}건 중 {(alertPage - 1) * dynamicPageSize + 1}-{Math.min(alertPage * dynamicPageSize, combinedErrors.length)}
          </span>
          <div className="widget-pagination-controls">
            <button disabled={alertPage <= 1} onClick={() => setAlertPage(1)} title="처음"><i className="bi bi-chevron-double-left"></i></button>
            <button disabled={alertPage <= 1} onClick={() => setAlertPage(p => p - 1)} title="이전"><i className="bi bi-chevron-left"></i></button>
            <span className="widget-pagination-page">{alertPage} / {totalPages}</span>
            <button disabled={alertPage >= totalPages} onClick={() => setAlertPage(p => p + 1)} title="다음"><i className="bi bi-chevron-right"></i></button>
            <button disabled={alertPage >= totalPages} onClick={() => setAlertPage(totalPages)} title="마지막"><i className="bi bi-chevron-double-right"></i></button>
          </div>
        </div>
      )}
    </div>
  );
}
