/* eslint-disable max-lines, max-lines-per-function, complexity, max-params, max-depth, no-prototype-builtins, react-hooks/immutability, react-hooks/exhaustive-deps, no-empty, no-unused-vars, react-hooks/set-state-in-effect */
// 후속 PR에서 hooks (useUserTopoGraph, useUserTopoEditor) + sub-component 분해 예정.

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useUserTopology, useUserTopologyGroup } from '../../../hooks/useTopology';
import { useGroupTree } from '../../../hooks/useGroups';
import { useDevicePorts } from '../../../hooks/useDevices';
import { useDeviceErrorLevels } from '../../../hooks/useFaults';
import { useAuthStore } from '../../../stores/authStore';

function UserTopologyWidget({ onExpand, onDeviceClick }) {
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const iconCache = useRef({});
  const navigate = useNavigate();
  const zoomedForViewRef = useRef(null);

  const { user } = useAuthStore();
  const userId = user?.USER_ID;

  // 위젯 내 그룹 네비게이션
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [currentGroupName, setCurrentGroupName] = useState(null);
  const [groupHistory, setGroupHistory] = useState([]);
  const isRoot = currentGroupId === null;

  // 배경 이미지 관련 상태
  const [backgroundImage, setBackgroundImage] = useState(null);
  const backgroundImageRef = useRef(null);

  // 장애 데이터
  const { deviceErrorMap, groupErrorMap, errors: activeErrors } = useDeviceErrorLevels();
  const deviceErrorMapRef = useRef(deviceErrorMap);
  const groupErrorMapRef = useRef(new Map());
  const { data: groupTree } = useGroupTree();

  // 그룹 호버 툴팁
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const tooltipHideTimer = useRef(null);
  const isTooltipHovered = useRef(false);
  const [expandedLevel, setExpandedLevel] = useState(null);

  // 링크 클릭 정보
  const [selectedLink, setSelectedLink] = useState(null);

  // 그룹트리 기반 장애 전파
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

  // 사용자 토폴로지 데이터 조회 (루트)
  const { data: rootTopoData, isLoading: rootLoading } = useUserTopology(userId);
  // 그룹 하위 토폴로지 데이터 조회 (드릴다운)
  const { data: groupTopoData, isLoading: groupLoading } = useUserTopologyGroup(userId, currentGroupId);

  // 현재 표시할 데이터 선택
  const topoData = isRoot ? rootTopoData : groupTopoData;
  const isLoading = isRoot ? rootLoading : groupLoading;
  const hasTopology = !!rootTopoData && (rootTopoData.nodes?.length > 0 || rootTopoData.links?.length > 0);

  // 현재 뷰 식별자 (줌 리셋 추적용)
  const currentViewKey = isRoot ? 'root' : `group_${currentGroupId}`;

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  // 데이터 → graphData 변환
  useEffect(() => {
    if (!topoData?.nodes) {
      setGraphData({ nodes: [], links: [] });
      setBackgroundImage(null);
      backgroundImageRef.current = null;
      return;
    }

    const fixedNodes = (topoData.nodes || []).map(n => ({
      ...n,
      id: String(n.id),
      label: n.label || n.name || n.groupName || n.deviceName || 'Unknown',
      fx: n.fx ?? n.x,
      fy: n.fy ?? n.y,
    }));

    const nodeIds = new Set(fixedNodes.map(n => String(n.id)));
    const validLinks = (topoData.links || []).filter(link => {
      const sourceId = typeof link.source === 'object' ? String(link.source?.id) : String(link.source);
      const targetId = typeof link.target === 'object' ? String(link.target?.id) : String(link.target);
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    setGraphData({ nodes: fixedNodes, links: validLinks });

    const bgData = topoData.backIconData;
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
  }, [topoData]);

  // 컨테이너 크기 추적
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

    if (graphData.nodes.length > 0) {
      // 애니메이션 없이 즉시 fit → 줌 레벨 확인 후 상한 적용
      graphRef.current.zoomToFit(0, 60);
      const MAX_ZOOM = 4;
      if (graphRef.current.zoom() > MAX_ZOOM) {
        graphRef.current.zoom(MAX_ZOOM, 0);
      }
    } else if (backgroundImageRef.current && backgroundImageRef.current.complete) {
      const img = backgroundImageRef.current;
      const bgScale = 0.4;
      const scaledWidth = img.naturalWidth * bgScale;
      const scaledHeight = img.naturalHeight * bgScale;
      const scaleX = containerWidth / scaledWidth;
      const scaleY = containerHeight / scaledHeight;
      const fitZoom = Math.min(scaleX, scaleY) * 0.85;
      graphRef.current.centerAt(0, 0, 0);
      graphRef.current.zoom(fitZoom, 0);
    }
  }, [graphData.nodes.length]);

  // 그룹 변경 시 줌 추적 리셋
  useEffect(() => {
    zoomedForViewRef.current = null;
  }, [currentViewKey]);

  useEffect(() => {
    if (graphRef.current && (graphData.nodes.length > 0 || backgroundImage)) {
      if (zoomedForViewRef.current === currentViewKey) return;

      const timer1 = setTimeout(adjustZoom, 200);
      const timer2 = setTimeout(adjustZoom, 500);
      const timer3 = setTimeout(() => {
        adjustZoom();
        zoomedForViewRef.current = currentViewKey;
      }, 1000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [graphData.nodes.length, dimensions, backgroundImage, adjustZoom, currentViewKey]);

  const NODE_SIZE = 36;
  const FAULT_COLORS = {
    'C': { r: 239, g: 68, b: 68 },
    'M': { r: 249, g: 115, b: 22 },
    'N': { r: 234, g: 179, b: 8 },
    'W': { r: 59, g: 130, b: 246 },
  };

  const drawNode = useCallback((node, ctx, globalScale) => {
    const nodeId = String(node.id);
    const isGroupNode = node.nodeType === 'GROUP' || nodeId.startsWith('G');
    const size = isGroupNode ? NODE_SIZE * 1.2 : NODE_SIZE;
    const half = size / 2;
    const drawX = node.x;
    const drawY = node.y;
    const label = node.label || node.name || node.id;

    let errorLevel = null;
    if (isGroupNode) {
      const gName = node.name || node.groupName || node.label;
      errorLevel = gName ? groupErrorMapRef.current.get(gName) : null;
    } else {
      const dId = node.deviceId ?? node.DEVICE_ID ?? node.originalId;
      if (dId != null) {
        errorLevel = deviceErrorMapRef.current.get(dId)
          || deviceErrorMapRef.current.get(String(dId))
          || deviceErrorMapRef.current.get(Number(dId))
          || null;
      }
    }
    const faultColor = errorLevel ? FAULT_COLORS[errorLevel] : null;
    const pulse = faultColor ? 0.6 + 0.4 * Math.sin(Date.now() / 400) : 0;

    if (isGroupNode) {
      const radius = 10;
      const hasIconData = node.iconData || node.ICON_DATA;

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

      if (hasIconData) {
        const cacheKey = `ut_group_${node.id}`;
        if (!iconCache.current[cacheKey]) {
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
          iconCache.current[cacheKey] = img;
        }
        const groupImg = iconCache.current[cacheKey];
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

      if (deviceIconData) {
        const cacheKey = `ut_device_${node.id}`;
        if (!iconCache.current[cacheKey]) {
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
          iconCache.current[cacheKey] = deviceImg;
        }
        const cachedImg = iconCache.current[cacheKey];
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

  // 장애 펄스 애니메이션
  const hasFaults = deviceErrorMap.size > 0 || groupErrorMap.size > 0;
  const [pulseKey2, setPulseKey2] = useState(0);
  useEffect(() => {
    if (!hasFaults) return;
    const interval = setInterval(() => setPulseKey2(k => k + 1), 80);
    return () => clearInterval(interval);
  }, [hasFaults]);

  // 그룹 클릭 → 드릴다운
  const handleNodeClick = useCallback((node) => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    setSelectedLink(null);
    const nodeId = String(node.id);
    if (node.nodeType === 'GROUP' || nodeId.startsWith('G')) {
      // 그룹 ID 추출: "G5" → 5
      let groupId = node.groupId || node.originalId;
      if (!groupId && nodeId.startsWith('G')) {
        groupId = nodeId.substring(1);
      }
      if (groupId) {
        // 현재 뷰를 히스토리에 추가
        setGroupHistory(prev => [...prev, { groupId: currentGroupId, groupName: currentGroupName }]);
        setCurrentGroupId(String(groupId));
        setCurrentGroupName(node.label || node.name || node.groupName || nodeId);
      }
    } else {
      const dId = node.deviceId ?? node.DEVICE_ID ?? node.originalId;
      if (dId && onDeviceClick) onDeviceClick(dId);
    }
  }, [currentGroupId, currentGroupName, onDeviceClick]);

  // 노드에서 장비 ID 추출
  const getDeviceIdFromNode = useCallback((node) => {
    if (!node) return null;
    const id = String(node.id || '');
    return node.deviceId || node.DEVICE_ID || (id.startsWith('D') ? Number(id.substring(1)) : null);
  }, []);

  // 링크 클릭 → 링크 정보 표시
  const handleLinkClick = useCallback((link) => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    const srcNode = typeof link.source === 'object' ? link.source : graphData.nodes.find(n => String(n.id) === String(link.source));
    const tgtNode = typeof link.target === 'object' ? link.target : graphData.nodes.find(n => String(n.id) === String(link.target));
    const srcId = String(srcNode?.id || link.source);
    const tgtId = String(tgtNode?.id || link.target);
    const srcIsDevice = srcNode?.nodeType !== 'GROUP' && !srcId.startsWith('G');
    const tgtIsDevice = tgtNode?.nodeType !== 'GROUP' && !tgtId.startsWith('G');
    setSelectedLink({
      ...link,
      sourceName: srcNode?.label || srcNode?.name || srcId,
      targetName: tgtNode?.label || tgtNode?.name || tgtId,
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

  // IF_INDEX → IF_NAME 변환
  const resolveIfName = useCallback((ifIndex, ifName, ports) => {
    if (ifName) return ifName;
    if (!ifIndex) return '';
    if (!ports?.length) return `IF:${ifIndex}`;
    const port = ports.find(p => String(p.IF_INDEX) === String(ifIndex));
    return port?.IF_NAME || `IF:${ifIndex}`;
  }, []);

  // 뒤로 가기
  const handleBackClick = useCallback(() => {
    setSelectedLink(null);
    if (groupHistory.length > 0) {
      const prev = groupHistory[groupHistory.length - 1];
      setGroupHistory(h => h.slice(0, -1));
      setCurrentGroupId(prev.groupId);
      setCurrentGroupName(prev.groupName);
    } else {
      setCurrentGroupId(null);
      setCurrentGroupName(null);
    }
  }, [groupHistory]);

  // 그룹 호버 시 장애 건수 툴팁
  const getGroupFaultInfo = useCallback((groupName) => {
    if (!groupName || !activeErrors?.length) return null;
    const targetNames = new Set([groupName]);
    const findDescendants = (nodes) => {
      for (const node of nodes) {
        if (targetNames.has(node.GROUP_NAME)) {
          if (node.children?.length > 0) {
            node.children.forEach(child => targetNames.add(child.GROUP_NAME));
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

  const hideTooltip = useCallback(() => {
    setHoveredGroup(null);
    setExpandedLevel(null);
    isTooltipHovered.current = false;
  }, []);

  const handleNodeHover = useCallback((node) => {
    clearTimeout(tooltipHideTimer.current);
    const nodeId = node ? String(node.id) : '';
    if (!node || !(node.nodeType === 'GROUP' || nodeId.startsWith('G'))) {
      tooltipHideTimer.current = setTimeout(() => {
        if (!isTooltipHovered.current) hideTooltip();
      }, 250);
      return;
    }
    const gName = node.name || node.groupName || node.label;
    const info = getGroupFaultInfo(gName);
    if (!info) { hideTooltip(); return; }

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

  // 토폴로지가 없는 경우
  if (!rootLoading && !hasTopology) {
    return (
      <div className="topology-graph-container" ref={containerRef}>
        <div className="topology-overlay">
          <i className="bi bi-person-workspace" style={{ fontSize: '48px', color: '#475569' }}></i>
          <span>사용자 토폴로지가 없습니다</span>
          <button
            style={{
              marginTop: '4px',
              padding: '8px 18px',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#c7d2fe'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
            onClick={() => navigate('/user-topology')}
          >
            <i className="bi bi-plus-lg" style={{ marginRight: '6px' }}></i>
            토폴로지 만들기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="topology-graph-container" ref={containerRef}>
      {isLoading && (
        <div className="topology-overlay">
          <div className="loading-spinner"></div>
          <span>사용자 토폴로지 로딩 중...</span>
        </div>
      )}
      {/* 현재 그룹 표시 */}
      {!isLoading && (
        <div className="topology-current-group">
          <i className={`bi ${isRoot ? 'bi-person-workspace' : 'bi-folder'}`}></i>
          <span title={isRoot ? '메인' : currentGroupName}>{isRoot ? '메인' : currentGroupName}</span>
        </div>
      )}
      {dimensionsReady && !isLoading && (
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
              const bDrawX = -scaledWidth / 2;
              const bDrawY = -scaledHeight / 2;
              ctx.save();
              ctx.globalAlpha = 0.4;
              ctx.drawImage(img, bDrawX, bDrawY, scaledWidth, scaledHeight);
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
      {!isRoot && (
        <button className="topology-back-btn" onClick={handleBackClick} title="뒤로 가기">
          <i className="bi bi-arrow-left"></i>
        </button>
      )}
    </div>
  );
}


export default memo(UserTopologyWidget);
