import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { diffLines } from 'diff';
import apiClient from '../api/client';

export default function AssetConfigDetail() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { deviceName, deviceIp } = location.state || {};

  const [yesterdayConfig, setYesterdayConfig] = useState('');
  const [todayConfig, setTodayConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  // 날짜 선택 상태
  const [leftDate, setLeftDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  });
  const [rightDate, setRightDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 날짜 입력 참조
  const leftDateRef = useRef(null);
  const rightDateRef = useRef(null);

  // 날짜 입력 클릭 시 달력 열기
  const handleDateClick = (ref) => {
    if (ref.current && ref.current.showPicker) {
      try {
        ref.current.showPicker();
      } catch (e) {
        // showPicker가 지원되지 않는 브라우저 처리
        ref.current.focus();
      }
    }
  };

  // 설정 데이터 로드
  useEffect(() => {
    const abortController = new AbortController();
    let isCancelled = false;

    const fetchConfigData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 병렬로 두 API 호출
        const [leftResponse, rightResponse] = await Promise.all([
          apiClient.get(`/device-config/${deviceId}`, {
            params: { date: leftDate },
            signal: abortController.signal
          }),
          apiClient.get(`/device-config/${deviceId}`, {
            params: { date: rightDate },
            signal: abortController.signal
          })
        ]);

        if (!isCancelled) {
          setYesterdayConfig(leftResponse.data?.data?.config || '');
          setTodayConfig(rightResponse.data?.data?.config || '');
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'CanceledError') {
          console.error('설정 정보 조회 오류:', err);
          setError('설정 정보를 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    if (deviceId) {
      fetchConfigData();
    }

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [deviceId, leftDate, rightDate]);

  // 설정 비교 결과 계산
  const configDiff = useMemo(() => {
    if (!yesterdayConfig || !todayConfig) return [];

    const differences = diffLines(yesterdayConfig, todayConfig);
    return differences;
  }, [yesterdayConfig, todayConfig]);

  // 변경 통계 계산
  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    configDiff.forEach(part => {
      const lines = part.value.split('\n').filter(line => line.length > 0).length;
      if (part.added) {
        added += lines;
      } else if (part.removed) {
        removed += lines;
      } else {
        unchanged += lines;
      }
    });

    return { added, removed, unchanged, total: added + removed };
  }, [configDiff]);

  // 라인 번호가 포함된 설정 렌더링
  const renderConfigWithLineNumbers = (config, type) => {
    if (!config) {
      return (
        <div className="config-empty">
          <i className="bi bi-file-earmark-x"></i>
          <span>해당 날짜의 설정 정보가 없습니다.</span>
        </div>
      );
    }

    const lines = config.split('\n');
    return lines.map((line, index) => (
      <div key={index} className="config-line">
        <span className="line-number">{index + 1}</span>
        <span className="line-content">{line || ' '}</span>
      </div>
    ));
  };

  // 개선된 Diff 결과 렌더링
  const renderDiff = () => {
    if (configDiff.length === 0) return null;

    let oldLineNum = 0;
    let newLineNum = 0;
    const result = [];

    configDiff.forEach((part, partIndex) => {
      const lines = part.value.split('\n');
      // 마지막 빈 라인 제거
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      // 변경 없는 부분이 길면 접기
      if (!part.added && !part.removed && showOnlyChanges && lines.length > 6) {
        // 처음 3줄
        lines.slice(0, 3).forEach((line, lineIndex) => {
          oldLineNum++;
          newLineNum++;
          result.push(
            <div key={`${partIndex}-${lineIndex}`} className="diff-line unchanged context">
              <span className="diff-line-number old">{oldLineNum}</span>
              <span className="diff-line-number new">{newLineNum}</span>
              <span className="diff-prefix"> </span>
              <span className="diff-content">{line || ' '}</span>
            </div>
          );
        });

        // 생략 표시
        const skipped = lines.length - 6;
        oldLineNum += skipped;
        newLineNum += skipped;
        result.push(
          <div key={`${partIndex}-fold`} className="diff-line fold">
            <span className="diff-fold-info">
              <i className="bi bi-three-dots"></i>
              {skipped}줄 생략됨
            </span>
          </div>
        );

        // 마지막 3줄
        lines.slice(-3).forEach((line, lineIndex) => {
          oldLineNum++;
          newLineNum++;
          result.push(
            <div key={`${partIndex}-end-${lineIndex}`} className="diff-line unchanged context">
              <span className="diff-line-number old">{oldLineNum}</span>
              <span className="diff-line-number new">{newLineNum}</span>
              <span className="diff-prefix"> </span>
              <span className="diff-content">{line || ' '}</span>
            </div>
          );
        });
      } else {
        lines.forEach((line, lineIndex) => {
          let className = 'diff-line';
          let prefix = ' ';
          let oldNum = '';
          let newNum = '';

          if (part.added) {
            className += ' added';
            prefix = '+';
            newLineNum++;
            newNum = newLineNum;
          } else if (part.removed) {
            className += ' removed';
            prefix = '-';
            oldLineNum++;
            oldNum = oldLineNum;
          } else {
            className += ' unchanged';
            oldLineNum++;
            newLineNum++;
            oldNum = oldLineNum;
            newNum = newLineNum;
          }

          result.push(
            <div key={`${partIndex}-${lineIndex}`} className={className}>
              <span className="diff-line-number old">{oldNum}</span>
              <span className="diff-line-number new">{newNum}</span>
              <span className="diff-prefix">{prefix}</span>
              <span className="diff-content">{line || ' '}</span>
            </div>
          );
        });
      }
    });

    return result;
  };

  // 날짜 포맷팅
  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return '오늘';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return '어제';
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="page-container" style={{ display: 'flex', width: '100%', height: '100%' }}>
        <main className="page-main-content" style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#94a3b8'
          }}>
            <i className="bi bi-arrow-repeat spinning" style={{ fontSize: '32px', marginBottom: '16px' }}></i>
            <span>설정 정보를 불러오는 중...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container asset-config-detail-page">
      <main className="page-main-content full-width">
        {/* 페이지 헤더 */}
        <div className="page-header">
          <div className="page-header-left">
            <button
              className="btn btn-icon-only"
              onClick={() => navigate('/mgmt/asset-config')}
              style={{ marginRight: '12px' }}
              title="목록으로"
            >
              <i className="bi bi-arrow-left"></i>
            </button>
            <h1 className="page-title">
              <i className="bi bi-file-diff"></i>
              설정 정보 비교
            </h1>
            <span className="selected-group-badge">
              <i className="bi bi-hdd-network"></i>
              {deviceName ? `${deviceName} (${deviceIp})` : `장비 ID: ${deviceId}`}
            </span>
          </div>
          <div className="page-header-right">
            {diffStats.total > 0 && (
              <div className="diff-stats">
                <span className="diff-stat added">
                  <i className="bi bi-plus-circle"></i> {diffStats.added} 추가
                </span>
                <span className="diff-stat removed">
                  <i className="bi bi-dash-circle"></i> {diffStats.removed} 삭제
                </span>
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
            <p>{error}</p>
          </div>
        ) : (
          <div className="config-content-wrapper">
            {/* 설정 비교 영역 */}
            <div className="config-compare-container">
              {/* 왼쪽: 이전 설정 */}
              <div className="config-panel glass-card">
                <div className="config-panel-header">
                  <div className="config-panel-title">
                    <i className="bi bi-clock-history"></i>
                    <span>이전 설정</span>
                    <span className="date-badge">{formatDateLabel(leftDate)}</span>
                  </div>
                  <input
                    ref={leftDateRef}
                    type="date"
                    className="config-date-picker"
                    value={leftDate}
                    onChange={(e) => setLeftDate(e.target.value)}
                    onClick={() => handleDateClick(leftDateRef)}
                    max={rightDate}
                  />
                </div>
                <div className="config-panel-content">
                  <pre className="config-text">
                    {renderConfigWithLineNumbers(yesterdayConfig, 'old')}
                  </pre>
                </div>
              </div>

              {/* 오른쪽: 오늘 설정 */}
              <div className="config-panel glass-card">
                <div className="config-panel-header">
                  <div className="config-panel-title">
                    <i className="bi bi-file-text"></i>
                    <span>오늘 설정</span>
                    <span className="date-badge">{formatDateLabel(rightDate)}</span>
                  </div>
                  <input
                    ref={rightDateRef}
                    type="date"
                    className="config-date-picker"
                    value={rightDate}
                    onChange={(e) => setRightDate(e.target.value)}
                    onClick={() => handleDateClick(rightDateRef)}
                    min={leftDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="config-panel-content">
                  <pre className="config-text">
                    {renderConfigWithLineNumbers(todayConfig, 'new')}
                  </pre>
                </div>
              </div>
            </div>

            {/* 변경 내역 영역 */}
            <div className="config-diff-container glass-card">
              <div className="config-diff-header">
                <div className="config-diff-title">
                  <i className="bi bi-git"></i>
                  <span>변경 내역</span>
                  {diffStats.total > 0 && (
                    <span className="diff-summary">
                      총 {diffStats.total}개 라인 변경
                    </span>
                  )}
                </div>
                <div className="config-diff-actions">
                  <label className="toggle-compact">
                    <input
                      type="checkbox"
                      checked={showOnlyChanges}
                      onChange={(e) => setShowOnlyChanges(e.target.checked)}
                    />
                    <span>변경사항만 보기</span>
                  </label>
                  <div className="config-diff-legend">
                    <span className="legend-item added">
                      <span className="legend-color"></span> 추가
                    </span>
                    <span className="legend-item removed">
                      <span className="legend-color"></span> 삭제
                    </span>
                  </div>
                </div>
              </div>
              <div className="config-diff-content">
                {!yesterdayConfig || !todayConfig ? (
                  <div className="no-diff">
                    <i className="bi bi-file-earmark-x"></i>
                    <p>비교할 수 없습니다.</p>
                    <span className="no-diff-sub">
                      {!yesterdayConfig && !todayConfig
                        ? '양쪽 모두 설정 정보가 없습니다.'
                        : !yesterdayConfig
                          ? '이전 날짜의 설정 정보가 없습니다.'
                          : '오늘 날짜의 설정 정보가 없습니다.'}
                    </span>
                  </div>
                ) : diffStats.total === 0 ? (
                  <div className="no-diff">
                    <i className="bi bi-check-circle"></i>
                    <p>변경 사항이 없습니다.</p>
                    <span className="no-diff-sub">두 설정이 동일합니다.</span>
                  </div>
                ) : (
                  <div className="diff-table">
                    <div className="diff-table-header">
                      <span className="diff-col-old">이전</span>
                      <span className="diff-col-new">오늘</span>
                      <span className="diff-col-content">내용</span>
                    </div>
                    <pre className="diff-text">
                      {renderDiff()}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .asset-config-detail-page {
          display: flex;
          width: 100%;
          height: 100%;
        }

        .asset-config-detail-page .page-main-content.full-width {
          flex: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .config-content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
          overflow: hidden;
        }

        .config-compare-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          flex: 1;
          min-height: 0;
        }

        .config-panel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 200px;
        }

        .config-panel.glass-card:hover {
          transform: none;
        }

        .config-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.5);
          flex-shrink: 0;
        }

        .config-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .config-panel-title i {
          color: #60a5fa;
        }

        .date-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .config-date-picker {
          padding: 6px 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          font-size: 12px;
          cursor: pointer;
          transition: border-color 0.2s, background-color 0.2s;
        }

        .config-date-picker:hover {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(30, 41, 59, 0.8);
        }

        .config-date-picker:focus {
          outline: none;
          border-color: #3b82f6;
        }

        /* 달력 아이콘 클릭 영역 확대 */
        .config-date-picker::-webkit-calendar-picker-indicator {
          cursor: pointer;
          filter: invert(0.7);
          opacity: 0.7;
          padding: 4px;
          margin-left: 4px;
        }

        .config-date-picker::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }

        .config-panel-content {
          flex: 1;
          overflow: auto;
          padding: 0;
          min-height: 0;
        }

        .config-text {
          margin: 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #e2e8f0;
          background: transparent;
        }

        .config-line {
          display: flex;
          padding: 0 12px;
        }

        .config-line:hover {
          background: rgba(59, 130, 246, 0.1);
        }

        .line-number {
          width: 40px;
          min-width: 40px;
          text-align: right;
          padding-right: 12px;
          color: #64748b;
          user-select: none;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          margin-right: 12px;
        }

        .line-content {
          flex: 1;
          white-space: pre;
        }

        .config-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 150px;
          color: #64748b;
          gap: 8px;
        }

        .config-empty i {
          font-size: 32px;
          opacity: 0.5;
        }

        .config-empty span {
          font-size: 13px;
        }

        .config-diff-container {
          display: flex;
          flex-direction: column;
          flex: 0 0 auto;
          height: calc(100vh - 520px);
          min-height: 250px;
          max-height: 400px;
          overflow: hidden;
        }

        .config-diff-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.5);
          flex-shrink: 0;
        }

        .config-diff-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .config-diff-title i {
          color: #f59e0b;
        }

        .diff-summary {
          font-size: 12px;
          font-weight: 400;
          color: #94a3b8;
          padding-left: 8px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          margin-left: 8px;
        }

        .config-diff-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .toggle-compact {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #94a3b8;
          cursor: pointer;
        }

        .toggle-compact input {
          accent-color: #3b82f6;
        }

        .config-diff-legend {
          display: flex;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #94a3b8;
        }

        .legend-color {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        .legend-item.added .legend-color {
          background: rgba(34, 197, 94, 0.4);
          border: 1px solid #22c55e;
        }

        .legend-item.removed .legend-color {
          background: rgba(239, 68, 68, 0.4);
          border: 1px solid #ef4444;
        }

        .config-diff-content {
          flex: 1;
          overflow: auto;
          padding: 0;
          min-height: 0;
        }

        .diff-table {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .diff-table-header {
          display: flex;
          padding: 8px 12px;
          background: rgba(15, 23, 42, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .diff-col-old {
          width: 50px;
          min-width: 50px;
          text-align: center;
        }

        .diff-col-new {
          width: 50px;
          min-width: 50px;
          text-align: center;
        }

        .diff-col-content {
          flex: 1;
          padding-left: 24px;
        }

        .diff-text {
          margin: 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12px;
          line-height: 1.7;
          color: #e2e8f0;
          background: transparent;
          flex: 1;
          overflow: auto;
        }

        .diff-line {
          display: flex;
          padding: 2px 12px;
          border-left: 3px solid transparent;
        }

        .diff-line.added {
          background: rgba(34, 197, 94, 0.1);
          border-left-color: #22c55e;
        }

        .diff-line.removed {
          background: rgba(239, 68, 68, 0.1);
          border-left-color: #ef4444;
        }

        .diff-line.unchanged {
          opacity: 0.7;
        }

        .diff-line.unchanged:hover {
          background: rgba(255, 255, 255, 0.05);
          opacity: 1;
        }

        .diff-line.context {
          opacity: 0.5;
        }

        .diff-line.fold {
          background: rgba(59, 130, 246, 0.1);
          justify-content: center;
          padding: 4px 12px;
          border-left-color: #3b82f6;
        }

        .diff-fold-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #60a5fa;
        }

        .diff-line-number {
          width: 50px;
          min-width: 50px;
          text-align: center;
          color: #64748b;
          user-select: none;
          font-size: 11px;
        }

        .diff-line-number.old {
          color: #f87171;
        }

        .diff-line-number.new {
          color: #4ade80;
        }

        .diff-line.unchanged .diff-line-number.old,
        .diff-line.unchanged .diff-line-number.new {
          color: #64748b;
        }

        .diff-prefix {
          width: 24px;
          min-width: 24px;
          text-align: center;
          font-weight: bold;
          user-select: none;
          font-size: 13px;
        }

        .diff-line.added .diff-prefix {
          color: #22c55e;
        }

        .diff-line.removed .diff-prefix {
          color: #ef4444;
        }

        .diff-content {
          flex: 1;
          white-space: pre;
          padding-left: 8px;
        }

        .diff-line.added .diff-content {
          color: #4ade80;
        }

        .diff-line.removed .diff-content {
          color: #f87171;
          text-decoration: line-through;
          text-decoration-color: rgba(248, 113, 113, 0.5);
        }

        .no-diff {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #94a3b8;
        }

        .no-diff i {
          font-size: 48px;
          color: #22c55e;
          margin-bottom: 12px;
        }

        .no-diff p {
          font-size: 16px;
          font-weight: 500;
          color: #e2e8f0;
          margin-bottom: 4px;
        }

        .no-diff-sub {
          font-size: 13px;
          color: #64748b;
        }

        .diff-stats {
          display: flex;
          gap: 12px;
        }

        .diff-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .diff-stat.added {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .diff-stat.removed {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .page-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        @media (max-width: 1200px) {
          .config-compare-container {
            grid-template-columns: 1fr;
          }

          .config-diff-container {
            height: 300px;
          }
        }
      `}</style>
    </div>
  );
}
