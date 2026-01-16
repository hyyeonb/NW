# 백엔드 위젯 데이터 구현 가이드

## 1. API 엔드포인트 구현 (Node.js/Express 예시)

```javascript
// routes/dashboard.js

/**
 * 위젯 차트 데이터 조회
 * GET /dashboard/widget-data/:userDashboardWidgetId
 */
router.get('/widget-data/:userDashboardWidgetId', async (req, res) => {
  try {
    const { userDashboardWidgetId } = req.params;

    // 1. 위젯 정보 조회
    const widget = await getWidgetInfo(userDashboardWidgetId);

    if (!widget) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WIDGET_NOT_FOUND',
          message: '위젯을 찾을 수 없습니다'
        }
      });
    }

    // 2. config 파싱
    const config = JSON.parse(widget.CONFIG);
    const { group, elements, chartType } = config;

    // 3. 차트 데이터 생성
    const chartData = await generateChartData(group, elements, chartType);

    // 4. 응답
    res.json({
      success: true,
      data: {
        widgetId: userDashboardWidgetId,
        chartType: chartType,
        chartData: chartData,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('위젯 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다'
      }
    });
  }
});
```

## 2. 위젯 정보 조회

```javascript
async function getWidgetInfo(userDashboardWidgetId) {
  const query = `
    SELECT
      USER_DASHBOARD_WIDGET_ID,
      WIDGET_ID,
      TITLE,
      CONFIG,
      POS_X,
      POS_Y,
      WIDTH,
      HEIGHT
    FROM R_USER_DASHBOARD_WIDGET_T
    WHERE USER_DASHBOARD_WIDGET_ID = ?
  `;

  const [rows] = await db.query(query, [userDashboardWidgetId]);
  return rows[0];
}
```

## 3. 모니터링 요소 메타데이터

```javascript
const MONITORING_ELEMENTS = {
  // CPU/Memory 그룹
  CPU: {
    table: 'PERF_CPU_T',
    column: 'CPU_USAGE',
    unit: '%',
    name: 'CPU 사용률',
    color: '#3b82f6',
    aggregation: 'AVG'  // AVG, MAX, MIN, SUM
  },
  MEMORY: {
    table: 'PERF_MEMORY_T',
    column: 'MEM_USAGE',
    unit: '%',
    name: 'Memory 사용률',
    color: '#8b5cf6',
    aggregation: 'AVG'
  },

  // File System 그룹
  FILESYSTEM: {
    table: 'PERF_FILESYSTEM_T',
    column: 'FS_USAGE',
    unit: '%',
    name: '파일시스템 사용률',
    color: '#ef4444',
    aggregation: 'AVG'
  },
  DISK_READ: {
    table: 'PERF_DISK_T',
    column: 'DISK_READ_RATE',
    unit: 'MB/s',
    name: 'Disk Read',
    color: '#f97316',
    aggregation: 'AVG'
  },
  DISK_WRITE: {
    table: 'PERF_DISK_T',
    column: 'DISK_WRITE_RATE',
    unit: 'MB/s',
    name: 'Disk Write',
    color: '#fb923c',
    aggregation: 'AVG'
  },

  // Traffic 그룹
  TRAFFIC_IN_BPS: {
    table: 'PERF_NETWORK_T',
    column: 'IN_BPS',
    unit: 'bps',
    name: 'Traffic IN (bps)',
    color: '#06b6d4',
    aggregation: 'AVG'
  },
  TRAFFIC_OUT_BPS: {
    table: 'PERF_NETWORK_T',
    column: 'OUT_BPS',
    unit: 'bps',
    name: 'Traffic OUT (bps)',
    color: '#22d3ee',
    aggregation: 'AVG'
  },

  // ICMP 그룹
  ICMP_AVG: {
    table: 'PERF_ICMP_T',
    column: 'ICMP_AVG',
    unit: 'ms',
    name: 'ICMP Avg',
    color: '#a5b4fc',
    aggregation: 'AVG'
  },
  ICMP_LOSS: {
    table: 'PERF_ICMP_T',
    column: 'ICMP_LOSS',
    unit: '%',
    name: 'ICMP Loss',
    color: '#c7d2fe',
    aggregation: 'AVG'
  }
};
```

## 4. 차트 데이터 생성 함수

### 4.1 Pie Chart / Bar Chart (현재 값)

```javascript
async function generateChartData(group, elements, chartType) {
  if (chartType === 'pie' || chartType === 'bar') {
    return await getCurrentValues(elements);
  } else if (chartType === 'line') {
    return await getTimeSeriesData(elements);
  }
}

/**
 * 현재 값 조회 (Pie/Bar Chart용)
 */
async function getCurrentValues(elements) {
  const chartData = [];

  for (const elementId of elements) {
    const meta = MONITORING_ELEMENTS[elementId];
    if (!meta) continue;

    // 최신 데이터 조회
    const query = `
      SELECT
        ${meta.aggregation}(${meta.column}) as value
      FROM ${meta.table}
      WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      LIMIT 1
    `;

    const [rows] = await db.query(query);
    const value = rows[0]?.value || 0;

    chartData.push({
      elementId: elementId,
      name: meta.name,
      value: parseFloat(value.toFixed(2)),
      color: meta.color,
      unit: meta.unit
    });
  }

  return chartData;
}
```

### 4.2 Line Chart (시계열 데이터)

