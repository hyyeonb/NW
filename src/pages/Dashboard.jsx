import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import GridLayout from 'react-grid-layout';
import ForceGraph2D from 'react-force-graph-2d';
import ReactECharts from 'echarts-for-react';
import { useTopologyView, useGroupTree, useWidgets, useDefaultDashboard, useUserDashboard, useSaveUserDashboard, useResetUserDashboard } from '../hooks';
import { useAuthStore } from '../stores/authStore';
import { useAlertStore } from '../stores/alertStore';
import { faultApi, dashboardApi } from '../api';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../styles/dashboard.css';

// 값 포맷팅 함수 (K, M, G 단위 적용)
const formatLargeValue = (value, unit = '') => {
  if (value == null || isNaN(value)) return '-';
  const absValue = Math.abs(value);

  // bps, byte 관련 단위인 경우
  if (unit.toLowerCase().includes('bps') || unit.toLowerCase().includes('byte')) {
    if (absValue >= 1000000000) {
      return (value / 1000000000).toFixed(1) + 'G';
    } else if (absValue >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (absValue >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
  }

  // 일반 숫자
  if (absValue >= 1000000000) {
    return (value / 1000000000).toFixed(1) + 'G';
  } else if (absValue >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }

  return value.toFixed(1);
};

// 메트릭 이름 축약 함수
const getShortMetricName = (metric) => {
  const abbrevMap = {
    'ICMP_MAX': 'MAX',
    'ICMP_MIN': 'MIN',
    'ICMP_AVG': 'AVG',
    'ICMP_LOSS': 'LOSS',
    'TRAFFIC_IN_BPS': 'IN_BPS',
    'TRAFFIC_OUT_BPS': 'OUT_BPS',
    'TRAFFIC_IN_BYTE': 'IN_BYTE',
    'TRAFFIC_OUT_BYTE': 'OUT_BYTE',
    'TRAFFIC_INPUT_BYTE': 'IN_BYTE',
    'TRAFFIC_OUTPUT_BYTE': 'OUT_BYTE',
    'TRAFFIC_IN_PKT': 'IN_PKT',
    'TRAFFIC_OUT_PKT': 'OUT_PKT',
    'TRAFFIC_IN_ERR': 'IN_ERR',
    'TRAFFIC_OUT_ERR': 'OUT_ERR',
    'TRAFFIC_IN_DROP': 'IN_DROP',
    'TRAFFIC_OUT_DROP': 'OUT_DROP',
    'CPU_USAGE': 'CPU',
    'MEMORY_USAGE': 'MEM',
  };
  return abbrevMap[metric] || metric;
};

// 기본 위젯 타입 (API 실패 시 폴백)
const DEFAULT_WIDGET_TYPES = {
  TOPOLOGY: {
    id: 'TOPOLOGY',
    name: '토폴로지 Map',
    icon: 'bi-diagram-3',
    category: 'network',
    defaultW: 2,
    defaultH: 2,
    defaultConfig: {},
  },
  CPU_MEM_TOPN: {
    id: 'CPU_MEM_TOPN',
    name: 'CPU/MEM TOPN',
    icon: 'bi-cpu',
    category: 'chart',
    defaultW: 1,
    defaultH: 1,
    defaultConfig: {
      group: 'CPU_MEM',
      elements: ['CPU', 'MEMORY'],
      chartType: 'pie',
    },
  },
  TRAFFIC_TOPN: {
    id: 'TRAFFIC_TOPN',
    name: 'Traffic IN/OUT TOPN',
    icon: 'bi-bar-chart',
    category: 'chart',
    defaultW: 1,
    defaultH: 1,
    defaultConfig: {
      group: 'TRAFFIC',
      elements: ['TRAFFIC_IN_BPS', 'TRAFFIC_OUT_BPS'],
      chartType: 'bar',
    },
  },
  ALERT_LIST: {
    id: 'ALERT_LIST',
    name: '알람 리스트',
    icon: 'bi-bell',
    category: 'monitoring',
    defaultW: 2,
    defaultH: 1,
    defaultConfig: {},
  },
  FILESYSTEM_TOPN: {
    id: 'FILESYSTEM_TOPN',
    name: '파일시스템 TOPN',
    icon: 'bi-pie-chart',
    category: 'chart',
    defaultW: 1,
    defaultH: 1,
    defaultConfig: {
      group: 'FILE',
      elements: ['FILESYSTEM'],
      chartType: 'pie',
    },
  },
  TRAFFIC_TREND: {
    id: 'TRAFFIC_TREND',
    name: 'Traffic IN/OUT 추이',
    icon: 'bi-graph-up',
    category: 'chart',
    defaultW: 2,
    defaultH: 1,
    defaultConfig: {
      group: 'TRAFFIC',
      elements: ['TRAFFIC_IN_BPS', 'TRAFFIC_OUT_BPS'],
      chartType: 'line',
    },
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: '사용자 정의',
    icon: 'bi-sliders',
    category: 'custom',
    defaultW: 2,
    defaultH: 1,
    defaultConfig: {},
  },
  REALTIME_ALERT: {
    id: 'REALTIME_ALERT',
    name: '실시간 장애 현황',
    icon: 'bi-exclamation-triangle',
    category: 'monitoring',
    defaultW: 2,
    defaultH: 2,
    defaultConfig: {},
  },
  ALERT_SUMMARY: {
    id: 'ALERT_SUMMARY',
    name: '장애 현황',
    icon: 'bi-bell-fill',
    category: 'monitoring',
    defaultW: 1,
    defaultH: 1,
    defaultConfig: {},
  },
  DEVICE_SUMMARY: {
    id: 'DEVICE_SUMMARY',
    name: '종합 현황',
    icon: 'bi-grid-3x3-gap-fill',
    category: 'monitoring',
    defaultW: 1,
    defaultH: 1,
    defaultConfig: {},
  },
};

const CATEGORIES = {
  all: { label: '전체', icon: 'bi-grid-3x3-gap' },
  network: { label: '네트워크', icon: 'bi-diagram-3' },
  monitoring: { label: '모니터링', icon: 'bi-display' },
  chart: { label: '차트', icon: 'bi-bar-chart' },
  custom: { label: '사용자 정의', icon: 'bi-sliders' },
  info: { label: '정보', icon: 'bi-info-circle' },
};

// 모니터링 요소 그룹 정의
const MONITORING_GROUPS = {
  CPU_MEM: {
    id: 'CPU_MEM',
    name: 'CPU/Memory',
    icon: 'bi-cpu',
    color: '#3b82f6',
    elements: [
      { id: 'CPU', name: 'CPU 사용률', icon: 'bi-cpu', color: '#3b82f6' },
      { id: 'MEMORY', name: 'Memory 사용률', icon: 'bi-memory', color: '#8b5cf6' },
    ]
  },
  FILE: {
    id: 'FILE',
    name: 'File System',
    icon: 'bi-folder',
    color: '#ef4444',
    elements: [
      { id: 'FILESYSTEM', name: '파일시스템 사용률', icon: 'bi-hdd', color: '#ef4444' },
      { id: 'DISK_READ', name: 'Disk Read', icon: 'bi-arrow-down-circle', color: '#f97316' },
      { id: 'DISK_WRITE', name: 'Disk Write', icon: 'bi-arrow-up-circle', color: '#fb923c' },
    ]
  },
  PROCESS: {
    id: 'PROCESS',
    name: 'Process',
    icon: 'bi-list-task',
    color: '#10b981',
    elements: [
      { id: 'PROCESS_COUNT', name: '프로세스 수', icon: 'bi-hash', color: '#10b981' },
      { id: 'PROCESS_CPU', name: '프로세스 CPU', icon: 'bi-cpu', color: '#22c55e' },
      { id: 'PROCESS_MEM', name: '프로세스 Memory', icon: 'bi-memory', color: '#4ade80' },
    ]
  },
  TRAFFIC: {
    id: 'TRAFFIC',
    name: 'Traffic',
    icon: 'bi-arrow-left-right',
    color: '#06b6d4',
    elements: [
      { id: 'TRAFFIC_IN_BPS', name: 'Traffic IN (bps)', icon: 'bi-arrow-down', color: '#06b6d4' },
      { id: 'TRAFFIC_IN_BYTE', name: 'Traffic IN (byte)', icon: 'bi-arrow-down-circle', color: '#3b82f6' },
      { id: 'TRAFFIC_IN_PKT', name: 'Traffic IN (pkt)', icon: 'bi-arrow-down-square', color: '#0891b2' },
      { id: 'TRAFFIC_IN_ERR', name: 'Traffic IN (err)', icon: 'bi-x-circle', color: '#0e7490' },
      { id: 'TRAFFIC_OUT_BPS', name: 'Traffic OUT (bps)', icon: 'bi-arrow-up', color: '#22d3ee' },
      { id: 'TRAFFIC_OUT_BYTE', name: 'Traffic OUT (byte)', icon: 'bi-arrow-up-circle', color: '#a5f3fc' },
      { id: 'TRAFFIC_OUT_PKT', name: 'Traffic OUT (pkt)', icon: 'bi-arrow-up-square', color: '#67e8f9' },
      { id: 'TRAFFIC_OUT_ERR', name: 'Traffic OUT (err)', icon: 'bi-x-circle-fill', color: '#f59e0b' },
    ]
  },
  ICMP: {
    id: 'ICMP',
    name: 'ICMP',
    icon: 'bi-wifi',
    color: '#6366f1',
    elements: [
      { id: 'ICMP_MIN', name: 'ICMP Min', icon: 'bi-dash-lg', color: '#6366f1' },
      { id: 'ICMP_MAX', name: 'ICMP Max', icon: 'bi-arrow-bar-up', color: '#818cf8' },
      { id: 'ICMP_AVG', name: 'ICMP Avg', icon: 'bi-bar-chart', color: '#a5b4fc' },
      { id: 'ICMP_LOSS', name: 'ICMP Loss', icon: 'bi-exclamation-triangle', color: '#c7d2fe' },
    ]
  },
};

// 역참조를 위한 평면 맵 생성
const MONITORING_ELEMENTS = {};
Object.values(MONITORING_GROUPS).forEach(group => {
  group.elements.forEach(element => {
    MONITORING_ELEMENTS[element.id] = element;
  });
});

// 초기 위젯 배치
const initialWidgets = [
  { id: 'w0', type: 'TOPOLOGY', title: '토폴로지 Map', config: DEFAULT_WIDGET_TYPES.TOPOLOGY.defaultConfig },
  { id: 'w1', type: 'CPU_MEM_TOPN', title: 'CPU/MEM TOPN', config: DEFAULT_WIDGET_TYPES.CPU_MEM_TOPN.defaultConfig },
  { id: 'w2', type: 'TRAFFIC_TOPN', title: 'Traffic IN/OUT TOPN', config: DEFAULT_WIDGET_TYPES.TRAFFIC_TOPN.defaultConfig },
  { id: 'w3', type: 'ALERT_LIST', title: '알람 리스트', config: DEFAULT_WIDGET_TYPES.ALERT_LIST.defaultConfig },
  { id: 'w4', type: 'FILESYSTEM_TOPN', title: '파일시스템 TOPN', config: DEFAULT_WIDGET_TYPES.FILESYSTEM_TOPN.defaultConfig },
  { id: 'w5', type: 'TRAFFIC_TREND', title: 'Traffic IN/OUT 추이', config: DEFAULT_WIDGET_TYPES.TRAFFIC_TREND.defaultConfig },
];

// 초기 레이아웃
const initialLayout = [
  { i: 'w0', x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1, maxH: 5 },  // 토폴로지 (좌측 상단)
  { i: 'w1', x: 2, y: 0, w: 1, h: 1, minW: 1, minH: 1, maxH: 5 },  // CPU/MEM TOPN
  { i: 'w2', x: 3, y: 0, w: 1, h: 1, minW: 1, minH: 1, maxH: 5 },  // Traffic TOPN
  { i: 'w3', x: 0, y: 2, w: 2, h: 1, minW: 1, minH: 1, maxH: 5 },  // 알람 리스트
  { i: 'w4', x: 2, y: 1, w: 1, h: 1, minW: 1, minH: 1, maxH: 5 },  // 파일시스템 TOPN
  { i: 'w5', x: 0, y: 3, w: 2, h: 1, minW: 1, minH: 1, maxH: 5 },  // Traffic 추이
];

// 토폴로지 위젯 컴포넌트
function TopologyWidget({ onExpand }) {
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const groupIconCache = useRef({});
  const navigate = useNavigate();

  // 위젯 내 그룹 네비게이션
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [groupHistory, setGroupHistory] = useState([]);

  // 배경 이미지 관련 상태
  const [backgroundImage, setBackgroundImage] = useState(null);
  const backgroundImageRef = useRef(null);

  const { data: groupTree, isLoading: groupTreeLoading } = useGroupTree();
  const rootGroup = groupTree?.find(g => g.GROUP_NAME !== '미등록 장비');
  const defaultGroupId = rootGroup?.GROUP_ID || null;

  // 현재 표시할 그룹 ID (사용자가 선택한 그룹 또는 최상위 그룹)
  const displayGroupId = currentGroupId || defaultGroupId;

  const { data: topologyData, isLoading: topologyLoading } = useTopologyView(displayGroupId, 'group');
  const isLoading = groupTreeLoading || (displayGroupId && topologyLoading);

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (!topologyData?.nodes) {
      setGraphData({ nodes: [], links: [] });
      setBackgroundImage(null);
      backgroundImageRef.current = null;
      return;
    }

    const fixedNodes = (topologyData.nodes || []).map(n => ({
      ...n,
      id: String(n.id),
      label: n.name || n.groupName || n.deviceName || 'Unknown',
      fx: n.fx ?? n.x,
      fy: n.fy ?? n.y,
    }));

    const nodeIds = new Set(fixedNodes.map(n => String(n.id)));
    const validLinks = (topologyData.links || []).filter(link => {
      const sourceId = typeof link.source === 'object' ? String(link.source?.id) : String(link.source);
      const targetId = typeof link.target === 'object' ? String(link.target?.id) : String(link.target);
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    setGraphData({ nodes: fixedNodes, links: validLinks });

    const bgData = topologyData.backIconData || topologyData.BACK_ICON_DATA;
    if (bgData) {
      let imgSrc;
      if (bgData.startsWith('data:')) {
        imgSrc = bgData;
      } else if (bgData.startsWith('/9j/')) {
        imgSrc = `data:image/jpeg;base64,${bgData}`;
      } else if (bgData.startsWith('iVBOR')) {
        imgSrc = `data:image/png;base64,${bgData}`;
      } else if (bgData.startsWith('R0lGOD')) {
        imgSrc = `data:image/gif;base64,${bgData}`;
      } else if (bgData.startsWith('PHN2Zy') || bgData.startsWith('PD94bW')) {
        imgSrc = `data:image/svg+xml;base64,${bgData}`;
      } else {
        imgSrc = `data:image/png;base64,${bgData}`;
      }

      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        setBackgroundImage(imgSrc);
      };
      img.onerror = () => {
        backgroundImageRef.current = null;
        setBackgroundImage(null);
      };
      img.src = imgSrc;
    } else {
      backgroundImageRef.current = null;
      setBackgroundImage(null);
    }
  }, [topologyData]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          const newWidth = Math.floor(rect.width);
          const newHeight = Math.floor(rect.height);
          setDimensions(prev => {
            if (!prev || Math.abs(prev.width - newWidth) > 5 || Math.abs(prev.height - newHeight) > 5) {
              return { width: newWidth, height: newHeight };
            }
            return prev;
          });
          setDimensionsReady(true);
        }
      }
    };

    const initTimer1 = setTimeout(updateSize, 50);
    const initTimer2 = setTimeout(updateSize, 150);
    const initTimer3 = setTimeout(updateSize, 300);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 50 && entry.contentRect.height > 50) {
        requestAnimationFrame(updateSize);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(initTimer1);
      clearTimeout(initTimer2);
      clearTimeout(initTimer3);
      resizeObserver.disconnect();
    };
  }, []);

  const adjustZoom = useCallback(() => {
    if (!graphRef.current || !containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    if (containerWidth < 100 || containerHeight < 100) return;

    if (backgroundImageRef.current && backgroundImageRef.current.complete) {
      const img = backgroundImageRef.current;
      const bgScale = 0.4;
      const scaledWidth = img.naturalWidth * bgScale;
      const scaledHeight = img.naturalHeight * bgScale;
      const scaleX = containerWidth / scaledWidth;
      const scaleY = containerHeight / scaledHeight;
      const fitZoom = Math.min(scaleX, scaleY) * 0.85;
      graphRef.current.centerAt(0, 0, 0);
      graphRef.current.zoom(fitZoom, 0);
    } else if (graphData.nodes.length > 0) {
      graphRef.current.zoomToFit(0, 30);
    }
  }, [graphData.nodes.length]);

  useEffect(() => {
    if (graphRef.current && (graphData.nodes.length > 0 || backgroundImage)) {
      const timer1 = setTimeout(adjustZoom, 100);
      const timer2 = setTimeout(adjustZoom, 300);
      const timer3 = setTimeout(adjustZoom, 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [graphData.nodes.length, dimensions, backgroundImage, adjustZoom]);

  const NODE_SIZE = 36;

  const drawNode = useCallback((node, ctx, globalScale) => {
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';
    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;
    const drawX = node.x;
    const drawY = node.y;
    const label = node.name || node.label || node.id;

    if (isGroupNode) {
      const radius = 10;
      const hasIconData = node.iconData || node.ICON_DATA;

      ctx.save();
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      const glassBg = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      glassBg.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
      glassBg.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
      glassBg.addColorStop(1, 'rgba(196, 181, 253, 0.25)');
      ctx.fillStyle = glassBg;
      ctx.fill();

      if (hasIconData) {
        const cacheKey = `group_${node.id}`;
        if (!groupIconCache.current[cacheKey]) {
          const img = new Image();
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
          const imgPadding = 5;
          const imgSize = size - imgPadding * 2;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(drawX - imgSize/2, drawY - imgSize/2, imgSize, imgSize, radius - 3);
          ctx.clip();
          ctx.drawImage(groupImg, drawX - imgSize/2, drawY - imgSize/2, imgSize, imgSize);
          ctx.restore();
        }
      }

      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    } else {
      const deviceIconData = node.iconData || node.ICON_DATA;

      ctx.save();
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      const glassBg = ctx.createRadialGradient(drawX - half * 0.3, drawY - half * 0.3, 0, drawX, drawY, half);
      glassBg.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
      glassBg.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
      glassBg.addColorStop(1, 'rgba(37, 99, 235, 0.3)');
      ctx.fillStyle = glassBg;
      ctx.fill();

      if (deviceIconData) {
        const cacheKey = `device_${node.id}`;
        if (!groupIconCache.current[cacheKey]) {
          const deviceImg = new Image();
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
          const imgRadius = half * 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.arc(drawX, drawY, imgRadius, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(cachedImg, drawX - imgRadius, drawY - imgRadius, imgRadius * 2, imgRadius * 2);
          ctx.restore();
        }
      }

      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    const fontSize = 11 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2 / globalScale;
    const textY = drawY + half + 4;
    ctx.strokeText(label, drawX, textY);
    ctx.fillText(label, drawX, textY);
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (node.nodeType === 'group' || node.type === 'group') {
      // 그룹 클릭 시 위젯 내에서 해당 그룹으로 이동
      let groupId = node.groupId || node.id;
      if (typeof groupId === 'string' && groupId.startsWith('group_')) {
        groupId = groupId.replace('group_', '');
      }

      // 현재 그룹을 히스토리에 추가
      if (displayGroupId) {
        setGroupHistory(prev => [...prev, displayGroupId]);
      }

      // 새 그룹으로 이동
      setCurrentGroupId(groupId);
    }
    // 장비 클릭 시에는 아무 동작 안 함 (위젯 내에서만 동작)
  }, [displayGroupId]);

  const handleBackClick = useCallback(() => {
    if (groupHistory.length > 0) {
      // 히스토리에서 이전 그룹 ID 가져오기
      const previousGroupId = groupHistory[groupHistory.length - 1];
      setGroupHistory(prev => prev.slice(0, -1));
      setCurrentGroupId(previousGroupId);
    } else {
      // 히스토리가 없으면 최상위 그룹으로
      setCurrentGroupId(null);
    }
  }, [groupHistory]);

  // 현재 그룹 정보 찾기
  const findGroupInfo = (groupId) => {
    if (!groupTree || !groupId) return null;

    const searchTree = (groups) => {
      for (const group of groups) {
        if (group.GROUP_ID === groupId) {
          return group;
        }
        if (group.children && group.children.length > 0) {
          const found = searchTree(group.children);
          if (found) return found;
        }
      }
      return null;
    };

    return searchTree(groupTree);
  };

  const currentGroup = findGroupInfo(displayGroupId);
  const currentGroupName = currentGroup?.GROUP_NAME || '전체';

  const renderOverlay = () => {
    if (isLoading) {
      return (
        <div className="topology-overlay">
          <div className="loading-spinner"></div>
          <span>토폴로지 로딩 중...</span>
        </div>
      );
    }
    if (!defaultGroupId) {
      return (
        <div className="topology-overlay">
          <i className="bi bi-diagram-3" style={{ fontSize: '48px', color: '#475569' }}></i>
          <span>등록된 그룹이 없습니다</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="topology-graph-container" ref={containerRef}>
      {renderOverlay()}
      {/* 현재 그룹 표시 */}
      {!isLoading && defaultGroupId && (
        <div className="topology-current-group">
          <i className="bi bi-folder"></i>
          <span title={currentGroupName}>{currentGroupName}</span>
        </div>
      )}
      {dimensionsReady && !isLoading && defaultGroupId && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 18, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor={() => '#475569'}
          linkWidth={2}
          onNodeClick={handleNodeClick}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={false}
          cooldownTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          onRenderFramePre={(ctx) => {
            if (backgroundImageRef.current && backgroundImageRef.current.complete) {
              const img = backgroundImageRef.current;
              const bgScale = 0.4;
              const scaledWidth = img.naturalWidth * bgScale;
              const scaledHeight = img.naturalHeight * bgScale;
              const drawX = -scaledWidth / 2;
              const drawY = -scaledHeight / 2;
              ctx.save();
              ctx.globalAlpha = 0.4;
              ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
              ctx.restore();
            }
          }}
        />
      )}
      {/* 뒤로 가기 버튼 (하위 그룹에 있을 때만 표시) */}
      {currentGroupId && groupHistory.length > 0 && (
        <button className="topology-back-btn" onClick={handleBackClick} title="뒤로 가기">
          <i className="bi bi-arrow-left"></i>
        </button>
      )}
      <button className="topology-expand-btn" onClick={onExpand} title="전체 화면">
        <i className="bi bi-arrows-fullscreen"></i>
      </button>
    </div>
  );
}

const MemoizedTopologyWidget = memo(TopologyWidget);

// 색상 팔레트 (장비별로 다른 색상 할당)
const DEVICE_COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#22c55e', '#f97316', '#6366f1'
];

// 사용자 정의 위젯 차트 컨텐츠 (백엔드 데이터 사용)
function CustomWidgetContent({ widget, isEditMode }) {
  const containerRef = useRef(null);
  const [tooltipOnLeft, setTooltipOnLeft] = useState(false);

  // 컨테이너 위치에 따라 툴팁 방향 결정
  useEffect(() => {
    const updateTooltipPosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const chartCenterX = rect.left + rect.width / 2;
        const screenWidth = window.innerWidth;
        // 위젯이 화면 오른쪽 절반에 있으면 툴팁을 왼쪽에
        setTooltipOnLeft(chartCenterX > screenWidth / 2);
      }
    };

    // 초기 계산 (레이아웃 완료 후)
    const timer = setTimeout(updateTooltipPosition, 100);

    // 리사이즈 및 주기적 업데이트
    window.addEventListener('resize', updateTooltipPosition);
    const interval = setInterval(updateTooltipPosition, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [widget.id]);

  // config 파싱 및 기본값 적용
  const config = useMemo(() => {
    let parsedConfig = {};

    // config 파싱
    if (widget.config) {
      try {
        parsedConfig = typeof widget.config === 'string'
          ? JSON.parse(widget.config)
          : widget.config;
      } catch (e) {
        console.error('CONFIG 파싱 실패:', e);
      }
    }

    // config가 비어있으면 widget.type에 따른 기본 config 적용
    const hasConfigData = parsedConfig.elements && parsedConfig.elements.length > 0;
    if (!hasConfigData && widget.type) {
      const defaultType = DEFAULT_WIDGET_TYPES[widget.type];
      if (defaultType?.defaultConfig) {
        parsedConfig = { ...defaultType.defaultConfig, ...parsedConfig };
      }
    }

    return parsedConfig;
  }, [widget.config, widget.type]);

  const elements = config.elements || [];
  const chartType = config.chartType || 'bar';
  const selectedGroup = config.group;

  // 라인 차트 시간 범위 상태
  const [timeRange, setTimeRange] = useState('all'); // 'all', '1h', '3h', '6h', '12h'

  // 백엔드에서 받은 chartData 사용
  const rawChartData = widget.chartData || [];


  if (elements.length === 0) {
    return (
      <div className="widget-content-inner">
        <div className="widget-placeholder">
          <i className="bi bi-sliders"></i>
          <span>설정된 모니터링 요소가 없습니다</span>
        </div>
      </div>
    );
  }

  // 선택한 요소의 메타데이터 가져오기 (색상 등)
  const elementMeta = elements.length > 0 ? MONITORING_ELEMENTS[elements[0]] : null;
  const baseColor = elementMeta?.color || '#3b82f6';

  // chartData 변환: 백엔드 형식 → 차트 렌더링 형식
  const chartData = Array.isArray(rawChartData)
    ? (() => {
        const filtered = rawChartData.filter(item => item != null);

        // 라인 차트: deviceId별로 그룹화하여 시계열 데이터 생성
        if (chartType === 'line') {
          // metric 필드가 있는지 확인
          const hasMetricField = filtered.length > 0 && filtered[0].metric;

          if (hasMetricField) {
            // Multiple Metrics: 각 메트릭별로 상위 디바이스들 표시
            const metricDeviceMap = new Map(); // Map<metric, Map<deviceId, data>>

            // 1. (metric, deviceId) 조합별로 시계열 데이터 생성
            filtered.forEach(item => {
              const metric = item.metric || 'unknown';
              const deviceId = item.deviceId || 'unknown';
              const key = `${metric}|||${deviceId}`;

              if (!metricDeviceMap.has(key)) {
                metricDeviceMap.set(key, {
                  metric: metric,
                  deviceId: deviceId,
                  deviceName: item.deviceName || `장비 ${deviceId}`,
                  values: [],
                  timestamps: []
                });
              }
              const data = metricDeviceMap.get(key);
              data.values.push(item.linePct || 0);
              data.timestamps.push(item.timestamp);
            });

            // 2. Map을 배열로 변환
            let allData = Array.from(metricDeviceMap.values());

            // 3. 각 메트릭별로 상위 5개 디바이스만 선택 (평균값 기준)
            const metricGroups = new Map();
            allData.forEach(data => {
              if (!metricGroups.has(data.metric)) {
                metricGroups.set(data.metric, []);
              }
              // 평균값 계산
              const avg = data.values.reduce((sum, v) => sum + v, 0) / data.values.length;
              metricGroups.get(data.metric).push({ ...data, avgValue: avg });
            });

            // 각 메트릭별로 상위 5개만 선택 (elements에 포함된 것만)
            let selectedData = [];
            metricGroups.forEach((devices, metric) => {
              // elements에 포함된 메트릭만 처리
              if (!elements.includes(metric)) return;

              const top5 = devices
                .sort((a, b) => b.avgValue - a.avgValue)
                .slice(0, 5);
              selectedData.push(...top5);
            });

            // 4. 시간 범위 필터링
            if (timeRange !== 'all' && selectedData.length > 0) {
              const totalPoints = selectedData[0].timestamps.length;
              let pointsToShow;

              switch (timeRange) {
                case '1h':
                  pointsToShow = Math.min(12, totalPoints);
                  break;
                case '3h':
                  pointsToShow = Math.min(36, totalPoints);
                  break;
                case '6h':
                  pointsToShow = Math.min(72, totalPoints);
                  break;
                case '12h':
                  pointsToShow = Math.min(144, totalPoints);
                  break;
                default:
                  pointsToShow = totalPoints;
              }

              const startIndex = Math.max(0, totalPoints - pointsToShow);
              selectedData = selectedData.map(data => ({
                ...data,
                values: data.values.slice(startIndex),
                timestamps: data.timestamps.slice(startIndex)
              }));
            }

            // 5. 메트릭별 색상 정의
            const metricColors = {
              // ICMP 메트릭
              'ICMP_MAX': '#ef4444',
              'ICMP_MIN': '#3b82f6',
              'ICMP_AVG': '#10b981',
              'ICMP_LOSS': '#f59e0b',
              // TRAFFIC 메트릭
              'TRAFFIC_IN_BPS': '#06b6d4',   // 시안
              'TRAFFIC_OUT_BPS': '#10b981',  // 초록
              'TRAFFIC_IN_BYTE': '#3b82f6',  // 파랑
              'TRAFFIC_OUT_BYTE': '#eab308', // 노란색
              'TRAFFIC_INPUT_BYTE': '#3b82f6',
              'TRAFFIC_OUTPUT_BYTE': '#eab308',
              'TRAFFIC_IN_PKT': '#0891b2',   // 진한 시안
              'TRAFFIC_OUT_PKT': '#67e8f9',  // 밝은 시안
              'TRAFFIC_IN_ERR': '#ef4444',   // 빨강
              'TRAFFIC_OUT_ERR': '#f59e0b',  // 주황
              'TRAFFIC_IN_DROP': '#a855f7',
              'TRAFFIC_OUT_DROP': '#ec4899',
              // CPU/MEMORY 메트릭
              'CPU_USAGE': '#a855f7',
              'MEMORY_USAGE': '#ec4899',
            };

            // 6. 메트릭별로 그룹화하여 색상 할당
            const metricColorMap = new Map();
            selectedData.forEach(data => {
              if (!metricColorMap.has(data.metric)) {
                metricColorMap.set(data.metric, []);
              }
              metricColorMap.get(data.metric).push(data);
            });

            // 7. 색상 톤 변화 함수 (같은 메트릭 내 디바이스 구분용)
            const adjustColorBrightness = (hexColor, index, total) => {
              try {
                // hex 색상인지 확인
                if (!hexColor || typeof hexColor !== 'string') {
                  return hexColor;
                }

                // #이 없으면 추가
                const color = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;

                // hex를 RGB로 변환
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);

                // 유효성 검사
                if (isNaN(r) || isNaN(g) || isNaN(b)) {
                  return hexColor;
                }

                // 명도 조절 (0.7 ~ 1.2 범위)
                const factor = 0.7 + (index / Math.max(1, total - 1)) * 0.5;

                const newR = Math.min(255, Math.max(0, Math.floor(r * factor)));
                const newG = Math.min(255, Math.max(0, Math.floor(g * factor)));
                const newB = Math.min(255, Math.max(0, Math.floor(b * factor)));

                return `rgb(${newR}, ${newG}, ${newB})`;
              } catch (error) {
                console.error('색상 변환 에러:', error, hexColor);
                return hexColor;
              }
            };

            // 9. 메트릭별 단위 정의
            const metricUnits = {
              'ICMP_MAX': 'ms',
              'ICMP_MIN': 'ms',
              'ICMP_AVG': 'ms',
              'ICMP_LOSS': '%',
              'TRAFFIC_IN_BPS': 'bps',
              'TRAFFIC_OUT_BPS': 'bps',
              'TRAFFIC_IN_BYTE': 'byte',
              'TRAFFIC_OUT_BYTE': 'byte',
              'TRAFFIC_INPUT_BYTE': 'byte',
              'TRAFFIC_OUTPUT_BYTE': 'byte',
              'TRAFFIC_IN_PKT': 'pkt',
              'TRAFFIC_OUT_PKT': 'pkt',
              'TRAFFIC_IN_ERR': '개',
              'TRAFFIC_OUT_ERR': '개',
              'TRAFFIC_IN_DROP': '개',
              'TRAFFIC_OUT_DROP': '개',
              'CPU_USAGE': '%',
              'MEMORY_USAGE': '%',
            };

            // 10. 색상 및 짧은 라벨 추가 후 반환
            let result = [];
            metricColorMap.forEach((devices, metric) => {
              const baseColor = metricColors[metric] || '#14b8a6';
              const shortMetric = getShortMetricName(metric);
              const deviceCount = devices.length;
              const metricUnit = metricUnits[metric] || '%';

              devices.forEach((data, index) => {
                // 디바이스 이름도 10자로 제한
                const shortDeviceName = data.deviceName.length > 10
                  ? data.deviceName.substring(0, 10)
                  : data.deviceName;

                // 같은 메트릭 내에서 디바이스별로 색상 톤 변화
                const deviceColor = deviceCount > 1
                  ? adjustColorBrightness(baseColor, index, deviceCount)
                  : baseColor;

                result.push({
                  ...data,
                  value: data.values,
                  color: deviceColor,
                  unit: metricUnit,
                  displayName: `${shortMetric}-${shortDeviceName}`,
                  fullDisplayName: `${data.metric} - ${data.deviceName}`, // 툴팁용
                  _key: `${data.metric}-${data.deviceId}-line`
                });
              });
            });
            return result;
          }

          // 기본: deviceId별로만 그룹화 (metric 필드 없음)
          const deviceMap = new Map();

          filtered.forEach(item => {
            const deviceId = item.deviceId || 'unknown';
            if (!deviceMap.has(deviceId)) {
              deviceMap.set(deviceId, {
                deviceId: deviceId,
                deviceName: item.deviceName || `장비 ${deviceId}`,
                values: [],
                timestamps: []
              });
            }
            const device = deviceMap.get(deviceId);
            device.values.push(item.linePct || 0);
            device.timestamps.push(item.timestamp);
          });

          // Map을 배열로 변환
          let deviceArray = Array.from(deviceMap.values());

          // 시간 범위 필터링
          if (timeRange !== 'all' && deviceArray.length > 0) {
            const totalPoints = deviceArray[0].timestamps.length;
            let pointsToShow;

            switch (timeRange) {
              case '1h':
                pointsToShow = Math.min(12, totalPoints); // 5분 간격 기준 1시간 = 12개
                break;
              case '3h':
                pointsToShow = Math.min(36, totalPoints); // 3시간 = 36개
                break;
              case '6h':
                pointsToShow = Math.min(72, totalPoints); // 6시간 = 72개
                break;
              case '12h':
                pointsToShow = Math.min(144, totalPoints); // 12시간 = 144개
                break;
              default:
                pointsToShow = totalPoints;
            }

            // 최신 데이터만 표시
            const startIndex = Math.max(0, totalPoints - pointsToShow);
            deviceArray = deviceArray.map(device => ({
              ...device,
              values: device.values.slice(startIndex),
              timestamps: device.timestamps.slice(startIndex)
            }));
          }

          // 색상 추가
          return deviceArray.map((device, index) => ({
            ...device,
            value: device.values, // 시계열 값 배열
            color: DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length],
            unit: elementMeta?.unit || '%',
            _key: `${device.deviceId}-line`
          }));
        }

        // 파이/막대 차트: 최신 값만 사용 (deviceId별로 중복 제거)
        else {
          const deviceMap = new Map();

          filtered.forEach(item => {
            const deviceId = item.deviceId || 'unknown';
            // 같은 deviceId가 있으면 최신 값으로 덮어쓰기 (마지막 값 사용)
            deviceMap.set(deviceId, item);
          });

          return Array.from(deviceMap.values()).map((item, index) => {
            const deviceId = item.deviceId || `device-${index}`;
            // 차트 타입에 따라 다른 필드 사용
            const value = chartType === 'pie'
              ? (item.piePct || 0)
              : chartType === 'bar'
                ? (item.barPct || 0)
                : 0;

            return {
              deviceId: deviceId,
              deviceName: item.deviceName || `장비 ${deviceId}`,
              value: value,
              color: DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length],
              unit: elementMeta?.unit || '%',
              _key: `${deviceId}-${index}`
            };
          });
        }
      })()
    : [];

  // ECharts 옵션 생성
  const getChartOption = (tooltipOnLeft = false) => {
    const elementMeta = elements.length > 0 ? MONITORING_ELEMENTS[elements[0]] : null;
    const elementName = elementMeta?.name || '모니터링';

    // 파이 차트
    if (chartType === 'pie') {
      // metric 필드가 있는지 확인 (Multiple Pie Charts용)
      const hasMetricField = rawChartData.length > 0 && rawChartData[0].metric;

      if (hasMetricField) {
        // Multiple Pie Charts: 각 메트릭별로 작은 파이 차트 표시

        // 1. 고유한 메트릭 목록 추출 (elements에 포함된 것만)
        const uniqueMetrics = [...new Set(rawChartData.map(item => item.metric))]
          .filter(metric => elements.includes(metric));

        // 2. 메트릭 개수에 따른 동적 레이아웃 생성
        const getPositionConfig = (metricCount) => {
          if (metricCount === 1) {
            return [{ center: ['50%', '50%'], titleTop: '25%' }];
          } else if (metricCount === 2) {
            return [
              { center: ['33%', '50%'], titleTop: '25%' },  // 좌측
              { center: ['67%', '50%'], titleTop: '25%' },  // 우측
            ];
          } else if (metricCount === 3) {
            return [
              { center: ['33%', '50%'], titleTop: '25%' },  // 좌측
              { center: ['67%', '50%'], titleTop: '25%' },  // 우측
              { center: ['50%', '80%'], titleTop: '60%' },  // 하단 중앙
            ];
          } else if (metricCount === 4) {
            return [
              { center: ['25%', '30%'], titleTop: '5%' },   // 좌측 상단
              { center: ['75%', '30%'], titleTop: '5%' },   // 우측 상단
              { center: ['25%', '70%'], titleTop: '55%' },  // 좌측 하단
              { center: ['75%', '70%'], titleTop: '55%' },  // 우측 하단
            ];
          } else if (metricCount === 5) {
            return [
              { center: ['25%', '25%'], titleTop: '5%' },   // 좌측 상단
              { center: ['75%', '25%'], titleTop: '5%' },   // 우측 상단
              { center: ['25%', '65%'], titleTop: '50%' },  // 좌측 하단
              { center: ['75%', '65%'], titleTop: '50%' },  // 우측 하단
              { center: ['50%', '90%'], titleTop: '78%' },  // 최하단 중앙
            ];
          } else {
            // 6개 이상: 3x2 그리드
            return [
              { center: ['20%', '25%'], titleTop: '5%' },
              { center: ['50%', '25%'], titleTop: '5%' },
              { center: ['80%', '25%'], titleTop: '5%' },
              { center: ['20%', '65%'], titleTop: '50%' },
              { center: ['50%', '65%'], titleTop: '50%' },
              { center: ['80%', '65%'], titleTop: '50%' },
            ];
          }
        };

        const positions = getPositionConfig(uniqueMetrics.length);

        // 메트릭별 기본 색상 정의
        const metricBaseColors = {
          // ICMP 메트릭
          'ICMP_MAX': '#ef4444',
          'ICMP_MIN': '#3b82f6',
          'ICMP_AVG': '#10b981',
          'ICMP_LOSS': '#f59e0b',
          // TRAFFIC 메트릭
          'TRAFFIC_IN_BPS': '#06b6d4',
          'TRAFFIC_OUT_BPS': '#10b981',
          'TRAFFIC_IN_BYTE': '#3b82f6',
          'TRAFFIC_OUT_BYTE': '#eab308',
          'TRAFFIC_IN_PKT': '#0891b2',
          'TRAFFIC_OUT_PKT': '#67e8f9',
          'TRAFFIC_IN_ERR': '#ef4444',
          'TRAFFIC_OUT_ERR': '#f59e0b',
          'TRAFFIC_IN_DROP': '#a855f7',
          'TRAFFIC_OUT_DROP': '#ec4899',
          // CPU/MEMORY 메트릭
          'CPU_USAGE': '#a855f7',
          'MEMORY_USAGE': '#ec4899',
        };

        // 3. 각 메트릭별로 데이터 및 시리즈 생성
        const metricDataMap = uniqueMetrics.map((metric, index) => {
          const metricData = rawChartData
            .filter(item => item.metric === metric && item.piePct != null && item.piePct > 0)
            .slice(0, 10)
            .map((item, idx) => ({
              name: item.deviceName,
              value: item.piePct,
              itemStyle: {
                color: DEVICE_COLOR_PALETTE[idx % DEVICE_COLOR_PALETTE.length]
              }
            }));

          const position = positions[index] || { center: ['50%', '50%'], titleTop: '25%' };
          const hasData = metricData.length > 0;

          return { metric, metricData, position, hasData };
        });

        // 데이터가 있는 메트릭의 시리즈만 생성
        const series = metricDataMap
          .filter(m => m.hasData)
          .map(({ metric, metricData, position }) => ({
            name: getShortMetricName(metric),
            type: 'pie',
            radius: ['18%', '35%'],
            center: position.center,
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#0f172a',
              borderWidth: 1
            },
            label: {
              show: true,
              formatter: '{b}\n{d}%',
              color: '#94a3b8',
              fontSize: 10,
              position: 'outside',
              alignTo: 'edge',
              margin: 8
            },
            labelLine: {
              show: true,
              length: 8,
              length2: 8,
              lineStyle: {
                color: '#475569',
                width: 1
              }
            },
            emphasis: {
              label: { show: true, fontSize: 11, fontWeight: 'bold' },
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
            },
            data: metricData
          }));

        // 데이터 없는 메트릭을 위한 빈 파이 차트 시리즈 (회색 링 + 중앙 텍스트)
        const emptySeries = metricDataMap
          .filter(m => !m.hasData)
          .map(({ metric, position }) => ({
            name: getShortMetricName(metric),
            type: 'pie',
            radius: ['18%', '35%'],
            center: position.center,
            silent: true,
            label: {
              show: true,
              position: 'center',
              formatter: '데이터 없음',
              color: '#64748b',
              fontSize: 11
            },
            labelLine: { show: false },
            itemStyle: {
              color: 'rgba(51, 65, 85, 0.3)',
              borderColor: '#475569',
              borderWidth: 1,
              borderType: 'dashed'
            },
            emphasis: {
              scale: false
            },
            data: [{ value: 1, name: '데이터 없음' }]
          }));

        // 전체 데이터가 없을 때
        if (series.length === 0) {
          return {
            backgroundColor: 'transparent',
            tooltip: { show: false },
            graphic: [{
              type: 'group',
              left: 'center',
              top: 'middle',
              children: [
                {
                  type: 'circle',
                  shape: { r: 50 },
                  style: {
                    fill: 'transparent',
                    stroke: '#334155',
                    lineWidth: 2,
                    lineDash: [5, 5]
                  }
                },
                {
                  type: 'text',
                  style: {
                    text: '데이터 없음',
                    fill: '#64748b',
                    font: 'bold 13px sans-serif',
                    textAlign: 'center',
                    textVerticalAlign: 'middle'
                  }
                }
              ]
            }],
            series: []
          };
        }

        // 4. 각 메트릭의 타이틀 표시를 위한 title 요소
        const titles = uniqueMetrics.map((metric, index) => {
          const position = positions[index] || { center: ['50%', '50%'], titleTop: '25%' };

          return {
            text: getShortMetricName(metric),
            left: position.center[0],
            top: position.titleTop,
            textAlign: 'center',
            textStyle: {
              color: '#94a3b8',
              fontSize: 11,
              fontWeight: 'bold'
            }
          };
        });

        return {
          backgroundColor: 'transparent',
          title: titles,
          tooltip: {
            trigger: 'item',
            formatter: (params) => {
              // 빈 데이터 시리즈는 툴팁 표시 안함
              if (params.data.name === '데이터 없음') return '';
              return `${params.seriesName}<br/>${params.name}: ${params.percent}%`;
            },
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#f1f5f9' }
          },
          series: [...series, ...emptySeries]
        };
      }

      // 기본 Pie Chart: 단일 메트릭 (value가 null이 아니고 0보다 큰 것만)
      const pieData = chartData
        .filter(item => item.value != null && item.value > 0)
        .map(item => ({
          name: item.deviceName,
          value: item.value,
          itemStyle: { color: item.color }
        }));

      // 데이터가 없을 때 빈 상태 표시
      const hasData = pieData.length > 0;

      // 데이터 없을 때는 빈 상태 표시
      if (!hasData) {
        return {
          backgroundColor: 'transparent',
          tooltip: { show: false },
          graphic: [{
            type: 'group',
            left: 'center',
            top: 'middle',
            children: [
              {
                type: 'circle',
                shape: { r: 50 },
                style: {
                  fill: 'transparent',
                  stroke: '#334155',
                  lineWidth: 2,
                  lineDash: [5, 5]
                }
              },
              {
                type: 'text',
                style: {
                  text: '데이터 없음',
                  fill: '#64748b',
                  font: 'bold 13px sans-serif',
                  textAlign: 'center',
                  textVerticalAlign: 'middle'
                }
              }
            ]
          }],
          series: []
        };
      }

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {d}%',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' }
        },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { color: '#94a3b8', fontSize: 11 },
          itemWidth: 12,
          itemHeight: 12
        },
        series: [{
          name: elementName,
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#0f172a',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            color: '#94a3b8',
            fontSize: 11,
            position: 'outside',
            alignTo: 'edge',
            margin: 10
          },
          labelLine: {
            show: true,
            length: 10,
            length2: 10,
            lineStyle: {
              color: '#475569',
              width: 1
            }
          },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
          },
          data: pieData
        }]
      };
    }

    // 막대 차트
    if (chartType === 'bar') {
      // metric 필드가 있는지 확인 (Grouped Bar Chart용)
      const hasMetricField = rawChartData.length > 0 && rawChartData[0].metric;

      if (hasMetricField) {
        // Grouped Bar Chart: 여러 메트릭을 함께 표시

        // 1. 고유한 디바이스 목록 추출 (x축)
        const uniqueDevices = [...new Set(rawChartData.map(item => item.deviceName))];

        // 2. 고유한 메트릭 목록 추출 (각 시리즈, elements에 포함된 것만)
        const uniqueMetrics = [...new Set(rawChartData.map(item => item.metric))]
          .filter(metric => elements.includes(metric));

        // 3. 메트릭별 색상 정의
        const metricColors = {
          // ICMP 메트릭
          'ICMP_MAX': '#ef4444',    // 빨강
          'ICMP_MIN': '#3b82f6',    // 파랑
          'ICMP_AVG': '#10b981',    // 초록
          'ICMP_LOSS': '#f59e0b',   // 주황
          // TRAFFIC 메트릭
          'TRAFFIC_IN_BPS': '#06b6d4',   // 시안
          'TRAFFIC_OUT_BPS': '#10b981',  // 초록
          'TRAFFIC_IN_BYTE': '#3b82f6',  // 파랑
          'TRAFFIC_OUT_BYTE': '#eab308', // 노랑
          'TRAFFIC_INPUT_BYTE': '#3b82f6',  // 파랑
          'TRAFFIC_OUTPUT_BYTE': '#eab308', // 노랑
          'TRAFFIC_IN_PKT': '#0891b2',   // 진한 시안
          'TRAFFIC_OUT_PKT': '#67e8f9',  // 밝은 시안
          'TRAFFIC_IN_ERR': '#ef4444',   // 빨강
          'TRAFFIC_OUT_ERR': '#f59e0b',  // 주황
          'TRAFFIC_IN_DROP': '#a855f7',  // 밝은 보라
          'TRAFFIC_OUT_DROP': '#ec4899', // 핑크
          // CPU/MEMORY 메트릭
          'CPU_USAGE': '#a855f7',   // 밝은 보라
          'MEMORY_USAGE': '#ec4899', // 핑크
        };

        // 4. 각 메트릭별로 시리즈 생성
        const series = uniqueMetrics.map(metric => {
          // 해당 메트릭의 데이터만 필터링하여 디바이스 순서에 맞게 배치
          const metricData = uniqueDevices.map(deviceName => {
            const found = rawChartData.find(
              item => item.metric === metric && item.deviceName === deviceName
            );
            return found ? found.barPct : 0;
          });

          return {
            name: getShortMetricName(metric),
            type: 'bar',
            data: metricData,
            itemStyle: {
              color: metricColors[metric] || '#14b8a6', // 기본: 밝은 청록색
              borderRadius: [4, 4, 0, 0]
            }
          };
        });

        return {
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            textStyle: { color: '#f1f5f9' },
            formatter: (params) => {
              if (!params || params.length === 0) return '';
              let result = `<div style="font-weight: bold; margin-bottom: 4px;">${params[0].name}</div>`;
              params.forEach(param => {
                if (param.value == null) return;
                // 메트릭별 단위 결정
                let unit = '';
                if (param.seriesName.includes('BPS')) unit = 'bps';
                else if (param.seriesName.includes('BYTE')) unit = 'byte';
                else if (param.seriesName.includes('PKT')) unit = 'pkt';
                else if (param.seriesName.includes('ERR') || param.seriesName.includes('DROP')) unit = '';
                else if (param.seriesName.includes('LOSS')) unit = '%';
                else unit = 'ms';
                const displayValue = formatLargeValue(param.value, unit);
                const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};margin-right:6px;"></span>`;
                result += `<div style="margin-top: 2px;">${marker}${param.seriesName}: <strong>${displayValue}${unit}</strong></div>`;
              });
              return result;
            }
          },
          legend: {
            data: uniqueMetrics.map(getShortMetricName),
            textStyle: { color: '#94a3b8', fontSize: 10 },
            bottom: 0,
            itemWidth: 12,
            itemHeight: 12,
            type: 'scroll',
            pageIconColor: '#3b82f6',
            pageIconInactiveColor: '#475569'
          },
          grid: {
            left: '2%',
            right: '2%',
            bottom: '15%',
            top: '5%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: uniqueDevices,
            axisLabel: {
              color: '#94a3b8',
              fontSize: 9,
              interval: 'auto',
              rotate: 30,
              overflow: 'truncate',
              width: 60
            },
            axisLine: { lineStyle: { color: '#334155' } }
          },
          yAxis: {
            type: 'value',
            name: 'ms / %',
            nameTextStyle: { color: '#94a3b8' },
            axisLabel: {
              color: '#94a3b8',
              formatter: (value) => formatLargeValue(value, '')
            },
            axisLine: { lineStyle: { color: '#334155' } },
            splitLine: { lineStyle: { color: '#1e293b' } }
          },
          series: series
        };
      }

      // 기본 Bar Chart: 단일 메트릭
      const barUnit = elementMeta?.unit || '%';
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' },
          formatter: (params) => {
            const param = params[0];
            if (!param) return '';
            const displayValue = formatLargeValue(param.value, barUnit);
            return `${param.name}<br/>${param.seriesName}: <strong>${displayValue}${barUnit}</strong>`;
          }
        },
        grid: {
          left: '2%',
          right: '2%',
          bottom: '12%',
          top: '8%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: chartData.map(item => item.deviceName),
          axisLabel: {
            color: '#94a3b8',
            fontSize: 9,
            interval: 'auto',
            rotate: 30,
            overflow: 'truncate',
            width: 60
          },
          axisLine: { lineStyle: { color: '#334155' } }
        },
        yAxis: {
          type: 'value',
          name: elementMeta?.unit || '%',
          nameTextStyle: { color: '#94a3b8', fontSize: 10 },
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: (value) => formatLargeValue(value, elementMeta?.unit || '%')
          },
          axisLine: { lineStyle: { color: '#334155' } },
          splitLine: { lineStyle: { color: '#1e293b' } }
        },
        series: [{
          name: elementName,
          type: 'bar',
          data: chartData.map(item => ({
            value: item.value,
            itemStyle: { color: item.color }
          })),
          barWidth: '60%',
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }]
      };
    }

    // 선 차트
    if (chartType === 'line') {
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(30, 41, 59, 0.98)',
          borderColor: '#334155',
          borderWidth: 2,
          textStyle: { color: '#f1f5f9', fontSize: 11 },
          confine: false,
          enterable: true,
          hideDelay: 500,
          appendToBody: true,
          alwaysShowContent: false,
          triggerOn: 'mousemove|click',
          extraCssText: 'max-width: 300px; max-height: 60vh; box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: auto;',
          // 고정 위치: 컴포넌트에서 계산한 위치 사용 (안정적)
          position: function (point, params, dom, rect, size) {
            const tooltipWidth = size.contentSize[0];
            const viewWidth = size.viewSize[0];

            // tooltipOnLeft 값에 따라 위치 결정 (컴포넌트에서 미리 계산됨)
            if (tooltipOnLeft) {
              return [-tooltipWidth - 10, 0];
            } else {
              return [viewWidth + 10, 0];
            }
          },
          formatter: (params) => {
            if (!params || params.length === 0) return '';

            // 첫 번째 파라미터에서 인덱스 가져오기
            const dataIndex = params[0].dataIndex;
            const timestamps = chartData[0]?.timestamps || [];
            const fullTimestamp = timestamps[dataIndex] || '';

            // 툴팁 헤더
            let header = `<div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">${fullTimestamp}</div>`;

            // 툴팁 아이템들 (스크롤 가능) - 모든 chartData 항목 표시
            let items = '';

            // params에서 값 맵 생성 (seriesName -> value, color)
            const paramsMap = new Map();
            params.forEach(param => {
              paramsMap.set(param.seriesName, {
                value: param.value,
                color: param.color
              });
            });

            // 모든 chartData 항목을 순회하며 툴팁 생성
            chartData.forEach((dataItem) => {
              const seriesName = dataItem.displayName || dataItem.deviceName;
              const color = dataItem.color || '#3b82f6';
              const unit = dataItem?.unit || '%';

              // params에서 값 찾기, 없으면 values 배열에서 직접 가져오기
              let value;
              if (paramsMap.has(seriesName)) {
                value = paramsMap.get(seriesName).value;
              } else if (Array.isArray(dataItem.value) && dataIndex < dataItem.value.length) {
                value = dataItem.value[dataIndex];
              } else if (Array.isArray(dataItem.values) && dataIndex < dataItem.values.length) {
                value = dataItem.values[dataIndex];
              }

              const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>`;

              // 값이 없으면 '-' 표시
              if (value == null || isNaN(value)) {
                items += `<div style="margin-top: 4px; white-space: nowrap; font-size: 12px; opacity: 0.5;">${marker}${seriesName}: <strong>-</strong></div>`;
              } else {
                // 절대값으로 표시 + K/M/G 단위 적용
                const displayValue = formatLargeValue(Math.abs(value), unit);
                items += `<div style="margin-top: 4px; white-space: nowrap; font-size: 12px;">${marker}${seriesName}: <strong>${displayValue}${unit}</strong></div>`;
              }
            });

            // 항목 수에 따라 스크롤 힌트 표시 (각 항목 약 24px, max-height 280px → 약 11개 표시 가능)
            const itemCount = chartData.length;
            const scrollHint = itemCount > 11
              ? `<div style="text-align: center; padding: 6px 0 2px; color: #64748b; font-size: 10px; border-top: 1px solid #334155; margin-top: 6px;">
                  <span style="opacity: 0.8;">↕ 스크롤하여 ${itemCount}개 항목 모두 보기</span>
                </div>`
              : '';

            // 스크롤 가능한 컨테이너로 감싸기 (스크롤바 스타일 추가)
            return `${header}<div style="max-height: 280px; overflow-y: auto; overflow-x: hidden; padding-right: 8px; scrollbar-width: thin; scrollbar-color: #64748b #1e293b;">
              <style>
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #1e293b; }
                ::-webkit-scrollbar-thumb { background: #64748b; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
              </style>
              ${items}
            </div>${scrollHint}`;
          }
        },
        legend: {
          data: chartData.map(item => item.displayName || item.deviceName),
          textStyle: {
            color: '#94a3b8',
            fontSize: 10,
            overflow: 'truncate',
            width: 100
          },
          bottom: 0,
          left: 'center',
          type: 'scroll',
          orient: 'horizontal',
          pageIconColor: '#3b82f6',
          pageIconInactiveColor: '#475569',
          pageTextStyle: { color: '#94a3b8' },
          tooltip: {
            show: true,
            formatter: (params) => {
              const item = chartData.find(d => d.displayName === params.name);
              return item?.fullDisplayName || params.name;
            }
          }
        },
        grid: {
          left: '2%',
          right: '2%',
          bottom: '15%',
          top: '8%',
          containLabel: true
        },
        toolbox: {
          show: true,
          right: 5,
          top: 0,
          itemSize: 12,
          feature: {
            dataZoom: {
              yAxisIndex: 'none',
              title: { zoom: '드래그 확대', back: '확대 복원' }
            },
            restore: {
              title: '복원'
            },
            saveAsImage: {
              title: '이미지 저장',
              backgroundColor: '#0f172a'
            }
          },
          iconStyle: { borderColor: '#94a3b8' },
          emphasis: { iconStyle: { borderColor: '#3b82f6' } }
        },
        dataZoom: [
          {
            type: 'inside',
            start: timeRange === 'all' ? 0 : 70,
            end: 100,
            zoomOnMouseWheel: 'shift',
            moveOnMouseMove: true
          }
        ],
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: chartData[0]?.timestamps?.map(ts => ts.split(' ')[1]?.substring(0, 5) || '') || [],
          axisLabel: { color: '#94a3b8', fontSize: 9 },
          axisLine: { lineStyle: { color: '#334155' } }
        },
        yAxis: {
          type: 'value',
          name: (() => {
            const units = [...new Set(chartData.map(item => item.unit))];
            return units.length === 1 ? units[0] : '';
          })(),
          nameTextStyle: { color: '#94a3b8' },
          axisLabel: {
            color: '#94a3b8',
            formatter: (value) => {
              const absValue = Math.abs(value);
              const unit = chartData[0]?.unit || '';
              return formatLargeValue(absValue, unit);
            }
          },
          axisLine: { lineStyle: { color: '#334155' } },
          splitLine: { lineStyle: { color: '#1e293b' } }
        },
        series: (() => {
          // RGB 색상을 RGBA로 변환하는 헬퍼
          const colorToRgba = (color, alpha) => {
            if (!color) return `rgba(59, 130, 246, ${alpha})`;
            if (color.startsWith('rgb(')) {
              const values = color.match(/\d+/g);
              if (values && values.length === 3) {
                return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
              }
            }
            return color;
          };

          // 전체 차트에서 최대값 찾기
          let globalMax = { value: -Infinity, seriesIndex: -1, dataIndex: -1, unit: '%' };
          chartData.forEach((item, seriesIdx) => {
            const values = item.value || item.values || [];
            values.forEach((val, dataIdx) => {
              const numVal = typeof val === 'number' ? val : parseFloat(val);
              if (!isNaN(numVal) && numVal > globalMax.value) {
                globalMax = { value: numVal, seriesIndex: seriesIdx, dataIndex: dataIdx, unit: item.unit || '%' };
              }
            });
          });

          return chartData.map((item, seriesIdx) => {
            const rawValues = item.value || item.values || [];
            const isMaxSeries = seriesIdx === globalMax.seriesIndex;

            // TRAFFIC 미러 차트: OUT 데이터는 음수로 변환
            const isOutMetric = selectedGroup === 'TRAFFIC' && item.metric && item.metric.includes('OUT');
            const dataValues = isOutMetric
              ? rawValues.map(v => (v != null ? -Math.abs(v) : v))
              : rawValues;

            return {
              name: item.displayName || item.deviceName,
              type: 'line',
              data: dataValues,
              smooth: true,
              symbol: 'circle',
              symbolSize: 4,
              lineStyle: { color: item.color, width: 2 },
              itemStyle: { color: item.color },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: isOutMetric
                    ? [
                        { offset: 0, color: colorToRgba(item.color, 0) },
                        { offset: 1, color: colorToRgba(item.color, 0.25) }
                      ]
                    : [
                        { offset: 0, color: colorToRgba(item.color, 0.25) },
                        { offset: 1, color: colorToRgba(item.color, 0) }
                      ]
                }
              },
              // 최대값이 있는 시리즈에만 markPoint 표시 (TRAFFIC 미러 차트에서는 제외)
              ...(!isOutMetric && isMaxSeries && globalMax.value !== -Infinity ? {
                markPoint: {
                  data: [{
                    coord: [globalMax.dataIndex, globalMax.value],
                    value: globalMax.value,
                    symbol: 'circle',
                    symbolSize: 12,
                    itemStyle: {
                      color: '#fff',
                      borderColor: item.color,
                      borderWidth: 3,
                      shadowColor: item.color,
                      shadowBlur: 8
                    },
                    label: {
                      show: true,
                      position: 'top',
                      distance: 8,
                      formatter: `{value|${formatLargeValue(globalMax.value, globalMax.unit)}${globalMax.unit}}`,
                      rich: {
                        value: {
                          fontSize: 12,
                          fontWeight: 'bold',
                          color: '#f1f5f9',
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          padding: [4, 8],
                          borderRadius: 4
                        }
                      }
                    }
                  }]
                }
              } : {})
            };
          });
        })()
      };
    }

    return {};
  };

  return (
    <div className="widget-content-inner" ref={containerRef}>
      <div className="custom-widget-content echarts-container">
        {chartData.length > 0 ? (
          <ReactECharts
            option={getChartOption(tooltipOnLeft)}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        ) : (
          <div className="widget-placeholder">
            <i className={`bi ${chartType === 'pie' ? 'bi-pie-chart' : chartType === 'bar' ? 'bi-bar-chart' : 'bi-graph-up'}`}></i>
            <span>데이터가 없습니다</span>
          </div>
        )}
      </div>
    </div>
  );
}

const MemoizedCustomWidgetContent_OLD = memo(CustomWidgetContent_OLD);

// OLD CODE BELOW - TO BE DELETED
function CustomWidgetContent_OLD({ widget, isEditMode }) {
  return (
    <div className="widget-content-inner">
      <div className="custom-widget-content">
        {/* 파이 차트 */}
        {false && (
          <div className="custom-pie-chart">
            <svg viewBox="0 0 200 200" className="pie-svg">
              {chartData.map((data, index) => {
                // 전체 합계 계산
                const total = chartData.reduce((sum, item) => sum + (item.value || 0), 0);

                // 현재 항목까지의 누적 각도 계산
                const prevSum = chartData.slice(0, index).reduce((sum, item) => sum + (item.value || 0), 0);
                const currentValue = data.value || 0;

                const startAngle = (prevSum / total) * 360 - 90;
                const endAngle = ((prevSum + currentValue) / total) * 360 - 90;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                const x1 = 100 + 80 * Math.cos(startRad);
                const y1 = 100 + 80 * Math.sin(startRad);
                const x2 = 100 + 80 * Math.cos(endRad);
                const y2 = 100 + 80 * Math.sin(endRad);

                const largeArc = (currentValue / total) > 0.5 ? 1 : 0;

                return (
                  <path
                    key={data._key}
                    d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={data.color}
                    opacity="0.8"
                    stroke="#1e293b"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
            <div className="pie-legend">
              {chartData.slice(0, 8).map((data) => {
                const deviceName = data.deviceName || `장비 ${data.deviceId}`;
                const displayName = deviceName.length > 8 ? `${deviceName.substring(0, 8)}...` : deviceName;
                return (
                  <div key={data._key} className="legend-item">
                    <span className="legend-dot" style={{ background: data.color }}></span>
                    <span title={`${deviceName}: ${data.value?.toFixed(1)}${data.unit}`}>
                      {displayName}: {data.value?.toFixed(1)}{data.unit}
                    </span>
                  </div>
                );
              })}
              {chartData.length > 8 && (
                <div className="legend-item">
                  <span className="legend-more">+{chartData.length - 8}개 더</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 데이터 없음 */}
        {chartType === 'pie' && chartData.length === 0 && (
          <div className="widget-placeholder">
            <i className="bi bi-pie-chart"></i>
            <span>데이터가 없습니다</span>
          </div>
        )}

        {/* 막대 차트 */}
        {chartType === 'bar' && chartData.length > 0 && (
          <div className="custom-bar-chart">
            <div className="bar-chart-container">
              {chartData.map((data) => {
                const deviceName = data.deviceName || `장비 ${data.deviceId}`;
                const displayName = deviceName.length > 6 ? `${deviceName.substring(0, 6)}...` : deviceName;
                return (
                  <div key={data._key} className="bar-column">
                    <div className="bar-wrapper">
                      <div
                        className="bar-fill-vertical"
                        style={{
                          height: `${Math.min(data.value || 0, 100)}%`,
                          background: data.color
                        }}
                      >
                        <span className="bar-value">{data.value?.toFixed(1)}{data.unit}</span>
                      </div>
                    </div>
                    <div className="bar-label">
                      <span className="device-name" title={deviceName}>
                        {displayName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 데이터 없음 */}
        {chartType === 'bar' && chartData.length === 0 && (
          <div className="widget-placeholder">
            <i className="bi bi-bar-chart"></i>
            <span>데이터가 없습니다</span>
          </div>
        )}

        {/* 선 차트 */}
        {chartType === 'line' && chartData.length > 0 && (
          <div className="custom-line-chart">
            {/* 시간 범위 및 줌 컨트롤 */}
            <div className="line-chart-controls">
              <div className="time-range-buttons">
                <button
                  className={`range-btn ${timeRange === '1h' ? 'active' : ''}`}
                  onClick={() => setTimeRange('1h')}
                >
                  1시간
                </button>
                <button
                  className={`range-btn ${timeRange === '3h' ? 'active' : ''}`}
                  onClick={() => setTimeRange('3h')}
                >
                  3시간
                </button>
                <button
                  className={`range-btn ${timeRange === '6h' ? 'active' : ''}`}
                  onClick={() => setTimeRange('6h')}
                >
                  6시간
                </button>
                <button
                  className={`range-btn ${timeRange === '12h' ? 'active' : ''}`}
                  onClick={() => setTimeRange('12h')}
                >
                  12시간
                </button>
                <button
                  className={`range-btn ${timeRange === 'all' ? 'active' : ''}`}
                  onClick={() => setTimeRange('all')}
                >
                  전체
                </button>
              </div>
            </div>
            <div className="line-chart-legend">
              {chartData.slice(0, 7).map((data) => {
                const deviceName = data.deviceName || `장비 ${data.deviceId}`;
                const displayName = deviceName.length > 10 ? `${deviceName.substring(0, 10)}...` : deviceName;
                return (
                  <div key={data._key} className="legend-item">
                    <span className="legend-dot" style={{ background: data.color }}></span>
                    <span title={deviceName}>
                      {displayName}
                    </span>
                  </div>
                );
              })}
              {chartData.length > 7 && (
                <div className="legend-item">
                  <span className="legend-more">+{chartData.length - 7}개 더</span>
                </div>
              )}
            </div>
            <svg className="line-chart-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
              {/* 데이터 선 */}
              {chartData.map((data, index) => {
                // 시계열 데이터가 배열로 오는 경우
                if (Array.isArray(data.value)) {
                  const points = data.value.map((val, i) => {
                    const x = (i / (data.value.length - 1)) * 300;
                    const y = 100 - (val / 100) * 80;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <polyline
                      key={data._key}
                      points={points}
                      fill="none"
                      stroke={data.color}
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                } else {
                  // 단일 값인 경우 수평선으로 표시
                  const y = 100 - ((data.value || 0) / 100) * 80;
                  return (
                    <line
                      key={data._key}
                      x1="0"
                      y1={y}
                      x2="300"
                      y2={y}
                      stroke={data.color}
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                }
              })}
            </svg>
            {/* X축 시간 레이블 (SVG 외부) */}
            {chartData.length > 0 && chartData[0].timestamps && (() => {
              const timestamps = chartData[0].timestamps;
              const totalPoints = timestamps.length;

              // 표시할 시간 레이블 인덱스 선택 (최대 5개)
              let indicesToShow = [];
              if (totalPoints <= 5) {
                // 5개 이하면 모두 표시
                indicesToShow = Array.from({ length: totalPoints }, (_, i) => i);
              } else {
                // 5개 이상이면 첫/끝과 중간 3개만 표시
                indicesToShow = [
                  0,  // 첫 번째
                  Math.floor(totalPoints * 0.25),  // 1/4 지점
                  Math.floor(totalPoints * 0.5),   // 중간
                  Math.floor(totalPoints * 0.75),  // 3/4 지점
                  totalPoints - 1  // 마지막
                ];
              }

              return (
                <div className="line-chart-timeline">
                  {indicesToShow.map((i) => {
                    const timestamp = timestamps[i];
                    const position = (i / (totalPoints - 1)) * 100;  // 백분율로 위치 계산
                    // "2025-12-23 17:45:00" -> "17:45"
                    const timeStr = timestamp?.split(' ')[1]?.substring(0, 5) || '';
                    return (
                      <span
                        key={i}
                        className="timeline-label"
                        style={{ left: `${position}%` }}
                      >
                        {timeStr}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
            <div className="line-chart-values">
              {chartData.slice(0, 5).map((data) => {
                const deviceName = data.deviceName || `장비 ${data.deviceId}`;
                const displayName = deviceName.length > 8 ? `${deviceName.substring(0, 8)}...` : deviceName;
                const latestValue = Array.isArray(data.value)
                  ? data.value[data.value.length - 1]
                  : data.value;
                return (
                  <div key={data._key} className="value-item">
                    <span className="value-device" title={deviceName}>
                      {displayName}:
                    </span>
                    <span className="value-number">
                      {latestValue?.toFixed(1)}{data.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 데이터 없음 */}
        {chartType === 'line' && chartData.length === 0 && (
          <div className="widget-placeholder">
            <i className="bi bi-graph-up"></i>
            <span>데이터가 없습니다</span>
          </div>
        )}
      </div>
    </div>
  );
}

const MemoizedCustomWidgetContent = memo(CustomWidgetContent, (prevProps, nextProps) => {
  // chartData나 cntData가 변경되면 리렌더링
  if (prevProps.widget.chartData !== nextProps.widget.chartData) return false;
  if (prevProps.widget.cntData !== nextProps.widget.cntData) return false;
  if (prevProps.widget.id !== nextProps.widget.id) return false;
  if (prevProps.widget.config !== nextProps.widget.config) return false;
  if (prevProps.isEditMode !== nextProps.isEditMode) return false;
  return true;
});

// 사용자 정의 위젯 설정 모달
function CustomWidgetModal({ onClose, onSave, initialData = null }) {
  const [widgetName, setWidgetName] = useState(initialData?.name || '');
  const [selectedGroup, setSelectedGroup] = useState(initialData?.group || null);
  const [selectedElements, setSelectedElements] = useState(initialData?.elements || []);
  const [chartType, setChartType] = useState(initialData?.chartType || 'bar');

  const handleGroupChange = (groupId) => {
    setSelectedGroup(groupId);
    setSelectedElements([]); // 그룹 변경 시 선택 초기화
  };

  const toggleElement = (elementId) => {
    // CPU_MEM 그룹은 단일 선택만 가능
    if (selectedGroup === 'CPU_MEM') {
      setSelectedElements([elementId]);
    } else {
      // 다른 그룹은 다중 선택 가능
      setSelectedElements(prev =>
        prev.includes(elementId)
          ? prev.filter(id => id !== elementId)
          : [...prev, elementId]
      );
    }
  };

  const handleSave = () => {
    if (!widgetName.trim()) {
      alert('위젯 이름을 입력하세요.');
      return;
    }
    if (!selectedGroup) {
      alert('모니터링 그룹을 선택하세요.');
      return;
    }
    if (selectedElements.length === 0) {
      alert('최소 1개 이상의 모니터링 요소를 선택하세요.');
      return;
    }

    onSave({
      name: widgetName,
      group: selectedGroup,
      elements: selectedElements,
      chartType: chartType,
    });
  };

  const currentGroup = selectedGroup ? MONITORING_GROUPS[selectedGroup] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content custom-widget-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialData ? '사용자 정의 위젯 수정' : '사용자 정의 위젯 만들기'}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* 위젯 이름 */}
          <div className="custom-widget-section">
            <label className="section-label">위젯 이름</label>
            <input
              type="text"
              className="widget-name-input"
              placeholder="예: 서버 모니터링"
              value={widgetName}
              onChange={(e) => setWidgetName(e.target.value)}
            />
          </div>

          {/* 모니터링 그룹 선택 */}
          <div className="custom-widget-section">
            <label className="section-label">1. 모니터링 카테고리 선택</label>
            <div className="monitoring-groups">
              {Object.values(MONITORING_GROUPS).map(group => (
                <div
                  key={group.id}
                  className={`group-card ${selectedGroup === group.id ? 'selected' : ''}`}
                  onClick={() => handleGroupChange(group.id)}
                >
                  <div className="group-icon" style={{ color: group.color }}>
                    <i className={`bi ${group.icon}`}></i>
                  </div>
                  <span className="group-name">{group.name}</span>
                  {selectedGroup === group.id && (
                    <i className="bi bi-check-circle-fill group-check"></i>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 세부 요소 선택 */}
          {currentGroup && (
            <div className="custom-widget-section">
              <label className="section-label">
                2. {currentGroup.name} 세부 항목 선택
                <span className="selected-count">
                  ({selectedElements.length}개 선택됨)
                  {selectedGroup === 'CPU_MEM' && <span className="single-select-notice"> - 1개만 선택 가능</span>}
                </span>
              </label>
              <div className="monitoring-elements-grid">
                {currentGroup.elements.map(element => (
                  <div
                    key={element.id}
                    className={`monitoring-element-card ${selectedElements.includes(element.id) ? 'selected' : ''}`}
                    onClick={() => toggleElement(element.id)}
                  >
                    <div className="element-icon" style={{ color: element.color }}>
                      <i className={`bi ${element.icon}`}></i>
                    </div>
                    <span className="element-name">{element.name}</span>
                    {selectedElements.includes(element.id) && (
                      <i className="bi bi-check-circle-fill element-check"></i>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 차트 타입 선택 */}
          <div className="custom-widget-section">
            <label className="section-label">
              3. 차트 타입
              <span className="chart-info">(Top 10까지만 표출됩니다)</span>
            </label>
            <div className="chart-type-options">
              <button
                className={`chart-type-option ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
              >
                <i className="bi bi-bar-chart-fill"></i>
                <span>막대 그래프</span>
              </button>
              <button
                className={`chart-type-option ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
              >
                <i className="bi bi-graph-up"></i>
                <span>선 그래프</span>
              </button>
              <button
                className={`chart-type-option ${chartType === 'pie' ? 'active' : ''}`}
                onClick={() => setChartType('pie')}
              >
                <i className="bi bi-pie-chart-fill"></i>
                <span>파이 차트</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button className="btn-save" onClick={handleSave}>
            {initialData ? '수정 완료' : '위젯 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 일반 위젯 컨텐츠 렌더링
function WidgetContent({ widget, widgetTypes, isEditMode }) {
  const type = widgetTypes[widget.type];

  switch (widget.type) {
    case 'CPU_MEM_TOPN':
    case 'TRAFFIC_TOPN':
    case 'FILESYSTEM_TOPN':
    case 'TRAFFIC_TREND':
      // 차트 위젯은 CustomWidgetContent로 통합
      return <CustomWidgetContent widget={widget} isEditMode={isEditMode} />;

    case 'ALERT_LIST':
      return (
        <div className="widget-content-inner">
          <div className="alert-table">
            <table>
              <thead>
                <tr>
                  <th>등급</th>
                  <th>장비명</th>
                  <th>알람 내용</th>
                  <th>발생 시간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="alert-row critical">
                  <td><span className="alert-badge critical">Critical</span></td>
                  <td>Server-01</td>
                  <td>서버 응답 없음</td>
                  <td>2분 전</td>
                </tr>
                <tr className="alert-row warning">
                  <td><span className="alert-badge warning">Warning</span></td>
                  <td>Switch-02</td>
                  <td>CPU 사용량 85%</td>
                  <td>15분 전</td>
                </tr>
                <tr className="alert-row info">
                  <td><span className="alert-badge info">Info</span></td>
                  <td>Router-01</td>
                  <td>백업 완료</td>
                  <td>1시간 전</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'CUSTOM':
      // 실제 데이터를 사용하는 별도 컴포넌트 사용
      return null; // WidgetContent 외부에서 처리

    case 'REALTIME_ALERT':
      // 실제 데이터를 사용하는 별도 컴포넌트 사용
      return null; // WidgetContent 외부에서 처리

    case 'ALERT_SUMMARY':
      // 별도 컴포넌트로 처리 (강조 효과 포함)
      return null;

    case 'DEVICE_SUMMARY':
      // cntData에서 장비 수 데이터 추출
      const deviceCntData = widget.cntData || {};
      return (
        <div className="widget-content-inner">
          <div className="device-summary-grid">
            <div className="device-card">
              <div className="device-icon network"><i className="bi bi-diagram-3-fill"></i></div>
              <div className="device-content">
                <div className="device-count">{deviceCntData.networkCnt ?? 0}</div>
                <div className="device-label">네트워크</div>
              </div>
            </div>
            <div className="device-card">
              <div className="device-icon server"><i className="bi bi-hdd-stack-fill"></i></div>
              <div className="device-content">
                <div className="device-count">{deviceCntData.serverCnt ?? 0}</div>
                <div className="device-label">서버</div>
              </div>
            </div>
            <div className="device-card">
              <div className="device-icon transfer"><i className="bi bi-arrow-left-right"></i></div>
              <div className="device-content">
                <div className="device-count">{deviceCntData.tranCnt ?? 0}</div>
                <div className="device-label">전송</div>
              </div>
            </div>
            <div className="device-card">
              <div className="device-icon fms"><i className="bi bi-building-fill"></i></div>
              <div className="device-content">
                <div className="device-count">{deviceCntData.fmsCnt ?? 0}</div>
                <div className="device-label">FMS</div>
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="widget-content-inner">
          <div className="widget-placeholder">
            <i className={`bi ${type?.icon || 'bi-grid'}`}></i>
            <span>{type?.name || widget.type}</span>
          </div>
        </div>
      );
  }
}

// 장애 현황 위젯 컴포넌트
function AlertSummaryWidget({ cntData, isEditMode }) {
  const [prevCounts, setPrevCounts] = useState(null);
  const [highlightedLevels, setHighlightedLevels] = useState(new Set());

  // 카운트 변경 감지 및 강조 효과
  useEffect(() => {
    if (isEditMode || !cntData) return;

    const currentCounts = {
      critical: cntData.criticalCnt ?? 0,
      major: cntData.majorCnt ?? 0,
      minor: cntData.minorCnt ?? 0,
      warning: cntData.warningCnt ?? 0,
    };

    // 이전 값과 비교하여 증가한 등급 찾기
    if (prevCounts !== null) {
      const newHighlights = new Set();

      if (currentCounts.critical > prevCounts.critical) {
        newHighlights.add('critical');
      }
      if (currentCounts.major > prevCounts.major) {
        newHighlights.add('major');
      }
      if (currentCounts.minor > prevCounts.minor) {
        newHighlights.add('minor');
      }
      if (currentCounts.warning > prevCounts.warning) {
        newHighlights.add('warning');
      }

      if (newHighlights.size > 0) {
        setHighlightedLevels(newHighlights);
        // 3초 후 강조 효과 제거
        const timer = setTimeout(() => {
          setHighlightedLevels(new Set());
        }, 3000);
        return () => clearTimeout(timer);
      }
    }

    setPrevCounts(currentCounts);
  }, [cntData, isEditMode]);

  const alertCntData = cntData || {};

  return (
    <div className="widget-content-inner">
      <div className="alert-summary-grid">
        <div className={`summary-card critical${highlightedLevels.has('critical') ? ' card-highlight' : ''}`}>
          <div className="summary-icon"><i className="bi bi-exclamation-circle-fill"></i></div>
          <div className="summary-content">
            <div className="summary-count">{alertCntData.criticalCnt ?? 0}</div>
            <div className="summary-label">Critical</div>
          </div>
        </div>
        <div className={`summary-card major${highlightedLevels.has('major') ? ' card-highlight' : ''}`}>
          <div className="summary-icon"><i className="bi bi-exclamation-triangle-fill"></i></div>
          <div className="summary-content">
            <div className="summary-count">{alertCntData.majorCnt ?? 0}</div>
            <div className="summary-label">Major</div>
          </div>
        </div>
        <div className={`summary-card minor${highlightedLevels.has('minor') ? ' card-highlight' : ''}`}>
          <div className="summary-icon"><i className="bi bi-info-circle-fill"></i></div>
          <div className="summary-content">
            <div className="summary-count">{alertCntData.minorCnt ?? 0}</div>
            <div className="summary-label">Minor</div>
          </div>
        </div>
        <div className={`summary-card warning${highlightedLevels.has('warning') ? ' card-highlight' : ''}`}>
          <div className="summary-icon"><i className="bi bi-exclamation-diamond-fill"></i></div>
          <div className="summary-content">
            <div className="summary-count">{alertCntData.warningCnt ?? 0}</div>
            <div className="summary-label">Warning</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 실시간 장애 현황 위젯 컴포넌트
const ERROR_LEVELS = [
  { id: 'C', label: 'Cr', color: '#ef4444', name: 'Critical' },
  { id: 'M', label: 'Mj', color: '#f97316', name: 'Major' },
  { id: 'N', label: 'Mn', color: '#eab308', name: 'Minor' },
  { id: 'W', label: 'Wr', color: '#3b82f6', name: 'Warning' },
];

function RealtimeAlertWidget({ isEditMode, initialData }) {
  // 초기 데이터: 백엔드에서 widget.chartData로 받은 데이터 사용
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

  // 새로 추가된 행 강조를 위한 상태
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const prevErrorIdsRef = useRef(new Set());

  // 검색 필터 (여러 필드)
  const [searchFilters, setSearchFilters] = useState({
    deviceName: '',
    deviceIp: '',
    groupName: '',
    errorMessage: '',
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // initialData가 변경되면 apiErrors 업데이트
  useEffect(() => {
    if (Array.isArray(initialData)) {
      setApiErrors(initialData);
    } else if (initialData?.list) {
      setApiErrors(initialData.list);
    }
  }, [initialData]);

  // 새로운 장애 ID 감지 및 강조 효과
  useEffect(() => {
    if (isEditMode || apiErrors.length === 0) return;

    const currentErrorIds = new Set(apiErrors.map(e => e.ERROR_ID).filter(Boolean));
    const prevIds = prevErrorIdsRef.current;

    // 이전에 없던 새로운 ID 찾기
    const newIds = new Set();
    currentErrorIds.forEach(id => {
      if (!prevIds.has(id)) {
        newIds.add(id);
      }
    });

    // 새로운 장애가 있고, 이전 데이터가 있었다면 강조 상태 설정
    if (newIds.size > 0 && prevIds.size > 0) {
      setHighlightedIds(newIds);
      // 3초 후 강조 효과 제거
      const timer = setTimeout(() => {
        setHighlightedIds(new Set());
      }, 3000);

      // 현재 ID를 이전 ID로 저장 (강조 설정 후 바로 업데이트)
      prevErrorIdsRef.current = currentErrorIds;
      return () => clearTimeout(timer);
    }

    // 현재 ID를 이전 ID로 저장
    prevErrorIdsRef.current = currentErrorIds;
  }, [apiErrors, isEditMode]);

  // API 데이터에 필터 적용
  const combinedErrors = useMemo(() => {
    return apiErrors.filter(error => {
      // 등급 필터
      const matchLevel = selectedLevels.includes(error.ERROR_LEVEL);
      if (!matchLevel) return false;

      // 검색 필터 (클라이언트 필터링 - 빠른 응답을 위해)
      const { deviceName, deviceIp, groupName, errorMessage } = searchFilters;

      if (deviceName.trim()) {
        const name = (error.DEVICE_NAME || '').toLowerCase();
        if (!name.includes(deviceName.toLowerCase())) return false;
      }
      if (deviceIp.trim()) {
        const ip = (error.DEVICE_IP || '').toLowerCase();
        if (!ip.includes(deviceIp.toLowerCase())) return false;
      }
      if (groupName.trim()) {
        const group = (error.GROUP_NAME || '').toLowerCase();
        if (!group.includes(groupName.toLowerCase())) return false;
      }
      if (errorMessage.trim()) {
        const msg = (error.ERROR_MESSAGE || '').toLowerCase();
        if (!msg.includes(errorMessage.toLowerCase())) return false;
      }

      return true;
    });
  }, [apiErrors, selectedLevels, searchFilters]);

  // 장애 목록 조회
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

  // 초기 데이터가 없으면 API에서 조회
  useEffect(() => {
    if (isEditMode || hasFetched) return;
    const initData = getInitialData();
    if (initData.length === 0) {
      fetchErrors();
    } else {
      setHasFetched(true);
    }
  }, [isEditMode, hasFetched]);

  // WebSocket 알림 수신 시 목록 새로고침
  useEffect(() => {
    if (isEditMode || !hasFetched || alerts.length === 0) return;
    fetchErrors();
  }, [alerts.length]);

  // 등급 토글
  const toggleLevel = (levelId) => {
    setSelectedLevels(prev => {
      if (prev.includes(levelId)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== levelId);
      }
      return [...prev, levelId];
    });
  };

  // 검색 필터 변경
  const handleFilterChange = (field, value) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  // 검색 초기화
  const handleResetFilters = () => {
    setSearchFilters({
      deviceName: '',
      deviceIp: '',
      groupName: '',
      errorMessage: '',
    });
  };

  // 검색어가 있는지 확인
  const hasActiveFilters = Object.values(searchFilters).some(v => v.trim());

  // 날짜 포맷 (상세 형식)
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

      if (isNaN(date.getTime())) {
        return dateStr;
      }

      // 상세 날짜/시간 형식 (YYYY-MM-DD HH:mm:ss)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return dateStr;
    }
  };

  // 등급 클래스
  const getLevelClass = (level) => {
    switch (level) {
      case 'C': return 'critical';
      case 'M': return 'major';
      case 'N': return 'minor';
      case 'W': return 'warning';
      default: return '';
    }
  };

  // 등급 라벨
  const getLevelLabel = (level) => {
    switch (level) {
      case 'C': return 'Cr';
      case 'M': return 'Mj';
      case 'N': return 'Mn';
      case 'W': return 'Wr';
      default: return '-';
    }
  };

  // 편집 모드일 때는 플레이스홀더 표시
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

  return (
    <div className="realtime-alert-widget">
      {/* 필터 영역 */}
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
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="장비명..."
            value={searchFilters.deviceName}
            onChange={(e) => handleFilterChange('deviceName', e.target.value)}
          />
        </div>
        <button
          className={`widget-filter-toggle ${showAdvancedSearch ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          title="상세 검색"
        >
          <i className="bi bi-filter"></i>
        </button>
        {hasActiveFilters && (
          <button
            className="widget-filter-reset"
            onClick={handleResetFilters}
            title="검색 초기화"
          >
            <i className="bi bi-x-circle"></i>
          </button>
        )}
      </div>

      {/* 상세 검색 영역 */}
      {showAdvancedSearch && (
        <div className="widget-advanced-search">
          <div className="search-field">
            <label>IP</label>
            <input
              type="text"
              placeholder="IP 주소"
              value={searchFilters.deviceIp}
              onChange={(e) => handleFilterChange('deviceIp', e.target.value)}
            />
          </div>
          <div className="search-field">
            <label>그룹</label>
            <input
              type="text"
              placeholder="그룹명"
              value={searchFilters.groupName}
              onChange={(e) => handleFilterChange('groupName', e.target.value)}
            />
          </div>
          <div className="search-field">
            <label>내용</label>
            <input
              type="text"
              placeholder="장애 내용"
              value={searchFilters.errorMessage}
              onChange={(e) => handleFilterChange('errorMessage', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 장애 테이블 */}
      <div className="widget-alert-table-container">
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
              {combinedErrors.slice(0, 50).map((error, index) => (
                <tr
                  key={error.ERROR_ID || `error-${index}`}
                  className={`${getLevelClass(error.ERROR_LEVEL)}${highlightedIds.has(error.ERROR_ID) ? ' row-highlight' : ''}`}
                >
                  <td className="col-level">
                    <span className={`level-badge ${getLevelClass(error.ERROR_LEVEL)}`}>
                      {getLevelLabel(error.ERROR_LEVEL)}
                    </span>
                  </td>
                  <td className="col-status">
                    <span className={`status-badge ${error.ERROR_FLAG === 1 ? 'ack' : 'active'}`}>
                      {error.ERROR_FLAG === 1 ? '인지' : '발생'}
                    </span>
                  </td>
                  <td className="col-device" title={error.DEVICE_NAME || '-'}>
                    {error.DEVICE_NAME || '-'}
                  </td>
                  <td className="col-ip" title={error.DEVICE_IP || '-'}>
                    {error.DEVICE_IP || '-'}
                  </td>
                  <td className="col-group" title={error.GROUP_NAME || '-'}>
                    {error.GROUP_NAME || '-'}
                  </td>
                  <td className="col-message" title={error.ERROR_MESSAGE || '-'}>
                    {error.ERROR_MESSAGE || '-'}
                  </td>
                  <td className="col-time" title={formatDateTime(error.OCCUR_AT)}>
                    {formatDateTime(error.OCCUR_AT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 더보기 */}
      {combinedErrors.length > 50 && (
        <div className="widget-more">
          <span>+{combinedErrors.length - 50}건 더 있음</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef(null);
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCustomWidgetModal, setShowCustomWidgetModal] = useState(false);
  const [showFullScreenAlert, setShowFullScreenAlert] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialWidgetCount, setInitialWidgetCount] = useState(0); // 편집 시작 시 위젯 개수
  const [showResetConfirm, setShowResetConfirm] = useState(false); // 초기화 확인 모달
  const [isResettingDashboard, setIsResettingDashboard] = useState(false); // 초기화 진행 중
  const [refreshingWidgets, setRefreshingWidgets] = useState(new Set()); // 새로고침 중인 위젯 ID
  const [isReloadingAfterSave, setIsReloadingAfterSave] = useState(false); // 저장 후 데이터 리로딩 중

  // 사용자 정보 가져오기
  const { user } = useAuthStore();
  const userId = user?.userId || user?.id || user?.USER_ID;

  // API에서 위젯 목록 조회 (R_WIDGET_T)
  const { data: apiWidgetList, isLoading: widgetsLoading } = useWidgets();

  // API에서 기본 대시보드 조회 (R_DEFAULT_DASHBOARD_WIDGET_T)
  const { data: defaultDashboard, isLoading: defaultDashboardLoading } = useDefaultDashboard();

  // API에서 사용자 대시보드 조회 (R_USER_DASHBOARD_WIDGET_T)
  const { data: userDashboard, isLoading: userDashboardLoading, isFetching: userDashboardFetching, refetch: refetchUserDashboard } = useUserDashboard(userId);

  // 사용자 대시보드 저장 mutation (편집 완료 시만 사용)
  const { mutate: saveUserDashboard, isPending: isSaving } = useSaveUserDashboard(userId);
  const { mutate: resetUserDashboard, isPending: isResetting } = useResetUserDashboard(userId);

  // API 데이터를 WIDGET_TYPES 형태로 변환 (DEFAULT_WIDGET_TYPES와 병합)
  const WIDGET_TYPES = useMemo(() => {
    // 기본 위젯 타입으로 시작
    const types = { ...DEFAULT_WIDGET_TYPES };

    // API 데이터가 있으면 병합
    if (apiWidgetList && apiWidgetList.length > 0) {
      apiWidgetList.forEach(widget => {
        const code = widget.widgetCode;
        const defaultType = DEFAULT_WIDGET_TYPES[code];

        types[code] = {
          id: widget.widgetId,
          code: code,
          name: widget.name,
          icon: widget.icon || defaultType?.icon || 'bi-grid',
          category: widget.category || defaultType?.category || 'info',
          defaultW: widget.defaultW || defaultType?.defaultW || 1,
          defaultH: widget.defaultH || defaultType?.defaultH || 1,
          minW: widget.minW || 1,
          minH: widget.minH || 1,
          defaultConfig: defaultType?.defaultConfig || {},
        };
      });
    }
    return types;
  }, [apiWidgetList]);

  // 대시보드 데이터 초기화 (기본 대시보드 또는 사용자 대시보드)
  // 기본 대시보드 응답: { defaultDashboardWidgetId, widgetId, widgetCode, name, icon, category, x, y, width, height }
  useEffect(() => {
    // 로딩 중이거나 refetching 중이면 스킵 (캐시 무효화 후 새 데이터 로드 대기)
    if (widgetsLoading || defaultDashboardLoading || userDashboardLoading || userDashboardFetching) {
      return;
    }

    // 이미 초기화되었고 리셋 중이 아니면 스킵
    if (isInitialized && !isResetting) {
      return;
    }

    // 편집 모드일 때는 초기화하지 않음
    if (isEditMode) {
      return;
    }

    // 사용자 대시보드가 있으면 사용, 없으면 기본 대시보드 사용
    const dashboardData = (userDashboard && userDashboard.length > 0)
      ? userDashboard
      : defaultDashboard;

    if (!dashboardData || dashboardData.length === 0) {
      // API 데이터가 없으면 폴백 사용
      setWidgets(initialWidgets);
      setLayout(initialLayout);
      setIsInitialized(true);
      return;
    }

    // API 데이터를 widgets와 layout으로 변환
    const newWidgets = [];
    const newLayout = [];
    const maxCols = 12; // 그리드 최대 칼럼 수

    dashboardData.forEach((item, index) => {
      const id = `w${item.defaultDashboardWidgetId || item.userDashboardWidgetId || index}`;

      // 위젯 너비와 위치를 그리드 칼럼 수에 맞게 제한
      const width = Math.min(item.width ?? 1, maxCols);
      const posX = Math.min(item.posX ?? item.x ?? 0, maxCols - width);

      // 기본 위젯인지 사용자 위젯인지 구분
      const isDefaultWidget = !!item.defaultDashboardWidgetId;
      const isUserWidget = !!item.userDashboardWidgetId;

      // config 파싱
      let parsedConfig = item.config ? (typeof item.config === 'string' ? JSON.parse(item.config) : item.config) : {};

      // config가 비어있으면 위젯 타입의 기본 config 사용
      const widgetType = WIDGET_TYPES[item.widgetCode];
      const isEmptyConfig = !parsedConfig || Object.keys(parsedConfig).length === 0;

      if (isEmptyConfig && widgetType?.defaultConfig) {
        parsedConfig = { ...widgetType.defaultConfig };
      }

      // config에 위젯 구분 정보 추가
      const configWithMetadata = {
        ...parsedConfig,
        // 위젯 소스 정보
        source: isUserWidget ? 'user' : 'default',
        // 위젯 마스터 정보
        widgetId: item.widgetId,
        widgetCode: item.widgetCode,
        widgetName: item.name || item.widgetCode,
        // 대시보드 위젯 ID
        defaultDashboardWidgetId: item.defaultDashboardWidgetId,
        userDashboardWidgetId: item.userDashboardWidgetId,
      };

      newWidgets.push({
        id: id,
        widgetId: item.widgetId,
        userDashboardWidgetId: item.userDashboardWidgetId, // DB: USER_DASHBOARD_WIDGET_ID
        defaultDashboardWidgetId: item.defaultDashboardWidgetId, // DB: DEFAULT_DASHBOARD_WIDGET_ID
        type: item.widgetCode,
        title: item.title || item.name || item.widgetCode, // DB: TITLE
        sortOrder: item.sortOrder ?? index, // DB: SORT_ORDER
        config: configWithMetadata, // 메타데이터가 추가된 CONFIG
        chartData: item.chartData || [], // 백엔드에서 받은 차트 데이터
        cntData: item.cntData || null, // 백엔드에서 받은 카운트 데이터 (장애현황 등)
      });

      newLayout.push({
        i: id,
        x: posX,                         // DB: POS_X (그리드 범위 내로 제한)
        y: item.posY ?? item.y ?? 0,     // DB: POS_Y
        w: width,                        // DB: WIDTH (최대 칼럼 수로 제한)
        h: item.height ?? 1,             // DB: HEIGHT
        minW: 1,
        minH: 1,
        maxW: maxCols,                   // 최대 너비 제한
        maxH: 5,                         // 최대 높이 제한
      });
    });

    setWidgets(newWidgets);
    setLayout(newLayout);
    setIsInitialized(true);
    setIsReloadingAfterSave(false); // 리로딩 완료
  }, [defaultDashboard, userDashboard, widgetsLoading, defaultDashboardLoading, userDashboardLoading, userDashboardFetching, isInitialized, isSaving, isResetting, isEditMode, WIDGET_TYPES]);

  // 컨테이너 너비 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWidth = 0;

    const updateWidth = () => {
      const width = container.clientWidth;
      // 이전 값과 비교해서 실제로 변경되었을 때만 업데이트 (무한 루프 방지)
      if (width > 0 && Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        setContainerWidth(width);
      }
    };

    // 초기 너비 설정
    updateWidth();

    // DOM이 완전히 렌더링된 후 다시 측정
    const timer1 = setTimeout(updateWidth, 50);
    const timer2 = setTimeout(updateWidth, 200);

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(container);

    // window resize도 감지
    window.addEventListener('resize', updateWidth);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [isInitialized]);

  // 알림 구독
  const alerts = useAlertStore((state) => state.alerts);

  // 특정 위젯 데이터 갱신 함수
  const refreshWidget = useCallback(async (widget) => {
    // 이미 새로고침 중이면 스킵
    if (refreshingWidgets.has(widget.id)) return;

    // 새로고침 시작
    setRefreshingWidgets(prev => new Set(prev).add(widget.id));

    try {
      // REALTIME_ALERT와 ALERT_LIST는 faultApi에서 직접 조회
      if (widget.type === 'REALTIME_ALERT' || widget.type === 'ALERT_LIST') {
        const response = await faultApi.getErrors({});
        const data = response.data?.data || {};
        setWidgets(prev => prev.map(w => {
          if (w.id === widget.id) {
            return {
              ...w,
              chartData: data.list || [],
            };
          }
          return w;
        }));
        return;
      }

      let response;
      // 사용자 위젯인 경우
      if (widget.userDashboardWidgetId) {
        console.log('[refreshWidget] Refreshing user widget:', widget.userDashboardWidgetId);
        response = await dashboardApi.refreshUserWidget(widget.userDashboardWidgetId);
      }
      // 기본 대시보드 위젯인 경우
      else if (widget.defaultDashboardWidgetId) {
        console.log('[refreshWidget] Refreshing default widget:', widget.defaultDashboardWidgetId);
        response = await dashboardApi.refreshDefaultWidget(widget.defaultDashboardWidgetId);
      }
      // 위젯 ID가 없는 경우 경고
      else {
        console.warn('[refreshWidget] Widget has no ID for refresh:', widget.type, widget.id);
        return;
      }

      if (response?.data?.data) {
        const newData = response.data.data;
        console.log('[refreshWidget] Got new data for widget:', widget.type, newData);
        // 위젯 상태 업데이트 (새 데이터로 완전히 교체)
        setWidgets(prev => prev.map(w => {
          if (w.id === widget.id) {
            return {
              ...w,
              chartData: 'chartData' in newData ? newData.chartData : w.chartData,
              cntData: 'cntData' in newData ? newData.cntData : w.cntData,
            };
          }
          return w;
        }));
      }
    } catch (error) {
      console.error('위젯 데이터 갱신 실패:', error);
    } finally {
      // 새로고침 완료
      setRefreshingWidgets(prev => {
        const next = new Set(prev);
        next.delete(widget.id);
        return next;
      });
    }
  }, [refreshingWidgets]);

  // 알림 발생 시 관련 위젯 갱신 (debounce 적용)
  const lastAlertRef = useRef(null);
  useEffect(() => {
    if (!isInitialized || isEditMode) return;

    // 새로운 알림이 있는지 확인 (alerts 배열은 최신이 앞에 있음)
    const latestAlert = alerts[0];
    if (!latestAlert) return;

    // 같은 알림이면 무시 (중복 방지)
    const alertKey = latestAlert.alertId || latestAlert.timestamp;
    if (lastAlertRef.current === alertKey) return;
    lastAlertRef.current = alertKey;

    console.log('[Dashboard] New alert detected, refreshing widgets...', latestAlert);

    // debounce: 여러 알림이 연속으로 오면 마지막 것만 처리
    const timer = setTimeout(() => {
      // 갱신이 필요한 위젯 타입들 (장애 관련 위젯들)
      const refreshTargetTypes = ['ALERT_SUMMARY', 'DEVICE_SUMMARY', 'REALTIME_ALERT', 'ALERT_LIST'];

      // 해당 타입의 위젯들을 찾아서 갱신
      widgets.forEach(widget => {
        if (refreshTargetTypes.includes(widget.type)) {
          console.log('[Dashboard] Refreshing widget:', widget.type, widget.id);
          refreshWidget(widget);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [alerts, isInitialized, isEditMode, widgets, refreshWidget]);

  // 레이아웃 변경 핸들러
  const handleLayoutChange = useCallback((newLayout) => {
    const cols = 12;
    const maxRows = 5;

    // 5칸을 초과하는 위젯이 있는지 체크
    const exceedsMaxRows = newLayout.some(item => (item.y + item.h) > maxRows);

    // 5칸 초과 시 레이아웃 변경 거부 (이전 레이아웃 유지)
    if (exceedsMaxRows) {
      return;
    }

    // 화면 경계 체크 및 조정
    const boundedLayout = newLayout.map(item => {
      // 너비를 최대 칼럼 수로 제한
      const adjustedW = Math.min(item.w, cols);
      // x + w가 cols를 넘지 않도록
      const adjustedX = Math.min(item.x, cols - adjustedW);

      return {
        ...item,
        w: adjustedW,
        x: Math.max(0, adjustedX),
        y: item.y,
        maxW: cols,
        maxH: 5,
      };
    });

    // 실제로 변경되었는지 확인 (무한 루프 방지)
    setLayout(prevLayout => {
      const hasChanged = JSON.stringify(prevLayout) !== JSON.stringify(boundedLayout);
      if (hasChanged) {
        return boundedLayout;
      }
      return prevLayout;
    });
  }, []);

  // 빈 공간 찾기 함수
  const findEmptySpace = useCallback((widgetWidth, widgetHeight, currentLayout, cols = 12, maxRows = 5) => {
    // 그리드 맵 생성 (각 셀이 사용 중인지 체크)
    const grid = Array(maxRows).fill(null).map(() => Array(cols).fill(false));

    // 현재 위젯들로 그리드 채우기
    currentLayout.forEach(item => {
      for (let y = item.y; y < item.y + item.h && y < maxRows; y++) {
        for (let x = item.x; x < item.x + item.w && x < cols; x++) {
          if (grid[y]) grid[y][x] = true;
        }
      }
    });

    // 빈 공간 찾기 (위에서부터 아래로, 왼쪽에서 오른쪽으로)
    for (let y = 0; y <= maxRows - widgetHeight; y++) {
      for (let x = 0; x <= cols - widgetWidth; x++) {
        // 이 위치에 위젯을 놓을 수 있는지 체크
        let canPlace = true;
        for (let dy = 0; dy < widgetHeight && canPlace; dy++) {
          for (let dx = 0; dx < widgetWidth && canPlace; dx++) {
            if (grid[y + dy] && grid[y + dy][x + dx]) {
              canPlace = false;
            }
          }
        }
        if (canPlace) {
          return { x, y };
        }
      }
    }
    return null; // 빈 공간 없음
  }, []);

  // 위젯 추가 (typeCode: WIDGET_CODE, widgetId: DB의 WIDGET.ID)
  const handleAddWidget = useCallback((typeCode, widgetId) => {
    const type = WIDGET_TYPES[typeCode];
    if (!type) return;

    // CUSTOM 타입인 경우 사용자 정의 모달 열기
    if (typeCode === 'CUSTOM') {
      setShowAddModal(false);
      setShowCustomWidgetModal(true);
      return;
    }

    const maxCols = 12; // 그리드 최대 칼럼 수
    const widgetWidth = Math.min(type.defaultW || 1, maxCols);
    const widgetHeight = type.defaultH || 1;

    // 빈 공간 찾기
    const emptySpace = findEmptySpace(widgetWidth, widgetHeight, layout);

    if (!emptySpace) {
      setShowFullScreenAlert(true);
      return;
    }

    const maxSortOrder = widgets.reduce((max, w) => Math.max(max, w.sortOrder || 0), 0);
    const newId = `w${Date.now()}`;

    // 새 위젯 생성 (로컬 state만 업데이트)
    const newWidget = {
      id: newId,
      widgetId: widgetId || type.id,
      type: typeCode,
      title: type.name,
      sortOrder: maxSortOrder + 1,
      config: type.defaultConfig || {},
    };

    const newLayoutItem = {
      i: newId,
      x: emptySpace.x,
      y: emptySpace.y,
      w: widgetWidth,
      h: widgetHeight,
      minW: 1,
      minH: 1,
      maxW: maxCols,
      maxH: 5,
    };

    // 로컬 state 업데이트만 (API 호출 없음)
    setWidgets(prev => [...prev, newWidget]);
    setLayout(prev => [...prev, newLayoutItem]);
    setShowAddModal(false);
  }, [layout, widgets, WIDGET_TYPES, findEmptySpace]);

  // 사용자 정의 위젯 저장
  const handleSaveCustomWidget = useCallback((customConfig) => {
    console.log('=== 사용자 정의 위젯 저장 ===', customConfig);

    const type = WIDGET_TYPES['CUSTOM'];
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const maxSortOrder = widgets.reduce((max, w) => Math.max(max, w.sortOrder || 0), 0);

    const newId = `w${Date.now()}`;

    const newWidget = {
      id: newId,
      widgetId: type.id,
      type: 'CUSTOM',
      title: customConfig.name,
      sortOrder: maxSortOrder + 1,
      config: {
        group: customConfig.group,
        elements: customConfig.elements,
        chartType: customConfig.chartType,
      },
      chartData: [], // 초기에는 빈 배열 (저장 후 서버에서 받아옴)
    };

    console.log('=== 생성된 위젯 ===', newWidget);

    const newLayoutItem = {
      i: newId,
      x: 0,
      y: maxY,
      w: type.defaultW || 2,
      h: type.defaultH || 1,
      minW: 1,
      minH: 1,
      maxW: 12,
      maxH: 5,
    };

    setWidgets(prev => {
      const updated = [...prev, newWidget];
      console.log('=== 업데이트된 위젯 목록 ===', updated);
      return updated;
    });
    setLayout(prev => [...prev, newLayoutItem]);
    setShowCustomWidgetModal(false);
  }, [layout, widgets, WIDGET_TYPES]);

  // 위젯 삭제 (최소 1개 위젯 유지)
  const handleDeleteWidget = useCallback((widgetId) => {
    setWidgets(prev => {
      // 마지막 위젯은 삭제 불가
      if (prev.length <= 1) {
        alert('최소 1개의 위젯은 유지해야 합니다.');
        return prev;
      }
      return prev.filter(w => w.id !== widgetId);
    });
    setLayout(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter(l => l.i !== widgetId);
    });
  }, []);

  // 위젯 설정 열기
  const handleOpenConfig = useCallback((widget) => {
    // CUSTOM 위젯인 경우 CustomWidgetModal 열기
    if (widget.type === 'CUSTOM') {
      setSelectedWidget(widget);
      setShowCustomWidgetModal(true);
    } else {
      setSelectedWidget(widget);
      setShowConfigModal(true);
    }
  }, []);

  // 위젯 설정 저장
  const handleSaveConfig = useCallback((updatedWidget) => {
    // 로컬 state만 업데이트 (API 호출 없음)
    setWidgets(prev => prev.map(w =>
      w.id === updatedWidget.id ? updatedWidget : w
    ));
    setShowConfigModal(false);
    setSelectedWidget(null);
  }, []);

  // 사용자 정의 위젯 수정
  const handleUpdateCustomWidget = useCallback((customConfig) => {
    if (!selectedWidget) return;

    console.log('=== 사용자 정의 위젯 수정 ===', customConfig);
    console.log('=== 기존 위젯 ===', selectedWidget);

    const updatedWidget = {
      ...selectedWidget,
      title: customConfig.name,
      config: {
        group: customConfig.group,
        elements: customConfig.elements,
        chartType: customConfig.chartType,
      },
      // chartData는 유지 (서버에서 새로 받아올 때까지)
    };

    console.log('=== 수정된 위젯 ===', updatedWidget);

    setWidgets(prev => {
      const updated = prev.map(w =>
        w.id === selectedWidget.id ? updatedWidget : w
      );
      console.log('=== 업데이트된 위젯 목록 ===', updated);
      return updated;
    });
    setShowCustomWidgetModal(false);
    setSelectedWidget(null);
  }, [selectedWidget]);

  // 토폴로지 전체화면 이동
  const handleExpandTopology = useCallback(() => {
    navigate('/topology');
  }, [navigate]);

  // config에서 메타데이터 제거 (저장용)
  const removeConfigMetadata = useCallback((config) => {
    if (!config || typeof config !== 'object') return config;

    const {
      source,
      widgetId,
      widgetCode,
      widgetName,
      defaultDashboardWidgetId,
      userDashboardWidgetId,
      ...cleanConfig
    } = config;

    return cleanConfig;
  }, []);

  // 기본 대시보드를 사용자 대시보드로 복사
  const handleCopyToUserDashboard = useCallback(() => {
    if (!confirm('기본 대시보드를 복사하여 나만의 대시보드를 만드시겠습니까?\n이후 자유롭게 편집할 수 있습니다.')) {
      return;
    }

    // 기본 대시보드를 사용자 대시보드로 복사
    const widgetsToSave = widgets.map((widget, index) => {
      const layoutItem = layout.find(l => l.i === widget.id);
      const cleanConfig = removeConfigMetadata(widget.config);
      return {
        // userDashboardWidgetId 없음 → 새로 생성
        widgetId: widget.widgetId,
        title: widget.title,
        posX: layoutItem?.x ?? 0,
        posY: layoutItem?.y ?? 0,
        width: layoutItem?.w ?? 1,
        height: layoutItem?.h ?? 1,
        sortOrder: index,
        config: typeof cleanConfig === 'string' ? cleanConfig : JSON.stringify(cleanConfig || {}),
      };
    });

    console.log('=== 기본 대시보드 복사 ===', widgetsToSave);

    saveUserDashboard(widgetsToSave, {
      onSuccess: async () => {
        console.log('대시보드가 성공적으로 복사되었습니다.');
        alert('나만의 대시보드가 생성되었습니다. 이제 자유롭게 편집할 수 있습니다.');
        // 새로운 데이터를 즉시 가져온 후 재초기화
        await refetchUserDashboard();
        setIsInitialized(false);
      },
      onError: (error) => {
        console.error('대시보드 복사 실패:', error);
        alert('대시보드 복사에 실패했습니다.');
      }
    });
  }, [widgets, layout, saveUserDashboard, refetchUserDashboard, removeConfigMetadata]);

  // 편집 모드 토글 및 저장 (사용자 대시보드만)
  const handleToggleEditMode = useCallback(() => {
    if (isEditMode) {
      // 편집 모드 종료 시 레이아웃 저장
      console.log('=== 편집 완료 - 현재 위젯 목록 ===', widgets);

      const widgetsToSave = widgets.map((widget, index) => {
        const layoutItem = layout.find(l => l.i === widget.id);
        const cleanConfig = removeConfigMetadata(widget.config);

        console.log(`=== 위젯 ${index} 저장 준비 ===`, {
          id: widget.id,
          type: widget.type,
          title: widget.title,
          config: widget.config,
          cleanConfig: cleanConfig,
          configType: typeof widget.config,
          configStringified: typeof cleanConfig === 'string' ? cleanConfig : JSON.stringify(cleanConfig || {})
        });

        return {
          userDashboardWidgetId: widget.userDashboardWidgetId,
          widgetId: widget.widgetId,
          title: widget.title,
          posX: layoutItem?.x ?? 0,
          posY: layoutItem?.y ?? 0,
          width: layoutItem?.w ?? 1,
          height: layoutItem?.h ?? 1,
          sortOrder: widget.sortOrder ?? index,
          config: typeof cleanConfig === 'string' ? cleanConfig : JSON.stringify(cleanConfig || {}),
        };
      });

      console.log('=== 저장할 위젯 데이터 ===', widgetsToSave);

      // 즉시 UI 업데이트 (사용자에게 빠른 피드백)
      setIsEditMode(false);
      setIsReloadingAfterSave(true); // 리로딩 시작

      // 백그라운드에서 저장
      saveUserDashboard(widgetsToSave, {
        onSuccess: async (response) => {
          console.log('대시보드가 성공적으로 저장되었습니다.');

          // 저장 API 응답에서 데이터 추출
          const freshData = response?.data?.data || response?.data || [];
          console.log('=== 저장 후 응답 데이터 ===', freshData);

          // 서버에서 최신 데이터를 다시 가져옴 (캐시 무효화는 hook에서 자동 처리)
          await refetchUserDashboard();

          // 새로 추가된 위젯의 chartData를 포함한 전체 데이터를 다시 로드
          setIsInitialized(false);
        },
        onError: (error) => {
          console.error('대시보드 저장 실패:', error);
          alert('대시보드 저장에 실패했습니다.');
          setIsEditMode(true);
        }
      });
    } else {
      // 편집 모드 시작
      setInitialWidgetCount(widgets.length);
      setIsEditMode(true);
    }
  }, [isEditMode, widgets, layout, saveUserDashboard, refetchUserDashboard, removeConfigMetadata, queryClient, userId]);

  // 기본 대시보드로 초기화 - 확인 모달 표시
  const handleResetDashboard = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  // 실제 초기화 실행
  const executeResetDashboard = useCallback(() => {
    setIsResettingDashboard(true);

    resetUserDashboard(undefined, {
      onSuccess: (response) => {
        console.log('대시보드가 기본값으로 초기화되었습니다.');

        // API 응답에서 바로 위젯 데이터 사용
        const freshData = response?.data?.data || response?.data || response || [];
        console.log('=== 초기화 API 응답 데이터 ===', freshData);

        if (freshData && freshData.length > 0) {
          // 새 데이터로 위젯과 레이아웃 직접 업데이트
          const maxCols = 12;
          const newWidgets = [];
          const newLayout = [];

          freshData.forEach((item, index) => {
            const id = `w${item.userDashboardWidgetId || index}`;
            const width = Math.min(item.width ?? 1, maxCols);
            const posX = Math.min(item.posX ?? item.x ?? 0, maxCols - width);

            let parsedConfig = item.config ? (typeof item.config === 'string' ? JSON.parse(item.config) : item.config) : {};
            const widgetType = WIDGET_TYPES[item.widgetCode];
            if ((!parsedConfig || Object.keys(parsedConfig).length === 0) && widgetType?.defaultConfig) {
              parsedConfig = { ...widgetType.defaultConfig };
            }

            newWidgets.push({
              id,
              widgetId: item.widgetId,
              userDashboardWidgetId: item.userDashboardWidgetId,
              type: item.widgetCode,
              title: item.title || item.name || item.widgetCode,
              sortOrder: item.sortOrder ?? index,
              config: parsedConfig,
              chartData: item.chartData || [],
              cntData: item.cntData || null,
            });

            newLayout.push({
              i: id,
              x: posX,
              y: item.posY ?? item.y ?? 0,
              w: width,
              h: item.height ?? 1,
              minW: 1,
              minH: 1,
              maxW: maxCols,
              maxH: 5,
            });
          });

          setWidgets(newWidgets);
          setLayout(newLayout);

          // 캐시도 업데이트 (다음 조회 시 일관성 유지)
          queryClient.setQueryData(['userDashboard', userId], freshData);
        }

        setIsResettingDashboard(false);
        setShowResetConfirm(false);
      },
      onError: (error) => {
        console.error('대시보드 초기화 실패:', error);
        setIsResettingDashboard(false);
        setShowResetConfirm(false);
      }
    });
  }, [resetUserDashboard, queryClient, userId, WIDGET_TYPES]);

  // 허용할 위젯 코드 목록 (화이트리스트)
  const ALLOWED_WIDGET_CODES = [
    'TOPOLOGY',
    'CPU_MEM_TOPN',
    'TRAFFIC_TOPN',
    'FILESYSTEM_TOPN',
    'TRAFFIC_TREND',
    'CUSTOM',
    'REALTIME_ALERT',
    'ALERT_SUMMARY',
    'DEVICE_SUMMARY'
  ];

  // 필터링된 위젯 타입
  const filteredWidgetTypes = Object.values(WIDGET_TYPES).filter(type => {
    const widgetCode = type.code || type.id;
    const isAllowed = ALLOWED_WIDGET_CODES.includes(widgetCode);
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    return isAllowed && matchesSearch && matchesCategory;
  });

  const cols = 12;
  const margin = 16;
  const containerPaddingVal = 20;

  // 정사각형 위젯을 위해 rowHeight를 컨테이너 너비 기준으로 계산
  // (containerWidth - 좌우패딩 - (cols-1)*margin) / cols = 1칸 너비
  const cellWidth = (containerWidth - containerPaddingVal * 2 - (cols - 1) * margin) / cols;
  const rowHeight = Math.max(cellWidth, 150); // 최소 150px

  // 편집 모드에 따라 static 속성 추가
  const layoutWithStatic = useMemo(() => {
    return layout.map(item => ({
      ...item,
      static: !isEditMode  // 편집 모드가 아니면 고정
    }));
  }, [layout, isEditMode]);

  // 로딩 중일 때
  const isLoading = widgetsLoading || defaultDashboardLoading || !isInitialized;

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1>대시보드</h1>
          </div>
        </div>
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <span>대시보드 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* 저장 후 데이터 리로딩 오버레이 */}
      {isReloadingAfterSave && (
        <div className="dashboard-reload-overlay">
          <div className="reload-content">
            <div className="loading-spinner"></div>
            <span>위젯 데이터 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>대시보드</h1>
          <span className="widget-count">{widgets.length}개 위젯</span>
        </div>
        <div className="dashboard-actions">
          {isEditMode && (
            <button className="btn-add-widget" onClick={() => setShowAddModal(true)}>
              <i className="bi bi-plus-lg"></i>
              위젯 추가
            </button>
          )}
          {!isEditMode && (
            <button className="btn-reset" onClick={handleResetDashboard} disabled={isResetting}>
              <i className="bi bi-arrow-counterclockwise"></i>
              {isResetting ? '초기화 중...' : '기본값으로 초기화'}
            </button>
          )}

          {/* 편집 버튼 - 사용자 대시보드 유무 관계없이 표시 */}
          <button
            className={`btn-edit-mode ${isEditMode ? 'active' : ''}`}
            onClick={handleToggleEditMode}
            disabled={isSaving}
          >
            <i className={`bi ${isEditMode ? 'bi-check-lg' : 'bi-pencil'}`}></i>
            {isSaving ? '저장 중...' : (isEditMode ? '완료' : '편집')}
          </button>
        </div>
      </div>

      {/* 위젯 그리드 */}
      <div className={`widget-grid-container ${isEditMode ? 'edit-mode' : ''}`} ref={containerRef}>
        <GridLayout
          className="layout"
          layout={layoutWithStatic}
          cols={cols}
          rowHeight={rowHeight}
          width={containerWidth}
          maxRows={5}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          isDroppable={isEditMode}
          isBounded={true}
          compactType="vertical"
          preventCollision={false}
          draggableHandle={isEditMode ? ".widget-drag-handle" : ""}
          resizeHandles={isEditMode ? ['se'] : []}
          margin={[margin, margin]}
          containerPadding={[containerPaddingVal, containerPaddingVal]}
          useCSSTransforms={true}
        >
          {widgets.map(widget => {
            const type = WIDGET_TYPES[widget.type];
            const isTopology = widget.type === 'TOPOLOGY';

            return (
              <div key={widget.id} className="widget-card">
                {/* 편집 모드: 떠있는 삭제 버튼 */}
                {isEditMode && (
                  <button
                    className="widget-floating-delete"
                    onClick={() => handleDeleteWidget(widget.id)}
                    title="삭제"
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}

                <div className="widget-header">
                  <div className="widget-title">
                    {isEditMode && <i className="bi bi-grip-vertical widget-drag-handle"></i>}
                    <i className={`bi ${type?.icon || 'bi-grid'}`}></i>
                    <span>{widget.title}</span>
                  </div>
                  <div className="widget-header-actions">
                    {/* 새로고침 버튼 (편집 모드가 아닐 때만) */}
                    {!isEditMode && !isTopology && (
                      <button
                        className={`widget-refresh-btn ${refreshingWidgets.has(widget.id) ? 'refreshing' : ''}`}
                        onClick={() => refreshWidget(widget)}
                        disabled={refreshingWidgets.has(widget.id)}
                        title="새로고침"
                      >
                        <i className={`bi bi-arrow-clockwise ${refreshingWidgets.has(widget.id) ? 'spinning' : ''}`}></i>
                      </button>
                    )}
                    {isTopology && !isEditMode && (
                      <button className="topology-fullscreen-btn" onClick={handleExpandTopology} title="전체 화면">
                        <i className="bi bi-arrows-fullscreen"></i>
                      </button>
                    )}
                    {isEditMode && (
                      <div className="widget-actions">
                        <button className="widget-action-btn" onClick={() => handleOpenConfig(widget)} title="설정">
                          <i className="bi bi-gear"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="widget-content">
                  {isTopology ? (
                    isEditMode ? (
                      <div className="topology-edit-placeholder">
                        <i className="bi bi-diagram-3"></i>
                        <span>네트워크 토폴로지</span>
                      </div>
                    ) : (
                      <MemoizedTopologyWidget onExpand={handleExpandTopology} />
                    )
                  ) : widget.type === 'CUSTOM' ? (
                    <MemoizedCustomWidgetContent widget={widget} isEditMode={isEditMode} />
                  ) : widget.type === 'REALTIME_ALERT' ? (
                    <RealtimeAlertWidget isEditMode={isEditMode} initialData={widget.chartData} />
                  ) : widget.type === 'ALERT_SUMMARY' ? (
                    <AlertSummaryWidget cntData={widget.cntData} isEditMode={isEditMode} />
                  ) : (
                    <WidgetContent widget={widget} widgetTypes={WIDGET_TYPES} isEditMode={isEditMode} />
                  )}
                </div>
              </div>
            );
          })}
        </GridLayout>
      </div>

      {/* 위젯 추가 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content add-widget-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>위젯 추가</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="widget-search">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  placeholder="위젯 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="category-filter">
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <button
                    key={key}
                    className={`category-btn ${selectedCategory === key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(key)}
                  >
                    <i className={`bi ${cat.icon}`}></i>
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="widget-type-list">
                {filteredWidgetTypes.map(type => (
                  <div
                    key={type.code || type.id}
                    className="widget-type-item"
                    onClick={() => handleAddWidget(type.code || type.id, type.id)}
                  >
                    <div className="widget-type-icon">
                      <i className={`bi ${type.icon}`}></i>
                    </div>
                    <div className="widget-type-info">
                      <span className="widget-type-name">{type.name}</span>
                      <span className="widget-type-category">{CATEGORIES[type.category]?.label}</span>
                    </div>
                    <i className="bi bi-plus-circle add-icon"></i>
                  </div>
                ))}
                {filteredWidgetTypes.length === 0 && (
                  <div className="no-widgets-found">
                    <i className="bi bi-search"></i>
                    <span>검색 결과가 없습니다</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 위젯 설정 모달 */}
      {showConfigModal && selectedWidget && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content config-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>위젯 설정</h2>
              <button className="modal-close" onClick={() => setShowConfigModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="config-form">
                <div className="form-group">
                  <label>위젯 제목</label>
                  <input
                    type="text"
                    value={selectedWidget.title}
                    onChange={(e) => setSelectedWidget({ ...selectedWidget, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>위젯 타입</label>
                  <div className="type-display">
                    <i className={`bi ${WIDGET_TYPES[selectedWidget.type]?.icon}`}></i>
                    <span>{WIDGET_TYPES[selectedWidget.type]?.name}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowConfigModal(false)}>취소</button>
              <button className="btn-save" onClick={() => handleSaveConfig(selectedWidget)}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 정의 위젯 모달 */}
      {showCustomWidgetModal && (
        <CustomWidgetModal
          onClose={() => {
            setShowCustomWidgetModal(false);
            setSelectedWidget(null);
          }}
          onSave={selectedWidget ? handleUpdateCustomWidget : handleSaveCustomWidget}
          initialData={selectedWidget?.type === 'CUSTOM' ? {
            name: selectedWidget.title,
            group: selectedWidget.config?.group,
            elements: selectedWidget.config?.elements || [],
            chartType: selectedWidget.config?.chartType || 'bar',
          } : null}
        />
      )}

      {/* 화면 가득 참 알림 모달 */}
      {showFullScreenAlert && (
        <div className="modal-overlay" onClick={() => setShowFullScreenAlert(false)}>
          <div className="modal-content alert-modal" onClick={e => e.stopPropagation()}>
            <div className="alert-icon">
              <i className="bi bi-exclamation-circle"></i>
            </div>
            <h3>공간이 부족합니다</h3>
            <p>대시보드가 가득 찼습니다.<br/>기존 위젯을 삭제하거나 크기를 조정한 후 다시 시도해주세요.</p>
            <button className="btn-confirm" onClick={() => setShowFullScreenAlert(false)}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* 기본값 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => !isResettingDashboard && setShowResetConfirm(false)}>
          <div className="modal-content reset-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="reset-confirm-icon">
              <i className="bi bi-arrow-counterclockwise"></i>
            </div>
            <h3>기본 대시보드로 초기화</h3>
            <p>
              현재 대시보드 설정이 모두 삭제되고<br/>
              기본 대시보드로 복원됩니다.
            </p>
            <div className="reset-confirm-warning">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>이 작업은 되돌릴 수 없습니다.</span>
            </div>
            <div className="reset-confirm-buttons">
              <button
                className="btn-cancel"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResettingDashboard}
              >
                취소
              </button>
              <button
                className="btn-reset"
                onClick={executeResetDashboard}
                disabled={isResettingDashboard}
              >
                {isResettingDashboard ? (
                  <>
                    <span className="spinner"></span>
                    초기화 중...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    초기화
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
