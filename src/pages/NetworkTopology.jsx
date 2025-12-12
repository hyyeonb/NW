import { useEffect, useRef, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import TopologySidebar from "../components/TopologySidebar";
import { useDevice, useDevicePorts, useTopologyView, useSaveTopology, useGroupTree } from "../hooks";
import { useGroupStore } from "../stores";
import "../styles/topology-sidebar.css";

const ICONS = {
  "CX8100-24": "/icon/CX8100-24.png",
  "CX8100-48": "/icon/CX8100-48.png",
  "HPE 7503X": "/icon/HPE 7503X.png",
  "HPE 7506X": "/icon/HPE 7506X.png"
};

const DEVICE_TYPES = ["CX8100-24", "CX8100-48", "HPE 7503X", "HPE 7506X"];
const NODE_SIZE = 40;

export default function NetworkTopology() {
  const graphRef = useRef(null);
  const containerRef = useRef(null);

  // 그룹 스토어에서 선택된 그룹 가져오기
  const { selectedGroup, setSelectedGroup } = useGroupStore();

  // 현재 토폴로지에 표시할 ID (그룹 또는 장비)
  const [currentTopologyGroupId, setCurrentTopologyGroupId] = useState(null);
  // 현재 토폴로지 타입 ('group' 또는 'device')
  const [currentTopologyType, setCurrentTopologyType] = useState('group');
  // 현재 토폴로지 이름 (편집 중에도 유지)
  const [currentTopologyGroupName, setCurrentTopologyGroupName] = useState(null);
  // 토폴로지 이동 히스토리 (뒤로 가기용)
  const [topologyHistory, setTopologyHistory] = useState([]);

  // 그룹 트리 조회 (최상위 그룹 찾기용)
  const { data: groupTree } = useGroupTree();

  const [data, setData] = useState({ nodes: [], links: [] });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [linkDraftSource, setLinkDraftSource] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedSidebarDevice, setSelectedSidebarDevice] = useState(null);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceModalId, setDeviceModalId] = useState(null);

  // 인터페이스 선택 모달 관련 상태
  const [interfaceModalOpen, setInterfaceModalOpen] = useState(false);
  const [interfaceModalStep, setInterfaceModalStep] = useState(1); // 1: source 인터페이스, 2: target 인터페이스
  const [pendingLinkSource, setPendingLinkSource] = useState(null); // { node, interface }
  const [pendingLinkTarget, setPendingLinkTarget] = useState(null); // { node, interface }

  // 토폴로지 데이터 조회 (현재 그룹 또는 장비 기준)
  const {
    data: topologyData,
    isLoading: topologyLoading,
    error: topologyError,
    refetch: refetchTopology
  } = useTopologyView(currentTopologyGroupId, currentTopologyType);

  // 토폴로지 저장 mutation
  const saveTopologyMutation = useSaveTopology();

  // 다중 선택 관련 상태
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const selectedNodesRef = useRef(new Set()); // 드래그 핸들러에서 사용할 ref
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionStartRef = useRef(null);
  const lastNodeClickTimeRef = useRef(0); // 노드/엣지 클릭 시간 기록

  // 노드 드래그 관련 ref (상단에 선언해야 함)
  const dragOffsetsRef = useRef({});
  const isDraggingNodesRef = useRef(false);
  const dragEndTimeRef = useRef(0);
  const draggingNodeRef = useRef(null); // 현재 드래그 중인 노드

  // selectedNodes가 변경될 때 ref도 업데이트
  useEffect(() => {
    selectedNodesRef.current = selectedNodes;
  }, [selectedNodes]);

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: null, // 'background' | 'node' | 'link'
    target: null,
    graphX: null,
    graphY: null
  });

  const nodeIdCounter = useRef(1000);
  const linkIdCounter = useRef(100);
  const iconCache = useRef({});

  // 장비 상세정보 API 호출
  const { data: deviceDetailData, isLoading: deviceLoading, error: deviceError } = useDevice(deviceModalId);

  // 인터페이스 모달에서 사용할 포트 정보 조회
  const sourceDeviceId = interfaceModalOpen && pendingLinkSource?.node?.deviceId ? pendingLinkSource.node.deviceId : null;
  const targetDeviceId = interfaceModalOpen && pendingLinkTarget?.node?.deviceId ? pendingLinkTarget.node.deviceId : null;
  const { data: sourcePorts, isLoading: sourcePortsLoading } = useDevicePorts(sourceDeviceId);
  const { data: targetPorts, isLoading: targetPortsLoading } = useDevicePorts(targetDeviceId);

  // 링크 end(source/target)가 문자열일 수도, 객체일 수도 있어서 id만 뽑는 함수
  const getLinkEndId = (end) =>
    typeof end === "object" && end !== null ? end.id : end;

  // 선택된 링크 비교용 키
  const getLinkKey = (link) => {
    if (!link) return "";
    const s = getLinkEndId(link.source);
    const t = getLinkEndId(link.target);
    return `${s}__${t}`;
  };

  const isSameLink = (a, b) => {
    if (!a || !b) return false;
    return getLinkKey(a) === getLinkKey(b);
  };

  // 컨테이너 크기 감지
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions({
          width: offsetWidth || 800,
          height: offsetHeight || 600
        });
      }
    };

    // 사이드바 토글 후 약간의 딜레이를 두고 크기 재계산
    const timer = setTimeout(updateDimensions, 50);

    window.addEventListener("resize", updateDimensions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [sidebarCollapsed]);

  // 아이콘 미리 로드
  useEffect(() => {
    Object.entries(ICONS).forEach(([type, src]) => {
      const img = new Image();
      img.src = src;
      iconCache.current[type] = img;
    });
  }, []);

  // 최상위 그룹 ID 설정 (그룹 트리 로드 후)
  useEffect(() => {
    if (groupTree && groupTree.length > 0 && !currentTopologyGroupId) {
      // '미등록 장비'를 제외한 첫 번째 그룹을 최상위로 설정
      const rootGroup = groupTree.find(g => g.GROUP_NAME !== '미등록 장비');
      if (rootGroup) {
        setCurrentTopologyGroupId(rootGroup.GROUP_ID);
        setCurrentTopologyGroupName(rootGroup.GROUP_NAME);
        if (!selectedGroup) {
          setSelectedGroup(rootGroup);
        }
      }
    }
  }, [groupTree, currentTopologyGroupId, selectedGroup, setSelectedGroup]);

  // 토폴로지 데이터 로드 시 state 업데이트
  useEffect(() => {
    if (topologyData) {
      console.log('=== 토폴로지 데이터 로드 ===', topologyData);

      // 모든 노드 위치 고정 (시뮬레이션으로 움직이지 않도록)
      const fixedNodes = (topologyData.nodes || []).map(n => ({
        ...n,
        fx: n.fx ?? n.x,
        fy: n.fy ?? n.y
      }));

      // 노드 ID 목록 생성
      const nodeIds = new Set(fixedNodes.map(n => String(n.id)));

      // 유효한 링크만 필터링 (source와 target이 모두 존재하는 노드를 참조해야 함)
      const validLinks = (topologyData.links || []).filter(link => {
        // source/target이 객체일 수도 있고 문자열일 수도 있음
        const sourceId = typeof link.source === 'object' ? String(link.source?.id) : String(link.source);
        const targetId = typeof link.target === 'object' ? String(link.target?.id) : String(link.target);
        const isValid = nodeIds.has(sourceId) && nodeIds.has(targetId);
        if (!isValid) {
          console.warn('유효하지 않은 링크 제외:', link, { sourceId, targetId, nodeIds: [...nodeIds] });
        }
        return isValid;
      });

      console.log('=== 변환된 노드 ===', fixedNodes);
      console.log('=== 유효한 링크 ===', validLinks);

      setData({ nodes: fixedNodes, links: validLinks });
      initialFitDone.current = false; // 새 데이터 로드 시 줌 재조정
    }
  }, [topologyData]);

  // 사이드바에서 그룹 선택 시 해당 그룹 토폴로지로 전환
  const handleGroupSelect = useCallback((group) => {
    if (!group) return;

    // 편집 모드에서는 토폴로지 전환하지 않고 그룹 선택만 (장비 목록 업데이트)
    if (isEditMode) {
      // 그룹 선택만 변경 (사이드바의 장비 목록 업데이트용)
      setSelectedGroup(group);
      return;
    }

    // 일반 모드에서는 토폴로지 전환
    if (group.GROUP_ID !== currentTopologyGroupId || currentTopologyType !== 'group') {
      // 먼저 데이터 초기화 (그래프 상태 리셋)
      setData({ nodes: [], links: [] });
      setCurrentTopologyGroupId(group.GROUP_ID);
      setCurrentTopologyType('group');
      setCurrentTopologyGroupName(group.GROUP_NAME);
      setSelectedNode(null);
      setSelectedLink(null);
      setSelectedNodes(new Set());
      setLinkDraftSource(null);
    }
  }, [currentTopologyGroupId, currentTopologyType, isEditMode, setSelectedGroup]);

  // 데이터 로드 후 전체 노드가 보이도록 줌 조정
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (data.nodes.length > 0 && graphRef.current) {
      // 노드 중심점 계산
      const avgX = data.nodes.reduce((sum, n) => sum + (n.x || 0), 0) / data.nodes.length;
      const avgY = data.nodes.reduce((sum, n) => sum + (n.y || 0), 0) / data.nodes.length;

      // 즉시 중심으로 이동
      graphRef.current.centerAt(avgX, avgY, 0);

      // 약간의 딜레이 후 zoomToFit 실행
      const timer = setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400, 80);
          initialFitDone.current = true;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data.nodes, currentTopologyGroupId]);

  // 다중 노드 드래그를 위한 커스텀 드래그 핸들러 설정
  useEffect(() => {
    if (!graphRef.current || data.nodes.length === 0) return;

    // 캔버스 요소에 직접 이벤트 리스너 추가
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;

    let dragStartNode = null;
    let dragStartX = 0;
    let dragStartY = 0;

    const handleCanvasMouseDown = (e) => {
      if (e.button !== 0) return; // 좌클릭만
      if (!graphRef.current) return;
      if (!isEditMode) return; // 편집 모드가 아니면 무시

      // 마우스 위치를 그래프 좌표로 변환
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY);

      // 해당 위치에 노드가 있는지 확인 - data state에서 노드 찾기
      const clickedNode = data.nodes.find(node => {
        const dx = (node.x || 0) - graphCoords.x;
        const dy = (node.y || 0) - graphCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < NODE_SIZE / 2 + 10; // 클릭 영역 여유
      });

      if (clickedNode) {
        dragStartNode = clickedNode;
        dragStartX = graphCoords.x;
        dragStartY = graphCoords.y;

        const currentSelected = selectedNodesRef.current;

        // 다중 선택된 노드 드래그 시 오프셋 저장
        if (currentSelected.size > 1 && currentSelected.has(clickedNode.id)) {
          isDraggingNodesRef.current = true;
          draggingNodeRef.current = clickedNode;
          dragOffsetsRef.current = {};

          data.nodes.forEach(n => {
            if (currentSelected.has(n.id) && n.id !== clickedNode.id) {
              dragOffsetsRef.current[n.id] = {
                dx: n.x - clickedNode.x,
                dy: n.y - clickedNode.y
              };
            }
          });
        }
      }
    };

    const handleCanvasMouseMove = (e) => {
      if (!dragStartNode || !isDraggingNodesRef.current) return;
      if (!isEditMode || !graphRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY);

      // 메인 노드의 현재 위치 찾기
      const mainNode = data.nodes.find(n => n.id === dragStartNode.id);

      if (mainNode && Object.keys(dragOffsetsRef.current).length > 0) {
        // 다른 선택된 노드들 위치 업데이트
        data.nodes.forEach(n => {
          const offset = dragOffsetsRef.current[n.id];
          if (offset) {
            n.x = mainNode.x + offset.dx;
            n.y = mainNode.y + offset.dy;
            n.fx = mainNode.x + offset.dx;
            n.fy = mainNode.y + offset.dy;
          }
        });
      }
    };

    const handleCanvasMouseUp = (e) => {
      if (dragStartNode && isDraggingNodesRef.current && isEditMode) {
        // 최종 위치를 노드 객체에 직접 반영 (setData 호출 안함 - 화면 점프 방지)
        if (Object.keys(dragOffsetsRef.current).length > 0) {
          const mainNode = data.nodes.find(n => n.id === dragStartNode.id);

          if (mainNode) {
            // 다른 선택된 노드들 위치 직접 업데이트
            data.nodes.forEach(n => {
              const offset = dragOffsetsRef.current[n.id];
              if (offset) {
                const newX = mainNode.x + offset.dx;
                const newY = mainNode.y + offset.dy;
                n.x = newX;
                n.y = newY;
                n.fx = newX;
                n.fy = newY;
              }
            });
          }
        }
      }

      dragStartNode = null;
      isDraggingNodesRef.current = false;
      draggingNodeRef.current = null;
      dragOffsetsRef.current = {};
      dragEndTimeRef.current = Date.now();
    };

    canvas.addEventListener('mousedown', handleCanvasMouseDown, true);
    canvas.addEventListener('mousemove', handleCanvasMouseMove, true);
    canvas.addEventListener('mouseup', handleCanvasMouseUp, true);
    document.addEventListener('mouseup', handleCanvasMouseUp, true);

    return () => {
      canvas.removeEventListener('mousedown', handleCanvasMouseDown, true);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove, true);
      canvas.removeEventListener('mouseup', handleCanvasMouseUp, true);
      document.removeEventListener('mouseup', handleCanvasMouseUp, true);
    };
  }, [data.nodes, isEditMode]);

  // 편집 모드 토글
  const toggleEditMode = () => {
    console.log('=== 편집 모드 토글 ===', { 현재모드: isEditMode, 현재데이터: data });
    setIsEditMode((prev) => {
      const next = !prev;
      if (!next) {
        setLinkDraftSource(null);
      }
      return next;
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 컨텍스트 메뉴 열기 공통
  const openContextMenu = (type, target, event, graphPos = null) => {
    // 기본 모드에서는 장비 노드 우클릭만 허용 (상세정보 보기용)
    if (!isEditMode) {
      if (type === 'node' && target?.nodeType === 'device') {
        // 장비 노드 우클릭은 기본 모드에서도 허용
      } else {
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type,
      target,
      graphX: graphPos?.x ?? null,
      graphY: graphPos?.y ?? null
    });
  };

  // 선택 박스 종료 시간 기록 (중복 선택 박스 방지용)
  const selectionEndTimeRef = useRef(0);
  const selectionDragStarted = useRef(false); // 실제로 드래그가 시작되었는지

  // 배경 우클릭 - 기본 컨텍스트 메뉴 방지
  const handleBackgroundContextMenu = (event) => {
    event.preventDefault();
  };

  // 마우스 다운 - 우클릭 드래그 선택 시작
  const handleMouseDown = (event) => {
    // 우클릭(버튼 2)이 아니면 무시
    if (event.button !== 2) return;
    if (!graphRef.current || !isEditMode) return;

    // 노드 드래그 직후 (300ms 이내)에는 선택 박스 시작 안함
    if (Date.now() - dragEndTimeRef.current < 300) {
      return;
    }

    // 선택 박스 종료 직후 (300ms 이내)에는 새 선택 박스 시작 안함
    if (Date.now() - selectionEndTimeRef.current < 300) {
      return;
    }

    // 노드/엣지 클릭 직후 (300ms 이내)에는 선택 박스 시작 안함
    if (Date.now() - lastNodeClickTimeRef.current < 300) {
      return;
    }

    // 노드 드래그 중이면 선택 박스 시작 안함
    if (isDraggingNodesRef.current) {
      return;
    }

    // 이미 선택 중이면 무시
    if (isSelecting) {
      return;
    }

    // 노드 위에서 우클릭한 경우 선택 박스 시작 안함 (노드 컨텍스트 메뉴 우선)
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY);

    const clickedOnNode = data.nodes.some(node => {
      const dx = (node.x || 0) - graphCoords.x;
      const dy = (node.y || 0) - graphCoords.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < NODE_SIZE / 2 + 10;
    });

    if (clickedOnNode) {
      return; // 노드 위 우클릭은 ForceGraph2D의 onNodeRightClick이 처리
    }

    // 컨텍스트 메뉴 숨기기
    setContextMenu((prev) => ({ ...prev, visible: false }));

    selectionStartRef.current = { screenX, screenY };
    selectionDragStarted.current = false; // 아직 드래그 시작 안함

    // 우클릭 드래그를 위해 mousemove/mouseup 이벤트 리스너 추가
    const handleGlobalMouseMove = (e) => {
      if (!selectionStartRef.current) return;

      const r = containerRef.current.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;

      // 최소 이동 거리 체크 (10px 이상 움직여야 드래그 시작)
      const dx = Math.abs(sx - selectionStartRef.current.screenX);
      const dy = Math.abs(sy - selectionStartRef.current.screenY);

      if (!selectionDragStarted.current && (dx > 10 || dy > 10)) {
        // 드래그 시작 - 이제 선택 박스 표시
        selectionDragStarted.current = true;
        setIsSelecting(true);
        setSelectionBox({
          startX: selectionStartRef.current.screenX,
          startY: selectionStartRef.current.screenY,
          endX: sx,
          endY: sy
        });
      } else if (selectionDragStarted.current) {
        // 드래그 중 - 선택 박스 업데이트
        setSelectionBox(prev => prev ? { ...prev, endX: sx, endY: sy } : null);
      }
    };

    const handleGlobalMouseUp = (e) => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);

      // 선택 종료 시간 기록
      selectionEndTimeRef.current = Date.now();

      // 드래그가 시작되지 않았으면 그냥 종료
      if (!selectionDragStarted.current) {
        selectionStartRef.current = null;
        return;
      }

      if (!selectionStartRef.current || !graphRef.current || !containerRef.current) {
        setIsSelecting(false);
        setSelectionBox(null);
        selectionStartRef.current = null;
        return;
      }

      const r = containerRef.current.getBoundingClientRect();
      const endX = e.clientX - r.left;
      const endY = e.clientY - r.top;
      const startX = selectionStartRef.current.screenX;
      const startY = selectionStartRef.current.screenY;

      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      // 선택 영역이 너무 작으면 무시
      if (maxX - minX < 5 && maxY - minY < 5) {
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectedNodes(new Set());
        selectionStartRef.current = null;
        return;
      }

      // 선택 영역 내의 노드들 찾기
      const fg = graphRef.current;
      const selected = new Set();
      data.nodes.forEach(node => {
        const screenCoords = fg.graph2ScreenCoords(node.x, node.y);
        if (
          screenCoords.x >= minX &&
          screenCoords.x <= maxX &&
          screenCoords.y >= minY &&
          screenCoords.y <= maxY
        ) {
          selected.add(node.id);
        }
      });

      console.log('=== 노드 선택 완료 ===', {
        selectedIds: [...selected],
        count: selected.size
      });
      setSelectedNodes(selected);
      selectedNodesRef.current = selected; // ref도 즉시 업데이트
      setIsSelecting(false);
      setSelectionBox(null);
      selectionStartRef.current = null;
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };


  // 노드 클릭 -> 그룹 노드는 해당 그룹 토폴로지로 이동, 장비 노드는 모달 표시
  const handleNodeClick = (node) => {
    // 클릭 시간 기록 (드래그 박스 방지용)
    lastNodeClickTimeRef.current = Date.now();

    setSelectedNode(node);

    // 편집 모드에서는 선택만 하고 이동/모달 안함
    if (isEditMode) return;

    // 노드 ID 추출 (그룹 또는 장비)
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';
    const nodeId = isGroupNode ? (node.groupId || node.id) : (node.deviceId || node.id);
    const nodeType = isGroupNode ? 'group' : 'device';

    if (!nodeId) return;

    // 같은 노드면 refetch만 수행
    if (String(nodeId) === String(currentTopologyGroupId) && nodeType === currentTopologyType) {
      refetchTopology();
      return;
    }

    // 현재 토폴로지를 히스토리에 저장 (뒤로 가기용)
    if (currentTopologyGroupId) {
      setTopologyHistory(prev => [...prev, {
        groupId: currentTopologyGroupId,
        groupName: currentTopologyGroupName,
        type: currentTopologyType
      }]);
    }

    // 데이터 초기화 후 새 토폴로지 로드
    setData({ nodes: [], links: [] });
    setCurrentTopologyGroupId(nodeId);
    setCurrentTopologyType(nodeType);
    setCurrentTopologyGroupName(node.name || node.GROUP_NAME || node.DEVICE_NAME || `${nodeType === 'group' ? '그룹' : '장비'} ${nodeId}`);
    setSelectedNode(null);
    setSelectedLink(null);
    setSelectedNodes(new Set());
    setLinkDraftSource(null);

    // 사이드바의 선택된 그룹도 업데이트 (그룹인 경우에만)
    if (isGroupNode) {
      const info = { GROUP_ID: nodeId, GROUP_NAME: node.name || node.GROUP_NAME };
      setSelectedGroup(info);
    }
  };

  // 노드 우클릭 - 컨텍스트 메뉴 (노드 삭제, 링크 생성)
  const handleNodeRightClick = (node, event) => {
    // 클릭 시간 기록 (드래그 박스 방지용)
    lastNodeClickTimeRef.current = Date.now();
    openContextMenu("node", node, event);
  };

  // 링크 우클릭
  const handleLinkRightClick = (link, event) => {
    // 클릭 시간 기록 (드래그 박스 방지용)
    lastNodeClickTimeRef.current = Date.now();
    openContextMenu("link", link, event);
  };

  // 노드 드래그 시작 핸들러 (ForceGraph2D 내부 드래그용 - 단일 노드)
  const handleNodeDragStart = useCallback((node, event) => {
    if (!isEditMode) return;
    // 다중 선택 드래그는 커스텀 핸들러에서 처리
  }, [isEditMode]);

  // 노드 드래그 핸들러 (ForceGraph2D 내부 드래그용)
  const handleNodeDrag = useCallback((node, translate) => {
    if (!isEditMode) return;

    node.fx = node.x;
    node.fy = node.y;
    draggingNodeRef.current = node;

    // 다중 선택된 경우 다른 노드들도 위치 업데이트
    const offsetKeys = Object.keys(dragOffsetsRef.current);
    if (offsetKeys.length > 0) {
      data.nodes.forEach(n => {
        const offset = dragOffsetsRef.current[n.id];
        if (offset) {
          n.x = node.x + offset.dx;
          n.y = node.y + offset.dy;
          n.fx = node.x + offset.dx;
          n.fy = node.y + offset.dy;
        }
      });
    }
  }, [isEditMode, data.nodes]);

  const handleNodeDragEnd = useCallback((node, translate) => {
    if (!isEditMode) return;

    // 다중 선택 드래그 완료 시 노드 객체에 직접 위치 반영 (setData 호출 안함 - 화면 점프 방지)
    if (Object.keys(dragOffsetsRef.current).length > 0) {
      data.nodes.forEach(n => {
        if (n.id === node.id) {
          n.x = node.x;
          n.y = node.y;
          n.fx = node.x;
          n.fy = node.y;
        } else {
          const offset = dragOffsetsRef.current[n.id];
          if (offset) {
            n.x = node.x + offset.dx;
            n.y = node.y + offset.dy;
            n.fx = node.x + offset.dx;
            n.fy = node.y + offset.dy;
          }
        }
      });
    } else {
      // 단일 노드 - 직접 업데이트
      const targetNode = data.nodes.find(n => n.id === node.id);
      if (targetNode) {
        targetNode.x = node.x;
        targetNode.y = node.y;
        targetNode.fx = node.x;
        targetNode.fy = node.y;
      }
    }

    dragOffsetsRef.current = {};
    draggingNodeRef.current = null;
    dragEndTimeRef.current = Date.now();
    isDraggingNodesRef.current = false;
  }, [isEditMode, data.nodes]);

  // 링크 클릭
  const handleLinkClick = (link, event) => {
    // 클릭 시간 기록 (드래그 박스 방지용)
    lastNodeClickTimeRef.current = Date.now();

    try {
      if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
      setSelectedLink(link);
    } catch (e) {
      console.error("onLinkClick error:", e);
    }
  };

  // 배경에서 노드 추가
  const handleAddNodeHere = () => {
    if (contextMenu.graphX === null || contextMenu.graphY === null) return;

    const newId = `N${nodeIdCounter.current++}`;
    const defaultName = `Node ${newId}`;

    const inputName = window.prompt("새 노드 이름을 입력하세요.", defaultName);
    if (inputName === null) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }
    const nodeName = inputName.trim() || defaultName;

    const typeHelp =
      "노드 타입 번호를 선택하세요:\n" +
      "1: CX8100-24\n" +
      "2: CX8100-48\n" +
      "3: HPE 7503X\n" +
      "4: HPE 7506X";

    const inputType = window.prompt(typeHelp, "1");
    if (inputType === null) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    let typeIndex = parseInt(inputType, 10);
    if (isNaN(typeIndex) || typeIndex < 1 || typeIndex > DEVICE_TYPES.length) {
      typeIndex = 1;
    }
    const selectedType = DEVICE_TYPES[typeIndex - 1];

    const inputIp = window.prompt("노드 관리 IP를 입력하세요. (예: 10.0.0.10)", "");
    const inputLocation = window.prompt(
      "노드 위치를 입력하세요. (예: IDC-1F, RACK-3)",
      ""
    );
    const inputNote = window.prompt("노드 설명/메모를 입력하세요.", "");

    const newNode = {
      id: newId,
      name: nodeName,
      type: selectedType,
      ip: inputIp?.trim() || "",
      location: inputLocation?.trim() || "",
      note: inputNote?.trim() || "",
      x: contextMenu.graphX,
      y: contextMenu.graphY,
      fx: contextMenu.graphX,
      fy: contextMenu.graphY
    };

    setData((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 노드 삭제 (연결된 링크 포함)
  const handleDeleteNode = () => {
    const node = contextMenu.target;
    if (!node) return;

    setData((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== node.id),
      links: prev.links.filter((l) => {
        const s = getLinkEndId(l.source);
        const t = getLinkEndId(l.target);
        return s !== node.id && t !== node.id;
      })
    }));

    if (selectedNode && selectedNode.id === node.id) {
      setSelectedNode(null);
    }
    if (linkDraftSource && linkDraftSource.id === node.id) {
      setLinkDraftSource(null);
    }

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 선택된 노드들 일괄 삭제
  const handleDeleteSelectedNodes = () => {
    if (selectedNodes.size === 0) return;

    const confirmDelete = window.confirm(`선택된 ${selectedNodes.size}개 노드를 삭제하시겠습니까?`);
    if (!confirmDelete) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    setData((prev) => ({
      nodes: prev.nodes.filter((n) => !selectedNodes.has(n.id)),
      links: prev.links.filter((l) => {
        const s = getLinkEndId(l.source);
        const t = getLinkEndId(l.target);
        return !selectedNodes.has(s) && !selectedNodes.has(t);
      })
    }));

    // 선택된 노드 중 현재 선택된 노드가 있으면 해제
    if (selectedNode && selectedNodes.has(selectedNode.id)) {
      setSelectedNode(null);
    }
    if (linkDraftSource && selectedNodes.has(linkDraftSource.id)) {
      setLinkDraftSource(null);
    }

    // 선택 초기화
    setSelectedNodes(new Set());
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 링크 시작
  const handleStartLinkFromNode = () => {
    const node = contextMenu.target;
    if (!node) return;
    setLinkDraftSource(node);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 링크 시작 취소
  const handleCancelLinkDraft = () => {
    setLinkDraftSource(null);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 링크 생성 (linkDraftSource -> target) - 장비 노드인 경우 인터페이스 선택 모달 열기
  const handleCreateLinkToNode = () => {
    const target = contextMenu.target;
    if (!linkDraftSource || !target || linkDraftSource.id === target.id) return;

    // 둘 다 장비 노드인 경우 인터페이스 선택 모달 열기
    const sourceIsDevice = linkDraftSource.nodeType === 'device';
    const targetIsDevice = target.nodeType === 'device';

    if (sourceIsDevice && targetIsDevice) {
      // 인터페이스 선택 모달 열기
      setPendingLinkSource({ node: linkDraftSource, interface: null });
      setPendingLinkTarget({ node: target, interface: null });
      setInterfaceModalStep(1);
      setInterfaceModalOpen(true);
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    // 그룹 노드가 포함된 경우 기존 방식으로 링크 생성
    createLinkDirect(linkDraftSource.id, target.id, null, null);
  };

  // 직접 링크 생성 (인터페이스 정보 포함 가능)
  const createLinkDirect = (sourceId, targetId, srcIfIndex, dstIfIndex, srcIfName = null, dstIfName = null) => {
    const a = sourceId;
    const b = targetId;

    const exists = data.links.some((l) => {
      const s = getLinkEndId(l.source);
      const t = getLinkEndId(l.target);
      // 같은 노드 간에 같은 인터페이스 조합이 있는지 확인
      if ((s === a && t === b) || (s === b && t === a)) {
        // 인터페이스 정보가 있으면 인터페이스도 비교
        if (srcIfIndex !== null && dstIfIndex !== null) {
          return (l.srcIfIndex === srcIfIndex && l.dstIfIndex === dstIfIndex) ||
                 (l.srcIfIndex === dstIfIndex && l.dstIfIndex === srcIfIndex);
        }
        return true;
      }
      return false;
    });

    if (exists) {
      alert(`이미 해당 연결이 존재합니다.`);
      setLinkDraftSource(null);
      return;
    }

    const newId = `L${linkIdCounter.current++}`;
    const newLink = {
      id: newId,
      source: a,
      target: b,
      srcIfIndex: srcIfIndex,
      dstIfIndex: dstIfIndex,
      srcIfName: srcIfName,
      dstIfName: dstIfName,
      status: "up"
    };

    setData((prev) => ({
      ...prev,
      links: [...prev.links, newLink]
    }));

    setLinkDraftSource(null);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 인터페이스 선택 완료 후 링크 생성
  const handleInterfaceSelect = (port) => {
    if (interfaceModalStep === 1) {
      // source 인터페이스 선택 완료
      setPendingLinkSource(prev => ({
        ...prev,
        interface: port.IF_INDEX,
        interfaceName: port.IF_NAME || port.IF_DESCR || `Interface ${port.IF_INDEX}`
      }));
      setInterfaceModalStep(2);
    } else {
      // target 인터페이스 선택 완료 -> 링크 생성
      const srcIfIndex = pendingLinkSource?.interface;
      const srcIfName = pendingLinkSource?.interfaceName;
      const dstIfIndex = port.IF_INDEX;
      const dstIfName = port.IF_NAME || port.IF_DESCR || `Interface ${port.IF_INDEX}`;

      createLinkDirect(
        pendingLinkSource?.node?.id,
        pendingLinkTarget?.node?.id,
        srcIfIndex,
        dstIfIndex,
        srcIfName,
        dstIfName
      );

      // 모달 닫기 및 상태 초기화
      setInterfaceModalOpen(false);
      setInterfaceModalStep(1);
      setPendingLinkSource(null);
      setPendingLinkTarget(null);
    }
  };

  // 인터페이스 선택 모달 닫기
  const handleInterfaceModalClose = () => {
    setInterfaceModalOpen(false);
    setInterfaceModalStep(1);
    setPendingLinkSource(null);
    setPendingLinkTarget(null);
    setLinkDraftSource(null);
  };

  // 링크 삭제
  const handleDeleteLink = () => {
    const link = contextMenu.target;
    if (!link) return;

    setData((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l !== link)
    }));

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 토폴로지 저장 (백엔드 API)
  const handleSaveTopology = async () => {
    if (!currentTopologyGroupId) {
      alert('저장할 그룹이 선택되지 않았습니다.');
      return;
    }

    try {
      const graphData = data;

      // 노드 ID → 실제 deviceId/groupId 매핑 생성
      const nodeIdToRealId = {};
      graphData.nodes.forEach(n => {
        const nodeId = String(n.id);
        if (n.nodeType === 'device' && n.deviceId) {
          nodeIdToRealId[nodeId] = n.deviceId;
        } else if (n.nodeType === 'group' && n.groupId) {
          nodeIdToRealId[nodeId] = n.groupId;
        } else {
          // deviceId/groupId가 없으면 id 그대로 사용
          nodeIdToRealId[nodeId] = n.deviceId || n.groupId || n.id;
        }
      });

      const cleanNodes = graphData.nodes.map((n) => {
        // id를 deviceId 또는 groupId로 설정
        const realId = n.nodeType === 'device' ? n.deviceId : n.groupId;
        return {
          id: realId || n.id,
          deviceId: n.deviceId || null,
          groupId: n.groupId || null,
          name: n.name || "",
          type: n.type || "",
          nodeType: n.nodeType || "device",
          ip: n.ip || "",
          location: n.location || "",
          note: n.note || "",
          x: n.x,
          y: n.y,
          fx: n.fx ?? n.x,
          fy: n.fy ?? n.y
        };
      });

      const cleanLinks = graphData.links.map((l) => {
        const sourceNodeId = String(getLinkEndId(l.source));
        const targetNodeId = String(getLinkEndId(l.target));

        // 노드 ID를 실제 deviceId/groupId로 변환
        const sourceRealId = nodeIdToRealId[sourceNodeId] || sourceNodeId;
        const targetRealId = nodeIdToRealId[targetNodeId] || targetNodeId;

        return {
          source: sourceRealId,
          target: targetRealId,
          srcIfIndex: l.srcIfIndex || null,
          dstIfIndex: l.dstIfIndex || null,
          srcIfName: l.srcIfName || null,
          dstIfName: l.dstIfName || null,
          status: l.status || "up"
        };
      });

      const payload = {
        nodes: cleanNodes,
        links: cleanLinks
      };

      console.log('=== 저장 payload ===', payload);

      await saveTopologyMutation.mutateAsync({
        id: currentTopologyGroupId,
        type: currentTopologyType,
        data: payload
      });

      const nowStr = new Date().toLocaleString();
      setLastSavedAt(nowStr);

      // 저장 완료 후 편집 모드 종료
      setIsEditMode(false);
      setLinkDraftSource(null);

      alert("토폴로지 저장 완료");
    } catch (e) {
      console.error("topology save error", e);
      alert("저장 중 오류가 발생했습니다: " + (e.message || '알 수 없는 오류'));
    }
  };

  // 캔버스 클릭 시 컨텍스트 메뉴 닫기
  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }
  };

  // 노드 그리기
  const drawNode = (node, ctx, globalScale) => {
    const img = iconCache.current[node.type];
    const label = node.name || node.id;
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';
    const currentSelected = selectedNodesRef.current;
    const isMultiSelected = currentSelected.has(node.id);

    // 드래그 중인 경우 선택된 노드들의 위치 보정
    let drawX = node.x;
    let drawY = node.y;

    // 다중 선택 드래그 중이고, 이 노드가 드래그 중인 노드가 아닌 선택된 노드인 경우
    const offset = dragOffsetsRef.current[node.id];
    if (isDraggingNodesRef.current && draggingNodeRef.current && offset) {
      // 드래그 중인 노드 기준으로 위치 계산
      drawX = draggingNodeRef.current.x + offset.dx;
      drawY = draggingNodeRef.current.y + offset.dy;
      // 실제 노드 위치도 업데이트 (링크가 따라오도록)
      node.x = drawX;
      node.y = drawY;
      node.fx = drawX;
      node.fy = drawY;
    }

    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;

    // 다중 선택된 노드 표시 (초록색 테두리)
    if (isMultiSelected && isEditMode) {
      ctx.beginPath();
      if (isGroupNode) {
        const radius = 10;
        ctx.roundRect(drawX - half - 6, drawY - half - 6, size + 12, size + 12, radius);
      } else {
        ctx.arc(drawX, drawY, half + 8, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
      ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
      ctx.fill();
    }

    // 선택된 노드 배경 (단일 선택)
    if (selectedNode && selectedNode.id === node.id && !isMultiSelected) {
      ctx.beginPath();
      if (isGroupNode) {
        // 그룹은 둥근 사각형
        const radius = 8;
        ctx.roundRect(drawX - half - 5, drawY - half - 5, size + 10, size + 10, radius);
      } else {
        ctx.arc(drawX, drawY, size * 0.75, 0, 2 * Math.PI);
      }
      ctx.fillStyle = isGroupNode ? "rgba(139, 92, 246, 0.2)" : "rgba(0, 150, 255, 0.15)";
      ctx.fill();
    }

    // 링크 시작 노드 강조
    if (linkDraftSource && linkDraftSource.id === node.id) {
      ctx.beginPath();
      if (isGroupNode) {
        const radius = 8;
        ctx.roundRect(drawX - half - 2, drawY - half - 2, size + 4, size + 4, radius);
      } else {
        ctx.arc(drawX, drawY, size, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
      ctx.lineWidth = 3 / globalScale;
      ctx.stroke();
    }

    // 그룹 노드 그리기
    if (isGroupNode) {
      const radius = 6;

      // 배경
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.fillStyle = "#7c3aed";
      ctx.fill();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();

      // 폴더 아이콘 그리기
      const iconSize = size * 0.5;
      const iconX = drawX - iconSize / 2;
      const iconY = drawY - iconSize / 2;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      // 폴더 탭
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
    } else {
      // 장비 노드 그리기 (기존 로직)
      if (img && img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, drawX - half, drawY - half, size, size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
        ctx.fillStyle = "#4a90e2";
        ctx.fill();
      }
    }

    // 라벨
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2 / globalScale;

    const textY = drawY + half + 4;
    ctx.strokeText(label, drawX, textY);
    ctx.fillText(label, drawX, textY);
  };

  // 노드 클릭 영역
  const paintNodePointerArea = (node, color, ctx) => {
    const size = NODE_SIZE;
    const half = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(node.x - half, node.y - half, size, size);
    ctx.fill();
  };

  // 링크 색상
  const getLinkColor = (link) => {
    if (selectedLink && isSameLink(selectedLink, link)) {
      return "#ffeb3b";
    }

    if (link.status === "down") return "red";
    if (link.status === "warning") return "orange";
    return "#6aaeff";
  };

  // 노드 ID로 현재 위치 가져오기 (드래그 중인 노드 위치 반영)
  const getNodePosition = useCallback((nodeIdOrObj) => {
    const nodeId = typeof nodeIdOrObj === 'object' ? nodeIdOrObj?.id : nodeIdOrObj;
    if (!nodeId) return null;

    // 드래그 중인 메인 노드인 경우
    if (isDraggingNodesRef.current && draggingNodeRef.current?.id === nodeId) {
      return { x: draggingNodeRef.current.x, y: draggingNodeRef.current.y };
    }

    // 드래그 중인 다른 선택된 노드인 경우
    const offset = dragOffsetsRef.current[nodeId];
    if (isDraggingNodesRef.current && draggingNodeRef.current && offset) {
      return {
        x: draggingNodeRef.current.x + offset.dx,
        y: draggingNodeRef.current.y + offset.dy
      };
    }

    // 일반 노드 - data에서 찾기
    const node = data.nodes.find(n => n.id === nodeId);
    if (node) return { x: node.x, y: node.y };

    // 객체로 전달된 경우 직접 위치 사용
    if (typeof nodeIdOrObj === 'object') {
      return { x: nodeIdOrObj.x, y: nodeIdOrObj.y };
    }

    return null;
  }, [data.nodes]);

  // 링크 직접 그리기 함수
  const drawLink = useCallback((link, ctx, globalScale) => {
    const source = link.source;
    const target = link.target;

    if (!source || !target) return;

    // 드래그 중인 노드 위치 반영
    const sourcePos = getNodePosition(source);
    const targetPos = getNodePosition(target);

    if (!sourcePos || !targetPos) return;

    const color = getLinkColor(link);
    const isSelected = selectedLink && isSameLink(selectedLink, link);
    const width = isSelected ? 3 : 1.5;

    ctx.beginPath();
    ctx.moveTo(sourcePos.x, sourcePos.y);
    ctx.lineTo(targetPos.x, targetPos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / globalScale;
    ctx.stroke();
  }, [getNodePosition, selectedLink]);

  // 컨텍스트 메뉴 렌더
  const renderContextMenu = () => {
    if (!contextMenu.visible) return null;

    const { type, target } = contextMenu;

    const menuStyle = {
      position: "fixed",
      top: contextMenu.y,
      left: contextMenu.x,
      backgroundColor: "#1f2937",
      color: "white",
      borderRadius: 4,
      padding: "4px 0",
      fontSize: 12,
      zIndex: 1000,
      boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
      minWidth: 180
    };

    const itemStyle = {
      width: "100%",
      padding: "6px 10px",
      textAlign: "left",
      border: "none",
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      fontSize: 12
    };

    return (
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {type === "node" && (
          <>
            <div
              style={{
                padding: "4px 10px",
                fontSize: 11,
                opacity: 0.8,
                borderBottom: "1px solid #374151"
              }}
            >
              노드: {target?.name || target?.id}
              {isEditMode && selectedNodes.size > 1 && selectedNodes.has(target?.id) && (
                <span style={{ marginLeft: 8, color: "#22c55e" }}>
                  (+{selectedNodes.size - 1}개 선택됨)
                </span>
              )}
            </div>

            {/* 편집 모드에서만 삭제/링크 옵션 표시 */}
            {isEditMode && (
              <>
                {/* 다중 선택된 경우 일괄 삭제 버튼 표시 */}
                {selectedNodes.size > 1 && selectedNodes.has(target?.id) ? (
                  <button
                    style={{ ...itemStyle, color: "#ef4444" }}
                    onClick={handleDeleteSelectedNodes}
                  >
                    선택된 {selectedNodes.size}개 노드 삭제
                  </button>
                ) : (
                  <button style={itemStyle} onClick={handleDeleteNode}>
                    노드 삭제
                  </button>
                )}

                {!linkDraftSource && (
                  <button style={itemStyle} onClick={handleStartLinkFromNode}>
                    이 노드에서 링크 시작
                  </button>
                )}

                {linkDraftSource && linkDraftSource.id === target?.id && (
                  <button style={itemStyle} onClick={handleCancelLinkDraft}>
                    링크 시작 취소
                  </button>
                )}

                {linkDraftSource && linkDraftSource.id !== target?.id && (
                  <button style={itemStyle} onClick={handleCreateLinkToNode}>
                    {linkDraftSource.name || linkDraftSource.id} →{" "}
                    {target?.name || target?.id} 링크 생성
                  </button>
                )}
              </>
            )}

            {/* 장비 노드인 경우 상세정보 보기 옵션 (기본 모드에서도 표시) */}
            {target?.nodeType === 'device' && (
              <button
                style={itemStyle}
                onClick={() => {
                  const deviceId = target.deviceId || target.id;
                  if (deviceId) {
                    setDeviceModalId(deviceId);
                    setDeviceModalOpen(true);
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
              >
                <i className="bi bi-info-circle" style={{ marginRight: 6 }}></i>
                장비 상세정보 보기
              </button>
            )}
          </>
        )}

        {type === "link" && (
          <>
            <div
              style={{
                padding: "8px 10px",
                fontSize: 11,
                opacity: 0.8,
                borderBottom: "1px solid #374151"
              }}
            >
              <div style={{ marginBottom: 4 }}>
                링크 ID: {target?.id || ""}
              </div>
              {/* 인터페이스 정보가 있으면 인터페이스명 표시 */}
              {(target?.srcIfName || target?.dstIfName) ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                  padding: '4px 6px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: 4
                }}>
                  <span style={{ color: '#60a5fa' }}>{target?.srcIfName || `IF:${target?.srcIfIndex}`}</span>
                  <i className="bi bi-arrow-right" style={{ fontSize: 10 }}></i>
                  <span style={{ color: '#60a5fa' }}>{target?.dstIfName || `IF:${target?.dstIfIndex}`}</span>
                </div>
              ) : (
                <div style={{ opacity: 0.6 }}>
                  {getLinkEndId(target?.source)} → {getLinkEndId(target?.target)}
                </div>
              )}
            </div>
            <button style={itemStyle} onClick={handleDeleteLink}>
              링크 삭제
            </button>
          </>
        )}
      </div>
    );
  };

  // 노드 상세 정보 패널
  const renderNodeDetailPanel = () => {
    if (!selectedNode) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 11,
          width: 260,
          backgroundColor: "#1f2937",
          borderRadius: 8,
          padding: "10px 12px",
          color: "white",
          fontSize: 12,
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>노드 상세 정보</span>
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 11
            }}
          >
            X
          </button>
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>이름</strong> : {selectedNode.name || selectedNode.id}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>ID</strong> : {selectedNode.id}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>타입</strong> : {selectedNode.type || "-"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>IP</strong> : {selectedNode.ip || "-"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>위치</strong> : {selectedNode.location || "-"}
        </div>
        <div style={{ marginBottom: 4 }}>
          <strong>설명</strong> : {selectedNode.note || "-"}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
          {isEditMode
            ? "편집 모드: 우클릭으로 노드/링크 편집 가능"
            : "조회 모드: 노드 클릭 시 상세 정보만 표시"}
        </div>
      </div>
    );
  };

  // 링크 상세 정보 패널
  const renderLinkDetailPanel = () => {
    if (!selectedLink) return null;

    // 소스/타겟 노드 정보 가져오기
    const sourceId = getLinkEndId(selectedLink.source);
    const targetId = getLinkEndId(selectedLink.target);
    const sourceNode = data.nodes.find(n => n.id === sourceId);
    const targetNode = data.nodes.find(n => n.id === targetId);

    const sourceName = sourceNode?.name || sourceId;
    const targetName = targetNode?.name || targetId;

    // 둘 다 장비 노드인 경우에만 인터페이스 정보 표시
    const sourceIsDevice = sourceNode?.nodeType === 'device';
    const targetIsDevice = targetNode?.nodeType === 'device';
    const showInterfaceInfo = sourceIsDevice && targetIsDevice;

    const srcIfName = selectedLink.srcIfName || (selectedLink.srcIfIndex ? `IF:${selectedLink.srcIfIndex}` : '-');
    const dstIfName = selectedLink.dstIfName || (selectedLink.dstIfIndex ? `IF:${selectedLink.dstIfIndex}` : '-');

    return (
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 11,
          width: 320,
          backgroundColor: "#1f2937",
          borderRadius: 8,
          padding: "12px 14px",
          color: "white",
          fontSize: 12,
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>
            <i className="bi bi-link-45deg" style={{ marginRight: 6 }}></i>
            링크 정보
          </span>
          <button
            onClick={() => setSelectedLink(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 11
            }}
          >
            X
          </button>
        </div>

        {/* 연결 시각화 */}
        <div
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12
          }}
        >
          {/* 소스 노드 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: sourceIsDevice ? "#3b82f6" : "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <i className={`bi ${sourceIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 14 }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: sourceIsDevice ? "#60a5fa" : "#a78bfa" }}>{sourceName}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{sourceIsDevice ? (sourceNode?.ip || '-') : '그룹'}</div>
            </div>
          </div>

          {/* 인터페이스 연결 표시 (장비-장비 링크만) */}
          {showInterfaceInfo ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "8px 0",
                borderTop: "1px dashed rgba(255,255,255,0.1)",
                borderBottom: "1px dashed rgba(255,255,255,0.1)",
                margin: "8px 0"
              }}
            >
              <div
                style={{
                  background: "#3b82f6",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500
                }}
              >
                {srcIfName}
              </div>
              <div style={{ display: "flex", alignItems: "center", color: "#6b7280" }}>
                <i className="bi bi-arrow-down" style={{ fontSize: 16 }}></i>
              </div>
              <div
                style={{
                  background: "#f59e0b",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500
                }}
              >
                {dstIfName}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 0",
                borderTop: "1px dashed rgba(255,255,255,0.1)",
                borderBottom: "1px dashed rgba(255,255,255,0.1)",
                margin: "8px 0",
                color: "#6b7280"
              }}
            >
              <i className="bi bi-arrow-down" style={{ fontSize: 16 }}></i>
            </div>
          )}

          {/* 타겟 노드 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: targetIsDevice ? "#f59e0b" : "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <i className={`bi ${targetIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 14 }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: targetIsDevice ? "#fbbf24" : "#a78bfa" }}>{targetName}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{targetIsDevice ? (targetNode?.ip || '-') : '그룹'}</div>
            </div>
          </div>
        </div>

        {/* 상세 정보 */}
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>상태</span>
            <span style={{
              color: selectedLink.status === 'up' ? '#22c55e' :
                     selectedLink.status === 'down' ? '#ef4444' : '#f59e0b'
            }}>
              {selectedLink.status === 'up' ? 'UP' :
               selectedLink.status === 'down' ? 'DOWN' : selectedLink.status || '-'}
            </span>
          </div>
          {showInterfaceInfo && srcIfName && srcIfName !== '-' && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>출발지 인터페이스</span>
              <span style={{ color: "#60a5fa" }}>{srcIfName}</span>
            </div>
          )}
          {showInterfaceInfo && dstIfName && dstIfName !== '-' && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>목적지 인터페이스</span>
              <span style={{ color: "#fbbf24" }}>{dstIfName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 장비 상세정보 모달 렌더링
  const renderDeviceModal = () => {
    if (!deviceModalOpen) return null;

    const device = deviceDetailData?.data || deviceDetailData;

    return (
      <div className="topology-modal-overlay" onClick={() => setDeviceModalOpen(false)}>
        <div className="topology-modal" onClick={(e) => e.stopPropagation()}>
          <div className="topology-modal-header">
            <h3>장비 상세 정보</h3>
            <button
              className="topology-modal-close"
              onClick={() => setDeviceModalOpen(false)}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="topology-modal-content">
            {deviceLoading ? (
              <div className="topology-modal-loading">
                <i className="bi bi-arrow-repeat spinning"></i>
                <span>로딩 중...</span>
              </div>
            ) : deviceError ? (
              <div className="topology-modal-error">
                <i className="bi bi-exclamation-triangle"></i>
                <span>장비 정보를 불러올 수 없습니다.</span>
              </div>
            ) : device ? (
              <div className="topology-modal-device-info">
                <div className="topology-modal-section">
                  <h4>기본 정보</h4>
                  <div className="topology-modal-row">
                    <span className="label">장비명</span>
                    <span className="value">{device.DEVICE_NAME || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">시스템명</span>
                    <span className="value">{device.DEVICE_SYSTEM_NAME || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">IP 주소</span>
                    <span className="value">{device.DEVICE_IP || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">장비 ID</span>
                    <span className="value">{device.DEVICE_ID || '-'}</span>
                  </div>
                </div>

                <div className="topology-modal-section">
                  <h4>모델 정보</h4>
                  <div className="topology-modal-row">
                    <span className="label">제조사</span>
                    <span className="value">{device.VENDOR_NAME || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">모델명</span>
                    <span className="value">{device.MODEL_NAME || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">포트 수</span>
                    <span className="value">{device.PORT_COUNT || '-'}</span>
                  </div>
                </div>

                <div className="topology-modal-section">
                  <h4>SNMP 정보</h4>
                  <div className="topology-modal-row">
                    <span className="label">SNMP 버전</span>
                    <span className="value">v{device.SNMP_VERSION || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">SNMP 포트</span>
                    <span className="value">{device.SNMP_PORT || '-'}</span>
                  </div>
                  <div className="topology-modal-row">
                    <span className="label">커뮤니티</span>
                    <span className="value">{device.SNMP_COMMUNITY || '-'}</span>
                  </div>
                </div>

                {device.DEVICE_DESC && (
                  <div className="topology-modal-section">
                    <h4>설명</h4>
                    <div className="topology-modal-desc">
                      {device.DEVICE_DESC}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="topology-modal-error">
                <span>장비 정보가 없습니다.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 인터페이스 선택 모달 렌더링
  const renderInterfaceModal = () => {
    if (!interfaceModalOpen) return null;

    const isSourceStep = interfaceModalStep === 1;
    const currentNode = isSourceStep ? pendingLinkSource?.node : pendingLinkTarget?.node;
    const currentPorts = isSourceStep ? sourcePorts : targetPorts;
    const isLoading = isSourceStep ? sourcePortsLoading : targetPortsLoading;
    const ports = currentPorts?.content || currentPorts || [];

    return (
      <div className="topology-modal-overlay" onClick={handleInterfaceModalClose}>
        <div className="topology-modal topology-interface-modal" onClick={(e) => e.stopPropagation()}>
          <div className="topology-modal-header">
            <h3>
              <i className="bi bi-link-45deg" style={{ marginRight: 8 }}></i>
              인터페이스 선택
            </h3>
            <button
              className="topology-modal-close"
              onClick={handleInterfaceModalClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* 연결 상태 표시 */}
          <div className="topology-interface-link-info">
            <div className={`topology-interface-node ${isSourceStep ? 'active' : 'completed'}`}>
              <i className="bi bi-hdd-network"></i>
              <span>{pendingLinkSource?.node?.name || '장비 1'}</span>
              {pendingLinkSource?.interface && (
                <span className="topology-interface-selected">
                  (IF: {pendingLinkSource.interface})
                </span>
              )}
            </div>
            <div className="topology-interface-arrow">
              <i className="bi bi-arrow-right"></i>
            </div>
            <div className={`topology-interface-node ${!isSourceStep ? 'active' : ''}`}>
              <i className="bi bi-hdd-network"></i>
              <span>{pendingLinkTarget?.node?.name || '장비 2'}</span>
            </div>
          </div>

          <div className="topology-modal-content">
            <div className="topology-interface-step-info">
              <span className="topology-interface-step-badge">
                {isSourceStep ? 'Step 1/2' : 'Step 2/2'}
              </span>
              <span className="topology-interface-step-text">
                {isSourceStep
                  ? `${currentNode?.name || '소스 장비'}의 인터페이스를 선택하세요`
                  : `${currentNode?.name || '대상 장비'}의 인터페이스를 선택하세요`
                }
              </span>
            </div>

            {isLoading ? (
              <div className="topology-modal-loading">
                <i className="bi bi-arrow-repeat spinning"></i>
                <span>인터페이스 목록 로딩 중...</span>
              </div>
            ) : ports.length > 0 ? (
              <div className="topology-interface-list">
                {ports.map((port) => (
                  <div
                    key={port.IF_INDEX}
                    className="topology-interface-item"
                    onClick={() => handleInterfaceSelect(port)}
                  >
                    <div className="topology-interface-icon">
                      <i className={`bi ${port.IF_OPER_STATUS === 1 ? 'bi-ethernet text-success' : 'bi-ethernet text-muted'}`}></i>
                    </div>
                    <div className="topology-interface-info">
                      <div className="topology-interface-name">
                        {port.IF_NAME || port.IF_DESCR || `Interface ${port.IF_INDEX}`}
                      </div>
                      <div className="topology-interface-details">
                        <span className="topology-interface-index">Index: {port.IF_INDEX}</span>
                        {port.IF_SPEED && (
                          <span className="topology-interface-speed">
                            {port.IF_SPEED >= 1000000000
                              ? `${(port.IF_SPEED / 1000000000).toFixed(0)} Gbps`
                              : port.IF_SPEED >= 1000000
                                ? `${(port.IF_SPEED / 1000000).toFixed(0)} Mbps`
                                : `${port.IF_SPEED} bps`
                            }
                          </span>
                        )}
                        <span className={`topology-interface-status ${port.IF_OPER_STATUS === 1 ? 'up' : 'down'}`}>
                          {port.IF_OPER_STATUS === 1 ? 'Up' : 'Down'}
                        </span>
                      </div>
                    </div>
                    <div className="topology-interface-select-icon">
                      <i className="bi bi-chevron-right"></i>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="topology-modal-error">
                <i className="bi bi-exclamation-circle"></i>
                <span>인터페이스가 없습니다.</span>
              </div>
            )}
          </div>

          <div className="topology-modal-footer">
            {!isSourceStep && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setInterfaceModalStep(1);
                  setPendingLinkSource(prev => ({ ...prev, interface: null }));
                }}
              >
                <i className="bi bi-arrow-left"></i>
                이전
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleInterfaceModalClose}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 사이드바에서 장비 선택 시
  const handleSidebarDeviceSelect = (device) => {
    setSelectedSidebarDevice(device);
    // 토폴로지에 해당 장비가 있으면 선택
    const node = data.nodes.find(
      (n) => n.ip === device.DEVICE_IP || n.name === device.DEVICE_NAME
    );
    if (node) {
      setSelectedNode(node);
      // 해당 노드로 화면 이동
      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 500);
      }
    }
  };

  // 다중 장비 추가 핸들러
  const handleAddMultipleDevices = (devices) => {
    if (!isEditMode || !graphRef.current) return;

    const newNodes = [];
    const startX = 0;
    const startY = 0;
    const spacing = 100;
    const columns = Math.ceil(Math.sqrt(devices.length));

    devices.forEach((device, index) => {
      // 이미 존재하는지 확인
      const exists = data.nodes.some(
        (n) => n.deviceId === device.DEVICE_ID || n.ip === device.DEVICE_IP
      );

      if (!exists) {
        const row = Math.floor(index / columns);
        const col = index % columns;

        const newNode = {
          id: `D${device.DEVICE_ID}`,
          deviceId: device.DEVICE_ID,
          name: device.DEVICE_NAME || device.DEVICE_SYSTEM_NAME || `Device ${device.DEVICE_ID}`,
          type: device.MODEL_NAME || 'Unknown',
          nodeType: 'device',
          ip: device.DEVICE_IP || '',
          location: '',
          note: device.DEVICE_DESC || '',
          x: startX + col * spacing,
          y: startY + row * spacing,
          fx: startX + col * spacing,
          fy: startY + row * spacing
        };

        newNodes.push(newNode);
      }
    });

    if (newNodes.length > 0) {
      setData((prev) => ({
        ...prev,
        nodes: [...prev.nodes, ...newNodes]
      }));

      // 추가된 노드들이 보이도록 줌 조정
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400, 50);
        }
      }, 100);
    }

    if (newNodes.length < devices.length) {
      const skipped = devices.length - newNodes.length;
      alert(`${newNodes.length}개 장비가 추가되었습니다. (${skipped}개는 이미 존재)`);
    }
  };

  // 드래그 오버 핸들러 (드롭 허용)
  const handleDragOver = (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // 드래그 오버 시각적 피드백
    if (containerRef.current) {
      containerRef.current.classList.add('drag-over');
    }
  };

  // 드래그 떠날 때
  const handleDragLeave = (e) => {
    if (containerRef.current) {
      containerRef.current.classList.remove('drag-over');
    }
  };

  // 드롭 핸들러 - 장비 또는 그룹을 토폴로지에 추가
  const handleDrop = (e) => {
    if (!isEditMode || !graphRef.current) return;
    e.preventDefault();

    // 드래그 오버 클래스 제거
    if (containerRef.current) {
      containerRef.current.classList.remove('drag-over');
    }

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const draggedItem = JSON.parse(jsonData);

      // 드롭 위치를 그래프 좌표로 변환
      const rect = containerRef.current.getBoundingClientRect();
      const graphCoords = graphRef.current.screen2GraphCoords(
        e.clientX - rect.left,
        e.clientY - rect.top
      );

      // 그룹인 경우
      if (draggedItem._dragType === 'group') {
        const group = draggedItem;

        // 이미 존재하는 그룹인지 확인
        const exists = data.nodes.some(
          (n) => n.groupId === group.GROUP_ID
        );

        if (exists) {
          alert(`이미 토폴로지에 존재하는 그룹입니다: ${group.GROUP_NAME}`);
          return;
        }

        // 새 그룹 노드 생성
        const newId = `G${group.GROUP_ID}`;
        const newNode = {
          id: newId,
          groupId: group.GROUP_ID,
          name: group.GROUP_NAME,
          type: 'group',
          nodeType: 'group',
          ip: '',
          location: group.ADDRESS || '',
          note: '',
          x: graphCoords.x,
          y: graphCoords.y,
          fx: graphCoords.x,
          fy: graphCoords.y
        };

        setData((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newNode]
        }));

        setSelectedNode(newNode);
        return;
      }

      // 장비인 경우
      const device = draggedItem;

      // 이미 존재하는 장비인지 확인
      const exists = data.nodes.some(
        (n) => n.deviceId === device.DEVICE_ID || n.ip === device.DEVICE_IP
      );

      if (exists) {
        alert(`이미 토폴로지에 존재하는 장비입니다: ${device.DEVICE_NAME}`);
        return;
      }

      // 새 노드 생성
      const newId = `D${device.DEVICE_ID}`;
      const newNode = {
        id: newId,
        deviceId: device.DEVICE_ID,
        name: device.DEVICE_NAME || device.DEVICE_SYSTEM_NAME || `Device ${device.DEVICE_ID}`,
        type: device.MODEL_NAME || 'Unknown',
        nodeType: 'device',
        ip: device.DEVICE_IP || '',
        location: '',
        note: device.DEVICE_DESC || '',
        x: graphCoords.x,
        y: graphCoords.y,
        fx: graphCoords.x,
        fy: graphCoords.y
      };

      setData((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode]
      }));

      // 새로 추가된 노드 선택
      setSelectedNode(newNode);
    } catch (err) {
      console.error('드롭 처리 오류:', err);
    }
  };

  return (
    <div className="topology-page-wrapper">
      {/* 토폴로지 전용 사이드바 */}
      {!sidebarCollapsed && (
        <div className="topology-sidebar-wrapper">
          <TopologySidebar
            onSelectDevice={handleSidebarDeviceSelect}
            selectedDevice={selectedSidebarDevice}
            isEditMode={isEditMode}
            onAddMultipleDevices={handleAddMultipleDevices}
            onGroupSelect={handleGroupSelect}
          />
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="topology-main-content">
        {/* 상단 툴바 */}
        <div className="topology-toolbar">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn btn-secondary"
            title={sidebarCollapsed ? "사이드바 표시" : "사이드바 숨기기"}
          >
            <i className={`bi ${sidebarCollapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`}></i>
          </button>

          {/* 뒤로 가기 버튼 */}
          {topologyHistory.length > 0 && (
            <button
              onClick={() => {
                const prev = topologyHistory[topologyHistory.length - 1];
                setTopologyHistory(h => h.slice(0, -1));
                setData({ nodes: [], links: [] });
                setCurrentTopologyGroupId(prev.groupId);
                setCurrentTopologyType(prev.type || 'group');
                setCurrentTopologyGroupName(prev.groupName);
                setSelectedNode(null);
                setSelectedLink(null);
                setSelectedNodes(new Set());
                setLinkDraftSource(null);
                if (prev.type === 'group') {
                  const groupInfo = { GROUP_ID: prev.groupId, GROUP_NAME: prev.groupName };
                  setSelectedGroup(groupInfo);
                }
              }}
              className="btn btn-secondary"
              title="이전 토폴로지로 돌아가기"
            >
              <i className="bi bi-arrow-left"></i>
            </button>
          )}

          {/* 현재 토폴로지 그룹 표시 */}
          {currentTopologyGroupName && (
            <div className="topology-current-group">
              <i className="bi bi-diagram-3"></i>
              <span>{currentTopologyGroupName}</span>
            </div>
          )}

          <div className="topology-toolbar-divider"></div>

          <button
            onClick={toggleEditMode}
            className={`btn ${isEditMode ? "btn-warning" : "btn-secondary"}`}
          >
            <i className={`bi ${isEditMode ? "bi-x-lg" : "bi-pencil"}`}></i>
            {isEditMode ? "편집 종료" : "편집 모드"}
          </button>

          {isEditMode && (
            <button
              onClick={handleSaveTopology}
              className="btn btn-success"
              disabled={saveTopologyMutation.isPending}
            >
              <i className={`bi ${saveTopologyMutation.isPending ? 'bi-arrow-repeat spinning' : 'bi-save'}`}></i>
              {saveTopologyMutation.isPending ? '저장 중...' : '저장'}
            </button>
          )}

          {lastSavedAt && (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              마지막 저장: {lastSavedAt}
            </span>
          )}

          {linkDraftSource && (
            <span className="topology-link-draft-badge">
              링크 시작 노드: {linkDraftSource.name || linkDraftSource.id}
            </span>
          )}

          {isEditMode && selectedNodes.size > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span style={{
                padding: "4px 10px",
                borderRadius: 4,
                backgroundColor: "rgba(34, 197, 94, 0.2)",
                color: "#22c55e",
                fontSize: 12,
                fontWeight: 500
              }}>
                {selectedNodes.size}개 노드 선택됨
              </span>
              <button
                onClick={handleDeleteSelectedNodes}
                className="btn btn-danger"
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                <i className="bi bi-trash"></i> 선택 삭제
              </button>
              <button
                onClick={() => setSelectedNodes(new Set())}
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                선택 해제
              </button>
            </div>
          )}

          {/* 로딩 상태 표시 */}
          {topologyLoading && (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              <i className="bi bi-arrow-repeat spinning"></i> 토폴로지 로딩 중...
            </span>
          )}
        </div>

        {/* 토폴로지 캔버스 */}
        <div
          ref={containerRef}
          className={`topology-canvas-container ${isEditMode ? 'edit-mode' : ''}`}
          onClick={closeContextMenu}
          onContextMenu={handleBackgroundContextMenu}
          onMouseDown={handleMouseDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 선택 영역 표시 */}
          {isSelecting && selectionBox && (
            <div
              className="topology-selection-box"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY)
              }}
            />
          )}

          {/* 링크 상세 정보 패널 */}
          {renderLinkDetailPanel()}

          <ForceGraph2D
            key={`topology-${currentTopologyGroupId}`}
            ref={graphRef}
            graphData={data}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0f172a"
            nodeLabel="name"
            nodeCanvasObject={drawNode}
            nodeCanvasObjectMode={() => "replace"}
            nodePointerAreaPaint={paintNodePointerArea}
            linkSource="source"
            linkTarget="target"
            linkCanvasObject={drawLink}
            linkCanvasObjectMode={() => "replace"}
            linkDirectionalArrowLength={0}
            enableZoomInteraction={true}
            enablePanInteraction={!isSelecting}
            enablePointerInteraction={true}
            enableNodeDrag={isEditMode}
            minZoom={0.5}
            maxZoom={4}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onLinkRightClick={handleLinkRightClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onLinkClick={handleLinkClick}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setSelectedLink(null);
              setSelectedNodes(new Set());
            }}
          />
        </div>

        {renderContextMenu()}
      </div>

      {/* 장비 상세정보 모달 */}
      {renderDeviceModal()}

      {/* 인터페이스 선택 모달 */}
      {renderInterfaceModal()}
    </div>
  );
}
