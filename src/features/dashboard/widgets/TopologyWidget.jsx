/* eslint-disable max-lines, max-lines-per-function, complexity, max-params, max-depth, no-prototype-builtins, react-hooks/immutability, react-hooks/exhaustive-deps, no-empty, no-unused-vars, react-hooks/set-state-in-effect */
// 후속 PR에서 hooks (useTopologyGraph, useTopologyZoom) + sub-component 분해 예정.

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useTopologyView } from '../../../hooks/useTopology';
import { useGroupTree } from '../../../hooks/useGroups';
import { useDevicePorts } from '../../../hooks/useDevices';
import { useDeviceErrorLevels } from '../../../hooks/useFaults';
import { useThemeStore } from '../../../stores/themeStore';
import { propagateGroupErrors } from '../../../shared/lib/groupErrorPropagation';

function TopologyWidget({ onExpand, onDeviceClick }) {
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

  // 주기적 갱신 시 줌/팬 리셋 방지용 ref
  const zoomedForGroupRef = useRef(null);

  // 그룹 호버 툴팁
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const tooltipHideTimer = useRef(null);
  const isTooltipHovered = useRef(false);

  // 링크 클릭 정보
  const [selectedLink, setSelectedLink] = useState(null);

  // 장애 데이터 (장비/그룹별 최고 등급)
  const { deviceErrorMap, groupErrorMap, errors: activeErrors } = useDeviceErrorLevels();
  const deviceErrorMapRef = useRef(deviceErrorMap);
  const groupErrorMapRef = useRef(new Map());

  const { data: groupTree, isLoading: groupTreeLoading } = useGroupTree();

  // 그룹트리 기반으로 하위 그룹 장애를 상위 그룹으로 전파
  useEffect(() => {
    deviceErrorMapRef.current = deviceErrorMap;
    groupErrorMapRef.current = propagateGroupErrors(groupTree, groupErrorMap);
  }, [deviceErrorMap, groupErrorMap, groupTree]);
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
      const MAX_ZOOM = 4;
      if (graphRef.current.zoom() > MAX_ZOOM) {
        graphRef.current.zoom(MAX_ZOOM, 0);
      }
    }
  }, [graphData.nodes.length]);

  // 그룹 변경 시 줌 추적 리셋
  useEffect(() => {
    zoomedForGroupRef.current = null;
  }, [displayGroupId]);

  useEffect(() => {
    if (graphRef.current && (graphData.nodes.length > 0 || backgroundImage)) {
      // 이미 현재 그룹에서 줌 완료 → 주기적 갱신이므로 줌 리셋 안 함
      if (zoomedForGroupRef.current === displayGroupId) return;

      const timer1 = setTimeout(adjustZoom, 100);
      const timer2 = setTimeout(adjustZoom, 300);
      const timer3 = setTimeout(() => {
        adjustZoom();
        zoomedForGroupRef.current = displayGroupId;
      }, 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [graphData.nodes.length, dimensions, backgroundImage, adjustZoom, displayGroupId]);

  const NODE_SIZE = 36;

  // 장애 등급별 색상
  const FAULT_COLORS = {
    'C': { r: 239, g: 68, b: 68 },   // Critical - 빨강
    'M': { r: 249, g: 115, b: 22 },  // Major - 주황
    'N': { r: 234, g: 179, b: 8 },   // Minor - 노랑
    'W': { r: 59, g: 130, b: 246 },  // Warning - 파랑
  };

  const drawNode = useCallback((node, ctx, globalScale) => {
    const isGroupNode = node.nodeType === 'group' || node.type === 'group';
    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;
    const drawX = node.x;
    const drawY = node.y;
    const label = node.name || node.label || node.id;

    // 장애 등급 조회
    let errorLevel = null;
    if (isGroupNode) {
      const gName = node.name || node.groupName;
      errorLevel = gName ? groupErrorMapRef.current.get(gName) : null;
    } else {
      // 다양한 ID 필드 시도
      const dId = node.deviceId ?? node.DEVICE_ID ?? node.originalId;
      if (dId != null) {
        errorLevel = deviceErrorMapRef.current.get(dId)
          || deviceErrorMapRef.current.get(String(dId))
          || deviceErrorMapRef.current.get(Number(dId))
          || null;
      }
    }
    const faultColor = errorLevel ? FAULT_COLORS[errorLevel] : null;

    // 펄스 애니메이션 (장애 시)
    const pulse = faultColor ? 0.6 + 0.4 * Math.sin(Date.now() / 400) : 0;

    if (isGroupNode) {
      const radius = 10;
      const hasIconData = node.iconData || node.ICON_DATA;

      // 외곽 glow
      ctx.save();
      if (faultColor) {
        ctx.shadowColor = `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.7 * pulse})`;
        ctx.shadowBlur = 18 + 6 * pulse;
      } else {
        ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      ctx.fillStyle = faultColor
        ? `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.12)`
        : 'rgba(139, 92, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 배경 그라데이션
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      const glassBg = ctx.createLinearGradient(drawX - half, drawY - half, drawX + half, drawY + half);
      if (faultColor) {
        glassBg.addColorStop(0, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.3)`);
        glassBg.addColorStop(0.5, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.15)`);
        glassBg.addColorStop(1, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.3)`);
      } else {
        glassBg.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        glassBg.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
        glassBg.addColorStop(1, 'rgba(196, 181, 253, 0.25)');
      }
      ctx.fillStyle = glassBg;
      ctx.fill();

      // 아이콘
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

      // 테두리
      ctx.beginPath();
      ctx.roundRect(drawX - half, drawY - half, size, size, radius);
      if (faultColor) {
        ctx.strokeStyle = `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 2.5 / globalScale;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5 / globalScale;
      }
      ctx.stroke();

      // 장애 노드 중심부 펄스 오버레이 (그룹 노드)
      if (faultColor) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(drawX - half, drawY - half, size, size, radius);
        ctx.clip();
        const pulseGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, half);
        pulseGrad.addColorStop(0, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.4 * pulse})`);
        pulseGrad.addColorStop(0.6, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.15 * pulse})`);
        pulseGrad.addColorStop(1, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0)`);
        ctx.fillStyle = pulseGrad;
        ctx.fillRect(drawX - half, drawY - half, size, size);
        ctx.restore();
      }
    } else {
      const deviceIconData = node.iconData || node.ICON_DATA;

      // 외곽 glow
      ctx.save();
      if (faultColor) {
        ctx.shadowColor = `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.7 * pulse})`;
        ctx.shadowBlur = 18 + 6 * pulse;
      } else {
        ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      ctx.fillStyle = faultColor
        ? `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.12)`
        : 'rgba(59, 130, 246, 0.1)';
      ctx.fill();
      ctx.restore();

      // 배경 그라데이션
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      const glassBg = ctx.createRadialGradient(drawX - half * 0.3, drawY - half * 0.3, 0, drawX, drawY, half);
      if (faultColor) {
        glassBg.addColorStop(0, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.4)`);
        glassBg.addColorStop(0.5, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.2)`);
        glassBg.addColorStop(1, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0.35)`);
      } else {
        glassBg.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
        glassBg.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
        glassBg.addColorStop(1, 'rgba(37, 99, 235, 0.3)');
      }
      ctx.fillStyle = glassBg;
      ctx.fill();

      // 아이콘
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

      // 테두리
      ctx.beginPath();
      ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
      if (faultColor) {
        ctx.strokeStyle = `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 2.5 / globalScale;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5 / globalScale;
      }
      ctx.stroke();

      // 장애 노드 중심부 펄스 오버레이 (장비 노드)
      if (faultColor) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(drawX, drawY, half, 0, 2 * Math.PI);
        ctx.clip();
        const pulseGrad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, half);
        pulseGrad.addColorStop(0, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.4 * pulse})`);
        pulseGrad.addColorStop(0.6, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, ${0.15 * pulse})`);
        pulseGrad.addColorStop(1, `rgba(${faultColor.r}, ${faultColor.g}, ${faultColor.b}, 0)`);
        ctx.fillStyle = pulseGrad;
        ctx.fill();
        ctx.restore();
      }
    }

    // 라벨
    const fontSize = 11 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = faultColor
      ? `rgb(${faultColor.r}, ${faultColor.g}, ${faultColor.b})`
      : "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2 / globalScale;
    const textY = drawY + half + 4;
    ctx.strokeText(label, drawX, textY);
    ctx.fillText(label, drawX, textY);
  }, []);

  // 장애 존재 시 펄스 애니메이션을 위한 주기적 re-render
  const hasFaults = deviceErrorMap.size > 0 || groupErrorMap.size > 0;
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (!hasFaults) return;
    const interval = setInterval(() => setPulseKey(k => k + 1), 80);
    return () => clearInterval(interval);
  }, [hasFaults]);

  const handleNodeClick = useCallback((node) => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    setSelectedLink(null);
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
    } else {
      // 장비 클릭 시 상위에 알림
      const dId = node.deviceId ?? node.DEVICE_ID ?? node.originalId;
      if (dId && onDeviceClick) {
        onDeviceClick(dId);
      }
    }
  }, [displayGroupId, onDeviceClick]);

  // 링크 클릭 → 링크 정보 표시
  // 노드에서 장비 ID 추출
  const getDeviceIdFromNode = useCallback((node) => {
    if (!node) return null;
    const id = String(node.id || '');
    return node.deviceId || node.DEVICE_ID || node.originalId || (id.startsWith('device_') ? id.replace('device_', '') : null);
  }, []);

  const handleLinkClick = useCallback((link) => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    const srcNode = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => String(n.id) === String(link.source));
    const tgtNode = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => String(n.id) === String(link.target));
    const srcIsDevice = srcNode?.nodeType === 'device' || (srcNode?.type && srcNode.type !== 'group');
    const tgtIsDevice = tgtNode?.nodeType === 'device' || (tgtNode?.type && tgtNode.type !== 'group');
    setSelectedLink({
      ...link,
      sourceName: srcNode?.name || srcNode?.label || String(link.source),
      targetName: tgtNode?.name || tgtNode?.label || String(link.target),
      sourceIp: srcNode?.ip || '',
      targetIp: tgtNode?.ip || '',
      srcIsDevice,
      tgtIsDevice,
      srcDeviceId: srcIsDevice ? getDeviceIdFromNode(srcNode) : null,
      tgtDeviceId: tgtIsDevice ? getDeviceIdFromNode(tgtNode) : null,
      srcIfName: link.srcIfName || link.SRC_IF_NAME || link.srcIfname || '',
      dstIfName: link.dstIfName || link.DST_IF_NAME || link.dstIfname || '',
      srcIfIndex: link.srcIfIndex ?? link.SRC_IF_INDEX ?? link.srcIfindex ?? '',
      dstIfIndex: link.dstIfIndex ?? link.DST_IF_INDEX ?? link.dstIfindex ?? '',
      status: link.status || link.STATUS || '',
    });
  }, [graphData.nodes, getDeviceIdFromNode]);

  // 선택된 링크의 장비 포트 조회 (IF_INDEX → IF_NAME 변환)
  const linkSrcDeviceId = selectedLink?.srcIsDevice ? selectedLink.srcDeviceId : null;
  const linkTgtDeviceId = selectedLink?.tgtIsDevice ? selectedLink.tgtDeviceId : null;
  const { data: linkSrcPorts } = useDevicePorts(linkSrcDeviceId);
  const { data: linkTgtPorts } = useDevicePorts(linkTgtDeviceId);

  const resolveIfName = useCallback((ifIndex, ifName, ports) => {
    if (ifName) return ifName;
    if (!ifIndex) return '';
    if (!ports?.length) return `IF:${ifIndex}`;
    const port = ports.find(p => String(p.IF_INDEX) === String(ifIndex));
    return port?.IF_NAME || `IF:${ifIndex}`;
  }, []);

  // 그룹 호버 시 장애 건수 툴팁
  const getGroupFaultInfo = useCallback((groupName) => {
    if (!groupName || !activeErrors?.length) return null;

    // 해당 그룹 + 하위 그룹명 수집
    const targetNames = new Set([groupName]);
    const findDescendants = (nodes) => {
      for (const node of nodes) {
        if (targetNames.has(node.GROUP_NAME)) {
          if (node.children?.length > 0) {
            node.children.forEach(child => {
              targetNames.add(child.GROUP_NAME);
            });
            findDescendants(node.children);
          }
        } else if (node.children?.length > 0) {
          findDescendants(node.children);
        }
      }
    };
    if (groupTree) findDescendants(groupTree);

    const counts = { C: 0, M: 0, N: 0, W: 0, total: 0 };
    const details = { C: [], M: [], N: [], W: [] };
    activeErrors.forEach(err => {
      if (targetNames.has(err.GROUP_NAME) && counts.hasOwnProperty(err.ERROR_LEVEL)) {
        counts[err.ERROR_LEVEL]++;
        counts.total++;
        details[err.ERROR_LEVEL].push(err);
      }
    });
    return counts.total > 0 ? { counts, details } : null;
  }, [activeErrors, groupTree]);

  const [expandedLevel, setExpandedLevel] = useState(null);

  const hideTooltip = useCallback(() => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    isTooltipHovered.current = false;
  }, []);

  const handleNodeHover = useCallback((node) => {
    clearTimeout(tooltipHideTimer.current);

    if (!node || !(node.nodeType === 'group' || node.type === 'group')) {
      // 노드를 벗어남 → 잠시 대기 후 숨김 (툴팁으로 이동 가능)
      tooltipHideTimer.current = setTimeout(() => {
        if (!isTooltipHovered.current) hideTooltip();
      }, 250);
      return;
    }
    const gName = node.name || node.groupName;
    const info = getGroupFaultInfo(gName);
    if (!info) { hideTooltip(); return; }

    // 노드 좌표 → 화면 좌표 변환
    if (graphRef.current) {
      const { x, y } = graphRef.current.graph2ScreenCoords(node.x, node.y);
      setHoveredGroup({ name: gName, ...info, x, y });
      setExpandedLevel(null);
    }
  }, [getGroupFaultInfo, hideTooltip]);

  const handleTooltipEnter = useCallback(() => {
    clearTimeout(tooltipHideTimer.current);
    isTooltipHovered.current = true;
  }, []);

  const handleTooltipLeave = useCallback(() => {
    isTooltipHovered.current = false;
    hideTooltip();
  }, [hideTooltip]);

  const handleBackClick = useCallback(() => {
    setSelectedLink(null);
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
          onNodeHover={handleNodeHover}
          onLinkClick={handleLinkClick}
          onBackgroundClick={() => setSelectedLink(null)}
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
      {/* 그룹 장애 현황 툴팁 */}
      {hoveredGroup && (
        <div
          className="topology-fault-tooltip"
          style={{ left: hoveredGroup.x + 20, top: hoveredGroup.y - 10 }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="topology-fault-tooltip-title">{hoveredGroup.name}</div>
          <div className="topology-fault-tooltip-body">
            {[
              { level: 'C', label: 'Critical', color: '#ef4444' },
              { level: 'M', label: 'Major',    color: '#f97316' },
              { level: 'N', label: 'Minor',    color: '#eab308' },
              { level: 'W', label: 'Warning',  color: '#3b82f6' },
            ].map(({ level, label, color }) => hoveredGroup.counts[level] > 0 && (
              <div key={level}>
                <div
                  className={`topology-fault-row ${expandedLevel === level ? 'expanded' : ''}`}
                  onClick={() => setExpandedLevel(prev => prev === level ? null : level)}
                >
                  <span className="topology-fault-dot" style={{ background: color }} />
                  <span>{label}</span>
                  <strong>{hoveredGroup.counts[level]}</strong>
                  <i className={`bi bi-chevron-${expandedLevel === level ? 'up' : 'down'} topology-fault-chevron`} />
                </div>
                {expandedLevel === level && (
                  <div className="topology-fault-detail">
                    {hoveredGroup.details[level].slice(0, 10).map((err, i) => (
                      <div key={err.ERROR_ID || i} className="topology-fault-detail-item">
                        <span className="topology-fault-detail-name" title={err.DEVICE_NAME}>
                          {err.DEVICE_NAME || '-'}
                        </span>
                        <span className="topology-fault-detail-ip">{err.DEVICE_IP || ''}</span>
                        <span className="topology-fault-detail-msg" title={err.ERROR_MESSAGE}>
                          {err.ERROR_MESSAGE || '-'}
                        </span>
                      </div>
                    ))}
                    {hoveredGroup.details[level].length > 10 && (
                      <div className="topology-fault-detail-more">
                        외 {hoveredGroup.details[level].length - 10}건
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="topology-fault-total">
              총 <strong>{hoveredGroup.counts.total}</strong>건
            </div>
          </div>
        </div>
      )}
      {/* 링크 정보 패널 */}
      {selectedLink && (() => {
        const resolvedSrc = resolveIfName(selectedLink.srcIfIndex, selectedLink.srcIfName, linkSrcPorts);
        const resolvedDst = resolveIfName(selectedLink.dstIfIndex, selectedLink.dstIfName, linkTgtPorts);
        const showInterface = selectedLink.srcIsDevice && selectedLink.tgtIsDevice;
        let linkStatus = selectedLink.status;
        if (!linkStatus && showInterface) {
          const srcPortList = linkSrcPorts?.content || linkSrcPorts || [];
          const dstPortList = linkTgtPorts?.content || linkTgtPorts || [];
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
          position: 'absolute', top: 10, right: 10, zIndex: 12, width: 260,
          backgroundColor: '#1f2937', borderRadius: 8, padding: '10px 12px',
          color: 'white', fontSize: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><i className="bi bi-link-45deg" style={{ marginRight: 6 }}></i>링크 정보</span>
            <button onClick={() => setSelectedLink(null)}
              style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>X</button>
          </div>
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: selectedLink.srcIsDevice ? '#3b82f6' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`bi ${selectedLink.srcIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 12 }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: selectedLink.srcIsDevice ? '#60a5fa' : '#a78bfa', fontSize: 11 }}>{selectedLink.sourceName}</div>
                {selectedLink.srcIsDevice && selectedLink.sourceIp && <div style={{ fontSize: 10, color: '#9ca3af' }}>{selectedLink.sourceIp}</div>}
              </div>
            </div>
            {showInterface && (resolvedSrc || resolvedDst) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '4px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)', margin: '6px 0' }}>
              {resolvedSrc ? (
                <span style={{ background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>{resolvedSrc}</span>
              ) : null}
              <i className="bi bi-arrow-down" style={{ fontSize: 14, color: '#6b7280' }}></i>
              {resolvedDst ? (
                <span style={{ background: '#f59e0b', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>{resolvedDst}</span>
              ) : null}
            </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: selectedLink.tgtIsDevice ? '#f59e0b' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`bi ${selectedLink.tgtIsDevice ? 'bi-hdd-network' : 'bi-folder2'}`} style={{ fontSize: 12 }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: selectedLink.tgtIsDevice ? '#fbbf24' : '#a78bfa', fontSize: 11 }}>{selectedLink.targetName}</div>
                {selectedLink.tgtIsDevice && selectedLink.targetIp && <div style={{ fontSize: 10, color: '#9ca3af' }}>{selectedLink.targetIp}</div>}
              </div>
            </div>
          </div>
          {(selectedLink.srcIsDevice || selectedLink.tgtIsDevice) && linkStatus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
              <span>상태</span>
              <span style={{ color: linkStatus === 'up' ? '#22c55e' : linkStatus === 'down' ? '#ef4444' : '#f59e0b' }}>
                {linkStatus === 'up' ? 'UP' : linkStatus === 'down' ? 'DOWN' : linkStatus || '-'}
              </span>
            </div>
          )}
        </div>
        );
      })()}
      {/* 뒤로 가기 버튼 (하위 그룹에 있을 때만 표시) */}
      {currentGroupId && groupHistory.length > 0 && (
        <button className="topology-back-btn" onClick={handleBackClick} title="뒤로 가기">
          <i className="bi bi-arrow-left"></i>
        </button>
      )}
    </div>
  );
}

export default memo(TopologyWidget);
