import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import TopologySidebar from '../components/TopologySidebar';
import DeviceDetailModal from '../components/DeviceDetailModal';
import { useDeviceErrorLevels, useDevicePorts, useGroupTree, useDevicesByGroup } from '../hooks';
import { useUserTopology, useUserTopologyGroup, useSaveUserTopology, useSaveUserTopologyGroup, useSaveUserBackgroundImage, useSaveUserNodeImage } from '../hooks';
import { useGroupStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import '../styles/topology-sidebar.css';
import '../styles/user-topology.css';

const ICONS = {
  "CX8100-24": "/icon/CX8100-24.png",
  "CX8100-48": "/icon/CX8100-48.png",
  "HPE 7503X": "/icon/HPE 7503X.png",
  "HPE 7506X": "/icon/HPE 7506X.png"
};
const NODE_SIZE = 40;

export default function UserTopology() {
  const { user } = useAuthStore();
  const userId = user?.USER_ID;

  const graphRef = useRef(null);
  const containerRef = useRef(null);

  const { setSelectedGroup } = useGroupStore();
  const { deviceErrorMap, groupErrorMap } = useDeviceErrorLevels();
  const { data: groupTree } = useGroupTree();
  const deviceErrorMapRef = useRef(deviceErrorMap);
  const groupErrorMapRef = useRef(new Map());

  // ===== 뷰 네비게이션 (사용자 루트 ↔ 그룹 드릴다운) =====
  const [currentView, setCurrentView] = useState({ type: 'user' }); // { type: 'user' } | { type: 'group', groupId, groupName }
  const [viewHistory, setViewHistory] = useState([]); // 뒤로가기 스택
  const isUserRoot = currentView.type === 'user';

  // API - 사용자 토폴로지 (메인, groupId=0)
  const { data: topoData, isLoading: userLoading } = useUserTopology(userId);
  // API - 그룹 하위 토폴로지 (드릴다운)
  const groupId = currentView.type === 'group' ? currentView.groupId : null;
  const { data: groupTopoData, isLoading: groupLoading } = useUserTopologyGroup(userId, groupId);
  const isLoading = isUserRoot ? userLoading : groupLoading;

  const saveMutation = useSaveUserTopology();
  const saveGroupMutation = useSaveUserTopologyGroup();
  const bgImageMutation = useSaveUserBackgroundImage();
  const nodeImageMutation = useSaveUserNodeImage();

  // 현재 그룹의 장비 목록 조회 (빈 토폴로지 시 장비 자동 추가용)
  const { data: currentGroupDevices, isLoading: devicesLoading } = useDevicesByGroup(
    !isUserRoot ? currentView.groupId : null
  );

  // 빈 토폴로지 확인 팝업
  const [showEmptyTopologyPrompt, setShowEmptyTopologyPrompt] = useState(false);
  const emptyTopologyCheckedRef = useRef(null);

  // 그룹 전환 애니메이션
  const [isGroupSwitching, setIsGroupSwitching] = useState(false);

  // 편집 모드
  const [isEditMode, setIsEditMode] = useState(false);

  const [data, setData] = useState({ nodes: [], links: [] });
  const [viewMeta, setViewMeta] = useState({ viewId: null, zoom: 1, centerX: 0, centerY: 0 });
  const [dimensions, setDimensions] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [selectedSidebarDevice, setSelectedSidebarDevice] = useState(null);
  const [linkDraftSource, setLinkDraftSource] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, target: null });
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const selectedNodesRef = useRef(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionStartRef = useRef(null);
  const selectionDragStarted = useRef(false);
  const selectionEndTimeRef = useRef(0);
  const lastNodeClickTimeRef = useRef(0);
  const dragOffsetsRef = useRef({});
  const isDraggingNodesRef = useRef(false);
  const dragEndTimeRef = useRef(0);
  const draggingNodeRef = useRef(null);
  const linkIdCounter = useRef(100);
  const iconCache = useRef({});
  const nodeIconCache = useRef({});

  // 커스텀 모달 상태
  const [customModal, setCustomModal] = useState({
    visible: false,
    type: 'alert', // 'alert' | 'confirm' | 'success' | 'error' | 'warning'
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const showAlert = useCallback((message, type = 'info', title = '') => {
    setCustomModal({
      visible: true,
      type,
      title: title || (type === 'success' ? '완료' : type === 'error' ? '오류' : type === 'warning' ? '경고' : '알림'),
      message,
      onConfirm: () => setCustomModal(prev => ({ ...prev, visible: false })),
      onCancel: null
    });
  }, []);

  const showConfirm = useCallback((message, title = '확인') => {
    return new Promise((resolve) => {
      setCustomModal({
        visible: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setCustomModal(prev => ({ ...prev, visible: false }));
          resolve(true);
        },
        onCancel: () => {
          setCustomModal(prev => ({ ...prev, visible: false }));
          resolve(false);
        }
      });
    });
  }, []);

  // 배경 이미지
  const [backgroundImage, setBackgroundImage] = useState(null);
  const backgroundImageRef = useRef(null);
  const [bgImageModalOpen, setBgImageModalOpen] = useState(false);
  const [bgImageInput, setBgImageInput] = useState('');

  // 노드 이미지 변경 모달
  const [nodeImageModalOpen, setNodeImageModalOpen] = useState(false);
  const [nodeImageTarget, setNodeImageTarget] = useState(null);
  const [nodeImageInput, setNodeImageInput] = useState('');

  // 장비 모달
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceModalId, setDeviceModalId] = useState(null);

  // 노드에서 실제 deviceId 추출 (D15 → 15)
  const getDeviceIdFromNode = (node) => node?.deviceId || (node?.id?.startsWith('D') ? Number(node.id.substring(1)) : node?.id);

  // 인터페이스 모달
  const [interfaceModalOpen, setInterfaceModalOpen] = useState(false);
  const [interfaceModalStep, setInterfaceModalStep] = useState(1);
  const [pendingLinkSource, setPendingLinkSource] = useState(null);
  const [pendingLinkTarget, setPendingLinkTarget] = useState(null);
  const sourceDeviceId = interfaceModalOpen && pendingLinkSource?.node ? getDeviceIdFromNode(pendingLinkSource.node) : null;
  const targetDeviceId = interfaceModalOpen && pendingLinkTarget?.node ? getDeviceIdFromNode(pendingLinkTarget.node) : null;
  const { data: sourcePorts, isLoading: sourcePortsLoading } = useDevicePorts(sourceDeviceId);
  const { data: targetPorts, isLoading: targetPortsLoading } = useDevicePorts(targetDeviceId);

  // 선택된 링크의 양쪽 장비 포트 조회 (IF_INDEX → IF_NAME 변환용)
  const selectedLinkSrcNode = selectedLink ? data.nodes.find(n => n.id === (typeof selectedLink.source === 'object' ? selectedLink.source?.id : selectedLink.source)) : null;
  const selectedLinkDstNode = selectedLink ? data.nodes.find(n => n.id === (typeof selectedLink.target === 'object' ? selectedLink.target?.id : selectedLink.target)) : null;
  const selectedLinkSrcDeviceId = selectedLinkSrcNode?.nodeType === 'device' ? getDeviceIdFromNode(selectedLinkSrcNode) : null;
  const selectedLinkDstDeviceId = selectedLinkDstNode?.nodeType === 'device' ? getDeviceIdFromNode(selectedLinkDstNode) : null;
  const { data: linkSrcPorts, isLoading: linkSrcPortsLoading } = useDevicePorts(selectedLinkSrcDeviceId);
  const { data: linkDstPorts, isLoading: linkDstPortsLoading } = useDevicePorts(selectedLinkDstDeviceId);
  const linkPortsLoading = linkSrcPortsLoading || linkDstPortsLoading;

  // IF_INDEX로 포트 이름 찾기 (포트 로딩 중이면 null 반환)
  const resolveIfName = useCallback((ifIndex, ifName, ports, isLoading) => {
    if (ifName) return ifName;
    if (!ifIndex) return '-';
    if (isLoading) return null; // 로딩 중 → null (패널에서 로딩 표시)
    const portList = ports?.content || ports || [];
    const port = portList.find(p => String(p.IF_INDEX) === String(ifIndex));
    return port?.IF_NAME || port?.IF_DESCR || `IF:${ifIndex}`;
  }, []);

  // 등록된 장비 ID
  const registeredDeviceIds = useMemo(() => {
    const ids = new Set();
    data.nodes.forEach(n => {
      if (n.deviceId) ids.add(String(n.deviceId));
      else if (n.id?.startsWith('D')) ids.add(n.id.substring(1));
    });
    return ids;
  }, [data.nodes]);

  // ===== 편집 모드 토글 =====
  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => {
      const next = !prev;
      if (next) {
        setSidebarCollapsed(false); // 편집 시작 → 사이드바 열기
      } else {
        setSidebarCollapsed(true);  // 편집 종료 → 사이드바 닫기
        setLinkDraftSource(null);
        setSelectedNodes(new Set());
        setSelectedNode(null);
        setSelectedLink(null);
      }
      return next;
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // 장애 맵 (상위 그룹 전파 포함)
  useEffect(() => {
    deviceErrorMapRef.current = deviceErrorMap;
    if (!groupTree || groupTree.length === 0) {
      groupErrorMapRef.current = groupErrorMap;
      return;
    }
    const levelPriority = { 'C': 4, 'M': 3, 'N': 2, 'W': 1 };
    const enhanced = new Map(groupErrorMap);
    const buildAncestors = (nodes, ancestors) => {
      for (const node of nodes) {
        const myLevel = groupErrorMap.get(node.GROUP_NAME);
        if (myLevel) {
          for (const anc of ancestors) {
            const existing = enhanced.get(anc);
            if ((levelPriority[myLevel] || 0) > (levelPriority[existing] || 0)) {
              enhanced.set(anc, myLevel);
            }
          }
        }
        if (node.children?.length > 0) {
          buildAncestors(node.children, [...ancestors, node.GROUP_NAME]);
        }
      }
    };
    buildAncestors(groupTree, []);
    groupErrorMapRef.current = enhanced;
  }, [deviceErrorMap, groupErrorMap, groupTree]);

  // 장애 펄스 애니메이션 - 장애 노드가 있을 때만 주기적 re-render
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    const hasFaults = deviceErrorMap.size > 0 || groupErrorMap.size > 0;
    if (!hasFaults) return;
    const interval = setInterval(() => setPulseKey(k => k + 1), 80);
    return () => clearInterval(interval);
  }, [deviceErrorMap, groupErrorMap]);

  useEffect(() => { selectedNodesRef.current = selectedNodes; }, [selectedNodes]);

  // 빈 토폴로지 감지 및 팝업 표시
  useEffect(() => {
    if (isUserRoot || isLoading || devicesLoading) return;
    const rawData = groupTopoData;
    if (!rawData || !currentGroupDevices) return;
    if (emptyTopologyCheckedRef.current === currentView.groupId) return;

    const nodes = rawData.nodes || [];
    const devices = currentGroupDevices?.content || currentGroupDevices || [];

    if (nodes.length === 0 && devices.length > 0) {
      setShowEmptyTopologyPrompt(true);
    }
    emptyTopologyCheckedRef.current = currentView.groupId;
  }, [groupTopoData, currentGroupDevices, currentView, isUserRoot, isLoading, devicesLoading]);

  // 빈 토폴로지에 그룹 장비 전체 추가 및 자동 저장
  const handleAddAllGroupDevices = useCallback(async () => {
    const devices = currentGroupDevices?.content || currentGroupDevices || [];
    if (devices.length === 0) {
      setShowEmptyTopologyPrompt(false);
      return;
    }

    const cols = Math.ceil(Math.sqrt(devices.length));
    const spacing = 100;
    const startX = -((cols - 1) * spacing) / 2;
    const startY = -((Math.ceil(devices.length / cols) - 1) * spacing) / 2;

    const newNodes = devices.map((device, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      return {
        id: `D${device.DEVICE_ID}`, nodeType: 'device',
        deviceId: device.DEVICE_ID,
        name: device.DEVICE_NAME || device.DEVICE_SYSTEM_NAME || `장비 ${device.DEVICE_ID}`,
        type: device.MODEL_NAME || '', ip: device.DEVICE_IP || '',
        location: '', note: device.DEVICE_DESC || '',
        iconData: device.ICON_DATA || null,
        x, y, fx: x, fy: y,
      };
    });

    setData({ nodes: newNodes, links: [] });
    setShowEmptyTopologyPrompt(false);

    // 자동 저장
    try {
      const payload = {
        zoom: 1, centerX: 0, centerY: 0,
        nodes: newNodes.map(n => ({
          id: n.id, nodeType: n.nodeType, deviceId: n.deviceId, groupId: null,
          name: n.name, type: n.type, ip: n.ip, location: n.location, note: n.note,
          iconData: n.iconData, x: n.x, y: n.y, fx: n.fx, fy: n.fy,
        })),
        links: [],
      };
      await saveGroupMutation.mutateAsync({ userId, groupId: currentView.groupId, data: payload });
    } catch (e) {
      console.error('빈 토폴로지 자동 저장 실패:', e);
    }

    setTimeout(() => {
      if (graphRef.current && newNodes.length > 0) graphRef.current.zoomToFit(400, 80);
    }, 200);
  }, [currentGroupDevices, userId, currentView, saveGroupMutation]);

  // 전체 보기
  const handleZoomToFit = useCallback(() => {
    if (graphRef.current) graphRef.current.zoomToFit(400, 60);
  }, []);

  // ===== 뷰 네비게이션 =====
  const navigateToGroup = useCallback((groupId, groupName) => {
    // 그룹 전환 페이드 시작
    setIsGroupSwitching(true);
    // 현재 뷰를 히스토리에 저장
    setViewHistory(prev => [...prev, currentView]);
    // 상태 초기화
    setSelectedNode(null); setSelectedLink(null); setSelectedNodes(new Set());
    setLinkDraftSource(null); setContextMenu(prev => ({ ...prev, visible: false }));
    // 편집 모드 해제
    setIsEditMode(false);
    setSidebarCollapsed(true);
    setLastSavedAt(null);
    // 빈 토폴로지 체크 리셋
    emptyTopologyCheckedRef.current = null;
    // 새 뷰로 전환
    setCurrentView({ type: 'group', groupId, groupName });
  }, [currentView, isEditMode]);

  const navigateBack = useCallback(() => {
    if (viewHistory.length === 0) return;
    setIsGroupSwitching(true);
    const prev = viewHistory[viewHistory.length - 1];
    setViewHistory(h => h.slice(0, -1));
    setSelectedNode(null); setSelectedLink(null); setSelectedNodes(new Set());
    setLinkDraftSource(null); setContextMenu(prev2 => ({ ...prev2, visible: false }));
    setIsEditMode(false);
    setSidebarCollapsed(true);
    setLastSavedAt(null);
    emptyTopologyCheckedRef.current = null;
    setCurrentView(prev);
  }, [viewHistory]);

  // ===== 키보드 단축키 =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Delete: 선택된 노드/링크 삭제 (편집 모드)
      if (e.key === 'Delete' && isEditMode) {
        if (selectedNodes.size > 1) {
          showConfirm(`선택된 ${selectedNodes.size}개 노드를 삭제하시겠습니까?`, '노드 삭제').then(ok => {
            if (ok) {
              setData(prev => ({
                nodes: prev.nodes.filter(n => !selectedNodes.has(n.id)),
                links: prev.links.filter(l => !selectedNodes.has(getLinkEndId(l.source)) && !selectedNodes.has(getLinkEndId(l.target))),
              }));
              setSelectedNodes(new Set());
              setSelectedNode(null);
            }
          });
        } else if (selectedLink) {
          setData(prev => ({ ...prev, links: prev.links.filter(l => l.id !== selectedLink.id) }));
          setSelectedLink(null);
        } else if (selectedNode) {
          setData(prev => ({
            nodes: prev.nodes.filter(n => n.id !== selectedNode.id),
            links: prev.links.filter(l => getLinkEndId(l.source) !== selectedNode.id && getLinkEndId(l.target) !== selectedNode.id),
          }));
          setSelectedNode(null);
          setSelectedNodes(new Set());
        }
        return;
      }

      // Escape: 선택 해제 / 링크 취소 / 메뉴 닫기 / 뒤로 가기
      if (e.key === 'Escape') {
        if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
        else if (linkDraftSource) setLinkDraftSource(null);
        else if (selectedNode || selectedLink || selectedNodes.size > 0) { setSelectedNode(null); setSelectedLink(null); setSelectedNodes(new Set()); }
        else if (viewHistory.length > 0) navigateBack();
        return;
      }

      // Backspace: 뒤로 가기 (그룹 드릴다운에서)
      if (e.key === 'Backspace' && viewHistory.length > 0 && !isEditMode) {
        navigateBack();
        return;
      }

      // Ctrl+A: 전체 선택 (편집 모드)
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && isEditMode) {
        e.preventDefault();
        setSelectedNodes(new Set(data.nodes.map(n => n.id)));
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedNode, selectedLink, selectedNodes, linkDraftSource, contextMenu.visible, data, viewHistory, navigateBack, showConfirm]);

  // API 데이터 로드 - 사용자 루트
  useEffect(() => {
    if (!isUserRoot) return;
    if (topoData === undefined) return;
    if (!topoData) {
      setData({ nodes: [], links: [] });
      setViewMeta({ viewId: null, zoom: 1, centerX: 0, centerY: 0 });
      setBackgroundImage(null);
      return;
    }
    setData({
      nodes: Array.isArray(topoData.nodes) ? topoData.nodes : [],
      links: Array.isArray(topoData.links) ? topoData.links : [],
    });
    setViewMeta({
      viewId: topoData.viewId || null,
      zoom: topoData.zoom || 1,
      centerX: topoData.centerX || 0,
      centerY: topoData.centerY || 0,
    });
    setBackgroundImage(topoData.backIconData || null);
    setTimeout(() => {
      if (graphRef.current && topoData.nodes?.length > 0) {
        graphRef.current.zoomToFit(400, 80);
      }
      setTimeout(() => setIsGroupSwitching(false), 50);
    }, 200);
  }, [topoData, isUserRoot]);

  // API 데이터 로드 - 그룹 드릴다운
  useEffect(() => {
    if (isUserRoot) return;
    if (groupTopoData === undefined) return;
    if (!groupTopoData) {
      setData({ nodes: [], links: [] });
      setViewMeta({ viewId: null, zoom: 1, centerX: 0, centerY: 0 });
      setBackgroundImage(null);
      return;
    }
    setData({
      nodes: Array.isArray(groupTopoData.nodes) ? groupTopoData.nodes : [],
      links: Array.isArray(groupTopoData.links) ? groupTopoData.links : [],
    });
    setViewMeta({
      viewId: groupTopoData.viewId || null,
      zoom: groupTopoData.zoom || 1,
      centerX: groupTopoData.centerX || 0,
      centerY: groupTopoData.centerY || 0,
    });
    setBackgroundImage(groupTopoData.backIconData || null);
    setTimeout(() => {
      if (graphRef.current && groupTopoData.nodes?.length > 0) {
        graphRef.current.zoomToFit(400, 80);
      }
      setTimeout(() => setIsGroupSwitching(false), 50);
    }, 200);
  }, [groupTopoData, isUserRoot]);

  // 배경 이미지 Image 객체 로드
  useEffect(() => {
    if (!backgroundImage) { backgroundImageRef.current = null; return; }
    const img = new Image();
    let imgSrc = backgroundImage;
    if (!imgSrc.startsWith('data:')) {
      imgSrc = imgSrc.startsWith('PHN2Zy') || imgSrc.startsWith('PD94bW')
        ? `data:image/svg+xml;base64,${imgSrc}` : `data:image/png;base64,${imgSrc}`;
    }
    img.src = imgSrc;
    img.onload = () => { backgroundImageRef.current = img; };
  }, [backgroundImage]);

  // 리사이즈 (사이드바 토글, 로딩 완료 시에도 재계산)
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          setDimensions({ width: offsetWidth, height: offsetHeight });
        }
      }
    };

    // 사이드바 토글 또는 로딩 완료 후 크기 재계산
    const timer = setTimeout(() => {
      updateDimensions();
    }, 150);

    const ro = new ResizeObserver(() => updateDimensions());
    if (containerRef.current) ro.observe(containerRef.current);

    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [sidebarCollapsed, isLoading]);

  const getLinkEndId = (end) => typeof end === 'object' && end !== null ? end.id : end;

  // 같은 장비 간 중복 링크 존재 여부 확인
  const hasDuplicateLink = useCallback((srcId, tgtId) => {
    return data.links.some(l => {
      const s = getLinkEndId(l.source);
      const t = getLinkEndId(l.target);
      return (s === srcId && t === tgtId) || (s === tgtId && t === srcId);
    });
  }, [data.links]);

  // ===== 사이드바 핸들러 =====

  const handleSidebarDeviceSelect = useCallback((device) => {
    setSelectedSidebarDevice(device);
    const node = data.nodes.find(n =>
      (n.deviceId && String(n.deviceId) === String(device.DEVICE_ID)) || n.ip === device.DEVICE_IP
    );
    if (node && graphRef.current) {
      setSelectedNode(node);
      setSelectedNodes(new Set([node.id]));
      graphRef.current.centerAt(node.x, node.y, 500);
    }
  }, [data.nodes]);

  const handleGroupSelect = useCallback((group) => {
    setSelectedGroup(group);
    setSelectedSidebarDevice(null);
  }, [setSelectedGroup]);

  const handleAddMultipleDevices = useCallback((devices) => {
    if (!graphRef.current) return;
    const cols = Math.ceil(Math.sqrt(devices.length));
    const spacing = 100;
    const newNodes = [];
    devices.forEach((device, i) => {
      const uniqueId = `D${device.DEVICE_ID}`;
      if (data.nodes.some(n => n.id === uniqueId)) return;
      const row = Math.floor(i / cols);
      const col = i % cols;
      newNodes.push({
        id: uniqueId, nodeType: 'device',
        name: device.DEVICE_NAME || device.DEVICE_SYSTEM_NAME || `장비 ${device.DEVICE_ID}`,
        deviceId: device.DEVICE_ID, groupId: null, iconData: null,
        type: device.MODEL_NAME || '', ip: device.DEVICE_IP || '',
        location: '', note: device.DEVICE_DESC || '',
        x: col * spacing, y: row * spacing, fx: col * spacing, fy: row * spacing,
      });
    });
    if (newNodes.length > 0) {
      setData(prev => ({ ...prev, nodes: [...prev.nodes, ...newNodes] }));
      setTimeout(() => { if (graphRef.current) graphRef.current.zoomToFit(400, 50); }, 100);
    }
  }, [data.nodes]);

  // ===== 우클릭 드래그 선택 =====

  const handleMouseDown = useCallback((event) => {
    if (event.button !== 2) return; // 우클릭만
    if (!graphRef.current || !isEditMode) return;
    if (Date.now() - dragEndTimeRef.current < 300) return;
    if (Date.now() - selectionEndTimeRef.current < 300) return;
    if (Date.now() - lastNodeClickTimeRef.current < 300) return;
    if (isDraggingNodesRef.current) return;
    if (isSelecting) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY);

    // 노드 위에서 우클릭 → 컨텍스트 메뉴 우선
    const clickedOnNode = data.nodes.some(node => {
      const dx = (node.x || 0) - graphCoords.x;
      const dy = (node.y || 0) - graphCoords.y;
      return Math.sqrt(dx * dx + dy * dy) < NODE_SIZE / 2 + 10;
    });
    if (clickedOnNode) return;

    setContextMenu(prev => ({ ...prev, visible: false }));
    selectionStartRef.current = { screenX, screenY };
    selectionDragStarted.current = false;

    const handleGlobalMouseMove = (e) => {
      if (!selectionStartRef.current) return;
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const dx = Math.abs(sx - selectionStartRef.current.screenX);
      const dy = Math.abs(sy - selectionStartRef.current.screenY);

      if (!selectionDragStarted.current && (dx > 10 || dy > 10)) {
        selectionDragStarted.current = true;
        setIsSelecting(true);
        setSelectionBox({ startX: selectionStartRef.current.screenX, startY: selectionStartRef.current.screenY, endX: sx, endY: sy });
      } else if (selectionDragStarted.current) {
        setSelectionBox(prev => prev ? { ...prev, endX: sx, endY: sy } : null);
      }
    };

    const handleGlobalMouseUp = (e) => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      selectionEndTimeRef.current = Date.now();

      if (!selectionDragStarted.current) {
        selectionStartRef.current = null;
        return;
      }
      if (!selectionStartRef.current || !graphRef.current || !containerRef.current) {
        setIsSelecting(false); setSelectionBox(null); selectionStartRef.current = null;
        return;
      }

      const r = containerRef.current.getBoundingClientRect();
      const endX = e.clientX - r.left;
      const endY = e.clientY - r.top;
      const startX = selectionStartRef.current.screenX;
      const startY = selectionStartRef.current.screenY;
      const minX = Math.min(startX, endX), maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY), maxY = Math.max(startY, endY);

      if (maxX - minX < 5 && maxY - minY < 5) {
        setIsSelecting(false); setSelectionBox(null); setSelectedNodes(new Set()); selectionStartRef.current = null;
        return;
      }

      const fg = graphRef.current;
      const selected = new Set();
      data.nodes.forEach(node => {
        const sc = fg.graph2ScreenCoords(node.x, node.y);
        if (sc.x >= minX && sc.x <= maxX && sc.y >= minY && sc.y <= maxY) selected.add(node.id);
      });

      setSelectedNodes(selected);
      selectedNodesRef.current = selected;
      setIsSelecting(false);
      setSelectionBox(null);
      selectionStartRef.current = null;
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [isEditMode, isSelecting, data.nodes]);

  const handleBgContextMenu = useCallback((event) => { event.preventDefault(); }, []);

  // ===== 캔버스 mousedown → 다중 노드 드래그 오프셋 계산 (한 번만) =====

  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;

    const handleCanvasMouseDown = (e) => {
      if (e.button !== 0 || !isEditMode || !graphRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const graphCoords = graphRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);

      // 클릭한 위치에 노드가 있는지 확인
      const clickedNode = data.nodes.find(n => {
        const dx = (n.x || 0) - graphCoords.x;
        const dy = (n.y || 0) - graphCoords.y;
        return Math.sqrt(dx * dx + dy * dy) < NODE_SIZE / 2 + 5;
      });
      if (!clickedNode) return;

      const currentSelected = selectedNodesRef.current;
      if (currentSelected.size > 1 && currentSelected.has(clickedNode.id)) {
        isDraggingNodesRef.current = true;
        draggingNodeRef.current = clickedNode;
        dragOffsetsRef.current = {};
        data.nodes.forEach(n => {
          if (currentSelected.has(n.id) && n.id !== clickedNode.id) {
            dragOffsetsRef.current[n.id] = { dx: n.x - clickedNode.x, dy: n.y - clickedNode.y };
          }
        });
      }
    };

    const handleCanvasMouseUp = () => {
      if (isDraggingNodesRef.current && Object.keys(dragOffsetsRef.current).length > 0) {
        const mainNode = draggingNodeRef.current;
        if (mainNode) {
          data.nodes.forEach(n => {
            const offset = dragOffsetsRef.current[n.id];
            if (offset) {
              n.x = mainNode.x + offset.dx; n.y = mainNode.y + offset.dy;
              n.fx = n.x; n.fy = n.y;
            }
          });
        }
      }
      dragOffsetsRef.current = {};
      isDraggingNodesRef.current = false;
      draggingNodeRef.current = null;
      dragEndTimeRef.current = Date.now();
    };

    // 커스텀 클릭 핸들러: force-graph 내부의 1px 드래그 판정 우회
    let pointerDownPos = null;
    let pointerDownTime = 0;
    const CLICK_THRESHOLD = 6;
    const CLICK_TIME_LIMIT = 500;

    const handlePointerDown = (e) => {
      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerDownTime = Date.now();
    };

    const handlePointerUp = (e) => {
      if (e.button !== 0 || !pointerDownPos) return;
      const pdx = Math.abs(e.clientX - pointerDownPos.x);
      const pdy = Math.abs(e.clientY - pointerDownPos.y);
      const elapsed = Date.now() - pointerDownTime;
      pointerDownPos = null;

      if (pdx > CLICK_THRESHOLD || pdy > CLICK_THRESHOLD || elapsed > CLICK_TIME_LIMIT) return;
      if (Date.now() - lastNodeClickTimeRef.current < 100) return;

      if (!graphRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const graphCoords = graphRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);

      const clickedNode = data.nodes.find(n => {
        const ndx = (n.x || 0) - graphCoords.x;
        const ndy = (n.y || 0) - graphCoords.y;
        const isGroup = n.nodeType === 'group' || n.type === 'group' || String(n.id).startsWith('G');
        const hitSize = (isGroup ? NODE_SIZE * 1.2 : NODE_SIZE) / 2 + 6;
        return Math.sqrt(ndx * ndx + ndy * ndy) < hitSize;
      });

      if (clickedNode) {
        handleNodeClick(clickedNode, e);
      } else {
        handleBackgroundClick();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown, true);
    canvas.addEventListener('pointerup', handlePointerUp, true);
    canvas.addEventListener('mousedown', handleCanvasMouseDown, true);
    canvas.addEventListener('mouseup', handleCanvasMouseUp, true);
    document.addEventListener('mouseup', handleCanvasMouseUp, true);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, true);
      canvas.removeEventListener('pointerup', handlePointerUp, true);
      canvas.removeEventListener('mousedown', handleCanvasMouseDown, true);
      canvas.removeEventListener('mouseup', handleCanvasMouseUp, true);
      document.removeEventListener('mouseup', handleCanvasMouseUp, true);
    };
  }, [isEditMode, data.nodes]);

  // ===== 노드 드래그 (ForceGraph2D 콜백) =====

  const handleNodeDrag = useCallback((node) => {
    if (!node) return;
    node.fx = node.x;
    node.fy = node.y;
    draggingNodeRef.current = node;

    // 다중 선택: 오프셋은 캔버스 mousedown에서 이미 계산됨
    const offsetKeys = Object.keys(dragOffsetsRef.current);
    if (offsetKeys.length > 0) {
      data.nodes.forEach(n => {
        const offset = dragOffsetsRef.current[n.id];
        if (offset) {
          n.x = node.x + offset.dx; n.y = node.y + offset.dy;
          n.fx = n.x; n.fy = n.y;
        }
      });
    }
  }, [data.nodes]);

  const handleNodeDragEnd = useCallback((node) => {
    if (!node) return;
    if (Object.keys(dragOffsetsRef.current).length > 0) {
      data.nodes.forEach(n => {
        const offset = dragOffsetsRef.current[n.id];
        if (offset) {
          n.x = node.x + offset.dx; n.y = node.y + offset.dy;
          n.fx = n.x; n.fy = n.y;
        }
      });
    } else {
      node.fx = node.x; node.fy = node.y;
    }
    dragOffsetsRef.current = {};
    isDraggingNodesRef.current = false;
    dragEndTimeRef.current = Date.now();
    draggingNodeRef.current = null;
  }, [data.nodes]);

  // ===== 노드 클릭 =====

  const handleNodeClick = useCallback((node, event) => {
    if (Date.now() - dragEndTimeRef.current < 200) return;
    lastNodeClickTimeRef.current = Date.now();

    // 편집 모드: Ctrl+클릭 다중 선택
    if (isEditMode && (event?.ctrlKey || event?.metaKey)) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
      return;
    }

    // 편집 모드: 링크 연결
    if (isEditMode && linkDraftSource) {
      if (linkDraftSource.id !== node.id) {
        if (hasDuplicateLink(linkDraftSource.id, node.id)) {
          showAlert('이미 해당 연결이 존재합니다.', 'warning');
        } else if (linkDraftSource.nodeType === 'device' && node.nodeType === 'device') {
          setPendingLinkSource({ node: linkDraftSource });
          setPendingLinkTarget({ node });
          setInterfaceModalStep(1);
          setInterfaceModalOpen(true);
        } else {
          setData(prev => ({ ...prev, links: [...prev.links, {
            id: `link_${linkIdCounter.current++}`, source: linkDraftSource.id, target: node.id,
            srcType: (linkDraftSource.nodeType || 'device').toUpperCase(),
            dstType: (node.nodeType || 'device').toUpperCase(),
          }] }));
        }
      }
      setLinkDraftSource(null);
      return;
    }

    // 편집 모드: 노드 선택만
    if (isEditMode) {
      setSelectedNode(node);
      setSelectedLink(null);
      setSelectedNodes(new Set([node.id]));
      return;
    }

    // 보기 모드: 그룹 클릭 → 해당 그룹 토폴로지로 드릴다운
    if (node.nodeType === 'group') {
      const groupId = node.groupId || (node.id?.startsWith('G') ? Number(node.id.substring(1)) : node.id);
      navigateToGroup(groupId, node.name || `그룹 ${groupId}`);
      return;
    }

    // 보기 모드: 장비 클릭 → 상세 모달
    if (node.nodeType === 'device') {
      setDeviceModalId(getDeviceIdFromNode(node));
      setDeviceModalOpen(true);
    }
  }, [isEditMode, linkDraftSource, navigateToGroup, hasDuplicateLink, showAlert]);

  const handleBackgroundClick = useCallback(() => {
    if (Date.now() - lastNodeClickTimeRef.current < 100) return;
    setSelectedNode(null);
    setSelectedLink(null);
    setLinkDraftSource(null);
    setSelectedNodes(new Set());
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleLinkClick = useCallback((link) => {
    lastNodeClickTimeRef.current = Date.now();
    setSelectedLink(link);
    setSelectedNode(null);
    setSelectedNodes(new Set());
  }, []);

  // ===== 우클릭 =====

  const handleRightClick = useCallback((node, event) => {
    event.preventDefault();
    event.stopPropagation();
    lastNodeClickTimeRef.current = Date.now();
    if (!isEditMode) return;
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, type: 'node', target: node });
  }, [isEditMode]);

  const handleLinkRightClick = useCallback((link, event) => {
    event.preventDefault();
    event.stopPropagation();
    lastNodeClickTimeRef.current = Date.now();
    if (!isEditMode) return;
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, type: 'link', target: link });
  }, [isEditMode]);

  const handleBgRightClick = useCallback((event) => {
    event.preventDefault();
  }, []);

  // ===== 삭제 (편집 모드 전용) =====

  const handleDeleteNode = useCallback((nodeId) => {
    setData(prev => ({
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      links: prev.links.filter(l => getLinkEndId(l.source) !== nodeId && getLinkEndId(l.target) !== nodeId),
    }));
    setSelectedNode(null);
    setSelectedNodes(new Set());
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleDeleteLink = useCallback((linkId) => {
    setData(prev => ({ ...prev, links: prev.links.filter(l => l.id !== linkId) }));
    setSelectedLink(null);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.size === 0) return;
    setData(prev => ({
      nodes: prev.nodes.filter(n => !selectedNodes.has(n.id)),
      links: prev.links.filter(l => !selectedNodes.has(getLinkEndId(l.source)) && !selectedNodes.has(getLinkEndId(l.target))),
    }));
    setSelectedNodes(new Set());
    setSelectedNode(null);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [selectedNodes]);

  // ===== 드롭 (편집 모드 전용) =====

  const handleDropToCanvas = useCallback((e) => {
    e.preventDefault();
    containerRef.current?.classList.remove('drag-over');
    if (!isEditMode) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const dropped = JSON.parse(raw);
      const rect = containerRef.current?.getBoundingClientRect();
      const graph = graphRef.current;
      if (!graph || !rect) return;
      const coords = graph.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);

      const isGroup = dropped._dragType === 'group';
      const nodeType = isGroup ? 'group' : 'device';
      const nodeId = isGroup ? dropped.GROUP_ID : dropped.DEVICE_ID;
      const uniqueId = isGroup ? `G${nodeId}` : `D${nodeId}`;
      const nodeName = isGroup ? dropped.GROUP_NAME : (dropped.DEVICE_NAME || dropped.MODEL_NAME || `장비 ${nodeId}`);
      if (data.nodes.some(n => n.id === uniqueId)) {
        showAlert(
          isGroup
            ? `이미 토폴로지에 존재하는 그룹입니다.\n${nodeName}`
            : `이미 토폴로지에 존재하는 장비입니다.\n${nodeName}`,
          'warning'
        );
        return;
      }

      const newNode = {
        id: uniqueId, nodeType,
        name: isGroup ? dropped.GROUP_NAME : (dropped.DEVICE_NAME || dropped.MODEL_NAME || `장비 ${nodeId}`),
        deviceId: isGroup ? null : nodeId, groupId: isGroup ? nodeId : null,
        iconData: null, type: dropped.MODEL_NAME || '', ip: dropped.DEVICE_IP || '',
        location: '', note: dropped.DEVICE_DESC || '',
        x: coords.x, y: coords.y, fx: coords.x, fy: coords.y,
      };
      setData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
      setSelectedNode(newNode);
      setSelectedNodes(new Set([uniqueId]));
    } catch (err) {
      console.error('Drop 처리 실패:', err);
    }
  }, [isEditMode, data.nodes, showAlert]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (isEditMode) containerRef.current?.classList.add('drag-over');
  }, [isEditMode]);

  const handleDragLeave = useCallback(() => {
    containerRef.current?.classList.remove('drag-over');
  }, []);

  // ===== 저장 =====

  const handleSave = useCallback(async () => {
    if (!userId) return;
    const graph = graphRef.current;
    const zoom = graph ? graph.zoom() : viewMeta.zoom;
    const center = graph ? graph.centerAt() : { x: viewMeta.centerX, y: viewMeta.centerY };

    const saveNodes = data.nodes.map(n => ({
      id: n.id, nodeType: n.nodeType || 'device',
      deviceId: n.deviceId || null, groupId: n.groupId || null, iconData: n.iconData || null,
      name: n.name || '', type: n.type || '', ip: n.ip || '',
      location: n.location || '', note: n.note || '',
      x: Math.round(n.x || 0), y: Math.round(n.y || 0),
      fx: n.fx != null ? Math.round(n.fx) : null, fy: n.fy != null ? Math.round(n.fy) : null,
    }));

    const saveLinks = data.links.map(l => {
      const srcId = getLinkEndId(l.source);
      const tgtId = getLinkEndId(l.target);
      const srcNode = data.nodes.find(n => n.id === srcId);
      const tgtNode = data.nodes.find(n => n.id === tgtId);
      return {
        source: srcId, target: tgtId,
        srcType: (srcNode?.nodeType || l.srcType || 'device').toUpperCase(),
        dstType: (tgtNode?.nodeType || l.dstType || 'device').toUpperCase(),
        srcIfIndex: l.srcIfIndex || '', dstIfIndex: l.dstIfIndex || '',
        srcIfName: l.srcIfName || '', dstIfName: l.dstIfName || '',
        status: l.status || '',
      };
    });

    const payload = { zoom: zoom || 1, centerX: center?.x || 0, centerY: center?.y || 0, nodes: saveNodes, links: saveLinks };

    try {
      if (isUserRoot) {
        await saveMutation.mutateAsync({ userId, data: payload });
      } else {
        await saveGroupMutation.mutateAsync({ userId, groupId: currentView.groupId, data: payload });
      }
      setLastSavedAt(new Date().toLocaleTimeString('ko-KR'));
      setIsEditMode(false);
      setSidebarCollapsed(true);
      setLinkDraftSource(null);
      setSelectedNodes(new Set());
      setSelectedNode(null);
      setSelectedLink(null);
      showAlert('토폴로지가 저장되었습니다.', 'success');
    } catch (err) {
      console.error('저장 실패:', err);
      setLastSavedAt('저장 실패');
      showAlert('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }, [userId, data, viewMeta, saveMutation, saveGroupMutation, isUserRoot, currentView]);

  // ===== 인터페이스 선택 후 링크 생성 =====

  const handleInterfaceSelect = useCallback((port) => {
    const ifName = port.IF_NAME || port.IF_DESCR || `Interface ${port.IF_INDEX}`;
    if (interfaceModalStep === 1) {
      setPendingLinkSource(prev => ({ ...prev, interface: port.IF_INDEX, interfaceName: ifName }));
      setInterfaceModalStep(2);
    } else {
      if (hasDuplicateLink(pendingLinkSource.node.id, pendingLinkTarget.node.id)) {
        showAlert('이미 해당 연결이 존재합니다.', 'warning');
      } else {
        setData(prev => ({ ...prev, links: [...prev.links, {
          id: `link_${linkIdCounter.current++}`,
          source: pendingLinkSource.node.id, target: pendingLinkTarget.node.id,
          srcType: 'DEVICE', dstType: 'DEVICE',
          srcIfIndex: pendingLinkSource.interface || '', dstIfIndex: port.IF_INDEX || '',
          srcIfName: pendingLinkSource.interfaceName || '', dstIfName: ifName,
        }] }));
      }
      setInterfaceModalOpen(false);
      setInterfaceModalStep(1);
      setPendingLinkSource(null);
      setPendingLinkTarget(null);
      setLinkDraftSource(null);
    }
  }, [interfaceModalStep, pendingLinkSource, pendingLinkTarget, hasDuplicateLink, showAlert]);

  const handleInterfaceModalClose = useCallback(() => {
    setInterfaceModalOpen(false);
    setInterfaceModalStep(1);
    setPendingLinkSource(null);
    setPendingLinkTarget(null);
    setLinkDraftSource(null);
  }, []);

  // ===== 이미지 핸들러 =====

  const handleOpenBgImageModal = useCallback(() => {
    let base64Only = backgroundImage || '';
    if (base64Only) base64Only = base64Only.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    setBgImageInput(base64Only);
    setBgImageModalOpen(true);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [backgroundImage]);

  const handleSaveBackgroundImage = useCallback(async () => {
    if (!userId) return;
    let imgSrc = bgImageInput || null;
    if (imgSrc) imgSrc = imgSrc.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    try {
      const currentGroupId = isUserRoot ? null : currentView.groupId;
      await bgImageMutation.mutateAsync({ userId, imgSrc, groupId: currentGroupId });
      setBgImageModalOpen(false);
      if (imgSrc) {
        const fullSrc = imgSrc.startsWith('PHN2Zy') || imgSrc.startsWith('PD94bW')
          ? `data:image/svg+xml;base64,${imgSrc}` : `data:image/png;base64,${imgSrc}`;
        setBackgroundImage(fullSrc);
      } else { setBackgroundImage(null); }
      showAlert('배경 이미지가 저장되었습니다.', 'success');
    } catch (err) {
      console.error('배경 이미지 저장 실패:', err);
      showAlert('배경 이미지 저장에 실패했습니다.', 'error');
    }
  }, [userId, bgImageInput, bgImageMutation, isUserRoot, currentView]);

  const handleOpenNodeImageModal = useCallback((node) => {
    let base64Only = node?.iconData || '';
    if (base64Only) base64Only = base64Only.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    setNodeImageTarget(node);
    setNodeImageInput(base64Only);
    setNodeImageModalOpen(true);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleSaveNodeImage = useCallback(async () => {
    if (!userId || !nodeImageTarget) return;
    const nodeKey = nodeImageTarget.id;
    let imgSrc = nodeImageInput || null;
    if (imgSrc) imgSrc = imgSrc.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    try {
      const currentGroupId = isUserRoot ? null : currentView.groupId;
      await nodeImageMutation.mutateAsync({ userId, nodeKey, imgSrc, groupId: currentGroupId });
      delete nodeIconCache.current[`device_${nodeKey}`];
      delete nodeIconCache.current[`group_${nodeKey}`];
      setData(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === nodeKey ? { ...n, iconData: imgSrc } : n) }));
      setNodeImageModalOpen(false);
      setNodeImageTarget(null);
      showAlert('노드 이미지가 저장되었습니다.', 'success');
    } catch (err) {
      console.error('노드 이미지 저장 실패:', err);
      showAlert('노드 이미지 저장에 실패했습니다.', 'error');
    }
  }, [userId, nodeImageTarget, nodeImageInput, nodeImageMutation, isUserRoot, currentView]);

  // ===== 노드 렌더링 =====

  const FAULT_COLORS = {
    'C': { r: 239, g: 68, b: 68 },
    'M': { r: 249, g: 115, b: 22 },
    'N': { r: 234, g: 179, b: 8 },
    'W': { r: 59, g: 130, b: 246 },
  };

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isGroupNode = node.nodeType === 'group';
    const isDevice = node.nodeType === 'device';
    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;
    const drawX = node.x;
    const drawY = node.y;
    const isMultiSelected = selectedNodesRef.current.has(node.id);

    // 장애 등급 조회
    let errorLevel = null;
    if (isGroupNode) {
      const gName = node.name || node.groupName;
      errorLevel = gName ? groupErrorMapRef.current.get(gName) : null;
    } else {
      const dId = node.deviceId || (node.id?.startsWith('D') ? node.id.substring(1) : null);
      if (dId != null) {
        errorLevel = deviceErrorMapRef.current.get(dId)
          || deviceErrorMapRef.current.get(String(dId))
          || deviceErrorMapRef.current.get(Number(dId))
          || null;
      }
    }
    const fc = errorLevel ? FAULT_COLORS[errorLevel] : null;
    const pulse = fc ? 0.6 + 0.4 * Math.sin(Date.now() / 400) : 0;

    // 다중 선택된 노드 표시
    if (isMultiSelected && isEditMode) {
      ctx.beginPath();
      if (isGroupNode) {
        const radius = 10;
        ctx.roundRect(drawX - half - 6, drawY - half - 6, size + 12, size + 12, radius);
      } else {
        ctx.arc(drawX, drawY, half + 8, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.fill();
    }

    // 선택된 노드 배경 (단일 선택)
    if (selectedNode && selectedNode.id === node.id && !isMultiSelected) {
      ctx.beginPath();
      if (isGroupNode) {
        ctx.roundRect(drawX - half - 5, drawY - half - 5, size + 10, size + 10, 8);
      } else {
        ctx.arc(drawX, drawY, size * 0.75, 0, 2 * Math.PI);
      }
      ctx.fillStyle = isGroupNode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 150, 255, 0.15)';
      ctx.fill();
    }

    // 링크 시작 노드 강조
    if (linkDraftSource?.id === node.id) {
      ctx.beginPath();
      if (isGroupNode) {
        ctx.roundRect(drawX - half - 2, drawY - half - 2, size + 4, size + 4, 8);
      } else {
        ctx.arc(drawX, drawY, size, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // 그룹 노드 그리기
    if (isGroupNode) {
      const radius = 12;
      const hasIconData = node.iconData;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      if (fc) {
        ctx.shadowColor = `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.7 * pulse})`;
        ctx.shadowBlur = 18 + 6 * pulse;
      } else {
        ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.fillStyle = fc ? `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.12)` : 'rgba(139, 92, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 글래스모피즘 메인 배경
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      const glassBg = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      if (fc) {
        glassBg.addColorStop(0, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.3)`);
        glassBg.addColorStop(0.5, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.15)`);
        glassBg.addColorStop(1, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.3)`);
      } else {
        glassBg.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        glassBg.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
        glassBg.addColorStop(1, 'rgba(196, 181, 253, 0.25)');
      }
      ctx.fillStyle = glassBg;
      ctx.fill();

      // 내부 하이라이트 (상단 빛 반사)
      ctx.beginPath();
      ctx.roundRect(drawX - half + 2, drawY - half + 2, size - 4, size * 0.4, [radius - 2, radius - 2, 0, 0]);
      const highlight = ctx.createLinearGradient(drawX, drawY - half, drawX, drawY - half + size * 0.4);
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.fill();

      // 그룹 아이콘
      if (hasIconData) {
        const cacheKey = `group_${node.id}`;
        if (!nodeIconCache.current[cacheKey]) {
          const img = new Image();
          let imgSrc = hasIconData;
          if (!imgSrc.startsWith('data:')) {
            imgSrc = imgSrc.startsWith('PHN2Zy') || imgSrc.startsWith('PD94bW')
              ? `data:image/svg+xml;base64,${imgSrc}` : `data:image/png;base64,${imgSrc}`;
          }
          img.src = imgSrc;
          nodeIconCache.current[cacheKey] = img;
        }
        const cachedImg = nodeIconCache.current[cacheKey];
        if (cachedImg?.complete && cachedImg.naturalWidth > 0) {
          const imgPadding = 6;
          const imgSize = size - imgPadding * 2;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(drawX - imgSize / 2, drawY - imgSize / 2, imgSize, imgSize, radius - 4);
          ctx.clip();
          ctx.drawImage(cachedImg, drawX - imgSize / 2, drawY - imgSize / 2, imgSize, imgSize);
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('...', drawX, drawY);
        }
      } else {
        // 기본 폴더 아이콘
        const iconSize = size * 0.45;
        const iconX = drawX - iconSize / 2;
        const iconY = drawY - iconSize / 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(iconX, iconY + iconSize * 0.2);
        ctx.lineTo(iconX + iconSize * 0.35, iconY + iconSize * 0.2);
        ctx.lineTo(iconX + iconSize * 0.45, iconY);
        ctx.lineTo(iconX + iconSize * 0.7, iconY);
        ctx.lineTo(iconX + iconSize * 0.7, iconY + iconSize * 0.2);
        ctx.lineTo(iconX + iconSize, iconY + iconSize * 0.2);
        ctx.lineTo(iconX + iconSize, iconY + iconSize);
        ctx.lineTo(iconX, iconY + iconSize);
        ctx.closePath();
        ctx.fill();
      }

      // 글래스모피즘 테두리
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      if (fc) {
        ctx.strokeStyle = `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 2.5 / globalScale;
      } else {
        const borderGradient = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
        borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        borderGradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.3)');
        borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 1.5 / globalScale;
      }
      ctx.stroke();

      // 장애 노드 중심부 펄스 오버레이
      if (fc) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(drawX - half, drawY - half, size, size, radius);
        ctx.clip();
        const pulseGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, half);
        pulseGrad.addColorStop(0, `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.4 * pulse})`);
        pulseGrad.addColorStop(0.6, `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.15 * pulse})`);
        pulseGrad.addColorStop(1, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0)`);
        ctx.fillStyle = pulseGrad;
        ctx.fillRect(drawX - half, drawY - half, size, size);
        ctx.restore();
      }
    } else {
      // 장비 노드 그리기 (글래스모피즘)
      const deviceIconData = node.iconData;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      if (fc) {
        ctx.shadowColor = `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.7 * pulse})`;
        ctx.shadowBlur = 18 + 6 * pulse;
      } else {
        ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.fillStyle = fc ? `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.12)` : 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 글래스모피즘 메인 배경
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      const glassBg = ctx.createRadialGradient(drawX - half * 0.3, drawY - half * 0.3, 0, drawX, drawY, half);
      if (fc) {
        glassBg.addColorStop(0, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.35)`);
        glassBg.addColorStop(0.5, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.2)`);
        glassBg.addColorStop(1, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0.3)`);
      } else {
        glassBg.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
        glassBg.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
        glassBg.addColorStop(1, 'rgba(37, 99, 235, 0.3)');
      }
      ctx.fillStyle = glassBg;
      ctx.fill();

      // 내부 하이라이트 (상단 빛 반사)
      ctx.beginPath();
      ctx.ellipse(drawX, drawY - half * 0.35, half * 0.7, half * 0.35, 0, 0, 2 * Math.PI);
      const highlight = ctx.createLinearGradient(drawX, drawY - half, drawX, drawY - half * 0.1);
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.fill();

      if (deviceIconData) {
        const cacheKey = `device_${node.id}`;
        if (!nodeIconCache.current[cacheKey]) {
          const img = new Image();
          let imgSrc = deviceIconData;
          if (!imgSrc.startsWith('data:')) {
            imgSrc = imgSrc.startsWith('PHN2Zy') || imgSrc.startsWith('PD94bW')
              ? `data:image/svg+xml;base64,${imgSrc}` : `data:image/png;base64,${imgSrc}`;
          }
          img.src = imgSrc;
          nodeIconCache.current[cacheKey] = img;
        }
        const cachedImg = nodeIconCache.current[cacheKey];
        if (cachedImg?.complete && cachedImg.naturalWidth > 0) {
          const imgRadius = half * 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.arc(drawX, drawY, imgRadius, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(cachedImg, drawX - imgRadius, drawY - imgRadius, imgRadius * 2, imgRadius * 2);
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('...', drawX, drawY);
        }
      } else {
        const model = node.type || '';
        const iconSrc = ICONS[model];
        if (isDevice && iconSrc) {
          if (!iconCache.current[model]) {
            const img = new Image(); img.src = iconSrc;
            img.onload = () => { iconCache.current[model] = img; };
          }
          const img = iconCache.current[model];
          if (img?.complete) {
            const imgRadius = half * 0.75;
            ctx.save();
            ctx.beginPath();
            ctx.arc(drawX, drawY, imgRadius, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(img, drawX - imgRadius, drawY - imgRadius, imgRadius * 2, imgRadius * 2);
            ctx.restore();
          } else {
            // 기본 서버 아이콘
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            const iconSz = size * 0.35;
            ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2, iconSz, iconSz * 0.25);
            ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2 + iconSz * 0.35, iconSz, iconSz * 0.25);
            ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2 + iconSz * 0.7, iconSz, iconSz * 0.25);
          }
        } else {
          // 기본 서버 아이콘
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          const iconSz = size * 0.35;
          ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2, iconSz, iconSz * 0.25);
          ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2 + iconSz * 0.35, iconSz, iconSz * 0.25);
          ctx.fillRect(drawX - iconSz / 2, drawY - iconSz / 2 + iconSz * 0.7, iconSz, iconSz * 0.25);
        }
      }

      // 글래스모피즘 테두리
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      if (fc) {
        ctx.strokeStyle = `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 2.5 / globalScale;
      } else {
        const borderGradient = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
        borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        borderGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.3)');
        borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.strokeStyle = borderGradient;
        ctx.lineWidth = 1.5 / globalScale;
      }
      ctx.stroke();

      // 장애 노드 중심부 펄스 오버레이 (장비 노드)
      if (fc) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
        ctx.clip();
        const pulseGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, half);
        pulseGrad.addColorStop(0, `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.4 * pulse})`);
        pulseGrad.addColorStop(0.6, `rgba(${fc.r}, ${fc.g}, ${fc.b}, ${0.15 * pulse})`);
        pulseGrad.addColorStop(1, `rgba(${fc.r}, ${fc.g}, ${fc.b}, 0)`);
        ctx.fillStyle = pulseGrad;
        ctx.fill();
        ctx.restore();
      }
    }

    // 라벨
    const label = node.name || '';
    if (label && globalScale > 0.4) {
      const fontSize = Math.max(9, 12 / globalScale);
      ctx.font = `500 ${fontSize}px 'Pretendard', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(node.x - tw / 2 - 3, node.y + half + 2, tw + 6, fontSize + 4);
      ctx.fillStyle = '#e2e8f0'; ctx.fillText(label, node.x, node.y + half + 4);
    }
  }, [selectedNode, linkDraftSource, isEditMode]);

  // ===== 링크 렌더링 =====

  const getLinkColor = useCallback((link) => {
    if (selectedLink?.id === link.id) return '#ffeb3b';
    if (link.status === 'down') return 'red';
    if (link.status === 'warning') return 'orange';
    return '#6aaeff';
  }, [selectedLink]);

  const paintLink = useCallback((link, ctx, globalScale) => {
    const src = link.source; const tgt = link.target;
    if (!src?.x || !tgt?.x) return;
    const isSelected = selectedLink?.id === link.id;
    const color = getLinkColor(link);
    const width = isSelected ? 3 : 1.5;

    ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / globalScale; ctx.stroke();

    const ifLabel = [link.srcIfName, link.dstIfName].filter(Boolean).join(' ↔ ');
    if (ifLabel) {
      const mx = (src.x + tgt.x) / 2; const my = (src.y + tgt.y) / 2;
      ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(ifLabel).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; ctx.fillRect(mx - tw / 2 - 3, my - 6, tw + 6, 12);
      ctx.fillStyle = '#94a3b8'; ctx.fillText(ifLabel, mx, my);
    }
  }, [selectedLink, getLinkColor]);

  // ===== 렌더링 =====

  if (isLoading) {
    return (
      <div className="ut-editor-page">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: 8 }}>
          <i className="bi bi-arrow-repeat spinning" style={{ fontSize: 18 }}></i> 토폴로지 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="topology-page-wrapper">
      {/* 사이드바 */}
      {!sidebarCollapsed && (
        <div className="topology-sidebar-wrapper">
          <TopologySidebar
            selectedDevice={selectedSidebarDevice}
            onSelectDevice={handleSidebarDeviceSelect}
            isEditMode={isEditMode}
            onAddMultipleDevices={handleAddMultipleDevices}
            onGroupSelect={handleGroupSelect}
            registeredDeviceIds={registeredDeviceIds}
            topologyLoading={isLoading || isGroupSwitching}
          />
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="topology-main-content">
        {/* 상단 툴바 */}
        <div className="topology-toolbar">
        {/* 사이드바 토글 */}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="btn btn-secondary"
          title={sidebarCollapsed ? '사이드바 표시' : '사이드바 숨기기'}>
          <i className={`bi ${sidebarCollapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`}></i>
        </button>

        {/* 뒤로 가기 */}
        {viewHistory.length > 0 && (
          <button onClick={navigateBack} className="btn btn-secondary" title="이전 토폴로지로 돌아가기">
            <i className="bi bi-arrow-left"></i>
          </button>
        )}

        {/* 현재 뷰 표시 */}
        <div className="topology-current-group">
          <i className="bi bi-person-workspace"></i>
          {isUserRoot ? (
            <span>사용자 토폴로지</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#64748b', cursor: 'pointer', fontSize: 12 }}
                onClick={() => { setViewHistory([]); setCurrentView({ type: 'user' }); setSelectedNode(null); setSelectedLink(null); setSelectedNodes(new Set()); setIsEditMode(false); setSidebarCollapsed(true); }}>
                사용자 토폴로지
              </span>
              <i className="bi bi-chevron-right" style={{ fontSize: 10, color: '#475569' }}></i>
              {currentView.groupName}
            </span>
          )}
        </div>

        <div className="topology-toolbar-divider"></div>

        {/* 편집 모드 토글 */}
        <button onClick={toggleEditMode} className={`btn ${isEditMode ? 'btn-warning' : 'btn-secondary'}`}>
          <i className={`bi ${isEditMode ? 'bi-x-lg' : 'bi-pencil'}`}></i>
          {isEditMode ? '편집 종료' : '편집 모드'}
        </button>

        {isEditMode && (
          <>
            <button onClick={handleSave} className="btn btn-success" disabled={saveMutation.isPending || saveGroupMutation.isPending}>
              <i className={`bi ${(saveMutation.isPending || saveGroupMutation.isPending) ? 'bi-arrow-repeat spinning' : 'bi-save'}`}></i>
              {(saveMutation.isPending || saveGroupMutation.isPending) ? '저장 중...' : '저장'}
            </button>
            <button onClick={handleOpenBgImageModal} className="btn btn-secondary" title="배경 이미지 변경">
              <i className="bi bi-image"></i> 배경 이미지
            </button>
          </>
        )}

        {lastSavedAt && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>마지막 저장: {lastSavedAt}</span>
        )}

        {/* 전체 보기 */}
        <button onClick={handleZoomToFit} className="btn btn-secondary" disabled={data.nodes.length === 0} title="전체 보기">
          <i className="bi bi-fullscreen"></i>
        </button>

        {linkDraftSource && (
          <span className="topology-link-draft-badge">
            링크 시작 노드: {linkDraftSource.name || linkDraftSource.id}
          </span>
        )}

        {/* 다중 선택 관련 */}
        {isEditMode && selectedNodes.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 4, backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 12, fontWeight: 500 }}>
              {selectedNodes.size}개 노드 선택됨
            </span>
            <button onClick={() => { showConfirm(`선택된 ${selectedNodes.size}개 노드를 삭제하시겠습니까?`, '노드 삭제').then(ok => ok && handleDeleteSelected()); }}
              className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}>
              <i className="bi bi-trash"></i> 선택 삭제
            </button>
            <button onClick={() => { setSelectedNodes(new Set()); setSelectedNode(null); }}
              className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
              선택 해제
            </button>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            <i className="bi bi-arrow-repeat spinning"></i> 토폴로지 로딩 중...
          </span>
        )}
      </div>

        <div ref={containerRef} className={`topology-canvas-container ${isEditMode ? 'edit-mode' : ''} ${isGroupSwitching ? 'switching' : ''}`}
          onDrop={handleDropToCanvas} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onMouseDown={handleMouseDown} onContextMenu={handleBgContextMenu}>
          {/* 선택 영역 표시 */}
          {isSelecting && selectionBox && (
            <div className="ut-selection-box" style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
            }} />
          )}
          {dimensions && <ForceGraph2D
            ref={graphRef} graphData={data}
            width={dimensions.width} height={dimensions.height}
            backgroundColor="#0f172a"
            nodeRelSize={0}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={(node, color, ctx) => {
              const isGroupNode = node.nodeType === 'group' || node.type === 'group';
              const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
              const half = size / 2;
              const labelPadding = 14;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.rect(node.x - half - 4, node.y - half - 4, size + 8, size + 8 + labelPadding);
              ctx.fill();
            }}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace'}
            onNodeClick={handleNodeClick} onNodeDrag={handleNodeDrag} onNodeDragEnd={handleNodeDragEnd}
            onNodeRightClick={handleRightClick} onBackgroundClick={handleBackgroundClick}
            onBackgroundRightClick={handleBgRightClick} onLinkClick={handleLinkClick}
            onLinkRightClick={handleLinkRightClick}
            enableNodeDrag={isEditMode}
            enablePanInteraction={!isSelecting}
            cooldownTicks={0} d3AlphaDecay={1} d3VelocityDecay={1} linkDirectionalParticles={0}
            minZoom={0.5} maxZoom={4}
            onRenderFramePre={(ctx) => {
              if (backgroundImageRef.current?.complete) {
                const img = backgroundImageRef.current;
                const bgScale = 0.4;
                const w = img.naturalWidth * bgScale; const h = img.naturalHeight * bgScale;
                ctx.save(); ctx.globalAlpha = 0.4;
                ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
              }
            }}
          />}

          {/* 컨텍스트 메뉴 (NetworkTopology 동일 스타일) */}
          {contextMenu.visible && (() => {
            const menuStyle = {
              position: 'fixed', top: contextMenu.y, left: contextMenu.x,
              backgroundColor: '#1f2937', color: 'white', borderRadius: 4,
              padding: '4px 0', fontSize: 12, zIndex: 1000,
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)', minWidth: 180,
            };
            const itemStyle = {
              width: '100%', padding: '6px 10px', textAlign: 'left',
              border: 'none', background: 'transparent', color: 'inherit',
              cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
            };
            const headerStyle = {
              padding: '4px 10px', fontSize: 11, opacity: 0.8,
              borderBottom: '1px solid #374151',
            };
            const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));

            return (
              <div style={menuStyle} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
                {/* 노드 우클릭 */}
                {contextMenu.type === 'node' && contextMenu.target && (() => {
                  const target = contextMenu.target;
                  const nodeKey = `${target.nodeType === 'group' ? 'G' : 'D'}${target.deviceId || target.groupId || target.id}`;
                  return (
                    <>
                      <div style={headerStyle}>
                        노드: {target.name || target.id}
                        {isEditMode && selectedNodes.size > 1 && selectedNodes.has(nodeKey) && (
                          <span style={{ marginLeft: 8, color: '#22c55e' }}>(+{selectedNodes.size - 1}개 선택됨)</span>
                        )}
                      </div>

                      {/* 편집 모드 전용 */}
                      {isEditMode && (
                        <>
                          {selectedNodes.size > 1 && selectedNodes.has(nodeKey) ? (
                            <button style={{ ...itemStyle, color: '#ef4444' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => { showConfirm(`선택된 ${selectedNodes.size}개 노드를 삭제하시겠습니까?`, '노드 삭제').then(ok => ok && handleDeleteSelected()); }}>
                              선택된 {selectedNodes.size}개 노드 삭제
                            </button>
                          ) : (
                            <button style={itemStyle}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => { handleDeleteNode(target.id); closeMenu(); }}>
                              노드 삭제
                            </button>
                          )}

                          {!linkDraftSource && (
                            <button style={itemStyle}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => { setLinkDraftSource(target); closeMenu(); }}>
                              이 노드에서 링크 시작
                            </button>
                          )}

                          {linkDraftSource && linkDraftSource.id === target.id && (
                            <button style={itemStyle}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => { setLinkDraftSource(null); closeMenu(); }}>
                              링크 시작 취소
                            </button>
                          )}

                          {linkDraftSource && linkDraftSource.id !== target.id && !hasDuplicateLink(linkDraftSource.id, target.id) && (
                            <button style={itemStyle}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => {
                                if (linkDraftSource.nodeType === 'device' && target.nodeType === 'device') {
                                  setPendingLinkSource({ node: linkDraftSource }); setPendingLinkTarget({ node: target });
                                  setInterfaceModalStep(1); setInterfaceModalOpen(true);
                                } else {
                                  setData(prev => ({ ...prev, links: [...prev.links, {
                                    id: `link_${linkIdCounter.current++}`, source: linkDraftSource.id, target: target.id,
                                    srcType: (linkDraftSource.nodeType || 'device').toUpperCase(), dstType: (target.nodeType || 'device').toUpperCase(),
                                  }] }));
                                }
                                setLinkDraftSource(null); closeMenu();
                              }}>
                              {linkDraftSource.name || linkDraftSource.id} → {target.name || target.id} 링크 생성
                            </button>
                          )}

                          <button style={itemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => { handleOpenNodeImageModal(target); }}>
                            <i className="bi bi-image" style={{ marginRight: 2 }}></i>
                            이미지 변경
                          </button>
                        </>
                      )}

                    </>
                  );
                })()}

                {/* 링크 우클릭 */}
                {contextMenu.type === 'link' && contextMenu.target && (() => {
                  const link = contextMenu.target;
                  const srcNode = typeof link.source === 'object' ? link.source : data.nodes.find(n => n.id === link.source);
                  const tgtNode = typeof link.target === 'object' ? link.target : data.nodes.find(n => n.id === link.target);
                  return (
                    <>
                      <div style={{ padding: '8px 10px', fontSize: 11, opacity: 0.8, borderBottom: '1px solid #374151' }}>
                        <div style={{ marginBottom: 4 }}>링크 ID: {link.id || ''}</div>
                        {(link.srcIfName || link.dstIfName || link.srcIfIndex || link.dstIfIndex) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '4px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: 4 }}>
                            <span style={{ color: '#60a5fa' }}>{link.srcIfName || `IF:${link.srcIfIndex}`}</span>
                            <i className="bi bi-arrow-right" style={{ fontSize: 10 }}></i>
                            <span style={{ color: '#60a5fa' }}>{link.dstIfName || `IF:${link.dstIfIndex}`}</span>
                          </div>
                        ) : (
                          <div style={{ opacity: 0.6 }}>
                            {srcNode?.name || '?'} → {tgtNode?.name || '?'}
                          </div>
                        )}
                      </div>
                      <button style={itemStyle}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { handleDeleteLink(link.id); closeMenu(); }}>
                        링크 삭제
                      </button>
                    </>
                  );
                })()}
              </div>
            );
          })()}


          {/* 링크 상세 정보 패널 (우측 상단) */}
          {selectedLink && (() => {
            const sourceId = getLinkEndId(selectedLink.source);
            const targetId = getLinkEndId(selectedLink.target);
            const sourceNode_ = data.nodes.find(n => n.id === sourceId);
            const targetNode_ = data.nodes.find(n => n.id === targetId);
            const sourceName = sourceNode_?.name || sourceId;
            const targetName = targetNode_?.name || targetId;
            const sourceIsDevice = sourceNode_?.nodeType === 'device';
            const targetIsDevice = targetNode_?.nodeType === 'device';
            const showInterfaceInfo = sourceIsDevice && targetIsDevice;
            const srcIfName = resolveIfName(selectedLink.srcIfIndex, selectedLink.srcIfName, linkSrcPorts, linkSrcPortsLoading);
            const dstIfName = resolveIfName(selectedLink.dstIfIndex, selectedLink.dstIfName, linkDstPorts, linkDstPortsLoading);

            // 포트 데이터에서 링크 상태 판단 (API에 status가 없을 경우)
            let linkStatus = selectedLink.status;
            if (!linkStatus && showInterfaceInfo && !linkPortsLoading) {
              const srcPortList = linkSrcPorts?.content || linkSrcPorts || [];
              const dstPortList = linkDstPorts?.content || linkDstPorts || [];
              const srcPort = srcPortList.find(p => String(p.IF_INDEX) === String(selectedLink.srcIfIndex));
              const dstPort = dstPortList.find(p => String(p.IF_INDEX) === String(selectedLink.dstIfIndex));
              if (srcPort || dstPort) {
                const srcUp = srcPort ? srcPort.IF_OPER_STATUS === 1 || srcPort.IF_OPER_STATUS === '1' || String(srcPort.IF_OPER_STATUS).toLowerCase() === 'up' : true;
                const dstUp = dstPort ? dstPort.IF_OPER_STATUS === 1 || dstPort.IF_OPER_STATUS === '1' || String(dstPort.IF_OPER_STATUS).toLowerCase() === 'up' : true;
                linkStatus = (srcUp && dstUp) ? 'up' : 'down';
              }
            }

            return (
              <div style={{
                position: 'absolute', top: 10, right: 10, zIndex: 11, width: 320,
                backgroundColor: '#1f2937', borderRadius: 8, padding: '12px 14px',
                color: 'white', fontSize: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><i className="bi bi-link-45deg" style={{ marginRight: 6 }}></i>링크 정보</span>
                  <button onClick={() => setSelectedLink(null)} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>X</button>
                </div>

                {/* 연결 시각화 */}
                <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  {/* 소스 노드 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: sourceIsDevice ? '#3b82f6' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`bi ${sourceIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 14 }}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: sourceIsDevice ? '#60a5fa' : '#a78bfa' }}>{sourceName}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{sourceIsDevice ? (sourceNode_?.ip || '-') : '그룹'}</div>
                    </div>
                  </div>

                  {/* 인터페이스 연결 (장비-장비만) */}
                  {showInterfaceInfo ? (
                    linkPortsLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)', margin: '8px 0', color: '#64748b', fontSize: 11 }}>
                        <i className="bi bi-arrow-repeat spinning" style={{ fontSize: 12 }}></i> 인터페이스 조회 중...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)', margin: '8px 0' }}>
                        <div style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{srcIfName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}><i className="bi bi-arrow-down" style={{ fontSize: 16 }}></i></div>
                        <div style={{ background: '#f59e0b', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{dstIfName}</div>
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)', margin: '8px 0', color: '#6b7280' }}>
                      <i className="bi bi-arrow-down" style={{ fontSize: 16 }}></i>
                    </div>
                  )}

                  {/* 타겟 노드 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: targetIsDevice ? '#f59e0b' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`bi ${targetIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 14 }}></i>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: targetIsDevice ? '#fbbf24' : '#a78bfa' }}>{targetName}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{targetIsDevice ? (targetNode_?.ip || '-') : '그룹'}</div>
                    </div>
                  </div>
                </div>

                {/* 상세 정보 */}
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {(sourceIsDevice || targetIsDevice) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>상태</span>
                    {linkPortsLoading ? (
                      <span style={{ color: '#64748b' }}>조회 중...</span>
                    ) : (
                      <span style={{ color: linkStatus === 'up' ? '#22c55e' : linkStatus === 'down' ? '#ef4444' : '#f59e0b' }}>
                        {linkStatus === 'up' ? 'UP' : linkStatus === 'down' ? 'DOWN' : linkStatus || '-'}
                      </span>
                    )}
                  </div>
                  )}
                  {showInterfaceInfo && !linkPortsLoading && srcIfName && srcIfName !== '-' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>출발지 인터페이스</span>
                      <span style={{ color: '#60a5fa' }}>{srcIfName}</span>
                    </div>
                  )}
                  {showInterfaceInfo && !linkPortsLoading && dstIfName && dstIfName !== '-' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>목적지 인터페이스</span>
                      <span style={{ color: '#fbbf24' }}>{dstIfName}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {data.nodes.length === 0 && !isLoading && (
            <div className="ut-empty-canvas">
              <i className="bi bi-diagram-3"></i>
              <p>{isEditMode ? '사이드바에서 장비/그룹을 드래그하여 토폴로지를 구성하세요' : (isUserRoot ? '편집 모드를 켜고 장비를 추가하세요' : '이 그룹에는 토폴로지 데이터가 없습니다')}</p>
              {!isEditMode && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!isUserRoot && (
                    <button className="ut-back-btn" onClick={navigateBack} style={{ width: 'auto', padding: '8px 16px', fontSize: 13, gap: 6 }}>
                      <i className="bi bi-chevron-left"></i> 뒤로 가기
                    </button>
                  )}
                  <button className="ut-edit-toggle-btn" onClick={toggleEditMode} style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }}>
                    <i className="bi bi-pencil"></i> 편집 모드
                  </button>
                </div>
              )}
              {isEditMode && sidebarCollapsed && (
                <button className="ut-tool-btn" onClick={() => setSidebarCollapsed(false)} style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }}>
                  <i className="bi bi-layout-sidebar"></i> 장비 목록 열기
                </button>
              )}
            </div>
          )}
        </div>
      </div> {/* topology-main-content 끝 */}

      {/* 빈 토폴로지 확인 팝업 */}
      {showEmptyTopologyPrompt && (
        <div className="topology-modal-overlay">
          <div className="topology-modal-glass topology-modal-confirm">
            <div className="topology-modal-icon topology-modal-icon-info">
              <i className="bi bi-diagram-3"></i>
            </div>
            <h3 className="topology-modal-title">빈 토폴로지</h3>
            <p className="topology-modal-message">
              해당 그룹에 속한 장비({(currentGroupDevices?.content || currentGroupDevices || []).length}개)를<br />
              자동으로 배치하시겠습니까?
            </p>
            <div className="topology-modal-actions">
              <button
                className="topology-modal-btn topology-modal-btn-cancel"
                onClick={() => setShowEmptyTopologyPrompt(false)}
              >
                취소
              </button>
              <button
                className="topology-modal-btn topology-modal-btn-primary"
                onClick={handleAddAllGroupDevices}
              >
                <i className="bi bi-check-lg"></i>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인터페이스 선택 모달 */}
      {interfaceModalOpen && (() => {
        const isSourceStep = interfaceModalStep === 1;
        const currentNode = isSourceStep ? pendingLinkSource?.node : pendingLinkTarget?.node;
        const currentPorts = isSourceStep ? sourcePorts : targetPorts;
        const portsLoading = isSourceStep ? sourcePortsLoading : targetPortsLoading;
        const ports = currentPorts?.content || currentPorts || [];
        return (
          <div className="ut-modal-overlay" onClick={handleInterfaceModalClose}>
            <div className="ut-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, minWidth: 400 }}>
              <h3><i className="bi bi-link-45deg"></i> 인터페이스 선택</h3>

              {/* 연결 정보 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: 'rgba(15,23,42,0.4)', borderRadius: 8, fontSize: '0.82rem' }}>
                <div style={{ color: isSourceStep ? '#38bdf8' : '#22c55e' }}>
                  <i className="bi bi-hdd-network"></i> {pendingLinkSource?.node?.name || '장비 1'}
                  {pendingLinkSource?.interfaceName && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>({pendingLinkSource.interfaceName})</span>}
                </div>
                <i className="bi bi-arrow-right" style={{ color: '#475569' }}></i>
                <div style={{ color: !isSourceStep ? '#38bdf8' : '#64748b' }}>
                  <i className="bi bi-hdd-network"></i> {pendingLinkTarget?.node?.name || '장비 2'}
                </div>
              </div>

              <div className="ut-modal-body">
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                  <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginRight: 8 }}>
                    {isSourceStep ? 'Step 1/2' : 'Step 2/2'}
                  </span>
                  <strong style={{ color: '#e2e8f0' }}>{currentNode?.name}</strong>의 인터페이스를 선택하세요
                </p>

                {portsLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                    <i className="bi bi-arrow-repeat spinning" style={{ fontSize: 18 }}></i>
                    <p style={{ margin: '8px 0 0', fontSize: 13 }}>인터페이스 목록 로딩 중...</p>
                  </div>
                ) : ports.length > 0 ? (
                  <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ports.map((port) => {
                      const ifName = port.IF_NAME || port.IF_DESCR || `Interface ${port.IF_INDEX}`;
                      const isUp = port.IF_OPER_STATUS === 1;
                      return (
                        <button key={port.IF_INDEX} className="ut-if-btn" onClick={() => handleInterfaceSelect(port)}>
                          <i className={`bi bi-ethernet`} style={{ color: isUp ? '#22c55e' : '#64748b' }}></i>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{ifName}</div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              <span>Index: {port.IF_INDEX}</span>
                              {port.IF_SPEED > 0 && (
                                <span>{port.IF_SPEED >= 1000000000 ? `${(port.IF_SPEED / 1000000000).toFixed(0)} Gbps` : port.IF_SPEED >= 1000000 ? `${(port.IF_SPEED / 1000000).toFixed(0)} Mbps` : `${port.IF_SPEED} bps`}</span>
                              )}
                              <span style={{ color: isUp ? '#22c55e' : '#ef4444' }}>{isUp ? 'Up' : 'Down'}</span>
                            </div>
                          </div>
                          <i className="bi bi-chevron-right" style={{ color: '#475569' }}></i>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                    <i className="bi bi-exclamation-circle" style={{ fontSize: 18 }}></i>
                    <p style={{ margin: '8px 0 0', fontSize: 13 }}>인터페이스가 없습니다.</p>
                  </div>
                )}
              </div>

              <div className="ut-modal-actions">
                {!isSourceStep && (
                  <button className="ut-modal-btn cancel" onClick={() => { setInterfaceModalStep(1); setPendingLinkSource(prev => ({ ...prev, interface: null, interfaceName: null })); }}>
                    <i className="bi bi-arrow-left"></i> 이전
                  </button>
                )}
                <button className="ut-modal-btn cancel" onClick={handleInterfaceModalClose}>취소</button>
              </div>
            </div>
          </div>
        );
      })()}

      {deviceModalOpen && <DeviceDetailModal deviceId={deviceModalId} onClose={() => { setDeviceModalOpen(false); setDeviceModalId(null); }} />}

      {/* 배경 이미지 모달 */}
      {bgImageModalOpen && (
        <div className="ut-modal-overlay" onClick={() => setBgImageModalOpen(false)}>
          <div className="ut-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3><i className="bi bi-image"></i> 배경 이미지</h3>
            <div className="ut-modal-body">
              <label>이미지 파일 선택</label>
              <input type="file" accept="image/*,.svg" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => { const r = ev.target?.result; if (r) setBgImageInput(r.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '')); };
                reader.readAsDataURL(file);
              }} style={{ width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
              {bgImageInput && (
                <div style={{ position: 'relative', textAlign: 'center', marginBottom: 12 }}>
                  <img src={`data:image/${bgImageInput.startsWith('PHN2Zy') || bgImageInput.startsWith('PD94bW') ? 'svg+xml' : 'png'};base64,${bgImageInput}`}
                    alt="미리보기" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  <button onClick={() => setBgImageInput('')}
                    style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, border: 'none', borderRadius: 4, background: 'rgba(239,68,68,0.8)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              )}
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>이미지를 비우고 저장하면 배경이 삭제됩니다.</p>
            </div>
            <div className="ut-modal-actions">
              <button className="ut-modal-btn cancel" onClick={() => setBgImageModalOpen(false)}>취소</button>
              <button className="ut-modal-btn primary" onClick={handleSaveBackgroundImage} disabled={bgImageMutation.isPending}>
                {bgImageMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 Alert/Confirm 모달 */}
      {customModal.visible && (
        <div className="topology-modal-overlay" onClick={() => customModal.type !== 'confirm' && customModal.onConfirm?.()}>
          <div
            className={`topology-modal-glass topology-modal-${customModal.type}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`topology-modal-icon topology-modal-icon-${customModal.type}`}>
              <i className={`bi ${
                customModal.type === 'success' ? 'bi-check-circle' :
                customModal.type === 'error' ? 'bi-x-circle' :
                customModal.type === 'warning' ? 'bi-exclamation-triangle' :
                customModal.type === 'confirm' ? 'bi-question-circle' :
                'bi-info-circle'
              }`}></i>
            </div>
            <h3 className="topology-modal-title">{customModal.title}</h3>
            <p className="topology-modal-message">{customModal.message}</p>
            <div className="topology-modal-actions">
              {customModal.type === 'confirm' ? (
                <>
                  <button
                    className="topology-modal-btn topology-modal-btn-cancel"
                    onClick={customModal.onCancel}
                  >
                    취소
                  </button>
                  <button
                    className="topology-modal-btn topology-modal-btn-primary"
                    onClick={customModal.onConfirm}
                  >
                    <i className="bi bi-check-lg"></i>
                    확인
                  </button>
                </>
              ) : (
                <button
                  className={`topology-modal-btn topology-modal-btn-${customModal.type === 'success' ? 'success' : customModal.type === 'error' ? 'danger' : 'primary'}`}
                  onClick={customModal.onConfirm}
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 노드 이미지 모달 */}
      {nodeImageModalOpen && (
        <div className="ut-modal-overlay" onClick={() => { setNodeImageModalOpen(false); setNodeImageTarget(null); }}>
          <div className="ut-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3><i className="bi bi-image"></i> 노드 이미지 변경</h3>
            <div className="ut-modal-body">
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                <strong style={{ color: '#e2e8f0' }}>{nodeImageTarget?.name}</strong> ({nodeImageTarget?.id})
              </p>
              <label>이미지 파일 선택</label>
              <input type="file" accept="image/*,.svg" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => { const r = ev.target?.result; if (r) setNodeImageInput(r.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '')); };
                reader.readAsDataURL(file);
              }} style={{ width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, background: 'rgba(15,23,42,0.6)', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
              {nodeImageInput && (
                <div style={{ position: 'relative', textAlign: 'center', marginBottom: 12 }}>
                  <img src={`data:image/${nodeImageInput.startsWith('PHN2Zy') || nodeImageInput.startsWith('PD94bW') ? 'svg+xml' : 'png'};base64,${nodeImageInput}`}
                    alt="미리보기" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  <button onClick={() => setNodeImageInput('')}
                    style={{ position: 'absolute', top: 4, right: 'calc(50% - 72px)', width: 24, height: 24, border: 'none', borderRadius: 4, background: 'rgba(239,68,68,0.8)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              )}
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>이 사용자 토폴로지의 해당 노드에만 적용됩니다.</p>
            </div>
            <div className="ut-modal-actions">
              <button className="ut-modal-btn cancel" onClick={() => { setNodeImageModalOpen(false); setNodeImageTarget(null); }}>취소</button>
              <button className="ut-modal-btn primary" onClick={handleSaveNodeImage} disabled={nodeImageMutation.isPending}>
                {nodeImageMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

