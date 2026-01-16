# 백엔드 응답 예시 및 처리 흐름

## 요청 예시

```http
GET /dashboard/widget-data/90
```

userDashboardWidgetId = 90인 위젯의 데이터 조회

## 백엔드 처리 과정

### 1단계: 위젯 정보 조회 (DB)

```sql
SELECT
  USER_DASHBOARD_WIDGET_ID,
  WIDGET_ID,
  TITLE,
  CONFIG,
  POS_X,
  POS_Y,
  WIDTH,
  HEIGHT,
  SORT_ORDER
FROM R_USER_DASHBOARD_WIDGET_T
WHERE USER_DASHBOARD_WIDGET_ID = 90;
```

**결과:**
```json
{
  "USER_DASHBOARD_WIDGET_ID": 90,
  "WIDGET_ID": 28,
  "TITLE": "ASD",
  "CONFIG": "{\"group\":\"FILE\",\"elements\":[\"FILESYSTEM\",\"DISK_READ\"],\"chartType\":\"pie\"}",
  "POS_X": 2,
  "POS_Y": 4,
  "WIDTH": 2,
  "HEIGHT": 1,
  "SORT_ORDER": 6
}
```

### 2단계: CONFIG 파싱

```javascript
const config = JSON.parse(widget.CONFIG);
// {
//   group: "FILE",
//   elements: ["FILESYSTEM", "DISK_READ"],
//   chartType: "pie"
// }
```

### 3단계: 각 element별 모니터링 데이터 조회

#### element: "FILESYSTEM"

```sql
-- 최근 5분간 평균값
SELECT
  AVG(FS_USAGE) as value
FROM PERF_FILESYSTEM_T
WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
```

**결과:** `value = 75.5`

#### element: "DISK_READ"

```sql
-- 최근 5분간 평균값
SELECT
  AVG(DISK_READ_RATE) as value
FROM PERF_DISK_T
WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
```

**결과:** `value = 45.2`

### 4단계: 응답 데이터 생성

---

## 응답 형식 (차트 타입별)

### 1. Pie Chart / Bar Chart 응답

```json
{
  "success": true,
  "data": {
    "widgetId": 90,
    "chartType": "pie",
    "chartData": [
      {
        "elementId": "FILESYSTEM",
        "name": "파일시스템 사용률",
        "value": 75.5,
        "color": "#ef4444",
        "unit": "%"
      },
      {
        "elementId": "DISK_READ",
        "name": "Disk Read",
        "value": 45.2,
        "color": "#f97316",
        "unit": "MB/s"
      }
    ],
    "lastUpdated": "2025-12-24T10:30:00Z"
  }
}
```

**필수 필드:**
- `elementId`: 모니터링 요소 ID (프론트엔드 MONITORING_ELEMENTS와 매칭)
- `name`: 표시될 이름
- `value`: 실제 값 (숫자)
- `color`: 차트 색상 (hex)
- `unit`: 단위 (%, MB/s, bps 등)

---

### 2. Line Chart 응답 (시계열 데이터)

```json
{
  "success": true,
  "data": {
    "widgetId": 90,
    "chartType": "line",
    "chartData": [
      {
        "elementId": "FILESYSTEM",
        "name": "파일시스템 사용률",
        "color": "#ef4444",
        "unit": "%",
        "points": [
          {
            "timestamp": "2025-12-24T09:30:00Z",
            "value": 70.5
          },
          {
            "timestamp": "2025-12-24T09:35:00Z",
            "value": 72.3
          },
          {
            "timestamp": "2025-12-24T09:40:00Z",
            "value": 71.8
          },
          {
            "timestamp": "2025-12-24T09:45:00Z",
            "value": 73.2
          },
          {
            "timestamp": "2025-12-24T09:50:00Z",
            "value": 74.1
          },
          {
            "timestamp": "2025-12-24T09:55:00Z",
            "value": 75.0
          },
          {
            "timestamp": "2025-12-24T10:00:00Z",
            "value": 75.5
          }
        ]
      },
      {
        "elementId": "DISK_READ",
        "name": "Disk Read",
        "color": "#f97316",
        "unit": "MB/s",
        "points": [
          {
            "timestamp": "2025-12-24T09:30:00Z",
            "value": 40.2
          },
          {
            "timestamp": "2025-12-24T09:35:00Z",
            "value": 41.5
          },
          {
            "timestamp": "2025-12-24T09:40:00Z",
            "value": 42.3
          },
          {
            "timestamp": "2025-12-24T09:45:00Z",
            "value": 43.1
          },
          {
            "timestamp": "2025-12-24T09:50:00Z",
            "value": 44.0
          },
          {
            "timestamp": "2025-12-24T09:55:00Z",
            "value": 44.8
          },
          {
            "timestamp": "2025-12-24T10:00:00Z",
            "value": 45.2
          }
        ]
      }
    ],
    "lastUpdated": "2025-12-24T10:00:00Z"
  }
}
```

