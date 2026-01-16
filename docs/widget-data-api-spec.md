# 위젯 데이터 API 명세

## 개요
사용자 정의 위젯의 실제 모니터링 데이터를 제공하는 API

## API 엔드포인트

### 위젯 데이터 조회
```
GET /dashboard/widget-data/{userDashboardWidgetId}
```

또는 (config를 직접 전달하는 경우)

```
POST /dashboard/widget-data
Content-Type: application/json

{
  "userDashboardWidgetId": 90,
  "config": {
    "group": "FILE",
    "elements": ["FILESYSTEM", "DISK_READ"],
    "chartType": "pie"
  }
}
```

## 응답 형식

### 공통 응답 구조
```json
{
  "success": true,
  "data": {
    "widgetId": 90,
    "chartType": "pie | bar | line",
    "chartData": [...],
    "lastUpdated": "2025-12-24T10:00:00Z"
  }
}
```

### 1. Pie Chart / Bar Chart 데이터
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
    "lastUpdated": "2025-12-24T10:00:00Z"
  }
}
```

### 2. Line Chart 데이터 (시계열)
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
          { "timestamp": "2025-12-24T09:50:00Z", "value": 70 },
          { "timestamp": "2025-12-24T09:55:00Z", "value": 72 },
          { "timestamp": "2025-12-24T10:00:00Z", "value": 75 }
        ]
      },
      {
        "elementId": "DISK_READ",
        "name": "Disk Read",
        "color": "#f97316",
        "unit": "MB/s",
        "points": [
          { "timestamp": "2025-12-24T09:50:00Z", "value": 40 },
          { "timestamp": "2025-12-24T09:55:00Z", "value": 43 },
          { "timestamp": "2025-12-24T10:00:00Z", "value": 45 }
        ]
      }
    ],
    "lastUpdated": "2025-12-24T10:00:00Z"
  }
}
```

## 백엔드 구현 가이드

### 1. Config 파싱
```javascript
// config 파싱 예시 (Node.js)
const config = JSON.parse(widget.config);
// { group: "FILE", elements: ["FILESYSTEM", "DISK_READ"], chartType: "pie" }
```

### 2. 모니터링 데이터 조회 로직
```javascript
async function getWidgetChartData(userDashboardWidgetId) {
  // 1. 위젯 정보 조회
  const widget = await db.query(
    'SELECT * FROM R_USER_DASHBOARD_WIDGET_T WHERE USER_DASHBOARD_WIDGET_ID = ?',
    [userDashboardWidgetId]
  );

  // 2. config 파싱
  const config = JSON.parse(widget.config);
  const { group, elements, chartType } = config;

  // 3. 각 element별로 모니터링 데이터 조회
  const chartData = [];
  for (const elementId of elements) {
    // 실제 모니터링 데이터 조회 (예시)
    const monitoringData = await getMonitoringData(elementId);

    chartData.push({
      elementId: elementId,
      name: getElementName(elementId),
      value: monitoringData.currentValue,
      color: getElementColor(elementId),
      unit: getElementUnit(elementId)
    });
  }

  return {
    widgetId: userDashboardWidgetId,
    chartType: chartType,
    chartData: chartData,
    lastUpdated: new Date().toISOString()
  };
}
```

### 3. 그룹별 모니터링 데이터 조회
```javascript
const MONITORING_GROUPS = {
  CPU_MEM: {
    ELEMENTS: {
      CPU: { table: 'PERF_CPU_T', column: 'CPU_USAGE', unit: '%' },
      MEMORY: { table: 'PERF_MEMORY_T', column: 'MEM_USAGE', unit: '%' }
    }
  },
  FILE: {
    ELEMENTS: {
      FILESYSTEM: { table: 'PERF_FILESYSTEM_T', column: 'FS_USAGE', unit: '%' },
      DISK_READ: { table: 'PERF_DISK_T', column: 'DISK_READ_RATE', unit: 'MB/s' },
      DISK_WRITE: { table: 'PERF_DISK_T', column: 'DISK_WRITE_RATE', unit: 'MB/s' }
    }
  },
  TRAFFIC: {
    ELEMENTS: {
      TRAFFIC_IN_BPS: { table: 'PERF_NETWORK_T', column: 'IN_BPS', unit: 'bps' },
      TRAFFIC_OUT_BPS: { table: 'PERF_NETWORK_T', column: 'OUT_BPS', unit: 'bps' }
    }
  }
  // ... 다른 그룹들
};

async function getMonitoringData(elementId) {
  // elementId로 테이블과 컬럼 찾기
  const config = findElementConfig(elementId);

  // 최신 데이터 조회
  const query = `
    SELECT ${config.column} as value
    FROM ${config.table}
    ORDER BY TIMESTAMP DESC
    LIMIT 1
  `;

  const result = await db.query(query);
  return {
    currentValue: result[0].value,
    unit: config.unit
  };
}
```

### 4. 차트 타입별 처리
```javascript
async function formatChartData(chartType, elements) {
  if (chartType === 'line') {
    // 시계열 데이터 (최근 1시간, 5분 간격)
    return await getTimeSeriesData(elements, '1h', '5m');
  } else {
    // 현재 값만 (pie, bar)
    return await getCurrentValues(elements);
  }
}
```

## 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "WIDGET_NOT_FOUND",
    "message": "위젯을 찾을 수 없습니다"
  }
}
```

## 주기적 업데이트
프론트엔드에서 30초마다 API 호출하여 데이터 갱신 권장
