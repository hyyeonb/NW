import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import DatePicker from 'react-datepicker';
import WatchSidebar from '../components/WatchSidebar';
import { useWatchStore } from '../stores/watchStore';
import { useGroupTree } from '../hooks/useGroups';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/pages/_perf-explorer.css';
import { getDateRange, autoGranularity } from '../shared/lib/timeRange';
import { usePerfDeviceList } from '../features/performance-explorer/hooks/usePerfDeviceList';
import { usePerfDeviceMetrics } from '../features/performance-explorer/hooks/usePerfDeviceMetrics';
import PEDeviceCard from '../features/performance-explorer/components/PEDeviceCard';
import { PERIOD_OPTIONS, EMPTY_ARR } from '../features/performance-explorer/model/constants';

// ========================== DnD Sortable Wrapper ==========================
function SortableCard({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
    minWidth: 0,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

const restrictHorizontalToWindow = ({ transform, draggingNodeRect, windowRect }) => {
  if (!draggingNodeRect || !windowRect) return transform;
  return {
    ...transform,
    x: Math.min(
      Math.max(transform.x, windowRect.left - draggingNodeRect.left),
      windowRect.right - draggingNodeRect.right,
    ),
  };
};

// ========================== 페이지 ==========================
export default function PerformanceExplorer() {
  const {
    hiddenDeviceIds, hideDevice, showDevice, showAllDevices,
    deviceOrder, setDeviceOrder,
  } = useWatchStore();

  const [selectedGroup, setSelectedGroup] = useState(null);
  const { data: regularGroupsForAutoSelect } = useGroupTree();

  // 첫 진입 시 첫 그룹 자동 선택 (WatchSidebar의 auto-select가 persisted store 때문에 차단되는 경우 보강)
  useEffect(() => {
    if (selectedGroup) return;
    if (!regularGroupsForAutoSelect || regularGroupsForAutoSelect.length === 0) return;
    const first = regularGroupsForAutoSelect.find(g => g.GROUP_NAME !== '미등록 장비') || regularGroupsForAutoSelect[0];
    if (first) {
      setSelectedGroup({ groupId: first.GROUP_ID, groupName: first.GROUP_NAME, type: 'regular' });
    }
  }, [regularGroupsForAutoSelect, selectedGroup]);

  const [period, setPeriod] = useState('24h');
  const [layout, setLayout] = useState(3); // 5/4/3 columns
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedRange, setAppliedRange] = useState(getDateRange('24h', PERIOD_OPTIONS));
  const [showHiddenDropdown, setShowHiddenDropdown] = useState(false);
  // 모달 열림 카운트 (열려있는 동안 카드 DnD 비활성화)
  const [openModalCount, setOpenModalCount] = useState(0);
  const handleCardModalToggle = useCallback((open) => {
    setOpenModalCount(c => open ? c + 1 : Math.max(0, c - 1));
  }, []);
  const dndDisabled = openModalCount > 0;
  const [hiddenDropdownPos, setHiddenDropdownPos] = useState(null);
  const hiddenBtnRef = useRef(null);
  const hiddenRef = useRef(null);

  const toggleHiddenDropdown = () => {
    if (showHiddenDropdown) { setShowHiddenDropdown(false); return; }
    const r = hiddenBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 280;
    const estimatedHeight = 40 + Math.min(currentHiddenIds.length, 7) * 44 + 40; // head + list + show-all
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= estimatedHeight + 12 || r.top < estimatedHeight + 12
      ? r.bottom + 8
      : r.top - estimatedHeight - 6;
    setHiddenDropdownPos({ top, left });
    setShowHiddenDropdown(true);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { groupId, groupName, groupDevices, deviceIds } = usePerfDeviceList(selectedGroup);
  const granularity = useMemo(
    () => autoGranularity(appliedRange?.startDate, appliedRange?.endDate),
    [appliedRange]
  );
  const { cpuMemBatch, trafficBatch, icmpBatch, isLoading, ledStatusMap } =
    usePerfDeviceMetrics(deviceIds, appliedRange, granularity, groupId);

  // 정렬 + 숨김 (UI state)
  const currentHiddenIds = useMemo(() => (groupId && hiddenDeviceIds[groupId]) || [], [groupId, hiddenDeviceIds]);
  const currentOrder = useMemo(() => (groupId && deviceOrder[groupId]) || [], [groupId, deviceOrder]);

  // 정렬용 priority Map (0=ok, 1=warn, 2=crit) — 정상 위, 심각 아래
  const deviceStatusMap = useMemo(() => {
    const m = new Map();
    ledStatusMap.forEach((status, deviceId) => {
      m.set(deviceId, status === 'crit' ? 2 : status === 'warn' ? 1 : 0);
    });
    return m;
  }, [ledStatusMap]);

  const orderedDevices = useMemo(() => {
    if (!groupDevices.length || !groupId) return [];
    const hidden = new Set(currentHiddenIds);
    const map = new Map(groupDevices.map(d => [d.deviceId, d]));
    const seen = new Set();
    const ids = [];
    // 1) 사용자 수동 순서 우선
    currentOrder.forEach(id => { if (map.has(id) && !hidden.has(id) && !seen.has(id)) { ids.push(id); seen.add(id); } });
    // 2) 나머지: 정상 → SNMP 장애 → PING 장애 순 (정상이 위, 심각한 장애가 아래)
    [...groupDevices].sort((a, b) => {
      const sa = deviceStatusMap.get(a.deviceId) ?? 0;
      const sb = deviceStatusMap.get(b.deviceId) ?? 0;
      if (sa !== sb) return sa - sb;
      return a.deviceId - b.deviceId;
    }).forEach(d => {
      if (!seen.has(d.deviceId) && !hidden.has(d.deviceId)) { ids.push(d.deviceId); seen.add(d.deviceId); }
    });
    return ids.map(id => map.get(id)).filter(Boolean);
  }, [groupDevices, groupId, currentHiddenIds, currentOrder, deviceStatusMap]);

  const orderedRef = useRef(orderedDevices);
  useEffect(() => { orderedRef.current = orderedDevices; }, [orderedDevices]);

  const handleHide = useCallback((deviceId) => { if (groupId) hideDevice(groupId, deviceId); }, [groupId, hideDevice]);
  const handleShow = useCallback((deviceId) => {
    if (!groupId) return;
    showDevice(groupId, deviceId);
    if (currentHiddenIds.length <= 1) setShowHiddenDropdown(false);
  }, [groupId, showDevice, currentHiddenIds]);
  const handleShowAll = useCallback(() => { if (groupId) { showAllDevices(groupId); setShowHiddenDropdown(false); } }, [groupId, showAllDevices]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !groupId) return;
    const ids = orderedRef.current.map(d => d.deviceId);
    const oldI = ids.indexOf(active.id);
    const newI = ids.indexOf(over.id);
    if (oldI === -1 || newI === -1) return;
    const newOrder = arrayMove(ids, oldI, newI);
    const hiddenInOrder = currentOrder.filter(id => currentHiddenIds.includes(id));
    setDeviceOrder(groupId, [...newOrder, ...hiddenInOrder]);
  }, [groupId, currentOrder, currentHiddenIds, setDeviceOrder]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e) => {
      if (hiddenBtnRef.current?.contains(e.target)) return;
      if (hiddenRef.current?.contains(e.target)) return;
      setShowHiddenDropdown(false);
    };
    if (showHiddenDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHiddenDropdown]);

  // 기간 적용
  const handleApply = () => {
    const r = getDateRange(period, PERIOD_OPTIONS, customStart, customEnd);
    if (r && r.startDate && r.endDate) setAppliedRange(r);
  };

  const totalPoints = useMemo(() => {
    return Object.values(cpuMemBatch).reduce(
      (acc, rows) => acc + ((rows || []).filter(r => r.CORE_INDEX == null).length), 0,
    );
  }, [cpuMemBatch]);

  return (
    <div className="pe-page c-emerald">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-graph-up" />
            성능 감시
          </h1>
          <span className="page-subtitle">
            적재된 시계열 데이터 분석
            {groupName && <> · {groupName} · {groupDevices.length}개 장비</>}
          </span>
        </div>
      </div>

      <div className="pe-layout">
        <WatchSidebar
          onGroupSelect={setSelectedGroup}
          title="관제 그룹"
          titleIcon="bi bi-collection"
          showImportButton={false}
        />

        <div className="pe-main">
          {/* 컨트롤 바 */}
          <div className="pe-toolbar glass">
            <div className="pe-toolbar-section">
              <span className="pe-toolbar-label">기간</span>
              <div className="pe-segment">
                {PERIOD_OPTIONS.map(opt => (
                  <button key={opt.id}
                    className={period === opt.id ? 'active' : ''}
                    onClick={() => {
                      setPeriod(opt.id);
                      if (opt.id !== 'custom') {
                        const r = getDateRange(opt.id, PERIOD_OPTIONS);
                        if (r) setAppliedRange(r);
                      }
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="pe-custom-range">
                  <input type="datetime-local" className="pe-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  <span className="pe-sep">~</span>
                  <input type="datetime-local" className="pe-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                  <button className="pe-btn-apply" onClick={handleApply}><i className="bi bi-check2" /> 적용</button>
                </div>
              )}
            </div>

            <div className="pe-toolbar-section">
              <span className="pe-toolbar-label">레이아웃</span>
              <div className="pe-segment">
                {[5, 4, 3].map(n => (
                  <button key={n} className={layout === n ? 'active' : ''} onClick={() => setLayout(n)}>{n}열</button>
                ))}
              </div>
            </div>

            <div className="pe-meta">
              <span className="pe-meta-item">집계 <b>{granularity}</b></span>
              <span className="pe-meta-item">포인트 <b>{totalPoints}</b></span>
              {currentHiddenIds.length > 0 && (
                <>
                  <button ref={hiddenBtnRef} className="pe-icon-btn" title={`숨김 ${currentHiddenIds.length}`} onClick={toggleHiddenDropdown}>
                    <i className="bi bi-eye-slash" />
                  </button>
                  {showHiddenDropdown && hiddenDropdownPos && createPortal(
                    <div ref={hiddenRef} className="pe-hidden-dropdown pe-hidden-dropdown-fixed"
                         style={{ top: hiddenDropdownPos.top, left: hiddenDropdownPos.left }}>
                      <div className="pe-hidden-head">숨긴 장비 ({currentHiddenIds.length})</div>
                      <div className="pe-hidden-list">
                        {currentHiddenIds.map(id => {
                          const dev = groupDevices.find(d => d.deviceId === id);
                          if (!dev) return null;
                          return (
                            <div key={id} className="pe-hidden-item">
                              <div>
                                <div className="pe-hidden-name">{dev.deviceName}</div>
                                <div className="pe-hidden-ip">{dev.deviceIp}</div>
                              </div>
                              <button className="pe-hidden-show" onClick={() => handleShow(id)}>표시</button>
                            </div>
                          );
                        })}
                      </div>
                      <button className="pe-hidden-show-all" onClick={handleShowAll}>모두 표시</button>
                    </div>,
                    document.body
                  )}
                </>
              )}
              {isLoading && <span className="pe-meta-item pe-loading-pill"><i className="bi bi-arrow-repeat" /> 로딩</span>}
            </div>
          </div>

          {/* 카드 그리드 */}
          {!selectedGroup ? (
            <div className="pe-empty">
              <i className="bi bi-graph-up" />
              <h2>그룹을 선택하세요</h2>
              <p>왼쪽에서 관제 그룹을 선택하면 적재된 성능 데이터를 조회합니다.</p>
            </div>
          ) : groupDevices.length === 0 ? (
            <div className="pe-empty">
              <i className="bi bi-hdd-network" />
              <h2>장비가 없습니다</h2>
              <p>이 그룹에 등록된 장비가 없습니다.</p>
            </div>
          ) : orderedDevices.length === 0 ? (
            <div className="pe-empty">
              <i className="bi bi-eye-slash" />
              <h2>모든 장비가 숨겨져 있습니다</h2>
              <p>상단 숨김 버튼에서 표시할 장비를 선택하세요.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictHorizontalToWindow]} autoScroll={false}>
              <SortableContext items={orderedDevices.map(d => d.deviceId)} strategy={rectSortingStrategy}>
                <div className={`pe-grid pe-grid-${layout}`}>
                  {orderedDevices.map(device => (
                    <SortableCard key={device.deviceId} id={device.deviceId} disabled={dndDisabled}>
                      <PEDeviceCard
                        device={device}
                        cpuMemRows={cpuMemBatch[device.deviceId] || EMPTY_ARR}
                        trafficRows={trafficBatch[device.deviceId] || EMPTY_ARR}
                        icmpRows={icmpBatch[device.deviceId] || EMPTY_ARR}
                        ledStatus={ledStatusMap.get(device.deviceId) || 'ok'}
                        appliedRange={appliedRange}
                        isLoading={isLoading}
                        onHide={handleHide}
                        onModalToggle={handleCardModalToggle}
                      />
                    </SortableCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
