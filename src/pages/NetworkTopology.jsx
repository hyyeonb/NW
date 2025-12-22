import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import TopologySidebar from "../components/TopologySidebar";
import { useDevice, useDevicePorts, useTopologyView, useSaveTopology, useGroupTree, useDevicesByGroup } from "../hooks";
import { topologyApi } from "../api";
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
  const [searchParams, setSearchParams] = useSearchParams();

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

  // 토폴로지에 등록된 장비 ID Set (사이드바에서 미등록 장비 표시용)
  const registeredDeviceIds = useMemo(() => {
    const ids = new Set();
    data.nodes.forEach(node => {
      if (node.nodeType === 'device' || node.deviceId) {
        // deviceId가 있으면 추가
        if (node.deviceId) {
          ids.add(String(node.deviceId));
        }
        // id에서 device_ 접두사 제거한 값도 추가
        if (node.id && node.id.startsWith('device_')) {
          ids.add(node.id.replace('device_', ''));
        }
      }
    });
    return ids;
  }, [data.nodes]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [linkDraftSource, setLinkDraftSource] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // 초기 진입 시 사이드바 숨김
  const [selectedSidebarDevice, setSelectedSidebarDevice] = useState(null);
  const [isGroupSwitching, setIsGroupSwitching] = useState(false); // 그룹 전환 중 상태
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceModalId, setDeviceModalId] = useState(null);
  const [deviceModalTab, setDeviceModalTab] = useState('device-info'); // 장비 상세 모달 탭

  // 배경 이미지 관련 상태
  const [backgroundImage, setBackgroundImage] = useState(null);
  const backgroundImageRef = useRef(null);

  // 배경 이미지 변경 모달 상태
  const [bgImageModalOpen, setBgImageModalOpen] = useState(false);
  const [bgImageInput, setBgImageInput] = useState('');
  const [bgImageSaving, setBgImageSaving] = useState(false);

  // 노드 이미지 변경 모달 상태
  const [nodeImageModalOpen, setNodeImageModalOpen] = useState(false);
  const [nodeImageTarget, setNodeImageTarget] = useState(null); // 이미지 변경할 노드
  const [nodeImageInput, setNodeImageInput] = useState('');
  const [nodeImageSaving, setNodeImageSaving] = useState(false);

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

  // 현재 그룹의 장비 목록 조회 (빈 토폴로지 시 장비 자동 추가용)
  const { data: currentGroupDevices, isLoading: devicesLoading } = useDevicesByGroup(
    currentTopologyType === 'group' ? currentTopologyGroupId : null
  );

  // 빈 토폴로지 확인 팝업 표시 여부
  const [showEmptyTopologyPrompt, setShowEmptyTopologyPrompt] = useState(false);
  const emptyTopologyCheckedRef = useRef(null); // 이미 확인한 그룹 ID 저장

  // 커스텀 모달 상태
  const [customModal, setCustomModal] = useState({
    visible: false,
    type: 'alert', // 'alert' | 'confirm' | 'success' | 'error' | 'warning'
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  // 커스텀 alert 함수
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

  // 커스텀 confirm 함수 (Promise 반환)
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
  const groupIconCache = useRef({}); // 그룹 아이콘 Base64 이미지 캐시

  // 장비 상세정보 API 호출
  const { data: deviceDetailData, isLoading: deviceLoading, error: deviceError } = useDevice(deviceModalId);
  // 장비 상세 모달용 포트 정보 조회
  const { data: deviceModalPorts, isLoading: devicePortsLoading } = useDevicePorts(deviceModalId);

  // 인터페이스 모달에서 사용할 포트 정보 조회
  const sourceDeviceId = interfaceModalOpen && pendingLinkSource?.node?.deviceId ? pendingLinkSource.node.deviceId : null;
  const targetDeviceId = interfaceModalOpen && pendingLinkTarget?.node?.deviceId ? pendingLinkTarget.node.deviceId : null;
  const { data: sourcePorts, isLoading: sourcePortsLoading } = useDevicePorts(sourceDeviceId);
  const { data: targetPorts, isLoading: targetPortsLoading } = useDevicePorts(targetDeviceId);

  // 링크 end(source/target)가 문자열일 수도, 객체일 수도 있어서 id만 뽑는 함수
  const getLinkEndId = (end) =>
    typeof end === "object" && end !== null ? end.id : end;

  // 링크 end의 nodeType 뽑는 함수
  const getLinkEndType = (end) =>
    typeof end === "object" && end !== null ? (end.nodeType || 'device') : null;

  // 노드 고유 키 생성 (nodeType + id 조합으로 device_28과 group_28 구분)
  const getNodeKey = (node) => {
    if (!node) return "";
    const nodeType = node.nodeType || 'device';
    return `${nodeType}_${node.id}`;
  };

  // 두 노드가 같은지 비교 (id와 nodeType 모두 일치해야 함)
  const isSameNode = (a, b) => {
    if (!a || !b) return false;
    return a.id === b.id && (a.nodeType || 'device') === (b.nodeType || 'device');
  };

  // 선택된 링크 비교용 키 (nodeType 포함)
  const getLinkKey = (link) => {
    if (!link) return "";
    const s = getLinkEndId(link.source);
    const t = getLinkEndId(link.target);
    const sType = link.srcType || getLinkEndType(link.source) || 'device';
    const tType = link.dstType || getLinkEndType(link.target) || 'device';
    return `${sType}_${s}__${tType}_${t}`;
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

    // 사이드바 토글 후 크기 재계산 및 배경 이미지 기준 줌 조정
    const timer = setTimeout(() => {
      updateDimensions();

      // 배경 이미지가 있으면 전체 보이도록 줌 조정
      if (graphRef.current && containerRef.current && backgroundImageRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        const imgWidth = backgroundImageRef.current.naturalWidth;
        const imgHeight = backgroundImageRef.current.naturalHeight;

        // 줌 1로 설정 (배경 이미지 자체가 축소되어 있음)
        graphRef.current.centerAt(0, 0, 0);
        graphRef.current.zoom(1, 0);
      }
    }, 150);

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

  // 그룹 트리에서 그룹 찾기 (재귀적으로 하위 그룹도 검색)
  const findGroupInTree = useCallback((groups, targetId) => {
    if (!groups) return null;
    for (const group of groups) {
      if (String(group.GROUP_ID) === String(targetId)) {
        return group;
      }
      if (group.children && group.children.length > 0) {
        const found = findGroupInTree(group.children, targetId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // URL 파라미터에서 groupId 처리 (우선순위 높음)
  useEffect(() => {
    const urlGroupId = searchParams.get('groupId');
    console.log('NetworkTopology: URL groupId:', urlGroupId, 'groupTree:', groupTree?.length);

    if (urlGroupId && groupTree && groupTree.length > 0) {
      // 재귀적으로 그룹 찾기
      const targetGroup = findGroupInTree(groupTree, urlGroupId);
      console.log('NetworkTopology: 찾은 그룹:', targetGroup);

      if (targetGroup) {
        setCurrentTopologyGroupId(targetGroup.GROUP_ID);
        setCurrentTopologyGroupName(targetGroup.GROUP_NAME);
        setCurrentTopologyType('group');
        setSelectedGroup(targetGroup);
        setTopologyHistory([]); // 히스토리 초기화
        // URL 파라미터 제거
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, groupTree, setSelectedGroup, setSearchParams, findGroupInTree]);

  // 최상위 그룹 ID 설정 (그룹 트리 로드 후, URL 파라미터가 없을 때만)
  useEffect(() => {
    if (groupTree && groupTree.length > 0 && !currentTopologyGroupId && !searchParams.get('groupId')) {
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
  }, [groupTree, currentTopologyGroupId, selectedGroup, setSelectedGroup, searchParams]);

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

      initialFitDone.current = false; // 새 데이터 로드 시 줌 재조정

      // 배경 이미지 설정 (BACK_ICON_DATA 또는 backIconData)
      const bgData = topologyData.backIconData || topologyData.BACK_ICON_DATA;
      console.log('=== 배경 이미지 원본 데이터 (처음 200자) ===', bgData ? bgData.substring(0, 200) : null);
      console.log('=== 배경 이미지 데이터 타입 ===', typeof bgData);

      // 배경 이미지 처리 및 전환 완료 함수
      const finishTransition = (hasBackgroundImage = false, bgImg = null, bgImgSrc = null) => {
        // 노드 아이콘 캐시 초기화 (새 토폴로지의 이미지를 새로 로드하도록)
        groupIconCache.current = {};

        // 배경 이미지 설정 (먼저 설정해야 렌더링 시 반영됨)
        if (hasBackgroundImage && bgImg) {
          backgroundImageRef.current = bgImg;
          setBackgroundImage(bgImgSrc);
        } else {
          backgroundImageRef.current = null;
          setBackgroundImage(null);
        }

        // 데이터 설정
        setData({ nodes: fixedNodes, links: validLinks });

        // 렌더링이 완료된 후 줌/센터 설정하고 페이드 인
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // 줌/센터 설정 (아직 투명 상태에서)
            if (graphRef.current) {
              if (hasBackgroundImage) {
                graphRef.current.centerAt(0, 0, 0);
                graphRef.current.zoom(1, 0);
              } else if (fixedNodes.length > 0) {
                // 배경 없으면 노드 중심으로 이동
                const avgX = fixedNodes.reduce((sum, n) => sum + (n.x || 0), 0) / fixedNodes.length;
                const avgY = fixedNodes.reduce((sum, n) => sum + (n.y || 0), 0) / fixedNodes.length;
                graphRef.current.centerAt(avgX, avgY, 0);
              }
            }
            // 한 프레임 더 기다린 후 페이드 인
            setTimeout(() => {
              setIsGroupSwitching(false);
            }, 50);
          });
        });
      };

      if (bgData) {
        // data: 접두사 확인 및 적절한 MIME 타입 처리
        let imgSrc;
        if (bgData.startsWith('data:')) {
          imgSrc = bgData;
        } else if (bgData.startsWith('/9j/')) {
          // JPEG 시그니처
          imgSrc = `data:image/jpeg;base64,${bgData}`;
        } else if (bgData.startsWith('iVBOR')) {
          // PNG 시그니처
          imgSrc = `data:image/png;base64,${bgData}`;
        } else if (bgData.startsWith('R0lGOD')) {
          // GIF 시그니처
          imgSrc = `data:image/gif;base64,${bgData}`;
        } else if (bgData.startsWith('PHN2Zy') || bgData.startsWith('PD94bW')) {
          // SVG 시그니처 (<svg 또는 <?xml)
          imgSrc = `data:image/svg+xml;base64,${bgData}`;
        } else {
          // 기본 PNG로 시도
          imgSrc = `data:image/png;base64,${bgData}`;
        }

        console.log('=== 배경 이미지 src (처음 100자) ===', imgSrc.substring(0, 100));

        const img = new Image();
        img.onload = () => {
          console.log('=== 배경 이미지 로드 완료 ===', img.naturalWidth, img.naturalHeight);
          // 배경 이미지 로드 완료 후 전환 완료
          finishTransition(true, img, imgSrc);
        };
        img.onerror = (e) => {
          console.error('=== 배경 이미지 로드 실패 ===', e);
          console.error('=== 시도한 src ===', imgSrc.substring(0, 200));
          // 이미지 로드 실패해도 전환 완료
          finishTransition(false);
        };
        img.src = imgSrc;
      } else {
        // 배경 이미지 없으면 바로 전환 완료
        finishTransition(false);
      }
    }
  }, [topologyData]);

  // 빈 토폴로지 감지 및 팝업 표시
  useEffect(() => {
    // 토폴로지 또는 장비 목록 로딩 중이면 대기
    if (topologyLoading || devicesLoading) {
      console.log('=== 데이터 로딩 중... ===', { topologyLoading, devicesLoading });
      return;
    }

    console.log('=== 빈 토폴로지 체크 ===', {
      topologyData,
      currentGroupDevices,
      currentTopologyGroupId,
      currentTopologyType,
      checkedRef: emptyTopologyCheckedRef.current,
      devicesLoading,
      topologyLoading
    });

    if (
      topologyData &&
      currentGroupDevices &&
      currentTopologyType === 'group' &&
      currentTopologyGroupId &&
      emptyTopologyCheckedRef.current !== currentTopologyGroupId
    ) {
      const nodes = topologyData.nodes || [];
      const devices = currentGroupDevices?.content || [];

      console.log('=== 노드/장비 수 ===', { nodesCount: nodes.length, devicesCount: devices.length });

      // 노드가 없고, 그룹에 속한 장비가 있는 경우에만 팝업 표시
      if (nodes.length === 0 && devices.length > 0) {
        console.log('=== 빈 토폴로지 팝업 표시 ===');
        setShowEmptyTopologyPrompt(true);
      }
      emptyTopologyCheckedRef.current = currentTopologyGroupId;
    }
  }, [topologyData, currentGroupDevices, currentTopologyGroupId, currentTopologyType, devicesLoading, topologyLoading]);

  // 빈 토폴로지에 그룹 장비 전체 추가 및 자동 저장
  const handleAddAllGroupDevices = useCallback(async () => {
    const devices = currentGroupDevices?.content || [];
    if (devices.length === 0) {
      setShowEmptyTopologyPrompt(false);
      return;
    }

    // 그리드 형태로 노드 배치
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
        id: `device_${device.DEVICE_ID}`,
        deviceId: device.DEVICE_ID,
        name: device.DEVICE_NAME || `장비 ${device.DEVICE_ID}`,
        type: device.DEVICE_TYPE || 'unknown',
        nodeType: 'device',
        x,
        y,
        fx: x,
        fy: y,
        iconData: device.ICON_DATA || null
      };
    });

    // 데이터 업데이트
    const newData = {
      nodes: newNodes,
      links: []
    };
    setData(newData);
    setShowEmptyTopologyPrompt(false);

    // 자동 저장
    try {
      const payload = {
        nodes: newNodes.map(n => ({
          id: n.id,
          deviceId: n.deviceId,
          groupId: n.groupId,
          name: n.name,
          type: n.type,
          nodeType: n.nodeType,
          x: n.x,
          y: n.y,
          iconData: n.iconData
        })),
        links: []
      };

      await saveTopologyMutation.mutateAsync({
        id: currentTopologyGroupId,
        type: currentTopologyType,
        data: payload
      });

      console.log('=== 빈 토폴로지 자동 저장 완료 ===');
    } catch (e) {
      console.error('빈 토폴로지 자동 저장 실패:', e);
    }
  }, [currentGroupDevices, currentTopologyGroupId, currentTopologyType, saveTopologyMutation]);

  // 사이드바에서 그룹 선택 시 해당 그룹 토폴로지로 전환
  const handleGroupSelect = useCallback((group) => {
    if (!group) return;

    // 편집 모드에서는 토폴로지 전환하지 않고 그룹 선택만 (장비 목록 업데이트)
    if (isEditMode) {
      // 그룹 선택만 변경 (사이드바의 장비 목록 업데이트용)
      setSelectedGroup(group);
      setSelectedSidebarDevice(null); // 사이드바 선택 장비 초기화
      return;
    }

    // 일반 모드에서는 토폴로지 전환
    if (group.GROUP_ID !== currentTopologyGroupId || currentTopologyType !== 'group') {
      // 그룹 전환 시작 - 페이드 아웃
      setIsGroupSwitching(true);
      // 기존 선택 상태 초기화
      setSelectedNode(null);
      setSelectedLink(null);
      setSelectedNodes(new Set());
      setLinkDraftSource(null);
      setSelectedSidebarDevice(null); // 사이드바 선택 장비 초기화
      // 빈 토폴로지 체크 리셋 (새 그룹이므로 다시 체크하도록)
      emptyTopologyCheckedRef.current = null;

      // 새 그룹 설정 (topologyData useQuery가 새 데이터를 가져옴)
      setCurrentTopologyGroupId(group.GROUP_ID);
      setCurrentTopologyType('group');
      setCurrentTopologyGroupName(group.GROUP_NAME);
    }
  }, [currentTopologyGroupId, currentTopologyType, isEditMode, setSelectedGroup]);

  // 데이터 로드 후 전체 노드가 보이도록 줌 조정 (그룹 전환 중에는 실행 안함 - finishTransition에서 처리)
  const initialFitDone = useRef(false);
  useEffect(() => {
    // 그룹 전환 중이면 finishTransition에서 처리하므로 여기서는 스킵
    if (isGroupSwitching) return;
    // 배경 이미지가 있으면 스킵 (배경 이미지 기준으로 줌이 설정됨)
    if (backgroundImage) return;

    if (data.nodes.length > 0 && graphRef.current && !initialFitDone.current) {
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
  }, [data.nodes, currentTopologyGroupId, isGroupSwitching, backgroundImage]);

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
        const clickedNodeKey = getNodeKey(clickedNode);

        // 다중 선택된 노드 드래그 시 오프셋 저장
        if (currentSelected.size > 1 && currentSelected.has(clickedNodeKey)) {
          isDraggingNodesRef.current = true;
          draggingNodeRef.current = clickedNode;
          dragOffsetsRef.current = {};

          data.nodes.forEach(n => {
            const nKey = getNodeKey(n);
            if (currentSelected.has(nKey) && !isSameNode(n, clickedNode)) {
              dragOffsetsRef.current[nKey] = {
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
      const mainNode = data.nodes.find(n => isSameNode(n, dragStartNode));

      if (mainNode && Object.keys(dragOffsetsRef.current).length > 0) {
        // 다른 선택된 노드들 위치 업데이트
        data.nodes.forEach(n => {
          const nKey = getNodeKey(n);
          const offset = dragOffsetsRef.current[nKey];
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
          const mainNode = data.nodes.find(n => isSameNode(n, dragStartNode));

          if (mainNode) {
            // 다른 선택된 노드들 위치 직접 업데이트
            data.nodes.forEach(n => {
              const nKey = getNodeKey(n);
              const offset = dragOffsetsRef.current[nKey];
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
        // 편집 모드 종료 시 사이드바 닫기
        setSidebarCollapsed(true);
      } else {
        // 편집 모드 시작 시 사이드바 열기
        setSidebarCollapsed(false);
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
          selected.add(getNodeKey(node));
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


  // 노드 클릭 -> 그룹 노드는 해당 그룹 토폴로지로 이동, 장비 노드는 상세 모달 표시
  const handleNodeClick = (node) => {
    // 클릭 시간 기록 (드래그 박스 방지용)
    lastNodeClickTimeRef.current = Date.now();

    setSelectedNode(node);

    // 편집 모드에서는 선택만 하고 이동/모달 안함
    if (isEditMode) return;

    // 노드 ID 추출 (그룹 또는 장비)
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';

    if (!isGroupNode) {
      // 장비 노드 클릭 -> 장비 상세 모달 표시
      const deviceId = node.deviceId || node.id?.replace?.('device_', '') || node.id?.replace?.('D', '');
      if (deviceId) {
        setDeviceModalId(deviceId);
        setDeviceModalOpen(true);
      }
      return;
    }

    // 그룹 노드 클릭 -> 해당 그룹 토폴로지로 이동
    const nodeId = node.groupId || node.id;
    if (!nodeId) return;

    // 같은 그룹이면 refetch만 수행
    if (String(nodeId) === String(currentTopologyGroupId) && currentTopologyType === 'group') {
      refetchTopology();
      return;
    }

    // 그룹 전환 시작 - 페이드 아웃
    setIsGroupSwitching(true);

    // 현재 토폴로지를 히스토리에 저장 (뒤로 가기용)
    if (currentTopologyGroupId) {
      setTopologyHistory(prev => [...prev, {
        groupId: currentTopologyGroupId,
        groupName: currentTopologyGroupName,
        type: currentTopologyType
      }]);
    }

    // 선택 상태 초기화
    setSelectedNode(null);
    setSelectedLink(null);
    setSelectedNodes(new Set());
    setLinkDraftSource(null);
    // 빈 토폴로지 체크 리셋
    emptyTopologyCheckedRef.current = null;

    // 새 토폴로지 로드 (데이터는 finishTransition에서 설정됨)
    setCurrentTopologyGroupId(nodeId);
    setCurrentTopologyType('group');
    setCurrentTopologyGroupName(node.name || node.GROUP_NAME || `그룹 ${nodeId}`);

    // 사이드바의 선택된 그룹도 업데이트
    const info = { GROUP_ID: nodeId, GROUP_NAME: node.name || node.GROUP_NAME };
    setSelectedGroup(info);
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

    if (selectedNode && isSameNode(selectedNode, node)) {
      setSelectedNode(null);
    }
    if (linkDraftSource && isSameNode(linkDraftSource, node)) {
      setLinkDraftSource(null);
    }

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // 선택된 노드들 일괄 삭제
  const handleDeleteSelectedNodes = async () => {
    if (selectedNodes.size === 0) return;

    const confirmDelete = await showConfirm(`선택된 ${selectedNodes.size}개 노드를 삭제하시겠습니까?`, '노드 삭제');
    if (!confirmDelete) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    setData((prev) => ({
      nodes: prev.nodes.filter((n) => !selectedNodes.has(getNodeKey(n))),
      links: prev.links.filter((l) => {
        // 링크의 source/target 노드 찾기
        const sourceNode = prev.nodes.find(n => String(n.id) === String(getLinkEndId(l.source)));
        const targetNode = prev.nodes.find(n => String(n.id) === String(getLinkEndId(l.target)));
        const sourceKey = sourceNode ? getNodeKey(sourceNode) : null;
        const targetKey = targetNode ? getNodeKey(targetNode) : null;
        return !selectedNodes.has(sourceKey) && !selectedNodes.has(targetKey);
      })
    }));

    // 선택된 노드 중 현재 선택된 노드가 있으면 해제
    if (selectedNode && selectedNodes.has(getNodeKey(selectedNode))) {
      setSelectedNode(null);
    }
    if (linkDraftSource && selectedNodes.has(getNodeKey(linkDraftSource))) {
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
    if (!linkDraftSource || !target || isSameNode(linkDraftSource, target)) return;

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

    // 그룹 노드가 포함된 경우 기존 방식으로 링크 생성 (nodeType 명시)
    createLinkDirect(
      linkDraftSource.id,
      target.id,
      null,
      null,
      null,
      null,
      linkDraftSource.nodeType || 'device',
      target.nodeType || 'device'
    );
  };

  // 직접 링크 생성 (인터페이스 정보 포함 가능)
  const createLinkDirect = (sourceId, targetId, srcIfIndex, dstIfIndex, srcIfName = null, dstIfName = null, srcNodeType = null, dstNodeType = null) => {
    const a = sourceId;
    const b = targetId;

    // source/target 노드의 타입 찾기
    const sourceNode = data.nodes.find(n => String(n.id) === String(sourceId));
    const targetNode = data.nodes.find(n => String(n.id) === String(targetId));
    const srcType = srcNodeType || sourceNode?.nodeType || 'device';
    const dstType = dstNodeType || targetNode?.nodeType || 'device';

    const exists = data.links.some((l) => {
      const s = getLinkEndId(l.source);
      const t = getLinkEndId(l.target);
      const lSrcType = l.srcType || 'device';
      const lDstType = l.dstType || 'device';
      // 같은 노드 간에 같은 인터페이스 조합이 있는지 확인 (타입도 비교)
      const sameDirection = s === a && t === b && lSrcType === srcType && lDstType === dstType;
      const reverseDirection = s === b && t === a && lSrcType === dstType && lDstType === srcType;
      if (sameDirection || reverseDirection) {
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
      showAlert('이미 해당 연결이 존재합니다.', 'warning');
      setLinkDraftSource(null);
      return;
    }

    const newId = `L${linkIdCounter.current++}`;
    const newLink = {
      id: newId,
      source: a,
      target: b,
      srcType: srcType,
      dstType: dstType,
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
        dstIfName,
        pendingLinkSource?.node?.nodeType || 'device',
        pendingLinkTarget?.node?.nodeType || 'device'
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
      showAlert('저장할 그룹이 선택되지 않았습니다.', 'warning');
      return;
    }

    try {
      const graphData = data;

      // 노드 ID → 실제 deviceId/groupId 및 nodeType 매핑 생성
      const nodeIdToRealId = {};
      const nodeIdToNodeType = {};
      graphData.nodes.forEach(n => {
        const nodeId = String(n.id);
        const nodeType = n.nodeType || 'device';
        nodeIdToNodeType[nodeId] = nodeType;
        if (nodeType === 'device' && n.deviceId) {
          nodeIdToRealId[nodeId] = n.deviceId;
        } else if (nodeType === 'group' && n.groupId) {
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
        // 링크 자체에 저장된 srcType, dstType 우선 사용
        const srcType = l.srcType || getLinkEndType(l.source) || 'device';
        const dstType = l.dstType || getLinkEndType(l.target) || 'device';

        const sourceNodeId = String(getLinkEndId(l.source));
        const targetNodeId = String(getLinkEndId(l.target));

        // 노드 ID를 실제 deviceId/groupId로 변환 (타입별로 노드 찾기)
        const sourceNode = graphData.nodes.find(n =>
          String(n.id) === sourceNodeId && (n.nodeType || 'device') === srcType
        );
        const targetNode = graphData.nodes.find(n =>
          String(n.id) === targetNodeId && (n.nodeType || 'device') === dstType
        );

        const sourceRealId = sourceNode
          ? (srcType === 'device' ? sourceNode.deviceId : sourceNode.groupId) || sourceNodeId
          : sourceNodeId;
        const targetRealId = targetNode
          ? (dstType === 'device' ? targetNode.deviceId : targetNode.groupId) || targetNodeId
          : targetNodeId;

        return {
          source: sourceRealId,
          target: targetRealId,
          srcType: srcType,
          dstType: dstType,
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

      // 저장 완료 후 편집 모드 종료 및 사이드바 닫기
      setIsEditMode(false);
      setLinkDraftSource(null);
      setSidebarCollapsed(true);

      showAlert('토폴로지가 저장되었습니다.', 'success');
    } catch (e) {
      console.error("topology save error", e);
      showAlert('저장 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'), 'error');
    }
  };

  // 배경 이미지 모달 열기
  const handleOpenBgImageModal = () => {
    // 기존 배경 이미지에서 data:image/...;base64, 접두사 제거
    let base64Only = backgroundImage || '';
    if (base64Only) {
      base64Only = base64Only.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    }
    setBgImageInput(base64Only);
    setBgImageModalOpen(true);
  };

  // 배경 이미지 저장
  const handleSaveBackgroundImage = async () => {
    if (!currentTopologyGroupId) {
      showAlert('그룹이 선택되지 않았습니다.', 'warning');
      return;
    }

    setBgImageSaving(true);
    try {
      // data:image/...;base64, 접두사 제거
      let imgSrc = bgImageInput || null;
      if (imgSrc) {
        imgSrc = imgSrc.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
      }
      const response = await topologyApi.saveBackgroundImage(currentTopologyGroupId, imgSrc);
      if (response.data?.code === 200) {
        setBgImageModalOpen(false);
        showAlert('배경 이미지가 저장되었습니다.', 'success');
        // 토폴로지 다시 조회하여 배경 이미지 반영
        refetchTopology();
      } else {
        showAlert('배경 이미지 저장에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error("background image save error", e);
      showAlert('배경 이미지 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setBgImageSaving(false);
    }
  };

  // 노드 이미지 변경 모달 열기
  const handleOpenNodeImageModal = (node) => {
    // 기존 노드 이미지에서 data:image/...;base64, 접두사 제거
    let base64Only = node?.iconData || '';
    if (base64Only) {
      base64Only = base64Only.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
    }
    setNodeImageTarget(node);
    setNodeImageInput(base64Only);
    setNodeImageModalOpen(true);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // 노드 이미지 저장
  const handleSaveNodeImage = async () => {
    if (!nodeImageTarget) {
      showAlert('노드가 선택되지 않았습니다.', 'warning');
      return;
    }

    const nodeType = nodeImageTarget.nodeType || 'device';
    const nodeId = nodeImageTarget.originalId || nodeImageTarget.groupId || nodeImageTarget.deviceId || nodeImageTarget.id;

    if (!nodeId) {
      showAlert('노드 ID를 찾을 수 없습니다.', 'error');
      return;
    }

    setNodeImageSaving(true);
    try {
      // data:image/...;base64, 접두사 제거
      let imgSrc = nodeImageInput || null;
      if (imgSrc) {
        imgSrc = imgSrc.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
      }
      const response = await topologyApi.saveNodeImage(nodeId, nodeType, imgSrc);
      if (response.data?.code === 200) {
        // 해당 노드의 아이콘 캐시 삭제 (다시 로드되도록)
        const cacheKey = `${nodeType}_${nodeImageTarget.id}`;
        delete groupIconCache.current[cacheKey];

        setNodeImageModalOpen(false);
        setNodeImageTarget(null);
        showAlert('노드 이미지가 저장되었습니다.', 'success');
        // 토폴로지 다시 조회하여 이미지 반영
        refetchTopology();
      } else {
        showAlert('노드 이미지 저장에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error("node image save error", e);
      showAlert('노드 이미지 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setNodeImageSaving(false);
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
    const nodeKey = getNodeKey(node);
    const isMultiSelected = currentSelected.has(nodeKey);

    // 드래그 중인 경우 선택된 노드들의 위치 보정
    let drawX = node.x;
    let drawY = node.y;

    // 다중 선택 드래그 중이고, 이 노드가 드래그 중인 노드가 아닌 선택된 노드인 경우
    const offset = dragOffsetsRef.current[nodeKey];
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
    if (linkDraftSource && isSameNode(linkDraftSource, node)) {
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
      const radius = 12;
      const hasIconData = node.iconData || node.ICON_DATA;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 글래스모피즘 메인 배경
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      const glassBg = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      glassBg.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
      glassBg.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
      glassBg.addColorStop(1, 'rgba(196, 181, 253, 0.25)');
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

      // 그룹 아이콘 이미지 로드 (Base64)
      if (hasIconData) {
        const cacheKey = `group_${node.id}`;
        if (!groupIconCache.current[cacheKey]) {
          const img = new Image();
          // SVG 지원을 위한 MIME 타입 감지
          let imgSrc = hasIconData;
          if (!hasIconData.startsWith('data:')) {
            if (hasIconData.startsWith('PHN2Zy') || hasIconData.startsWith('PD94bW')) {
              imgSrc = `data:image/svg+xml;base64,${hasIconData}`;
            } else {
              imgSrc = `data:image/png;base64,${hasIconData}`;
            }
          }
          img.src = imgSrc;
          groupIconCache.current[cacheKey] = img;
        }
        const groupImg = groupIconCache.current[cacheKey];

        if (groupImg && groupImg.complete && groupImg.naturalWidth > 0) {
          // 이미지가 로드된 경우 - 둥근 사각형 클리핑으로 이미지 표시
          const imgPadding = 6;
          const imgSize = size - imgPadding * 2;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(drawX - imgSize/2, drawY - imgSize/2, imgSize, imgSize, radius - 4);
          ctx.clip();
          ctx.drawImage(groupImg, drawX - imgSize/2, drawY - imgSize/2, imgSize, imgSize);
          ctx.restore();
        } else {
          // 이미지 로딩 중
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("...", drawX, drawY);
        }
      } else {
        // 아이콘 데이터 없음 - 기본 폴더 아이콘
        const iconSize = size * 0.45;
        const iconX = drawX - iconSize / 2;
        const iconY = drawY - iconSize / 2;

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
      }

      // 글래스모피즘 테두리
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      const borderGradient = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      borderGradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.3)');
      borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    } else {
      // 장비 노드 그리기 (글래스모피즘)
      const deviceIconData = node.iconData || node.ICON_DATA;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 글래스모피즘 메인 배경
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      const glassBg = ctx.createRadialGradient(drawX - half * 0.3, drawY - half * 0.3, 0, drawX, drawY, half);
      glassBg.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
      glassBg.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
      glassBg.addColorStop(1, 'rgba(37, 99, 235, 0.3)');
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
        // Base64 이미지가 있는 경우
        const cacheKey = `device_${node.id}`;
        if (!groupIconCache.current[cacheKey]) {
          const deviceImg = new Image();
          // SVG 지원을 위한 MIME 타입 감지
          let imgSrc = deviceIconData;
          if (!deviceIconData.startsWith('data:')) {
            if (deviceIconData.startsWith('PHN2Zy') || deviceIconData.startsWith('PD94bW')) {
              imgSrc = `data:image/svg+xml;base64,${deviceIconData}`;
            } else {
              imgSrc = `data:image/png;base64,${deviceIconData}`;
            }
          }
          deviceImg.src = imgSrc;
          groupIconCache.current[cacheKey] = deviceImg;
        }
        const cachedImg = groupIconCache.current[cacheKey];

        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
          // 이미지 로드 완료 - 원형 클리핑으로 이미지 표시
          const imgRadius = half * 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.arc(drawX, drawY, imgRadius, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(cachedImg, drawX - imgRadius, drawY - imgRadius, imgRadius * 2, imgRadius * 2);
          ctx.restore();
        } else {
          // 이미지 로딩 중
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("...", drawX, drawY);
        }
      } else if (img && img.complete) {
        // 기존 타입 기반 아이콘
        const imgRadius = half * 0.75;
        ctx.save();
        ctx.beginPath();
        ctx.arc(drawX, drawY, imgRadius, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, drawX - imgRadius, drawY - imgRadius, imgRadius * 2, imgRadius * 2);
        ctx.restore();
      } else {
        // 기본 아이콘 (서버/네트워크 심볼)
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        const iconSize = size * 0.35;
        // 간단한 서버 아이콘
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2, iconSize, iconSize * 0.25);
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2 + iconSize * 0.35, iconSize, iconSize * 0.25);
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2 + iconSize * 0.7, iconSize, iconSize * 0.25);
      }

      // 글래스모피즘 테두리
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      const borderGradient = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      borderGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.3)');
      borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
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
                {selectedNodes.size > 1 && selectedNodes.has(getNodeKey(target)) ? (
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

                {linkDraftSource && isSameNode(linkDraftSource, target) && (
                  <button style={itemStyle} onClick={handleCancelLinkDraft}>
                    링크 시작 취소
                  </button>
                )}

                {linkDraftSource && !isSameNode(linkDraftSource, target) && (
                  <button style={itemStyle} onClick={handleCreateLinkToNode}>
                    {linkDraftSource.name || linkDraftSource.id} →{" "}
                    {target?.name || target?.id} 링크 생성
                  </button>
                )}

                {/* 그룹 노드인 경우 이미지 변경 옵션 */}
                {target?.nodeType === 'group' && (
                  <button
                    style={itemStyle}
                    onClick={() => handleOpenNodeImageModal(target)}
                  >
                    <i className="bi bi-image" style={{ marginRight: 6 }}></i>
                    이미지 변경
                  </button>
                )}
              </>
            )}

            {/* 장비 노드인 경우 이미지 변경 옵션 (편집 모드에서만) */}
            {isEditMode && target?.nodeType === 'device' && (
              <button
                style={itemStyle}
                onClick={() => handleOpenNodeImageModal(target)}
              >
                <i className="bi bi-image" style={{ marginRight: 6 }}></i>
                이미지 변경
              </button>
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

  // 장비 상세정보 모달 렌더링 (자산관리와 동일한 스타일)
  const renderDeviceModal = () => {
    if (!deviceModalOpen) return null;

    const device = deviceDetailData?.data || deviceDetailData;
    const ports = deviceModalPorts || [];

    // 모달 닫기 시 탭 초기화
    const closeDeviceModal = () => {
      setDeviceModalOpen(false);
      setDeviceModalTab('device-info');
    };

    // SNMP 버전 라벨
    const getSnmpVersionLabel = (version) => {
      switch (version) {
        case 1: return 'v1';
        case 2: return 'v2c';
        case 3: return 'v3';
        default: return version ? `v${version}` : '-';
      }
    };

    // 날짜 포맷
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      try {
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    // 포트 상태 스타일
    const getPortStatusStyle = (status) => {
      switch (status) {
        case 1: return { color: '#22c55e', label: 'Up' };
        case 2: return { color: '#ef4444', label: 'Down' };
        default: return { color: '#94a3b8', label: 'Unknown' };
      }
    };

    return (
      <div className="topology-modal-overlay" onClick={closeDeviceModal}>
        <div className="topology-device-detail-modal" onClick={(e) => e.stopPropagation()}>
          <button className="topology-detail-close-btn" onClick={closeDeviceModal}>
            <i className="bi bi-x-lg"></i>
          </button>

          <h3 className="topology-detail-title">
            <i className="bi bi-hdd-network"></i>
            <span>{device?.DEVICE_NAME || '장비 상세 정보'}</span>
          </h3>

          {/* 탭 헤더 */}
          <div className="topology-detail-tabs">
            <button
              className={`topology-detail-tab ${deviceModalTab === 'device-info' ? 'active' : ''}`}
              onClick={() => setDeviceModalTab('device-info')}
            >
              <i className="bi bi-info-circle"></i> 장비 정보
            </button>
            <button
              className={`topology-detail-tab ${deviceModalTab === 'port-info' ? 'active' : ''}`}
              onClick={() => setDeviceModalTab('port-info')}
            >
              <i className="bi bi-ethernet"></i> 포트 정보
              {ports?.length > 0 && (
                <span className="topology-tab-badge">{ports.length}</span>
              )}
            </button>
          </div>

          {/* 장비 정보 탭 */}
          {deviceModalTab === 'device-info' && (
            <div className="topology-detail-content">
              {deviceLoading ? (
                <div className="topology-detail-loading">
                  <i className="bi bi-arrow-repeat spinning"></i>
                  <span>로딩 중...</span>
                </div>
              ) : deviceError ? (
                <div className="topology-detail-error">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>장비 정보를 불러올 수 없습니다.</span>
                </div>
              ) : device ? (
                <div className="topology-detail-sections">
                  {/* 기본 정보 */}
                  <div className="topology-detail-section">
                    <div className="topology-detail-section-header">
                      <i className="bi bi-info-circle"></i>
                      <span>기본 정보</span>
                    </div>
                    <div className="topology-detail-grid">
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">장비명</span>
                        <span className="topology-detail-value">{device.DEVICE_NAME || '-'}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">시스템명</span>
                        <span className="topology-detail-value">{device.DEVICE_SYSTEM_NAME || '-'}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">IP 주소</span>
                        <span className="topology-detail-value highlight">{device.DEVICE_IP || '-'}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">벤더</span>
                        <span className="topology-detail-value">{device.VENDOR_NAME || '-'}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">모델명</span>
                        <span className="topology-detail-value">{device.MODEL_NAME || '-'}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">장비 설명</span>
                        <span className="topology-detail-value">{device.DEVICE_DESC || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* SNMP 설정 */}
                  <div className="topology-detail-section">
                    <div className="topology-detail-section-header">
                      <i className="bi bi-diagram-3"></i>
                      <span>SNMP 설정</span>
                    </div>
                    <div className="topology-detail-grid">
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">SNMP 버전</span>
                        <span className="topology-detail-value">{getSnmpVersionLabel(device.SNMP_VERSION)}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">포트</span>
                        <span className="topology-detail-value">{device.SNMP_PORT || 161}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">커뮤니티</span>
                        <span className="topology-detail-value">{device.SNMP_COMMUNITY || '-'}</span>
                      </div>
                      {device.SNMP_VERSION === 3 && (
                        <>
                          <div className="topology-detail-item">
                            <span className="topology-detail-label">사용자</span>
                            <span className="topology-detail-value">{device.SNMP_USER || '-'}</span>
                          </div>
                          <div className="topology-detail-item">
                            <span className="topology-detail-label">인증 프로토콜</span>
                            <span className="topology-detail-value">{device.SNMP_AUTH_PROTOCOL || '-'}</span>
                          </div>
                          <div className="topology-detail-item">
                            <span className="topology-detail-label">암호화 프로토콜</span>
                            <span className="topology-detail-value">{device.SNMP_PRIV_PROTOCOL || '-'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 등록 정보 */}
                  <div className="topology-detail-section">
                    <div className="topology-detail-section-header">
                      <i className="bi bi-clock-history"></i>
                      <span>등록 정보</span>
                    </div>
                    <div className="topology-detail-grid">
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">등록일</span>
                        <span className="topology-detail-value">{formatDate(device.CREATE_AT)}</span>
                      </div>
                      <div className="topology-detail-item">
                        <span className="topology-detail-label">수정일</span>
                        <span className="topology-detail-value">{formatDate(device.MODIFY_AT)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="topology-detail-error">
                  <span>장비 정보가 없습니다.</span>
                </div>
              )}
            </div>
          )}

          {/* 포트 정보 탭 */}
          {deviceModalTab === 'port-info' && (
            <div className="topology-detail-content">
              {devicePortsLoading ? (
                <div className="topology-detail-loading">
                  <i className="bi bi-arrow-repeat spinning"></i>
                  <span>포트 정보 로딩 중...</span>
                </div>
              ) : ports.length > 0 ? (
                <div className="topology-port-table-wrapper">
                  <table className="topology-port-table">
                    <thead>
                      <tr>
                        <th>인덱스</th>
                        <th>포트명</th>
                        <th>별칭</th>
                        <th>상태</th>
                        <th>속도</th>
                        <th>타입</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((port, idx) => {
                        const status = getPortStatusStyle(port.IF_OPER_STATUS);
                        return (
                          <tr key={port.IF_INDEX || idx}>
                            <td>{port.IF_INDEX || '-'}</td>
                            <td className="port-name">{port.IF_NAME || '-'}</td>
                            <td>{port.IF_ALIAS || '-'}</td>
                            <td>
                              <span className="port-status" style={{ color: status.color }}>
                                <i className={`bi ${status.label === 'Up' ? 'bi-circle-fill' : 'bi-circle'}`}></i>
                                {status.label}
                              </span>
                            </td>
                            <td>{port.IF_SPEED ? `${Math.round(port.IF_SPEED / 1000000)} Mbps` : '-'}</td>
                            <td>{port.IF_TYPE || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="topology-detail-empty">
                  <i className="bi bi-ethernet"></i>
                  <span>포트 정보가 없습니다.</span>
                </div>
              )}
            </div>
          )}
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
      showAlert(`${newNodes.length}개 장비가 추가되었습니다.\n(${skipped}개는 이미 존재)`, 'info');
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
          showAlert(`이미 토폴로지에 존재하는 그룹입니다.\n${group.GROUP_NAME}`, 'warning');
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
        showAlert(`이미 토폴로지에 존재하는 장비입니다.\n${device.DEVICE_NAME}`, 'warning');
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
            registeredDeviceIds={registeredDeviceIds}
            topologyLoading={topologyLoading || isGroupSwitching}
          />
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="topology-main-content">
        {/* 상단 툴바 */}
        <div className="topology-toolbar">
          {/* 사이드바 토글 버튼 */}
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
              onClick={async () => {
                const prev = topologyHistory[topologyHistory.length - 1];
                // 그룹 전환 시작 - 페이드 아웃
                setIsGroupSwitching(true);
                // 노드 아이콘 캐시 초기화
                groupIconCache.current = {};
                setTopologyHistory(h => h.slice(0, -1));
                setSelectedNode(null);
                setSelectedLink(null);
                setSelectedNodes(new Set());
                setLinkDraftSource(null);
                // 새 토폴로지 로드 (데이터는 finishTransition에서 설정됨)
                setCurrentTopologyGroupId(prev.groupId);
                setCurrentTopologyType(prev.type || 'group');
                setCurrentTopologyGroupName(prev.groupName);
                if (prev.type === 'group') {
                  const groupInfo = { GROUP_ID: prev.groupId, GROUP_NAME: prev.groupName };
                  setSelectedGroup(groupInfo);
                }
                // React Query 캐시 무효화하여 최신 데이터 가져오기
                setTimeout(() => refetchTopology(), 50);
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
            <>
              <button
                onClick={handleSaveTopology}
                className="btn btn-success"
                disabled={saveTopologyMutation.isPending}
              >
                <i className={`bi ${saveTopologyMutation.isPending ? 'bi-arrow-repeat spinning' : 'bi-save'}`}></i>
                {saveTopologyMutation.isPending ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleOpenBgImageModal}
                className="btn btn-secondary"
                title="배경 이미지 변경"
              >
                <i className="bi bi-image"></i>
                배경 이미지
              </button>
            </>
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
          className={`topology-canvas-container ${isEditMode ? 'edit-mode' : ''} ${isGroupSwitching ? 'switching' : ''}`}
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
            onRenderFramePre={(ctx, globalScale) => {
              // 배경 이미지 그리기 (축소된 크기, 그래프 좌표계 기준)
              if (backgroundImageRef.current && backgroundImageRef.current.complete) {
                const img = backgroundImageRef.current;
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;

                // 배경 이미지 크기 축소 (0.4 = 40% 크기)
                const bgScale = 0.4;
                const scaledWidth = imgWidth * bgScale;
                const scaledHeight = imgHeight * bgScale;

                // 그래프 좌표 (0,0)을 중심으로 배치
                const drawX = -scaledWidth / 2;
                const drawY = -scaledHeight / 2;

                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
                ctx.restore();
              }
            }}
          />
        </div>

        {renderContextMenu()}
      </div>

      {/* 장비 상세정보 모달 */}
      {renderDeviceModal()}

      {/* 인터페이스 선택 모달 */}
      {renderInterfaceModal()}

      {/* 빈 토폴로지 확인 팝업 */}
      {showEmptyTopologyPrompt && (
        <div className="topology-modal-overlay">
          <div className="topology-modal-glass topology-modal-confirm">
            <div className="topology-modal-icon topology-modal-icon-info">
              <i className="bi bi-diagram-3"></i>
            </div>
            <h3 className="topology-modal-title">빈 토폴로지</h3>
            <p className="topology-modal-message">
              해당 그룹에 속한 장비({currentGroupDevices?.content?.length || 0}개)를<br />
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

      {/* 배경 이미지 변경 모달 */}
      {bgImageModalOpen && (
        <div className="topology-modal-overlay" onClick={() => setBgImageModalOpen(false)}>
          <div
            className="topology-modal-glass topology-bg-image-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', width: '90%' }}
          >
            <div className="topology-modal-header">
              <h3 className="topology-modal-title" style={{ margin: 0 }}>
                <i className="bi bi-image" style={{ marginRight: '8px' }}></i>
                배경 이미지 변경
              </h3>
              <button
                className="topology-modal-close"
                onClick={() => setBgImageModalOpen(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="topology-modal-body" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  이미지 파일 선택
                </label>
                <input
                  type="file"
                  accept="image/*,.svg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        // data:image/...;base64, 접두사 제거하여 순수 base64만 저장
                        const result = event.target?.result;
                        if (result) {
                          const base64 = result.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
                          setBgImageInput(base64);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              {bgImageInput && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-secondary)'
                  }}>
                    미리보기
                  </label>
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    maxHeight: '200px',
                    overflow: 'auto',
                    position: 'relative'
                  }}>
                    <img
                      src={(() => {
                        if (bgImageInput.startsWith('PHN2Zy') || bgImageInput.startsWith('PD94bW')) {
                          return `data:image/svg+xml;base64,${bgImageInput}`;
                        }
                        return `data:image/png;base64,${bgImageInput}`;
                      })()}
                      alt="미리보기"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '180px',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{
                      display: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: '13px',
                      textAlign: 'center',
                      padding: '20px'
                    }}>
                      <i className="bi bi-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                      유효하지 않은 이미지 형식입니다.
                    </div>
                    <button
                      onClick={() => setBgImageInput('')}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                      title="이미지 삭제"
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                </div>
              )}
              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginBottom: '16px'
              }}>
                <i className="bi bi-info-circle" style={{ marginRight: '6px' }}></i>
                배경 이미지를 삭제하려면 입력란을 비우고 저장하세요.
              </div>
            </div>
            <div className="topology-modal-actions" style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                className="topology-modal-btn topology-modal-btn-cancel"
                onClick={() => setBgImageModalOpen(false)}
                disabled={bgImageSaving}
              >
                취소
              </button>
              <button
                className="topology-modal-btn topology-modal-btn-primary"
                onClick={handleSaveBackgroundImage}
                disabled={bgImageSaving}
              >
                {bgImageSaving ? (
                  <>
                    <i className="bi bi-arrow-repeat spinning" style={{ marginRight: '6px' }}></i>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" style={{ marginRight: '6px' }}></i>
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 노드 이미지 변경 모달 */}
      {nodeImageModalOpen && (
        <div className="topology-modal-overlay" onClick={() => setNodeImageModalOpen(false)}>
          <div
            className="topology-modal-glass topology-bg-image-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '90%' }}
          >
            <div className="topology-modal-header">
              <h3 className="topology-modal-title" style={{ margin: 0 }}>
                <i className="bi bi-image" style={{ marginRight: '8px' }}></i>
                노드 이미지 변경
              </h3>
              <button
                className="topology-modal-close"
                onClick={() => setNodeImageModalOpen(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="topology-modal-body" style={{ padding: '20px' }}>
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className={`bi ${nodeImageTarget?.nodeType === 'device' ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ color: 'var(--text-secondary)' }}></i>
                  <span style={{ fontWeight: '500' }}>{nodeImageTarget?.name || nodeImageTarget?.id}</span>
                  {nodeImageTarget?.nodeType === 'device' && nodeImageTarget?.type && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {nodeImageTarget.type}
                    </span>
                  )}
                </div>
              </div>

              {/* 장비인 경우 경고문 표시 */}
              {nodeImageTarget?.nodeType === 'device' && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#f59e0b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ marginTop: '2px' }}></i>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>주의</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        이미지를 변경하면 동일한 모델({nodeImageTarget?.type || '알 수 없음'})의 <strong>모든 장비</strong>에 적용됩니다.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)'
                }}>
                  이미지 파일 선택
                </label>
                <input
                  type="file"
                  accept="image/*,.svg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        // data:image/...;base64, 접두사 제거하여 순수 base64만 저장
                        const result = event.target?.result;
                        if (result) {
                          const base64 = result.replace(/^data:image\/[a-zA-Z+\-]+;base64,/, '');
                          setNodeImageInput(base64);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              {nodeImageInput && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-secondary)'
                  }}>
                    미리보기
                  </label>
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative'
                  }}>
                    <img
                      src={(() => {
                        if (nodeImageInput.startsWith('PHN2Zy') || nodeImageInput.startsWith('PD94bW')) {
                          return `data:image/svg+xml;base64,${nodeImageInput}`;
                        }
                        return `data:image/png;base64,${nodeImageInput}`;
                      })()}
                      alt="미리보기"
                      style={{
                        maxWidth: '120px',
                        maxHeight: '120px',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{
                      display: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: '13px',
                      textAlign: 'center',
                      padding: '20px'
                    }}>
                      <i className="bi bi-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                      유효하지 않은 이미지 형식입니다.
                    </div>
                    <button
                      onClick={() => setNodeImageInput('')}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'rgba(239, 68, 68, 0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                      title="이미지 삭제"
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                </div>
              )}
              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginBottom: '16px'
              }}>
                <i className="bi bi-info-circle" style={{ marginRight: '6px' }}></i>
                이미지를 삭제하려면 입력란을 비우고 저장하세요.
              </div>
            </div>
            <div className="topology-modal-actions" style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                className="topology-modal-btn topology-modal-btn-cancel"
                onClick={() => setNodeImageModalOpen(false)}
                disabled={nodeImageSaving}
              >
                취소
              </button>
              <button
                className="topology-modal-btn topology-modal-btn-primary"
                onClick={handleSaveNodeImage}
                disabled={nodeImageSaving}
              >
                {nodeImageSaving ? (
                  <>
                    <i className="bi bi-arrow-repeat spinning" style={{ marginRight: '6px' }}></i>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" style={{ marginRight: '6px' }}></i>
                    저장
                  </>
                )}
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
    </div>
  );
}
