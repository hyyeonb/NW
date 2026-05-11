/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth, max-params */
// DeviceDetailModal의 Config 탭 — 두 날짜 config side-by-side + diff.

export default function ConfigTab(props) {
  const {
    configDiffStats, configSyncScroll, setConfigSyncScroll,
    configLeftDateRef, configLeftDate, setConfigLeftDate, configRightDate,
    configLeftPanelRef, handleConfigScroll, configLeft, configRight,
    configDates, configShowOnlyChanges, setConfigShowOnlyChanges, formatConfigDateLabel,
    configRightDateRef, setConfigRightDate, configRightPanelRef,
    configLoading, configDiff,
  } = props;

  return (
          <div id="config-tab" className="detail-tab-content active">
            {/* 상단 통계 + 동기화 스크롤 토글 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.5)', borderRadius: 6,
              border: '1px solid rgba(148, 163, 184, 0.15)',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#94a3b8' }}>
                  <i className="bi bi-file-diff" /> Config 비교
                </span>
                {configDiffStats.total > 0 && (
                  <>
                    <span style={{ color: '#34d399' }}>
                      <i className="bi bi-plus-circle" /> {configDiffStats.added} 추가
                    </span>
                    <span style={{ color: '#f87171' }}>
                      <i className="bi bi-dash-circle" /> {configDiffStats.removed} 삭제
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => setConfigSyncScroll(!configSyncScroll)}
                style={{
                  padding: '4px 10px', borderRadius: 4,
                  background: configSyncScroll ? 'rgba(56, 189, 248, 0.15)' : 'rgba(51, 65, 85, 0.4)',
                  color: configSyncScroll ? '#38bdf8' : '#94a3b8',
                  border: `1px solid ${configSyncScroll ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.2)'}`,
                  cursor: 'pointer', fontSize: 11,
                }}
              >
                <i className={`bi ${configSyncScroll ? 'bi-link-45deg' : 'bi-link'}`} /> 동기화 스크롤
              </button>
            </div>

            {/* 두 패널 side-by-side */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, height: 'calc(60vh - 180px)', minHeight: 300 }}>
              {/* 이전 패널 */}
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                background: 'rgba(15, 23, 42, 0.4)', borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.15)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                    <i className="bi bi-clock-history" /> 이전 설정
                  </div>
                  <input
                    ref={configLeftDateRef}
                    type="date"
                    value={configLeftDate}
                    onChange={(e) => setConfigLeftDate(e.target.value)}
                    onClick={() => configLeftDateRef.current?.showPicker?.()}
                    max={configRightDate}
                    list="config-dates-list"
                    style={{ padding: '4px 8px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 4, color: '#e2e8f0', fontSize: 11 }}
                  />
                </div>
                <div
                  ref={configLeftPanelRef}
                  onScroll={() => handleConfigScroll('left')}
                  style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontSize: 13, fontFamily: "'D2Coding', 'Cascadia Code', Consolas, 'Courier New', monospace", lineHeight: 1.6 }}
                >
                  {!configLeft ? (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                      <i className="bi bi-file-earmark-x" /> 해당 날짜 Config 없음
                    </div>
                  ) : (
                    configLeft.split('\n').map((line, i) => (
                      <div key={i} style={{ display: 'flex', color: '#cbd5e1' }}>
                        <span style={{ minWidth: 32, textAlign: 'right', paddingRight: 10, color: '#475569', userSelect: 'none' }}>{i + 1}</span>
                        <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line || ' '}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 이후 패널 */}
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                background: 'rgba(15, 23, 42, 0.4)', borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.15)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                    <i className="bi bi-file-text" /> 이후 설정
                    {configRightDate && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10,
                        background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8',
                      }}>{formatConfigDateLabel(configRightDate)}</span>
                    )}
                  </div>
                  <input
                    ref={configRightDateRef}
                    type="date"
                    value={configRightDate}
                    onChange={(e) => setConfigRightDate(e.target.value)}
                    onClick={() => configRightDateRef.current?.showPicker?.()}
                    min={configLeftDate}
                    max={new Date().toISOString().split('T')[0]}
                    list="config-dates-list"
                    style={{ padding: '4px 8px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 4, color: '#e2e8f0', fontSize: 11 }}
                  />
                </div>
                <div
                  ref={configRightPanelRef}
                  onScroll={() => handleConfigScroll('right')}
                  style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontSize: 13, fontFamily: "'D2Coding', 'Cascadia Code', Consolas, 'Courier New', monospace", lineHeight: 1.6 }}
                >
                  {!configRight ? (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                      <i className="bi bi-file-earmark-x" /> 해당 날짜 Config 없음
                    </div>
                  ) : (
                    configRight.split('\n').map((line, i) => (
                      <div key={i} style={{ display: 'flex', color: '#cbd5e1' }}>
                        <span style={{ minWidth: 32, textAlign: 'right', paddingRight: 10, color: '#475569', userSelect: 'none' }}>{i + 1}</span>
                        <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line || ' '}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 수집 이력 datalist (브라우저 자동완성) */}
            {configDates.length > 0 && (
              <datalist id="config-dates-list">
                {configDates.map(d => <option key={d} value={d} />)}
              </datalist>
            )}

            {/* 변경 내역 섹션 */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.4)', borderRadius: 6,
              border: '1px solid rgba(148, 163, 184, 0.15)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
                  <i className="bi bi-git" /> 변경 내역
                  {configDiffStats.total > 0 && (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>총 {configDiffStats.total}개 라인 변경</span>
                  )}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                  <input type="checkbox" checked={configShowOnlyChanges} onChange={(e) => setConfigShowOnlyChanges(e.target.checked)} />
                  변경사항만 보기
                </label>
              </div>
              <div style={{ maxHeight: 250, overflow: 'auto', padding: '8px 12px', fontSize: 13, fontFamily: "'D2Coding', 'Cascadia Code', Consolas, 'Courier New', monospace", lineHeight: 1.6 }}>
                {configLoading ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                    <i className="bi bi-arrow-repeat spinning" /> 불러오는 중...
                  </div>
                ) : !configLeft && !configRight ? (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                    <i className="bi bi-file-earmark-x" /> 비교할 Config가 없습니다
                  </div>
                ) : configDiffStats.total === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                    <i className="bi bi-check-circle" /> 변경 사항이 없습니다
                  </div>
                ) : (
                  (() => {
                    let oldLn = 0, newLn = 0;
                    const out = [];
                    configDiff.forEach((part, pi) => {
                      const lns = part.value.split('\n');
                      if (lns[lns.length - 1] === '') lns.pop();

                      if (!part.added && !part.removed && configShowOnlyChanges && lns.length > 6) {
                        // 앞 3줄
                        lns.slice(0, 3).forEach((l, li) => {
                          oldLn++; newLn++;
                          out.push(
                            <div key={`${pi}-${li}`} style={{ display: 'flex', color: '#94a3b8' }}>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{oldLn}</span>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{newLn}</span>
                              <span style={{ width: 16, color: '#64748b' }}> </span>
                              <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l || ' '}</span>
                            </div>
                          );
                        });
                        // 생략 표시
                        const skip = lns.length - 6;
                        oldLn += skip; newLn += skip;
                        out.push(
                          <div key={`${pi}-fold`} style={{ color: '#64748b', textAlign: 'center', padding: '4px 0', fontSize: 10 }}>
                            <i className="bi bi-three-dots" /> {skip}줄 생략됨
                          </div>
                        );
                        // 뒤 3줄
                        lns.slice(-3).forEach((l, li) => {
                          oldLn++; newLn++;
                          out.push(
                            <div key={`${pi}-end-${li}`} style={{ display: 'flex', color: '#94a3b8' }}>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{oldLn}</span>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{newLn}</span>
                              <span style={{ width: 16, color: '#64748b' }}> </span>
                              <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l || ' '}</span>
                            </div>
                          );
                        });
                      } else {
                        lns.forEach((l, li) => {
                          let color = '#94a3b8', bg = 'transparent', prefix = ' ';
                          let oldN = '', newN = '';
                          if (part.added) { color = '#34d399'; bg = 'rgba(16, 185, 129, 0.1)'; prefix = '+'; newLn++; newN = newLn; }
                          else if (part.removed) { color = '#f87171'; bg = 'rgba(239, 68, 68, 0.1)'; prefix = '-'; oldLn++; oldN = oldLn; }
                          else { oldLn++; newLn++; oldN = oldLn; newN = newLn; }
                          out.push(
                            <div key={`${pi}-${li}`} style={{ display: 'flex', color, background: bg }}>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{oldN}</span>
                              <span style={{ width: 32, textAlign: 'right', paddingRight: 6, color: '#475569' }}>{newN}</span>
                              <span style={{ width: 16, opacity: 0.7 }}>{prefix}</span>
                              <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l || ' '}</span>
                            </div>
                          );
                        });
                      }
                    });
                    return out;
                  })()
                )}
              </div>
            </div>
          </div>
  );
}
