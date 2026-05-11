/* eslint-disable max-lines, max-lines-per-function, complexity, max-params, max-depth, no-prototype-builtins, react-hooks/immutability, react-hooks/exhaustive-deps, no-empty, no-unused-vars, react-hooks/set-state-in-effect */
// 후속 PR에서 widget-type별 sub-component (LineChart/BarChart/PieChart/Stat 등) + useChartConfig hook 분해 예정.

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import SafeECharts from '../../../components/SafeECharts';
import { useThemeStore } from '../../../stores/themeStore';
import { formatLargeValue } from '../../../shared/lib/format';
import { getShortMetricName } from '../model/metricNames';
import { MONITORING_ELEMENTS } from '../model/monitoringGroups';

const DEVICE_COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#22c55e', '#f97316', '#6366f1'
];

// 사용자 정의 위젯 차트 컨텐츠 (백엔드 데이터 사용)
function CustomWidgetContent({ widget, isEditMode, onDeviceClick }) {
  const containerRef = useRef(null);
  const [tooltipOnLeft, setTooltipOnLeft] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const isLight = useThemeStore(s => s.resolvedTheme === 'light');

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
              // 평균값 계산 (null 값 제외)
              const validValues = data.values.filter(v => v != null);
              const avg = validValues.length > 0 ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length : 0;
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

            // 10. 모든 시리즈의 타임스탬프를 합쳐 통일된 시간축 생성
            const allTimestamps = new Set();
            selectedData.forEach(data => {
              data.timestamps.forEach(ts => allTimestamps.add(ts));
            });
            const unifiedTimestamps = [...allTimestamps].sort();

            // 11. 각 시리즈의 데이터를 통일된 시간축에 맞춰 정렬
            selectedData.forEach(data => {
              const tsMap = new Map();
              data.timestamps.forEach((ts, i) => tsMap.set(ts, data.values[i]));
              data.timestamps = unifiedTimestamps;
              data.values = unifiedTimestamps.map(ts => tsMap.has(ts) ? tsMap.get(ts) : null);
            });

            // 12. 색상 및 짧은 라벨 추가 후 반환
            let result = [];
            metricColorMap.forEach((devices, metric) => {
              const baseColor = metricColors[metric] || '#14b8a6';
              const shortMetric = getShortMetricName(metric);
              const deviceCount = devices.length;
              const metricUnit = metricUnits[metric] || '%';

              devices.forEach((data, index) => {

                // 같은 메트릭 내에서 디바이스별로 색상 톤 변화
                const deviceColor = deviceCount > 1
                  ? adjustColorBrightness(baseColor, index, deviceCount)
                  : baseColor;

                result.push({
                  ...data,
                  value: data.values,
                  color: deviceColor,
                  unit: metricUnit,
                  displayName: `${shortMetric}-${data.deviceName}`,
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

          // 모든 장비의 타임스탬프를 합쳐 통일된 시간축 생성
          const allTs = new Set();
          deviceArray.forEach(d => d.timestamps.forEach(ts => allTs.add(ts)));
          const unifiedTs = [...allTs].sort();

          deviceArray.forEach(device => {
            const tsMap = new Map();
            device.timestamps.forEach((ts, i) => tsMap.set(ts, device.values[i]));
            device.timestamps = unifiedTs;
            device.values = unifiedTs.map(ts => tsMap.has(ts) ? tsMap.get(ts) : null);
          });

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
  // 데이터 갱신 시 차트를 clear 후 새로 그리면서 등장 애니메이션 재생
  const prevRefreshedAtRef = useRef(widget._refreshedAt);

  const CHART_ANIMATION = {
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
  };

  const getChartOption = (tooltipOnLeft = false) => {
    const elementMeta = elements.length > 0 ? MONITORING_ELEMENTS[elements[0]] : null;
    const elementName = elementMeta?.name || '모니터링';

    // 테마별 차트 팔레트 — 라이트 모드는 검정 톤 글자 + 옅은 회색 그리드라인
    const C = isLight ? {
      text: '#0f172a',          // 거의 블랙 (axisLabel/legend/title/pie label)
      textMuted: '#475569',
      splitLine: '#cbd5e1',     // 옅은 회색 (Y축 가로선)
      axisLine: '#94a3b8',
      labelLine: '#94a3b8',
      pieBorder: '#ffffff',
      tipBg: '#ffffff',
      tipBorder: '#cbd5e1',
      tipText: '#0f172a',
      tipShadow: 'rgba(15, 23, 42, 0.12)',
      empty: '#64748b',
      emptyStroke: '#cbd5e1',
      pageIconAct: '#2563eb',
      pageIconInact: '#cbd5e1',
    } : {
      text: '#94a3b8',
      textMuted: '#64748b',
      splitLine: '#1e293b',
      axisLine: '#334155',
      labelLine: '#475569',
      pieBorder: '#0f172a',
      tipBg: '#1e293b',
      tipBorder: '#334155',
      tipText: '#f1f5f9',
      tipShadow: 'rgba(0, 0, 0, 0.3)',
      empty: '#64748b',
      emptyStroke: '#334155',
      pageIconAct: '#3b82f6',
      pageIconInact: '#475569',
    };

    // 파이 차트
    if (chartType === 'pie') {
      // metric 필드가 있는지 확인 (Multiple Pie Charts용)
      const hasMetricField = rawChartData.length > 0 && rawChartData[0].metric;

      if (hasMetricField) {
        // Multiple Pie Charts: 각 메트릭별로 작은 파이 차트 표시

        // 1. 고유한 메트릭 목록 추출 (elements에 포함된 것만)
        const uniqueMetrics = [...new Set(rawChartData.map(item => item.metric))]
          .filter(metric => elements.includes(metric));

        // 2. 메트릭 개수에 따른 동적 레이아웃
        // slotW/slotH: 각 도넛이 차지하는 가용 공간 비율(차트 W/H 대비). radius 픽셀 계산용.
        // bottom legend(약 16%) 고려해 slotH 합산 ≤ 0.84
        const getPositionConfig = (metricCount) => {
          if (metricCount === 1) {
            return [{ center: ['50%', '42%'], slotW: 1.0, slotH: 0.84, titleTop: '5%' }];
          } else if (metricCount === 2) {
            return [
              { center: ['28%', '42%'], slotW: 0.5, slotH: 0.84, titleTop: '5%' },
              { center: ['72%', '42%'], slotW: 0.5, slotH: 0.84, titleTop: '5%' },
            ];
          } else if (metricCount === 3) {
            return [
              { center: ['18%', '42%'], slotW: 0.34, slotH: 0.84, titleTop: '5%' },
              { center: ['50%', '42%'], slotW: 0.34, slotH: 0.84, titleTop: '5%' },
              { center: ['82%', '42%'], slotW: 0.34, slotH: 0.84, titleTop: '5%' },
            ];
          } else if (metricCount === 4) {
            return [
              { center: ['25%', '26%'], slotW: 0.5, slotH: 0.42, titleTop: '5%' },
              { center: ['75%', '26%'], slotW: 0.5, slotH: 0.42, titleTop: '5%' },
              { center: ['25%', '62%'], slotW: 0.5, slotH: 0.42, titleTop: '40%' },
              { center: ['75%', '62%'], slotW: 0.5, slotH: 0.42, titleTop: '40%' },
            ];
          } else if (metricCount === 5) {
            return [
              { center: ['25%', '22%'], slotW: 0.5, slotH: 0.32, titleTop: '5%' },
              { center: ['75%', '22%'], slotW: 0.5, slotH: 0.32, titleTop: '5%' },
              { center: ['25%', '58%'], slotW: 0.5, slotH: 0.32, titleTop: '40%' },
              { center: ['75%', '58%'], slotW: 0.5, slotH: 0.32, titleTop: '40%' },
              { center: ['50%', '78%'], slotW: 0.5, slotH: 0.32, titleTop: '60%' },
            ];
          } else {
            return [
              { center: ['18%', '24%'], slotW: 0.34, slotH: 0.42, titleTop: '5%' },
              { center: ['50%', '24%'], slotW: 0.34, slotH: 0.42, titleTop: '5%' },
              { center: ['82%', '24%'], slotW: 0.34, slotH: 0.42, titleTop: '5%' },
              { center: ['18%', '62%'], slotW: 0.34, slotH: 0.42, titleTop: '40%' },
              { center: ['50%', '62%'], slotW: 0.34, slotH: 0.42, titleTop: '40%' },
              { center: ['82%', '62%'], slotW: 0.34, slotH: 0.42, titleTop: '40%' },
            ];
          }
        };

        // 컨테이너 사이즈 + 슬롯 비율로 픽셀 단위 radius 계산
        // wide/tall 모두에서 도넛이 슬롯 안에 정확히 들어가고 서로 겹치지 않음
        const computeRadius = (slotW, slotH) => {
          const w = chartSize.width;
          const h = chartSize.height;
          if (w <= 0 || h <= 0) return ['38%', '56%']; // fallback (초기 렌더)
          const slotMin = Math.min(slotW * w, slotH * h);
          const outer = Math.max(20, slotMin / 2 * 0.85);
          const inner = outer * 0.66;
          return [inner, outer];
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
              deviceId: item.deviceId,
              itemStyle: {
                color: DEVICE_COLOR_PALETTE[idx % DEVICE_COLOR_PALETTE.length]
              }
            }));

          const position = positions[index] || { center: ['50%', '50%'], titleTop: '25%' };
          const hasData = metricData.length > 0;

          return { metric, metricData, position, hasData };
        });

        // 디바이스 색 매핑 (legend 통합용 — 첫 등장 디바이스의 색을 사용)
        const deviceColorMap = new Map();
        metricDataMap.filter(m => m.hasData).forEach(m => {
          m.metricData.forEach(d => {
            if (!deviceColorMap.has(d.name)) {
              deviceColorMap.set(d.name, d.itemStyle?.color);
            }
          });
        });
        const legendDevices = [...deviceColorMap.keys()];

        // 데이터가 있는 메트릭의 시리즈 — 도넛 중앙에 메트릭명, 호버 시 디바이스/% 표시
        const series = metricDataMap
          .filter(m => m.hasData)
          .map(({ metric, metricData, position }) => ({
            name: getShortMetricName(metric),
            type: 'pie',
            radius: computeRadius(position.slotW, position.slotH),
            center: position.center,
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 2,
              borderColor: C.pieBorder,
              borderWidth: 2
            },
            label: { show: false },
            labelLine: { show: false },
            emphasis: {
              scale: false,
              label: { show: false },
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.25)' }
            },
            data: metricData
          }));

        // 도넛 중앙 메트릭명 — 라벨 전용 빈 pie 시리즈 (silent로 hover 차단, label.position='center'로 정확히 중앙)
        const labelSeries = metricDataMap.filter(m => m.hasData).map(({ metric, position }) => ({
          type: 'pie',
          radius: [0, 0],
          center: position.center,
          silent: true,
          z: 5,
          label: {
            show: true,
            position: 'center',
            formatter: getShortMetricName(metric),
            color: C.text,
            fontSize: 11,
            fontWeight: 700
          },
          labelLine: { show: false },
          tooltip: { show: false },
          data: [{ value: 1, name: '__center__' }]
        }));

        // 데이터 없는 메트릭을 위한 빈 파이 차트 시리즈 (회색 링 + 중앙 텍스트)
        const emptySeries = metricDataMap
          .filter(m => !m.hasData)
          .map(({ metric, position }) => ({
            name: getShortMetricName(metric),
            type: 'pie',
            radius: computeRadius(position.slotW, position.slotH),
            center: position.center,
            silent: true,
            label: {
              show: true,
              position: 'center',
              formatter: `${getShortMetricName(metric)}\n데이터 없음`,
              color: C.empty,
              fontSize: 11,
              lineHeight: 14,
            },
            labelLine: { show: false },
            itemStyle: {
              color: isLight ? 'rgba(203, 213, 225, 0.4)' : 'rgba(51, 65, 85, 0.3)',
              borderColor: C.emptyStroke,
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
                    stroke: C.emptyStroke,
                    lineWidth: 2,
                    lineDash: [5, 5]
                  }
                },
                {
                  type: 'text',
                  style: {
                    text: '데이터 없음',
                    fill: C.empty,
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

        // 메트릭명은 각 도넛 중앙에 표시되므로 별도 title 요소는 불필요
        return {
          ...CHART_ANIMATION,
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item',
            confine: true,
            formatter: (params) => {
              if (params.data.name === '데이터 없음') return '';
              return `<span style="font-size:11px">${params.seriesName}<br/>${params.name}: ${params.percent}%</span>`;
            },
            transitionDuration: 0,
            backgroundColor: C.tipBg,
            borderColor: C.tipBorder,
            padding: [4, 8],
            textStyle: { color: C.tipText, fontSize: 11 },
            extraCssText: `max-width:200px; box-shadow:0 2px 8px ${C.tipShadow}; transition:none !important;`
          },
          // 디바이스 색 식별용 통합 legend (도넛 아래 가로 스크롤)
          legend: legendDevices.length > 0 ? {
            type: 'scroll',
            orient: 'horizontal',
            bottom: 4,
            left: 'center',
            data: legendDevices.map(name => ({
              name,
              icon: 'circle',
              itemStyle: { color: deviceColorMap.get(name) }
            })),
            textStyle: { color: C.text, fontSize: 10 },
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 10,
            pageIconColor: C.pageIconAct,
            pageIconInactiveColor: C.pageIconInact,
            pageTextStyle: { color: C.textMuted, fontSize: 10 },
          } : undefined,
          series: [...series, ...labelSeries, ...emptySeries]
        };
      }

      // 기본 Pie Chart: 단일 메트릭 (value가 null이 아니고 0보다 큰 것만)
      const pieData = chartData
        .filter(item => item.value != null && item.value > 0)
        .map(item => ({
          name: item.deviceName,
          value: item.value,
          deviceId: item.deviceId,
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
                  stroke: C.emptyStroke,
                  lineWidth: 2,
                  lineDash: [5, 5]
                }
              },
              {
                type: 'text',
                style: {
                  text: '데이터 없음',
                  fill: C.empty,
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
        ...CHART_ANIMATION,
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: '{b}: {d}%',
          transitionDuration: 0,
          backgroundColor: C.tipBg,
          borderColor: C.tipBorder,
          padding: [4, 8],
          textStyle: { color: C.tipText, fontSize: 11 },
          extraCssText: `max-width:200px; box-shadow:0 2px 8px ${C.tipShadow}; transition:none !important;`
        },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { color: C.text, fontSize: 11 },
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
            borderColor: C.pieBorder,
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            color: C.text,
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
              color: C.labelLine,
              width: 1
            }
          },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.25)' }
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
            return found ? { value: found.barPct, deviceId: found.deviceId } : 0;
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
          ...CHART_ANIMATION,
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'axis',
            confine: true,
            axisPointer: { type: 'shadow' },
            transitionDuration: 0,
            backgroundColor: C.tipBg,
            borderColor: C.tipBorder,
            padding: [4, 8],
            textStyle: { color: C.tipText, fontSize: 11 },
            extraCssText: `max-width:220px; box-shadow:0 2px 8px ${C.tipShadow}; transition:none !important;`,
            formatter: (params) => {
              if (!params || params.length === 0) return '';
              let result = `<div style="font-weight:bold; margin-bottom:2px; font-size:11px">${params[0].name}</div>`;
              params.forEach(param => {
                if (param.value == null) return;
                let unit = '';
                if (param.seriesName.includes('BPS')) unit = 'bps';
                else if (param.seriesName.includes('BYTE')) unit = 'byte';
                else if (param.seriesName.includes('PKT')) unit = 'pkt';
                else if (param.seriesName.includes('ERR') || param.seriesName.includes('DROP')) unit = '';
                else if (param.seriesName.includes('LOSS')) unit = '%';
                else unit = 'ms';
                const displayValue = formatLargeValue(param.value, unit);
                const marker = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${param.color};margin-right:4px;"></span>`;
                result += `<div style="margin-top:1px; font-size:11px">${marker}${param.seriesName}: <b>${displayValue}${unit}</b></div>`;
              });
              return result;
            }
          },
          legend: {
            data: uniqueMetrics.map(getShortMetricName),
            textStyle: { color: C.text, fontSize: 10 },
            bottom: 0,
            itemWidth: 12,
            itemHeight: 12,
            type: 'scroll',
            pageIconColor: C.pageIconAct,
            pageIconInactiveColor: C.pageIconInact
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
              color: C.text,
              fontSize: 9,
              interval: 'auto',
              rotate: 30,
              overflow: 'truncate',
              width: 60
            },
            axisLine: { lineStyle: { color: C.axisLine } }
          },
          yAxis: {
            type: 'value',
            name: 'ms / %',
            nameTextStyle: { color: C.textMuted },
            axisLabel: {
              color: C.text,
              formatter: (value) => formatLargeValue(value, '')
            },
            axisLine: { lineStyle: { color: C.axisLine } },
            splitLine: { lineStyle: { color: C.splitLine } }
          },
          series: series
        };
      }

      // 기본 Bar Chart: 단일 메트릭
      const barUnit = elementMeta?.unit || '%';
      return {
        ...CHART_ANIMATION,
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: { type: 'shadow' },
          transitionDuration: 0,
          backgroundColor: C.tipBg,
          borderColor: C.tipBorder,
          padding: [4, 8],
          textStyle: { color: C.tipText, fontSize: 11 },
          extraCssText: `max-width:200px; box-shadow:0 2px 8px ${C.tipShadow}; transition:none !important;`,
          formatter: (params) => {
            const param = params[0];
            if (!param) return '';
            const displayValue = formatLargeValue(param.value, barUnit);
            return `<span style="font-size:11px">${param.name}<br/>${param.seriesName}: <b>${displayValue}${barUnit}</b></span>`;
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
            color: C.text,
            fontSize: 9,
            interval: 'auto',
            rotate: 30,
            overflow: 'truncate',
            width: 60
          },
          axisLine: { lineStyle: { color: C.axisLine } }
        },
        yAxis: {
          type: 'value',
          name: elementMeta?.unit || '%',
          nameTextStyle: { color: C.textMuted, fontSize: 10 },
          axisLabel: {
            color: C.text,
            fontSize: 10,
            formatter: (value) => formatLargeValue(value, elementMeta?.unit || '%')
          },
          axisLine: { lineStyle: { color: C.axisLine } },
          splitLine: { lineStyle: { color: C.splitLine } }
        },
        series: [{
          name: elementName,
          type: 'bar',
          data: chartData.map(item => ({
            value: item.value,
            deviceId: item.deviceId,
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
        ...CHART_ANIMATION,
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          transitionDuration: 0,
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(30, 41, 59, 0.98)',
          borderColor: C.tipBorder,
          borderWidth: 2,
          textStyle: { color: C.tipText, fontSize: 11 },
          confine: false,
          enterable: true,
          hideDelay: 500,
          appendToBody: true,
          alwaysShowContent: false,
          triggerOn: 'mousemove|click',
          extraCssText: `max-width: 300px; max-height: 60vh; box-shadow: 0 4px 20px ${C.tipShadow}; pointer-events: auto; transition:none !important;`,
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

            // params에서 값 맵 생성 (seriesIndex -> value, color) - 이름 중복 방지를 위해 인덱스 사용
            const paramsByIndex = new Map();
            params.forEach(param => {
              paramsByIndex.set(param.seriesIndex, {
                value: param.value,
                color: param.color
              });
            });

            // 모든 chartData 항목을 순회하며 툴팁 생성
            chartData.forEach((dataItem, chartIdx) => {
              const color = dataItem.color || '#3b82f6';
              const unit = dataItem?.unit || '%';

              // seriesIndex로 값 찾기, 없으면 values 배열에서 직접 가져오기
              let value;
              if (paramsByIndex.has(chartIdx)) {
                value = paramsByIndex.get(chartIdx).value;
              } else if (Array.isArray(dataItem.value) && dataIndex < dataItem.value.length) {
                value = dataItem.value[dataIndex];
              } else if (Array.isArray(dataItem.values) && dataIndex < dataItem.values.length) {
                value = dataItem.values[dataIndex];
              }

              const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>`;
              // 툴팁에는 전체 이름 표시 (장비 구분을 위해)
              const tooltipName = dataItem.fullDisplayName || dataItem.displayName || dataItem.deviceName;

              // 값이 없으면 '-' 표시
              if (value == null || isNaN(value)) {
                items += `<div style="margin-top: 4px; white-space: nowrap; font-size: 12px; opacity: 0.5;">${marker}${tooltipName}: <strong>-</strong></div>`;
              } else {
                // 절대값으로 표시 + K/M/G 단위 적용
                const displayValue = formatLargeValue(Math.abs(value), unit);
                items += `<div style="margin-top: 4px; white-space: nowrap; font-size: 12px;">${marker}${tooltipName}: <strong>${displayValue}${unit}</strong></div>`;
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
            color: C.text,
            fontSize: 10,
            overflow: 'truncate',
            width: 100
          },
          bottom: 0,
          left: 'center',
          type: 'scroll',
          orient: 'horizontal',
          pageIconColor: C.pageIconAct,
          pageIconInactiveColor: C.pageIconInact,
          pageTextStyle: { color: C.text },
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
          right: -1000,
          feature: {
            dataZoom: { yAxisIndex: 'none' }
          }
        },
        dataZoom: [
          {
            type: 'inside',
            start: timeRange === 'all' ? 0 : 70,
            end: 100,
            zoomOnMouseWheel: true,
            moveOnMouseMove: false
          }
        ],
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: chartData[0]?.timestamps?.map(ts => (ts ? (ts.split(' ')[1]?.substring(0, 5) || '') : '')) || [],
          axisLabel: { color: C.text, fontSize: 9 },
          axisLine: { lineStyle: { color: C.axisLine } }
        },
        yAxis: {
          type: 'value',
          name: (() => {
            const units = [...new Set(chartData.map(item => item.unit))];
            return units.length === 1 ? units[0] : '';
          })(),
          nameTextStyle: { color: C.textMuted },
          axisLabel: {
            color: C.text,
            formatter: (value) => {
              const absValue = Math.abs(value);
              const unit = chartData[0]?.unit || '';
              return formatLargeValue(absValue, unit);
            }
          },
          axisLine: { lineStyle: { color: C.axisLine } },
          splitLine: { lineStyle: { color: C.splitLine } }
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

          const isTraffic = selectedGroup === 'TRAFFIC';

          return chartData.map((item, seriesIdx) => {
            const rawValues = item.value || item.values || [];

            // TRAFFIC 미러 차트: OUT 데이터는 음수로 변환
            const isOutMetric = isTraffic && item.metric && item.metric.includes('OUT');
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
              animationDuration: 600,
              animationEasing: 'cubicOut',
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
            };
          });
        })()
      };
    }

    return {};
  };

  const chartRef = useRef(null);

  // 데이터 갱신 시 ECharts를 clear 후 다시 그리기 (등장 애니메이션 재생)
  useEffect(() => {
    if (widget._refreshedAt && widget._refreshedAt !== prevRefreshedAtRef.current) {
      prevRefreshedAtRef.current = widget._refreshedAt;
      if (chartRef.current) {
        const chart = chartRef.current.getEchartsInstance?.();
        if (chart && !chart.isDisposed?.()) {
          chart.clear();
          chart.setOption(getChartOption(tooltipOnLeft));
        }
      }
    }
  }, [widget._refreshedAt]);

  // 컨테이너 리사이즈 시 ECharts 강제 resize + 사이즈 추적 (radius 동적 계산용)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setChartSize(prev => (prev.width !== width || prev.height !== height) ? { width, height } : prev);
      }
      if (chartRef.current) {
        const chart = chartRef.current.getEchartsInstance?.();
        if (chart && !chart.isDisposed?.()) {
          chart.resize();
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="widget-content-inner" ref={containerRef}>
      <div className="custom-widget-content echarts-container" onMouseLeave={() => {
        const chart = chartRef.current?.getEchartsInstance?.();
        if (chart && !chart.isDisposed?.()) {
          chart.dispatchAction({ type: 'hideTip' });
          chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
        }
      }}>
        {chartData.length > 0 ? (
          <SafeECharts
            ref={chartRef}
            option={getChartOption(tooltipOnLeft)}
            notMerge={false}
            lazyUpdate={true}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={{
              click: (params) => {
                if (isEditMode || !onDeviceClick) return;
                const deviceId = params.data?.deviceId;
                if (deviceId) onDeviceClick(deviceId);
              },
              globalout: () => {
                const chart = chartRef.current?.getEchartsInstance?.();
                if (chart && !chart.isDisposed?.()) {
                  chart.dispatchAction({ type: 'hideTip' });
                  chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
                }
              }
            }}
            onChartReady={(chart) => {
              if (chartType === 'line') {
                chart.dispatchAction({ type: 'takeGlobalCursor', key: 'dataZoomSelect', dataZoomSelectActive: true });
                chart.getZr().on('dblclick', () => {
                  chart.dispatchAction({ type: 'dataZoom', start: timeRange === 'all' ? 0 : 70, end: 100 });
                });
              }
            }}
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

const MemoizedCustomWidgetContent = memo(CustomWidgetContent, (prevProps, nextProps) => {
  // chartData나 cntData가 변경되면 리렌더링
  if (prevProps.widget.chartData !== nextProps.widget.chartData) return false;
  if (prevProps.widget.cntData !== nextProps.widget.cntData) return false;
  if (prevProps.widget._refreshedAt !== nextProps.widget._refreshedAt) return false;
  if (prevProps.widget.id !== nextProps.widget.id) return false;
  if (prevProps.widget.config !== nextProps.widget.config) return false;
  if (prevProps.isEditMode !== nextProps.isEditMode) return false;
  if (prevProps.onDeviceClick !== nextProps.onDeviceClick) return false;
  return true;
});

export default MemoizedCustomWidgetContent;
