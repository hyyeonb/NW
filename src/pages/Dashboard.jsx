import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useTopologyView, useGroupTree } from '../hooks';
import '../styles/dashboard.css';

// 위젯 타입 정의
const WIDGET_TYPES = {
  TOPOLOGY: {
    id: 'TOPOLOGY',
    name: '네트워크 토폴로지',
    icon: 'bi-diagram-3',
    category: 'network',
    size: 'large',
  },
  DEVICE_STATUS: {
    id: 'DEVICE_STATUS',
    name: '장비 상태',
    icon: 'bi-hdd-network',
    category: 'monitoring',
    size: 'medium',
  },
  TRAFFIC_CHART: {
    id: 'TRAFFIC_CHART',
    name: '트래픽 차트',
    icon: 'bi-graph-up',
    category: 'chart',
    size: 'medium',
  },
  ALERT_LIST: {
    id: 'ALERT_LIST',
    name: '알람 목록',
    icon: 'bi-bell',
    category: 'monitoring',
    size: 'medium',
  },
  RESOURCE_USAGE: {
    id: 'RESOURCE_USAGE',
    name: '리소스 사용량',
    icon: 'bi-pie-chart',
    category: 'chart',
    size: 'small',
  },
  EVENT_LOG: {
    id: 'EVENT_LOG',
    name: '이벤트 로그',
    icon: 'bi-list-ul',
    category: 'monitoring',
    size: 'medium',
  },
  PERFORMANCE_GAUGE: {
    id: 'PERFORMANCE_GAUGE',
    name: '성능 게이지',
    icon: 'bi-speedometer2',
    category: 'chart',
    size: 'small',
  },
  GROUP_SUMMARY: {
    id: 'GROUP_SUMMARY',
    name: '그룹 요약',
    icon: 'bi-folder',
    category: 'info',
    size: 'small',
  },
};

const CATEGORIES = {
  all: { label: '전체', icon: 'bi-grid-3x3-gap' },
  network: { label: '네트워크', icon: 'bi-diagram-3' },
  monitoring: { label: '모니터링', icon: 'bi-display' },
  chart: { label: '차트', icon: 'bi-bar-chart' },
  info: { label: '정보', icon: 'bi-info-circle' },
};

// 위젯 크기 옵션
const WIDGET_SIZES = {
  '1x1': { colSpan: 1, rowSpan: 1, label: '1x1' },
  '2x1': { colSpan: 2, rowSpan: 1, label: '2x1' },
  '1x2': { colSpan: 1, rowSpan: 2, label: '1x2' },
  '2x2': { colSpan: 2, rowSpan: 2, label: '2x2' },
  '3x2': { colSpan: 3, rowSpan: 2, label: '3x2' },
  '4x2': { colSpan: 4, rowSpan: 2, label: '4x2' },
};

// 초기 위젯 배치 (토폴로지가 첫 번째)
const initialWidgets = [
  { id: 'w0', type: 'TOPOLOGY', title: '네트워크 토폴로지', config: {}, size: '2x2' },
  { id: 'w1', type: 'DEVICE_STATUS', title: '장비 상태', config: {}, size: '1x1' },
  { id: 'w2', type: 'ALERT_LIST', title: '최근 알람', config: {}, size: '1x2' },
  { id: 'w3', type: 'RESOURCE_USAGE', title: 'CPU 사용량', config: {}, size: '1x1' },
  { id: 'w4', type: 'TRAFFIC_CHART', title: '트래픽 현황', config: {}, size: '2x1' },
];

