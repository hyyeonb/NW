import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import GridLayout, { getCompactor } from 'react-grid-layout';
import ForceGraph2D from 'react-force-graph-2d';
import SafeECharts from '../components/SafeECharts';
import { useTopologyView, useUserTopology, useUserTopologyGroup } from '../hooks/useTopology';
import { useGroupTree } from '../hooks/useGroups';
import { useWidgets, useDefaultDashboard, useUserDashboard, useSaveUserDashboard, useResetUserDashboard } from '../hooks/useDashboard';
import { useDeviceErrorLevels } from '../hooks/useFaults';
import { useDevicePorts } from '../hooks/useDevices';
import { useAuthStore } from '../stores/authStore';
import { useAlertStore } from '../stores/alertStore';
import { useThemeStore } from '../stores/themeStore';
import { faultApi } from '../api/fault';
import { dashboardApi } from '../api/dashboard';
import DeviceDetailModal from '../components/DeviceDetailModal';
import { useAlert } from '../components/CustomAlert';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../styles/dashboard-dark.css';
import '../styles/dashboard-light.css';
import '../styles/dashboard-responsive.css';
import { formatLargeValue } from '../shared/lib/format';
import { getShortMetricName } from '../features/dashboard/model/metricNames';
import DeviceSummaryWidget from '../features/dashboard/widgets/DeviceSummaryWidget';
import AlertSummaryWidget from '../features/dashboard/widgets/AlertSummaryWidget';
import RealtimeAlertWidget from '../features/dashboard/widgets/RealtimeAlertWidget';
import TopologyWidget from '../features/dashboard/widgets/TopologyWidget';
import UserTopologyWidget from '../features/dashboard/widgets/UserTopologyWidget';
import CustomWidgetContent from '../features/dashboard/widgets/CustomWidgetContent';
import CustomWidgetModal from '../features/dashboard/widgets/CustomWidgetModal';
import WidgetContent from '../features/dashboard/widgets/WidgetContent';
import { MONITORING_GROUPS } from '../features/dashboard/model/monitoringGroups';
import { GRID_COLS, GRID_SCALE, DEFAULT_WIDGET_TYPES, CATEGORIES, initialWidgets, initialLayout } from '../features/dashboard/model/widgetTypes';


// 토폴로지 위젯 컴포넌트

// 사용자 토폴로지 위젯 컴포넌트