**Line Chart SQL 예시 (최근 1시간, 5분 간격):**

```sql
-- FILESYSTEM 시계열 데이터
SELECT
  DATE_FORMAT(TIMESTAMP, '%Y-%m-%dT%H:%i:00Z') as timestamp,
  AVG(FS_USAGE) as value
FROM PERF_FILESYSTEM_T
WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:%i')
ORDER BY timestamp ASC;
```

---

## 실제 구현 예시 (Node.js)

```javascript
// routes/dashboard.js
router.get('/widget-data/:userDashboardWidgetId', async (req, res) => {
  try {
    const { userDashboardWidgetId } = req.params;

    // 1. 위젯 정보 조회
    const [widgets] = await db.query(
      'SELECT * FROM R_USER_DASHBOARD_WIDGET_T WHERE USER_DASHBOARD_WIDGET_ID = ?',
      [userDashboardWidgetId]
    );

    if (!widgets || widgets.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'WIDGET_NOT_FOUND', message: '위젯을 찾을 수 없습니다' }
      });
    }

    const widget = widgets[0];

    // 2. CONFIG 파싱
    const config = JSON.parse(widget.CONFIG);
    const { group, elements, chartType } = config;

    console.log('위젯 설정:', { group, elements, chartType });

    // 3. 차트 데이터 생성
    let chartData;

    if (chartType === 'line') {
      // 시계열 데이터
      chartData = await getTimeSeriesData(elements);
    } else {
      // 현재 값 (pie, bar)
      chartData = await getCurrentValues(elements);
    }

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
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// 현재 값 조회 (Pie/Bar)
async function getCurrentValues(elements) {
  const ELEMENT_CONFIG = {
    'FILESYSTEM': {
      table: 'PERF_FILESYSTEM_T',
      column: 'FS_USAGE',
      name: '파일시스템 사용률',
      color: '#ef4444',
      unit: '%'
    },
    'DISK_READ': {
      table: 'PERF_DISK_T',
      column: 'DISK_READ_RATE',
      name: 'Disk Read',
      color: '#f97316',
      unit: 'MB/s'
    },
    'DISK_WRITE': {
      table: 'PERF_DISK_T',
      column: 'DISK_WRITE_RATE',
      name: 'Disk Write',
      color: '#fb923c',
      unit: 'MB/s'
    },
    'CPU': {
      table: 'PERF_CPU_T',
      column: 'CPU_USAGE',
      name: 'CPU 사용률',
      color: '#3b82f6',
      unit: '%'
    },
    'MEMORY': {
      table: 'PERF_MEMORY_T',
      column: 'MEM_USAGE',
      name: 'Memory 사용률',
      color: '#8b5cf6',
      unit: '%'
    },
    'TRAFFIC_IN_BPS': {
      table: 'PERF_NETWORK_T',
      column: 'IN_BPS',
      name: 'Traffic IN (bps)',
      color: '#06b6d4',
      unit: 'bps'
    },
    'TRAFFIC_OUT_BPS': {
      table: 'PERF_NETWORK_T',
      column: 'OUT_BPS',
      name: 'Traffic OUT (bps)',
      color: '#22d3ee',
      unit: 'bps'
    }
    // ... 나머지 요소들
  };

  const chartData = [];

  for (const elementId of elements) {
    const config = ELEMENT_CONFIG[elementId];
    if (!config) {
      console.warn(`Unknown element: ${elementId}`);
      continue;
    }

    // 최근 5분간 평균값 조회
    const query = `
      SELECT AVG(${config.column}) as value
      FROM ${config.table}
      WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `;

    const [rows] = await db.query(query);
    const value = rows[0]?.value || 0;

    chartData.push({
      elementId: elementId,
      name: config.name,
      value: parseFloat(value.toFixed(2)),
      color: config.color,
      unit: config.unit
    });
  }

  return chartData;
}

// 시계열 데이터 조회 (Line)
async function getTimeSeriesData(elements) {
  // 위와 동일한 ELEMENT_CONFIG 사용

  const chartData = [];

  for (const elementId of elements) {
    const config = ELEMENT_CONFIG[elementId];
    if (!config) continue;

    // 최근 1시간, 5분 간격 데이터
    const query = `
      SELECT
        DATE_FORMAT(TIMESTAMP, '%Y-%m-%dT%H:%i:00Z') as timestamp,
        AVG(${config.column}) as value
      FROM ${config.table}
      WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:%i')
      ORDER BY timestamp ASC
    `;

    const [rows] = await db.query(query);

    chartData.push({
      elementId: elementId,
      name: config.name,
      color: config.color,
      unit: config.unit,
      points: rows.map(row => ({
        timestamp: row.timestamp,
        value: parseFloat(row.value.toFixed(2))
      }))
    });
  }

  return chartData;
}
```