// 토폴로지 위젯 컴포넌트
function TopologyWidget({ onExpand }) {
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 }); // 임시 초기값
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const groupIconCache = useRef({});
  const iconCache = useRef({});
  const navigate = useNavigate();

  // 배경 이미지 관련 상태
  const [backgroundImage, setBackgroundImage] = useState(null);
  const backgroundImageRef = useRef(null);

  // 그룹 트리에서 최상위 그룹 찾기 (NetworkTopology와 동일한 방식)
  const { data: groupTree, isLoading: groupTreeLoading } = useGroupTree();

  // '미등록 장비'를 제외한 첫 번째 그룹을 최상위로 설정
  const rootGroup = groupTree?.find(g => g.GROUP_NAME !== '미등록 장비');
  const topGroupId = rootGroup?.GROUP_ID || null;

  // 토폴로지 데이터 조회
  const { data: topologyData, isLoading: topologyLoading } = useTopologyView(topGroupId, 'group');

  // 그룹 트리 로딩 중이거나, 그룹 ID가 있고 토폴로지 로딩 중일 때
  const isLoading = groupTreeLoading || (topGroupId && topologyLoading);

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  // 토폴로지 데이터 로드 시 state 업데이트 (NetworkTopology와 동일한 방식)
  useEffect(() => {
    if (!topologyData?.nodes) {
      setGraphData({ nodes: [], links: [] });
      setBackgroundImage(null);
      backgroundImageRef.current = null;
      return;
    }

    // 모든 노드 위치 고정
    const fixedNodes = (topologyData.nodes || []).map(n => ({
      ...n,
      id: String(n.id),
      label: n.name || n.groupName || n.deviceName || 'Unknown',
      fx: n.fx ?? n.x,
      fy: n.fy ?? n.y,
    }));

    // 노드 ID 목록 생성
    const nodeIds = new Set(fixedNodes.map(n => String(n.id)));

    // 유효한 링크만 필터링
    const validLinks = (topologyData.links || []).filter(link => {
      const sourceId = typeof link.source === 'object' ? String(link.source?.id) : String(link.source);
      const targetId = typeof link.target === 'object' ? String(link.target?.id) : String(link.target);
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    setGraphData({ nodes: fixedNodes, links: validLinks });

    // 배경 이미지 설정 (BACK_ICON_DATA 또는 backIconData)
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
        // 크기가 유효할 때만 업데이트
        if (rect.width > 50 && rect.height > 50) {
          const newWidth = Math.floor(rect.width);
          const newHeight = Math.floor(rect.height);

          setDimensions(prev => {
            // 크기가 크게 변경되었을 때만 업데이트 (깜빡임 방지)
            if (!prev || Math.abs(prev.width - newWidth) > 5 || Math.abs(prev.height - newHeight) > 5) {
              return { width: newWidth, height: newHeight };
            }
            return prev;
          });
          setDimensionsReady(true);
        }
      }
    };

    // 초기 크기 설정 (여러 번 시도)
    const initTimer1 = setTimeout(updateSize, 50);
    const initTimer2 = setTimeout(updateSize, 150);
    const initTimer3 = setTimeout(updateSize, 300);

    const resizeObserver = new ResizeObserver((entries) => {
      // 크기가 0이 아닐 때만 업데이트
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

  // 줌 조정 함수
  const adjustZoom = useCallback(() => {
    if (!graphRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;

    if (containerWidth < 100 || containerHeight < 100) return; // 너무 작으면 무시

    // 배경 이미지가 있으면 이미지 기준으로 줌 설정
    if (backgroundImageRef.current && backgroundImageRef.current.complete) {
      const img = backgroundImageRef.current;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      // 배경 이미지 스케일 (NetworkTopology와 동일: 0.4)
      const bgScale = 0.4;
      const scaledWidth = imgWidth * bgScale;
      const scaledHeight = imgHeight * bgScale;

      // 위젯 크기에 맞게 줌 계산
      const scaleX = containerWidth / scaledWidth;
      const scaleY = containerHeight / scaledHeight;
      const fitZoom = Math.min(scaleX, scaleY) * 0.85; // 85%로 여백 확보

      graphRef.current.centerAt(0, 0, 0);
      graphRef.current.zoom(fitZoom, 0);
    } else if (graphData.nodes.length > 0) {
      // 배경 이미지 없으면 노드 기준으로 줌
      graphRef.current.zoomToFit(0, 30);
    }
  }, [graphData.nodes.length]);

  useEffect(() => {
    if (graphRef.current && (graphData.nodes.length > 0 || backgroundImage)) {
      // 여러 번 시도하여 확실히 줌 적용
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

  // NetworkTopology와 동일한 노드 그리기 (간소화 버전)
  const NODE_SIZE = 36;

  const drawNode = useCallback((node, ctx, globalScale) => {
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';
    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;
    const drawX = node.x;
    const drawY = node.y;
    const label = node.name || node.label || node.id;

    // 그룹 노드 그리기
    if (isGroupNode) {
      const radius = 10;
      const hasIconData = node.iconData || node.ICON_DATA;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 12;
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

      // 그룹 아이콘 이미지 로드
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
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("...", drawX, drawY);
        }
      } else {
        // 기본 폴더 아이콘
        const iconSize = size * 0.4;
        const iconX = drawX - iconSize / 2;
        const iconY = drawY - iconSize / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    } else {
      // 장비 노드 그리기
      const deviceIconData = node.iconData || node.ICON_DATA;

      // 글래스모피즘 배경 (외부 글로우)
      ctx.save();
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 12;
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
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = `${size * 0.3}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("...", drawX, drawY);
        }
      } else {
        // 기본 서버 아이콘
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        const iconSize = size * 0.35;
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2, iconSize, iconSize * 0.25);
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2 + iconSize * 0.35, iconSize, iconSize * 0.25);
        ctx.fillRect(drawX - iconSize/2, drawY - iconSize/2 + iconSize * 0.7, iconSize, iconSize * 0.25);
      }

      // 글래스모피즘 테두리
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // 라벨
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
    // 그룹 노드 클릭 시 해당 그룹의 토폴로지로 이동
    if (node.nodeType === 'group' || node.type === 'group') {
      // id가 "group_28" 형식일 수 있으므로 숫자만 추출
      let groupId = node.groupId || node.id;
      if (typeof groupId === 'string' && groupId.startsWith('group_')) {
        groupId = groupId.replace('group_', '');
      }
      console.log('Dashboard: 그룹 클릭, groupId:', groupId, 'node:', node);
      navigate(`/topology?groupId=${groupId}`);
    } else {
      navigate('/topology');
    }
  }, [navigate]);

  // 로딩/에러 오버레이 렌더링
  const renderOverlay = () => {
    if (isLoading) {
      return (
        <div className="topology-overlay">
          <div className="loading-spinner"></div>
          <span>토폴로지 로딩 중...</span>
        </div>
      );
    }
    if (!topGroupId) {
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
      {dimensionsReady && !isLoading && topGroupId && (
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
          onRenderFramePre={(ctx, globalScale) => {
            // 배경 이미지 그리기 (NetworkTopology와 동일한 방식)
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
      )}
      <button className="topology-expand-btn" onClick={onExpand} title="전체 화면">
        <i className="bi bi-arrows-fullscreen"></i>
      </button>
    </div>
  );
}

// memo로 감싸서 부모 리렌더링에 영향받지 않도록
const MemoizedTopologyWidget = memo(TopologyWidget);

// 일반 위젯 컨텐츠 렌더링
function WidgetContent({ widget }) {
  const type = WIDGET_TYPES[widget.type];

  switch (widget.type) {
    case 'DEVICE_STATUS':
      return (
        <div className="widget-content-inner">
          <div className="status-grid">
            <div className="status-item success">
              <span className="status-count">45</span>
              <span className="status-label">정상</span>
            </div>
            <div className="status-item warning">
              <span className="status-count">3</span>
              <span className="status-label">경고</span>
            </div>
            <div className="status-item danger">
              <span className="status-count">1</span>
              <span className="status-label">장애</span>
            </div>
            <div className="status-item offline">
              <span className="status-count">2</span>
              <span className="status-label">오프라인</span>
            </div>
          </div>
        </div>
      );

    case 'TRAFFIC_CHART':
      return (
        <div className="widget-content-inner">
          <div className="chart-placeholder">
            <i className="bi bi-graph-up"></i>
            <span>트래픽 차트</span>
          </div>
        </div>
      );

    case 'ALERT_LIST':
      return (
        <div className="widget-content-inner">
          <ul className="alert-list">
            <li className="alert-item critical">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div className="alert-info">
                <span className="alert-message">서버 응답 없음</span>
                <span className="alert-time">2분 전</span>
              </div>
            </li>
            <li className="alert-item warning">
              <i className="bi bi-exclamation-circle-fill"></i>
              <div className="alert-info">
                <span className="alert-message">CPU 사용량 85%</span>
                <span className="alert-time">15분 전</span>
              </div>
            </li>
            <li className="alert-item info">
              <i className="bi bi-info-circle-fill"></i>
              <div className="alert-info">
                <span className="alert-message">백업 완료</span>
                <span className="alert-time">1시간 전</span>
              </div>
            </li>
          </ul>
        </div>
      );

    case 'RESOURCE_USAGE':
      return (
        <div className="widget-content-inner">
          <div className="gauge-container">
            <svg viewBox="0 0 100 50" className="gauge-svg">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#334155" strokeWidth="8" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#3b82f6" strokeWidth="8"
                strokeDasharray="125.6" strokeDashoffset="44" />
            </svg>
            <div className="gauge-value">65%</div>
            <div className="gauge-label">CPU</div>
          </div>
        </div>
      );

    case 'EVENT_LOG':
      return (
        <div className="widget-content-inner">
          <ul className="event-log-list">
            <li><span className="time">10:32</span> 장비 연결됨</li>
            <li><span className="time">10:28</span> 백업 완료</li>
            <li><span className="time">10:15</span> 설정 변경</li>
          </ul>
        </div>
      );

    case 'GROUP_SUMMARY':
      return (
        <div className="widget-content-inner">
          <div className="group-summary">
            <div className="summary-item"><span>그룹</span><strong>12</strong></div>
            <div className="summary-item"><span>장비</span><strong>51</strong></div>
          </div>
        </div>
      );

    case 'PERFORMANCE_GAUGE':
      return (
        <div className="widget-content-inner">
          <div className="gauge-container">
            <svg viewBox="0 0 100 50" className="gauge-svg">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#334155" strokeWidth="8" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#22c55e" strokeWidth="8"
                strokeDasharray="125.6" strokeDashoffset="80" />
            </svg>
            <div className="gauge-value" style={{ color: '#22c55e' }}>36%</div>
            <div className="gauge-label">Memory</div>
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState(initialWidgets);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 드래그 상태
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [dragOverWidget, setDragOverWidget] = useState(null);

  // 위젯 추가
  const handleAddWidget = useCallback((typeId) => {
    const type = WIDGET_TYPES[typeId];
    if (!type) return;

    // 위젯 타입에 따른 기본 크기 설정
    const defaultSize = typeId === 'TOPOLOGY' ? '2x2' :
                        type.size === 'large' ? '2x2' :
                        type.size === 'medium' ? '1x1' : '1x1';

    const newWidget = {
      id: `w${Date.now()}`,
      type: typeId,
      title: type.name,
      config: {},
      size: defaultSize,
    };

    setWidgets(prev => [...prev, newWidget]);
    setShowAddModal(false);
  }, []);

  // 위젯 삭제
  const handleDeleteWidget = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  // 위젯 크기 변경
  const handleResizeWidget = useCallback((widgetId, newSize) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, size: newSize } : w
    ));
  }, []);

  // 위젯 설정 열기
  const handleOpenConfig = useCallback((widget) => {
    setSelectedWidget(widget);
    setShowConfigModal(true);
  }, []);

  // 위젯 설정 저장
  const handleSaveConfig = useCallback((updatedWidget) => {
    setWidgets(prev => prev.map(w =>
      w.id === updatedWidget.id ? updatedWidget : w
    ));
    setShowConfigModal(false);
    setSelectedWidget(null);
  }, []);

  // 토폴로지 전체화면 이동
  const handleExpandTopology = useCallback(() => {
    navigate('/topology');
  }, [navigate]);

  // 드래그 시작
  const handleDragStart = useCallback((e, widget) => {
    if (!isEditMode) return;
    setDraggedWidget(widget);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widget.id);
  }, [isEditMode]);

  // 드래그 오버
  const handleDragOver = useCallback((e, widget) => {
    e.preventDefault();
    if (!isEditMode || !draggedWidget || draggedWidget.id === widget.id) return;
    setDragOverWidget(widget);
  }, [isEditMode, draggedWidget]);

  // 드래그 떠남
  const handleDragLeave = useCallback(() => {
    setDragOverWidget(null);
  }, []);

  // 드롭
  const handleDrop = useCallback((e, targetWidget) => {
    e.preventDefault();
    if (!isEditMode || !draggedWidget || draggedWidget.id === targetWidget.id) {
      setDraggedWidget(null);
      setDragOverWidget(null);
      return;
    }

    setWidgets(prev => {
      const newWidgets = [...prev];
      const draggedIndex = newWidgets.findIndex(w => w.id === draggedWidget.id);
      const targetIndex = newWidgets.findIndex(w => w.id === targetWidget.id);

      // 위치 교환
      const [removed] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, removed);

      return newWidgets;
    });

    setDraggedWidget(null);
    setDragOverWidget(null);
  }, [isEditMode, draggedWidget]);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, []);

  // 필터링된 위젯 타입
  const filteredWidgetTypes = Object.values(WIDGET_TYPES).filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="dashboard-page">
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
          <button
            className={`btn-edit-mode ${isEditMode ? 'active' : ''}`}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <i className={`bi ${isEditMode ? 'bi-check-lg' : 'bi-pencil'}`}></i>
            {isEditMode ? '완료' : '편집'}
          </button>
        </div>
      </div>

      {/* 위젯 그리드 */}
      <div className={`widget-grid ${isEditMode ? 'edit-mode' : ''}`}>
        {widgets.map(widget => {
          const type = WIDGET_TYPES[widget.type];
          const isTopology = widget.type === 'TOPOLOGY';
          const isDragging = draggedWidget?.id === widget.id;
          const isDragOver = dragOverWidget?.id === widget.id;
          const widgetSize = WIDGET_SIZES[widget.size] || WIDGET_SIZES['1x1'];

          return (
            <div
              key={widget.id}
              className={`widget-card ${isEditMode ? 'editable' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              style={{
                gridColumn: `span ${widgetSize.colSpan}`,
                gridRow: `span ${widgetSize.rowSpan}`,
              }}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, widget)}
              onDragOver={(e) => handleDragOver(e, widget)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, widget)}
              onDragEnd={handleDragEnd}
            >
              <div className="widget-header">
                <div className="widget-title">
                  {isEditMode && <i className="bi bi-grip-vertical drag-handle"></i>}
                  <i className={`bi ${type?.icon || 'bi-grid'}`}></i>
                  <span>{widget.title}</span>
                </div>
                <div className="widget-header-actions">
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
                      <button className="widget-action-btn delete" onClick={() => handleDeleteWidget(widget.id)} title="삭제">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* 편집모드 크기 조절 버튼 */}
              {isEditMode && (
                <div className="widget-resize-controls">
                  <select
                    className="widget-size-select"
                    value={widget.size || '1x1'}
                    onChange={(e) => handleResizeWidget(widget.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.entries(WIDGET_SIZES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              )}
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
                ) : (
                  <WidgetContent widget={widget} />
                )}
              </div>
            </div>
          );
        })}
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
                  <div key={type.id} className="widget-type-item" onClick={() => handleAddWidget(type.id)}>
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
    </div>
  );
}