```javascript
/**
 * 시계열 데이터 조회 (Line Chart용)
 * 최근 1시간, 5분 간격
 */
async function getTimeSeriesData(elements) {
  const chartData = [];

  for (const elementId of elements) {
    const meta = MONITORING_ELEMENTS[elementId];
    if (!meta) continue;

    // 시계열 데이터 조회
    const query = `
      SELECT
        DATE_FORMAT(TIMESTAMP, '%Y-%m-%dT%H:%i:00') as timestamp,
        ${meta.aggregation}(${meta.column}) as value
      FROM ${meta.table}
      WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:%i')
      ORDER BY timestamp ASC
    `;

    const [rows] = await db.query(query);

    chartData.push({
      elementId: elementId,
      name: meta.name,
      color: meta.color,
      unit: meta.unit,
      points: rows.map(row => ({
        timestamp: row.timestamp,
        value: parseFloat(row.value.toFixed(2))
      }))
    });
  }

  return chartData;
}
```

## 5. 성능 최적화

### 5.1 여러 요소를 한 번에 조회

```javascript
/**
 * 같은 테이블의 여러 컬럼을 한 번에 조회
 */
async function getCurrentValuesOptimized(elements) {
  // 테이블별로 그룹화
  const tableGroups = {};
  elements.forEach(elementId => {
    const meta = MONITORING_ELEMENTS[elementId];
    if (!meta) return;

    if (!tableGroups[meta.table]) {
      tableGroups[meta.table] = [];
    }
    tableGroups[meta.table].push({ elementId, meta });
  });

  const chartData = [];

  // 테이블별로 한 번씩만 쿼리
  for (const [table, items] of Object.entries(tableGroups)) {
    const columns = items.map(item =>
      `${item.meta.aggregation}(${item.meta.column}) as ${item.elementId}`
    ).join(', ');

    const query = `
      SELECT ${columns}
      FROM ${table}
      WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      LIMIT 1
    `;

    const [rows] = await db.query(query);
    const row = rows[0] || {};

    items.forEach(item => {
      chartData.push({
        elementId: item.elementId,
        name: item.meta.name,
        value: parseFloat((row[item.elementId] || 0).toFixed(2)),
        color: item.meta.color,
        unit: item.meta.unit
      });
    });
  }

  return chartData;
}
```

### 5.2 캐싱 전략

```javascript
const NodeCache = require('node-cache');
const widgetDataCache = new NodeCache({ stdTTL: 30 }); // 30초 캐시

async function getCachedWidgetData(userDashboardWidgetId, group, elements, chartType) {
  const cacheKey = `widget_${userDashboardWidgetId}`;

  // 캐시 확인
  const cached = widgetDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 데이터 생성
  const data = await generateChartData(group, elements, chartType);

  // 캐시 저장
  widgetDataCache.set(cacheKey, data);

  return data;
}
```

## 6. 테스트용 더미 데이터

```javascript
/**
 * 개발/테스트용 더미 데이터 생성
 */
function generateDummyData(elements, chartType) {
  if (chartType === 'line') {
    return elements.map(elementId => {
      const meta = MONITORING_ELEMENTS[elementId];
      const points = [];
      const now = new Date();

      // 최근 1시간, 5분 간격
      for (let i = 12; i >= 0; i--) {
        const timestamp = new Date(now - i * 5 * 60 * 1000);
        points.push({
          timestamp: timestamp.toISOString(),
          value: parseFloat((Math.random() * 100).toFixed(2))
        });
      }

      return {
        elementId: elementId,
        name: meta.name,
        color: meta.color,
        unit: meta.unit,
        points: points
      };
    });
  } else {
    return elements.map(elementId => {
      const meta = MONITORING_ELEMENTS[elementId];
      return {
        elementId: elementId,
        name: meta.name,
        value: parseFloat((Math.random() * 100).toFixed(2)),
        color: meta.color,
        unit: meta.unit
      };
    });
  }
}
```

## 7. 에러 처리

```javascript
class WidgetDataError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function generateChartDataSafe(group, elements, chartType) {
  try {
    // 유효성 검사
    if (!elements || elements.length === 0) {
      throw new WidgetDataError('INVALID_ELEMENTS', '모니터링 요소가 없습니다');
    }

    if (!['pie', 'bar', 'line'].includes(chartType)) {
      throw new WidgetDataError('INVALID_CHART_TYPE', '지원하지 않는 차트 타입입니다');
    }

    // 데이터 생성
    return await generateChartData(group, elements, chartType);

  } catch (error) {
    if (error instanceof WidgetDataError) {
      throw error;
    }

    console.error('차트 데이터 생성 실패:', error);
    throw new WidgetDataError('DATA_GENERATION_FAILED', '차트 데이터 생성에 실패했습니다');
  }
}
```

## 8. 실제 환경 적용 체크리스트

- [ ] 데이터베이스 테이블 구조 확인
- [ ] 모니터링 데이터 수집 확인
- [ ] MONITORING_ELEMENTS 메타데이터 업데이트
- [ ] API 엔드포인트 라우팅 설정
- [ ] 권한 체크 (사용자별 위젯 접근 제어)
- [ ] 캐싱 전략 적용
- [ ] 로깅 및 모니터링 설정
- [ ] 에러 핸들링 테스트
- [ ] 성능 테스트 (동시 요청 처리)
- [ ] 프론트엔드 연동 테스트