// 색상 팔레트 (장비별로 다른 색상 할당)
// 종합 현황 위젯 컴포넌트
export default function Dashboard() {
  const { alert: showAlert, success: showSuccess, error: showError, warning: showWarning, confirm: showConfirm } = useAlert();
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
  const [gridAreaHeight, setGridAreaHeight] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialWidgetCount, setInitialWidgetCount] = useState(0); // 편집 시작 시 위젯 개수
  const [showResetConfirm, setShowResetConfirm] = useState(false); // 초기화 확인 모달
  const [isResettingDashboard, setIsResettingDashboard] = useState(false); // 초기화 진행 중
  const [refreshingWidgets, setRefreshingWidgets] = useState(new Set()); // 새로고침 중인 위젯 ID
  const [isReloadingAfterSave, setIsReloadingAfterSave] = useState(false); // 저장 후 데이터 리로딩 중

  // 토폴로지 장비 상세 모달
  const [topoDeviceModalOpen, setTopoDeviceModalOpen] = useState(false);
  const [topoDeviceModalId, setTopoDeviceModalId] = useState(null);
  const handleTopoDeviceClick = useCallback((deviceId) => {
    setTopoDeviceModalId(deviceId);
    setTopoDeviceModalOpen(true);
  }, []);

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

    // 사용자 대시보드인지 기본 대시보드인지 구분
    const isUserData = userDashboard && userDashboard.length > 0;

    // API 응답 필드명 매핑 헬퍼 (백엔드에서 posX/pos_x/x 등 다양한 필드명 가능)
    const getItemPosX = (item) => item.posX ?? item.pos_x ?? item.x;
    const getItemPosY = (item) => item.posY ?? item.pos_y ?? item.y;
    const getItemWidth = (item) => item.width ?? item.w;
    const getItemHeight = (item) => item.height ?? item.h;

    // API 데이터를 widgets와 layout으로 변환
    const newWidgets = [];
    const newLayout = [];

    // 서버에 위치 정보가 없으면 자동 배치를 위한 커서
    let autoX = 0;
    let autoY = 0;
    let rowMaxH = 0;

    dashboardData.forEach((item, index) => {
      const id = `w${item.defaultDashboardWidgetId || item.userDashboardWidgetId || index}`;

      // API 응답에서 위치/크기 추출 (다양한 필드명 대응)
      const rawPosX = getItemPosX(item);
      const rawPosY = getItemPosY(item);
      const rawWidth = getItemWidth(item);
      const rawHeight = getItemHeight(item);

      let width, height, posX, posY;

      // 데이터가 이미 96칸 기준인지 판별 (width > 12이면 96칸 기준)
      const isAlready96Col = rawWidth != null && rawWidth > 12;

      if ((isUserData || isAlready96Col) && rawPosX != null && rawPosY != null) {
        // 96칸 값 직접 사용 (사용자 대시보드 또는 96칸 기준 기본 대시보드)
        width = Math.min(rawWidth ?? 20, GRID_COLS);
        height = rawHeight ?? 8;
        posX = Math.min(rawPosX, GRID_COLS - width);
        posY = rawPosY;
      } else {
        // 12칸 기준 기본 대시보드 또는 위치 정보 없음 → GRID_SCALE 변환 후 자동 배치
        width = Math.min((rawWidth ?? 6) * GRID_SCALE, GRID_COLS);
        height = (rawHeight ?? 4) * GRID_SCALE;
        // 현재 행에 들어갈 수 없으면 다음 행으로
        if (autoX + width > GRID_COLS) {
          autoX = 0;
          autoY += rowMaxH;
          rowMaxH = 0;
        }
        posX = autoX;
        posY = autoY;
        autoX += width;
        rowMaxH = Math.max(rowMaxH, height);
      }

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
        x: posX,
        y: posY,
        w: width,
        h: height,
        minW: 1,
        minH: 1,
        maxW: GRID_COLS,
        maxH: 80,
      });
    });

    // 위치가 겹치는 위젯이 있으면 자동 재배치 (API 응답에서 위치가 모두 0인 경우 등)
    if (newLayout.length > 1) {
      const hasOverlap = newLayout.some((a, i) =>
        newLayout.some((b, j) => i !== j && a.i !== b.i &&
          a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y
        )
      );
      if (hasOverlap) {
        let ax = 0, ay = 0, rmh = 0;
        for (const l of newLayout) {
          if (ax + l.w > GRID_COLS) { ax = 0; ay += rmh; rmh = 0; }
          l.x = ax;
          l.y = ay;
          ax += l.w;
          rmh = Math.max(rmh, l.h);
        }
      }
    }

    setWidgets(newWidgets);
    setLayout(newLayout);
    setIsInitialized(true);
    setIsReloadingAfterSave(false); // 리로딩 완료
  }, [defaultDashboard, userDashboard, widgetsLoading, defaultDashboardLoading, userDashboardLoading, userDashboardFetching, isInitialized, isSaving, isResetting, isEditMode, WIDGET_TYPES]);

  // 컨테이너 너비 감지 + 그리드 영역 높이 계산 (window 기준, 순환 의존 방지)
  const headerRef = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWidth = 0;

    const updateSize = () => {
      const width = container.clientWidth;
      if (width > 0 && Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        setContainerWidth(width);
      }
      // window.innerHeight 기준으로 계산 (순환 의존 방지)
      const headerH = headerRef.current?.offsetHeight || 0;
      const headerMargin = 20; // dashboard-header margin-bottom
      const appMainPadding = 40; // .app-main padding top(20) + bottom(20)
      const availableH = window.innerHeight - appMainPadding - headerH - headerMargin;
      setGridAreaHeight(Math.max(200, availableH));
    };

    updateSize();
    const timer1 = setTimeout(updateSize, 50);
    const timer2 = setTimeout(updateSize, 200);

    const resizeObserver = new ResizeObserver(() => { updateSize(); });
    resizeObserver.observe(container);

    window.addEventListener('resize', updateSize);

    const onFullscreenChange = () => {
      setTimeout(updateSize, 50);
      setTimeout(updateSize, 200);
      setTimeout(updateSize, 500);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
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
              _refreshedAt: Date.now(),
            };
          }
          return w;
        }));
        return;
      }

      let response;
      // 사용자 위젯인 경우
      if (widget.userDashboardWidgetId) {
        response = await dashboardApi.refreshUserWidget(widget.userDashboardWidgetId);
      }
      // 기본 대시보드 위젯인 경우
      else if (widget.defaultDashboardWidgetId) {
        response = await dashboardApi.refreshDefaultWidget(widget.defaultDashboardWidgetId);
      }
      // 위젯 ID가 없는 경우 경고
      else {
        console.warn('[refreshWidget] Widget has no ID for refresh:', widget.type, widget.id);
        return;
      }

      if (response?.data?.data) {
        const newData = response.data.data;
        // 위젯 상태 업데이트 (새 데이터로 완전히 교체)
        setWidgets(prev => prev.map(w => {
          if (w.id === widget.id) {
            return {
              ...w,
              chartData: 'chartData' in newData ? newData.chartData : w.chartData,
              cntData: 'cntData' in newData ? newData.cntData : w.cntData,
              _refreshedAt: Date.now(),
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

    // debounce: 여러 알림이 연속으로 오면 마지막 것만 처리
    const timer = setTimeout(() => {
      // 갱신이 필요한 위젯 타입들 (장애 관련 위젯들)
      const refreshTargetTypes = ['ALERT_SUMMARY', 'DEVICE_SUMMARY', 'REALTIME_ALERT', 'ALERT_LIST'];

      // 해당 타입의 위젯들을 찾아서 갱신
      widgets.forEach(widget => {
        if (refreshTargetTypes.includes(widget.type)) {
          refreshWidget(widget);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [alerts, isInitialized, isEditMode, widgets, refreshWidget]);

  // 전체 위젯 주기적 자동 갱신 (60초)
  useEffect(() => {
    if (!isInitialized || isEditMode || widgets.length === 0) return;

    const interval = setInterval(() => {
      widgets.forEach(widget => {
        refreshWidget(widget);
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isInitialized, isEditMode, widgets, refreshWidget]);

  // 레이아웃 변경 핸들러
  const handleLayoutChange = useCallback((newLayout) => {
    const cols = GRID_COLS;
    const maxRows = 200;

    const exceedsMaxRows = newLayout.some(item => (item.y + item.h) > maxRows);

    if (exceedsMaxRows) {
      return;
    }

    const boundedLayout = newLayout.map(item => {
      const adjustedW = Math.min(item.w, cols);
      const adjustedX = Math.min(item.x, cols - adjustedW);

      return {
        ...item,
        w: adjustedW,
        x: Math.max(0, adjustedX),
        y: item.y,
        maxW: cols,
        maxH: 80,
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
  const findEmptySpace = useCallback((widgetWidth, widgetHeight, currentLayout, cols = GRID_COLS, maxRows = 20) => {
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

    const widgetWidth = Math.min((type.defaultW || 6) * GRID_SCALE, GRID_COLS);
    const widgetHeight = (type.defaultH || 4) * GRID_SCALE;

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
      maxW: GRID_COLS,
      maxH: 80,
    };

    // 로컬 state 업데이트만 (API 호출 없음)
    setWidgets(prev => [...prev, newWidget]);
    setLayout(prev => [...prev, newLayoutItem]);
    setShowAddModal(false);
  }, [layout, widgets, WIDGET_TYPES, findEmptySpace]);

  // 사용자 정의 위젯 저장
  const handleSaveCustomWidget = useCallback((customConfig) => {
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

    const newLayoutItem = {
      i: newId,
      x: 0,
      y: maxY,
      w: (type.defaultW || 12) * GRID_SCALE,
      h: (type.defaultH || 4) * GRID_SCALE,
      minW: 1,
      minH: 1,
      maxW: GRID_COLS,
      maxH: 80,
    };

    setWidgets(prev => [...prev, newWidget]);
    setLayout(prev => [...prev, newLayoutItem]);
    setShowCustomWidgetModal(false);
  }, [layout, widgets, WIDGET_TYPES]);

  // 위젯 삭제 (최소 1개 위젯 유지)
  const handleDeleteWidget = useCallback((widgetId) => {
    setWidgets(prev => {
      // 마지막 위젯은 삭제 불가
      if (prev.length <= 1) {
        showWarning('최소 1개의 위젯은 유지해야 합니다.');
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

    setWidgets(prev => prev.map(w =>
      w.id === selectedWidget.id ? updatedWidget : w
    ));
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
  const handleCopyToUserDashboard = useCallback(async () => {
    if (!await showConfirm('기본 대시보드를 복사하여 나만의 대시보드를 만드시겠습니까?\n이후 자유롭게 편집할 수 있습니다.')) {
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
        width: layoutItem?.w ?? 12,
        height: layoutItem?.h ?? 8,
        sortOrder: index,
        config: typeof cleanConfig === 'string' ? cleanConfig : JSON.stringify(cleanConfig || {}),
      };
    });

    saveUserDashboard(widgetsToSave, {
      onSuccess: async () => {
        showSuccess('나만의 대시보드가 생성되었습니다. 이제 자유롭게 편집할 수 있습니다.');
        // 새로운 데이터를 즉시 가져온 후 재초기화
        await refetchUserDashboard();
        setIsInitialized(false);
      },
      onError: (error) => {
        console.error('대시보드 복사 실패:', error);
        showError('대시보드 복사에 실패했습니다.');
      }
    });
  }, [widgets, layout, saveUserDashboard, refetchUserDashboard, removeConfigMetadata, showConfirm, showSuccess, showError]);

  // 편집 모드 토글 및 저장 (사용자 대시보드만)
  const handleToggleEditMode = useCallback(() => {
    if (isEditMode) {
      // 편집 모드 종료 시 레이아웃 저장
      const widgetsToSave = widgets.map((widget, index) => {
        const layoutItem = layout.find(l => l.i === widget.id);
        const cleanConfig = removeConfigMetadata(widget.config);

        return {
          userDashboardWidgetId: widget.userDashboardWidgetId,
          widgetId: widget.widgetId,
          title: widget.title,
          posX: layoutItem?.x ?? 0,
          posY: layoutItem?.y ?? 0,
          width: layoutItem?.w ?? 12,
          height: layoutItem?.h ?? 8,
          sortOrder: widget.sortOrder ?? index,
          config: typeof cleanConfig === 'string' ? cleanConfig : JSON.stringify(cleanConfig || {}),
        };
      });

      // 즉시 UI 업데이트 (사용자에게 빠른 피드백)
      setIsEditMode(false);
      setIsReloadingAfterSave(true); // 리로딩 시작

      // 백그라운드에서 저장
      saveUserDashboard(widgetsToSave, {
        onSuccess: async () => {
          // 서버에서 최신 데이터를 다시 가져옴 (캐시 무효화는 hook에서 자동 처리)
          await refetchUserDashboard();

          // 새로 추가된 위젯의 chartData를 포함한 전체 데이터를 다시 로드
          setIsInitialized(false);
        },
        onError: (error) => {
          console.error('대시보드 저장 실패:', error);
          showError('대시보드 저장에 실패했습니다.');
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
        // API 응답에서 바로 위젯 데이터 사용
        const freshData = response?.data?.data || response?.data || response || [];

        if (freshData && freshData.length > 0) {
          // 새 데이터로 위젯과 레이아웃 직접 업데이트 (서버 12칸 → 클라이언트 96칸)
          const newWidgets = [];
          const newLayout = [];

          let rAutoX = 0;
          let rAutoY = 0;
          let rRowMaxH = 0;

          freshData.forEach((item, index) => {
            const id = `w${item.userDashboardWidgetId || index}`;

            const rawW = item.width ?? item.w ?? 6;
            const rawH = item.height ?? item.h ?? 4;
            const rawX = item.posX ?? item.pos_x ?? item.x;
            const rawY = item.posY ?? item.pos_y ?? item.y;
            let width, height, posX, posY;

            // 이미 96칸 기준 데이터인지 판별 (width > 12이면 96칸)
            const isAlready96 = rawW > 12;

            if (isAlready96 && rawX != null && rawY != null) {
              // 96칸 값 직접 사용
              width = Math.min(rawW, GRID_COLS);
              height = rawH;
              posX = Math.min(rawX, GRID_COLS - width);
              posY = rawY;
            } else {
              // 12칸 기준 → GRID_SCALE 변환 + 자동 배치
              width = Math.min(rawW * GRID_SCALE, GRID_COLS);
              height = rawH * GRID_SCALE;
              if (rAutoX + width > GRID_COLS) {
                rAutoX = 0;
                rAutoY += rRowMaxH;
                rRowMaxH = 0;
              }
              posX = rAutoX;
              posY = rAutoY;
              rAutoX += width;
              rRowMaxH = Math.max(rRowMaxH, height);
            }

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
              y: posY,
              w: width,
              h: height,
              minW: 1,
              minH: 1,
              maxW: GRID_COLS,
              maxH: 80,
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

  const cols = GRID_COLS; // 96칸 세밀 그리드
  const margin = 2; // 위젯 간 간격
  const containerPaddingVal = 4;
  // 레이아웃 총 행 수 기준으로 rowHeight를 계산하여 화면에 꽉 채움
  const rowHeight = useMemo(() => {
    if (!gridAreaHeight || gridAreaHeight < 200 || layout.length === 0) return 20;
    const maxRow = layout.reduce((max, item) => Math.max(max, (item.y || 0) + (item.h || 1)), 0);
    if (maxRow <= 0) return 20;
    const available = gridAreaHeight - (containerPaddingVal * 2) - ((maxRow - 1) * margin);
    const calc = available / maxRow;
    return Math.max(10, calc);
  }, [gridAreaHeight, layout]);

  // static 속성은 사용하지 않음 (correctBounds가 static 위젯을 밀어내는 문제 방지)
  // 대신 dragConfig.enabled, resizeConfig.enabled로 편집 모드 제어
  const layoutWithStatic = useMemo(() => {
    return layout.map(item => ({
      ...item,
    }));
  }, [layout]);

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
      <div className="page-header dashboard-header" ref={headerRef}>
        <div className="page-header-left dashboard-title">
          <h1 className="page-title">
            <i className="bi bi-grid-1x2"></i>
            대시보드
          </h1>
          <span className="page-subtitle">실시간 현황을 한눈에 확인하세요</span>
          <span className="widget-count">{widgets.length}개 위젯</span>
        </div>
        <div className="page-header-right dashboard-actions">
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
          width={containerWidth}
          gridConfig={{
            cols,
            rowHeight,
            maxRows: 200,
            margin: [margin, margin],
            containerPadding: [containerPaddingVal, containerPaddingVal],
          }}
          dragConfig={{
            enabled: isEditMode,
            bounded: true,
            handle: isEditMode ? ".widget-header" : undefined,
          }}
          resizeConfig={{
            enabled: isEditMode,
            handles: isEditMode ? ['s', 'e', 'se'] : [],
          }}
          compactor={getCompactor(null, false, true)}
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map(widget => {
            const type = WIDGET_TYPES[widget.type];
            const isTopology = widget.type === 'TOPOLOGY';
            const isUserTopology = widget.type === 'USER_TOPOLOGY';

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
                    {/* 새로고침 버튼 (편집 모드가 아닐 때만, 토폴로지 위젯 제외) */}
                    {!isEditMode && !isTopology && !isUserTopology && (
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
                    {isUserTopology && !isEditMode && (
                      <button className="topology-fullscreen-btn" onClick={() => navigate('/user-topology')} title="전체 화면">
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
                        <span>토폴로지</span>
                      </div>
                    ) : (
                      <TopologyWidget onExpand={handleExpandTopology} onDeviceClick={handleTopoDeviceClick} />
                    )
                  ) : isUserTopology ? (
                    isEditMode ? (
                      <div className="topology-edit-placeholder">
                        <i className="bi bi-person-workspace"></i>
                        <span>사용자 토폴로지</span>
                      </div>
                    ) : (
                      <UserTopologyWidget onExpand={() => navigate('/user-topology')} onDeviceClick={handleTopoDeviceClick} />
                    )
                  ) : widget.type === 'CUSTOM' ? (
                    <CustomWidgetContent widget={widget} isEditMode={isEditMode} onDeviceClick={handleTopoDeviceClick} />
                  ) : widget.type === 'REALTIME_ALERT' ? (
                    <RealtimeAlertWidget isEditMode={isEditMode} initialData={widget.chartData} />
                  ) : widget.type === 'ALERT_SUMMARY' ? (
                    <AlertSummaryWidget cntData={widget.cntData} isEditMode={isEditMode} />
                  ) : widget.type === 'DEVICE_SUMMARY' ? (
                    <DeviceSummaryWidget cntData={widget.cntData} isEditMode={isEditMode} />
                  ) : (
                    <WidgetContent widget={widget} widgetTypes={WIDGET_TYPES} isEditMode={isEditMode} onDeviceClick={handleTopoDeviceClick} />
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

      {/* 토폴로지 장비 상세 모달 (최상위 레벨) */}
      {topoDeviceModalOpen && (
        <DeviceDetailModal
          deviceId={topoDeviceModalId}
          onClose={() => setTopoDeviceModalOpen(false)}
        />
      )}
    </div>
  );
}