---

## 에러 응답 예시

### 위젯을 찾을 수 없을 때
```json
{
  "success": false,
  "error": {
    "code": "WIDGET_NOT_FOUND",
    "message": "위젯을 찾을 수 없습니다"
  }
}
```

### 서버 오류
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "서버 오류가 발생했습니다"
  }
}
```

### CONFIG 파싱 실패
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CONFIG",
    "message": "위젯 설정이 올바르지 않습니다"
  }
}
```

---

## 테스트용 더미 데이터 응답

개발 중 실제 DB 데이터가 없을 때 사용:

```javascript
// 더미 데이터 생성 함수
function generateDummyData(elements, chartType) {
  const ELEMENT_CONFIG = { /* 위와 동일 */ };

  if (chartType === 'line') {
    // 시계열 더미 데이터
    return elements.map(elementId => {
      const config = ELEMENT_CONFIG[elementId];
      const points = [];
      const now = new Date();

      // 최근 1시간, 5분 간격 (13개 데이터 포인트)
      for (let i = 12; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
        points.push({
          timestamp: timestamp.toISOString(),
          value: parseFloat((Math.random() * 100).toFixed(2))
        });
      }

      return {
        elementId: elementId,
        name: config.name,
        color: config.color,
        unit: config.unit,
        points: points
      };
    });
  } else {
    // 현재 값 더미 데이터
    return elements.map(elementId => {
      const config = ELEMENT_CONFIG[elementId];
      return {
        elementId: elementId,
        name: config.name,
        value: parseFloat((Math.random() * 100).toFixed(2)),
        color: config.color,
        unit: config.unit
      };
    });
  }
}

// 사용 예시
if (process.env.USE_DUMMY_DATA === 'true') {
  chartData = generateDummyData(elements, chartType);
} else {
  chartData = await getCurrentValues(elements);
}
```

---

## 중요 포인트

### ✅ 반드시 포함해야 할 필드
1. **elementId**: 프론트엔드 MONITORING_ELEMENTS와 매칭되어야 함
2. **name**: 차트에 표시될 이름
3. **color**: 프론트엔드와 동일한 색상 사용
4. **unit**: 단위 표시
5. **value** (pie/bar) 또는 **points** (line)

### ⚠️ 주의사항
- config.elements 순서대로 chartData 배열 생성
- elementId는 대소문자 구분 (FILESYSTEM, DISK_READ 등)
- value는 숫자 타입 (문자열 X)
- timestamp는 ISO 8601 형식
- 데이터가 없을 때 빈 배열이 아닌 0 또는 빈 points 배열 반환

### 🔧 선택적 최적화
- 같은 테이블의 여러 컬럼을 한 번에 조회
- Redis 캐싱 (30초 TTL)
- 비동기 병렬 처리
