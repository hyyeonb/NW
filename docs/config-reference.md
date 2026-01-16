# CONFIG 필드 완전 참조 가이드

프론트엔드에서 백엔드로 전송하는 `CONFIG` 필드에 들어갈 수 있는 모든 값들의 완전한 목록입니다.

---

## CONFIG 구조

```json
{
  "group": "그룹ID",
  "elements": ["요소1", "요소2", ...],
  "chartType": "pie | bar | line"
}
```

---

## 1. CPU_MEM 그룹 ⚠️ **단일 선택만 가능**

### group 값
```
"CPU_MEM"
```

### elements 가능한 값 (1개만 선택 가능)
```json
[
  "CPU"
]
// 또는
[
  "MEMORY"
]
```

**⚠️ 중요**: CPU_MEM 그룹은 CPU 또는 MEMORY 중 **하나만** 선택 가능합니다.

### 예시 CONFIG

#### Pie Chart - CPU만
```json
{
  "group": "CPU_MEM",
  "elements": ["CPU"],
  "chartType": "pie"
}
```

#### Bar Chart - Memory만
```json
{
  "group": "CPU_MEM",
  "elements": ["MEMORY"],
  "chartType": "bar"
}
```

#### Line Chart - CPU만
```json
{
  "group": "CPU_MEM",
  "elements": ["CPU"],
  "chartType": "line"
}
```

**❌ 잘못된 예시 (다중 선택 불가)**
```json
{
  "group": "CPU_MEM",
  "elements": ["CPU", "MEMORY"],  // ❌ 에러!
  "chartType": "pie"
}
```

### 백엔드 매핑 정보

| elementId | 테이블 | 컬럼 | 이름 | 색상 | 단위 |
|-----------|--------|------|------|------|------|
| CPU | PERF_CPU_T | CPU_USAGE | CPU 사용률 | #3b82f6 | % |
| MEMORY | PERF_MEMORY_T | MEM_USAGE | Memory 사용률 | #8b5cf6 | % |

---

## 2. FILE 그룹

### group 값
```
"FILE"
```

### elements 가능한 값
```json
[
  "FILESYSTEM",
  "DISK_READ",
  "DISK_WRITE"
]
```

### 예시 CONFIG

#### Pie Chart
```json
{
  "group": "FILE",
  "elements": ["FILESYSTEM", "DISK_READ"],
  "chartType": "pie"
}
```

#### Bar Chart
```json
{
  "group": "FILE",
  "elements": ["FILESYSTEM", "DISK_READ", "DISK_WRITE"],
  "chartType": "bar"
}
```

#### Line Chart
```json
{
  "group": "FILE",
  "elements": ["DISK_READ", "DISK_WRITE"],
  "chartType": "line"
}
```

### 백엔드 매핑 정보

| elementId | 테이블 | 컬럼 | 이름 | 색상 | 단위 |
|-----------|--------|------|------|------|------|
| FILESYSTEM | PERF_FILESYSTEM_T | FS_USAGE | 파일시스템 사용률 | #ef4444 | % |
| DISK_READ | PERF_DISK_T | DISK_READ_RATE | Disk Read | #f97316 | MB/s |
| DISK_WRITE | PERF_DISK_T | DISK_WRITE_RATE | Disk Write | #fb923c | MB/s |

---

## 3. PROCESS 그룹

### group 값
```
"PROCESS"
```

### elements 가능한 값
```json
[
  "PROCESS_COUNT",
  "PROCESS_CPU",
  "PROCESS_MEM"
]
```

### 예시 CONFIG

#### Pie Chart
```json
{
  "group": "PROCESS",
  "elements": ["PROCESS_CPU", "PROCESS_MEM"],
  "chartType": "pie"
}
```

#### Bar Chart
```json
{
  "group": "PROCESS",
  "elements": ["PROCESS_COUNT", "PROCESS_CPU", "PROCESS_MEM"],
  "chartType": "bar"
}
```

#### Line Chart
```json
{
  "group": "PROCESS",
  "elements": ["PROCESS_COUNT"],
  "chartType": "line"
}
```

### 백엔드 매핑 정보

| elementId | 테이블 | 컬럼 | 이름 | 색상 | 단위 |
|-----------|--------|------|------|------|------|
| PROCESS_COUNT | PERF_PROCESS_T | PROCESS_COUNT | 프로세스 수 | #10b981 | 개 |
| PROCESS_CPU | PERF_PROCESS_T | PROCESS_CPU_USAGE | 프로세스 CPU | #22c55e | % |
| PROCESS_MEM | PERF_PROCESS_T | PROCESS_MEM_USAGE | 프로세스 Memory | #4ade80 | % |

---

## 4. TRAFFIC 그룹 ⭐ 가장 많은 요소

### group 값
```
"TRAFFIC"
```

### elements 가능한 값
```json
[
  "TRAFFIC_IN_BPS",
  "TRAFFIC_IN_PKT",
  "TRAFFIC_IN_ERR",
  "TRAFFIC_OUT_BPS",
  "TRAFFIC_OUT_PKT",
  "TRAFFIC_OUT_BYTE"
]
```

### 예시 CONFIG

#### Pie Chart
```json
{
  "group": "TRAFFIC",
  "elements": ["TRAFFIC_IN_BPS", "TRAFFIC_OUT_BPS"],
  "chartType": "pie"
}
```

#### Bar Chart
```json
{
  "group": "TRAFFIC",
  "elements": ["TRAFFIC_IN_BPS", "TRAFFIC_IN_PKT", "TRAFFIC_IN_ERR", "TRAFFIC_OUT_BPS"],
  "chartType": "bar"
}
```

#### Line Chart
```json
{
  "group": "TRAFFIC",
  "elements": ["TRAFFIC_IN_BPS", "TRAFFIC_OUT_BPS"],
  "chartType": "line"
}
```

### 백엔드 매핑 정보

| elementId | 테이블 | 컬럼 | 이름 | 색상 | 단위 |
|-----------|--------|------|------|------|------|
| TRAFFIC_IN_BPS | PERF_NETWORK_T | IN_BPS | Traffic IN (bps) | #06b6d4 | bps |
| TRAFFIC_IN_PKT | PERF_NETWORK_T | IN_PKT | Traffic IN (pkt) | #0891b2 | pkt/s |
| TRAFFIC_IN_ERR | PERF_NETWORK_T | IN_ERR | Traffic IN (err) | #0e7490 | err/s |
| TRAFFIC_OUT_BPS | PERF_NETWORK_T | OUT_BPS | Traffic OUT (bps) | #22d3ee | bps |
| TRAFFIC_OUT_PKT | PERF_NETWORK_T | OUT_PKT | Traffic OUT (pkt) | #67e8f9 | pkt/s |
| TRAFFIC_OUT_BYTE | PERF_NETWORK_T | OUT_BYTE | Traffic OUT (byte) | #a5f3fc | byte/s |

---

## 5. ICMP 그룹

### group 값
```
"ICMP"
```

### elements 가능한 값
```json
[
  "ICMP_MIN",
  "ICMP_MAX",
  "ICMP_AVG",
  "ICMP_LOSS"
]
```

### 예시 CONFIG

#### Pie Chart
```json
{
  "group": "ICMP",
  "elements": ["ICMP_AVG", "ICMP_LOSS"],
  "chartType": "pie"
}
```

#### Bar Chart
```json
{
  "group": "ICMP",
  "elements": ["ICMP_MIN", "ICMP_MAX", "ICMP_AVG"],
  "chartType": "bar"
}
```

#### Line Chart
```json
{
  "group": "ICMP",
  "elements": ["ICMP_AVG", "ICMP_LOSS"],
  "chartType": "line"
}
```

### 백엔드 매핑 정보

| elementId | 테이블 | 컬럼 | 이름 | 색상 | 단위 |
|-----------|--------|------|------|------|------|
| ICMP_MIN | PERF_ICMP_T | ICMP_MIN | ICMP Min | #6366f1 | ms |
| ICMP_MAX | PERF_ICMP_T | ICMP_MAX | ICMP Max | #818cf8 | ms |
| ICMP_AVG | PERF_ICMP_T | ICMP_AVG | ICMP Avg | #a5b4fc | ms |
| ICMP_LOSS | PERF_ICMP_T | ICMP_LOSS | ICMP Loss | #c7d2fe | % |

---

## chartType 가능한 값

```
"pie"    - 파이 차트 (Top 10까지만 표출)
"bar"    - 막대 차트 (Top 10까지만 표출)
"line"   - 선 그래프 (시계열, Top 10까지만 표출)
```

**📊 모든 차트 타입은 Top 10 장비/항목까지만 표시됩니다.**

---

## 전체 요소 목록 (알파벳 순)

총 **19개 요소**

| elementId | 그룹 | 테이블 | 컬럼 | 단위 |
|-----------|------|--------|------|------|
| CPU | CPU_MEM | PERF_CPU_T | CPU_USAGE | % |
| DISK_READ | FILE | PERF_DISK_T | DISK_READ_RATE | MB/s |
| DISK_WRITE | FILE | PERF_DISK_T | DISK_WRITE_RATE | MB/s |
| FILESYSTEM | FILE | PERF_FILESYSTEM_T | FS_USAGE | % |
| ICMP_AVG | ICMP | PERF_ICMP_T | ICMP_AVG | ms |
| ICMP_LOSS | ICMP | PERF_ICMP_T | ICMP_LOSS | % |
| ICMP_MAX | ICMP | PERF_ICMP_T | ICMP_MAX | ms |
| ICMP_MIN | ICMP | PERF_ICMP_T | ICMP_MIN | ms |
| MEMORY | CPU_MEM | PERF_MEMORY_T | MEM_USAGE | % |
| PROCESS_COUNT | PROCESS | PERF_PROCESS_T | PROCESS_COUNT | 개 |
| PROCESS_CPU | PROCESS | PERF_PROCESS_T | PROCESS_CPU_USAGE | % |
| PROCESS_MEM | PROCESS | PERF_PROCESS_T | PROCESS_MEM_USAGE | % |
| TRAFFIC_IN_BPS | TRAFFIC | PERF_NETWORK_T | IN_BPS | bps |
| TRAFFIC_IN_ERR | TRAFFIC | PERF_NETWORK_T | IN_ERR | err/s |
| TRAFFIC_IN_PKT | TRAFFIC | PERF_NETWORK_T | IN_PKT | pkt/s |
| TRAFFIC_OUT_BPS | TRAFFIC | PERF_NETWORK_T | OUT_BPS | bps |
| TRAFFIC_OUT_BYTE | TRAFFIC | PERF_NETWORK_T | OUT_BYTE | byte/s |
| TRAFFIC_OUT_PKT | TRAFFIC | PERF_NETWORK_T | OUT_PKT | pkt/s |

---

## 실제 사용 예시 모음

### 예시 1: CPU 모니터링 (Pie) - Top 10 표출
```json
{
  "group": "CPU_MEM",
  "elements": ["CPU"],
  "chartType": "pie"
}
```

### 예시 2: 파일시스템과 디스크 I/O (Bar)
```json
{
  "group": "FILE",
  "elements": ["FILESYSTEM", "DISK_READ", "DISK_WRITE"],
  "chartType": "bar"
}
```

### 예시 3: 트래픽 In/Out 추이 (Line)
```json
{
  "group": "TRAFFIC",
  "elements": ["TRAFFIC_IN_BPS", "TRAFFIC_OUT_BPS"],
  "chartType": "line"
}
```

### 예시 4: ICMP 응답 시간 모니터링 (Line)
```json
{
  "group": "ICMP",
  "elements": ["ICMP_MIN", "ICMP_MAX", "ICMP_AVG"],
  "chartType": "line"
}
```

### 예시 5: 프로세스 리소스 사용량 (Bar)
```json
{
  "group": "PROCESS",
  "elements": ["PROCESS_CPU", "PROCESS_MEM"],
  "chartType": "bar"
}
```

### 예시 6: 트래픽 에러율 (Pie)
```json
{
  "group": "TRAFFIC",
  "elements": ["TRAFFIC_IN_ERR", "TRAFFIC_OUT_BPS"],
  "chartType": "pie"
}
```

---

## 백엔드 구현 시 주의사항

### 1. group 값 검증
```java
// 허용된 group 목록
Set<String> ALLOWED_GROUPS = Set.of(
    "CPU_MEM",
    "FILE",
    "PROCESS",
    "TRAFFIC",
    "ICMP"
);

if (!ALLOWED_GROUPS.contains(config.getGroup())) {
    throw new InvalidConfigException("유효하지 않은 group: " + config.getGroup());
}
```

### 2. elements 값 검증
```java
// 각 group별 허용된 elements 검증
Map<String, Set<String>> GROUP_ELEMENTS = Map.of(
    "CPU_MEM", Set.of("CPU", "MEMORY"),
    "FILE", Set.of("FILESYSTEM", "DISK_READ", "DISK_WRITE"),
    "PROCESS", Set.of("PROCESS_COUNT", "PROCESS_CPU", "PROCESS_MEM"),
    "TRAFFIC", Set.of("TRAFFIC_IN_BPS", "TRAFFIC_IN_PKT", "TRAFFIC_IN_ERR",
                      "TRAFFIC_OUT_BPS", "TRAFFIC_OUT_PKT", "TRAFFIC_OUT_BYTE"),
    "ICMP", Set.of("ICMP_MIN", "ICMP_MAX", "ICMP_AVG", "ICMP_LOSS")
);

Set<String> allowedElements = GROUP_ELEMENTS.get(config.getGroup());
for (String element : config.getElements()) {
    if (!allowedElements.contains(element)) {
        throw new InvalidConfigException(
            "group " + config.getGroup() + "에 유효하지 않은 element: " + element
        );
    }
}
```

### 3. chartType 값 검증
```java
Set<String> ALLOWED_CHART_TYPES = Set.of("pie", "bar", "line");

if (!ALLOWED_CHART_TYPES.contains(config.getChartType())) {
    throw new InvalidConfigException("유효하지 않은 chartType: " + config.getChartType());
}
```

### 4. elements 개수 제한 및 CPU_MEM 그룹 검증
```java
// CPU_MEM 그룹은 1개만 허용
if ("CPU_MEM".equals(config.getGroup())) {
    if (config.getElements().size() != 1) {
        throw new InvalidConfigException(
            "CPU_MEM 그룹은 CPU 또는 MEMORY 중 하나만 선택해야 합니다"
        );
    }
}

// 일반 검증: 최소 1개, 최대 6개
if (config.getElements().isEmpty()) {
    throw new InvalidConfigException("elements는 최소 1개 이상이어야 합니다");
}
if (config.getElements().size() > 6) {
    throw new InvalidConfigException("elements는 최대 6개까지 선택 가능합니다");
}
```

---

## 테스트용 샘플 CONFIG

백엔드 테스트 시 사용할 수 있는 다양한 CONFIG 샘플:

```java
// 샘플 1: CPU/Memory 파이 차트
String config1 = "{\"group\":\"CPU_MEM\",\"elements\":[\"CPU\",\"MEMORY\"],\"chartType\":\"pie\"}";

// 샘플 2: 파일시스템 막대 차트
String config2 = "{\"group\":\"FILE\",\"elements\":[\"FILESYSTEM\",\"DISK_READ\",\"DISK_WRITE\"],\"chartType\":\"bar\"}";

// 샘플 3: 트래픽 선 그래프
String config3 = "{\"group\":\"TRAFFIC\",\"elements\":[\"TRAFFIC_IN_BPS\",\"TRAFFIC_OUT_BPS\"],\"chartType\":\"line\"}";

// 샘플 4: ICMP 막대 차트
String config4 = "{\"group\":\"ICMP\",\"elements\":[\"ICMP_MIN\",\"ICMP_MAX\",\"ICMP_AVG\"],\"chartType\":\"bar\"}";

// 샘플 5: 프로세스 파이 차트
String config5 = "{\"group\":\"PROCESS\",\"elements\":[\"PROCESS_CPU\",\"PROCESS_MEM\"],\"chartType\":\"pie\"}";

// 샘플 6: 트래픽 에러 포함 (사용자 제공 예시)
String config6 = "{\"group\":\"TRAFFIC\",\"elements\":[\"TRAFFIC_OUT_BPS\",\"TRAFFIC_IN_ERR\"],\"chartType\":\"pie\"}";
```

---

## 데이터베이스 테이블 요약

백엔드에서 접근해야 할 테이블 목록:

| 테이블명 | 관련 요소 | 주요 컬럼 |
|---------|----------|----------|
| PERF_CPU_T | CPU | CPU_USAGE, TIMESTAMP |
| PERF_MEMORY_T | MEMORY | MEM_USAGE, TIMESTAMP |
| PERF_FILESYSTEM_T | FILESYSTEM | FS_USAGE, TIMESTAMP |
| PERF_DISK_T | DISK_READ, DISK_WRITE | DISK_READ_RATE, DISK_WRITE_RATE, TIMESTAMP |
| PERF_PROCESS_T | PROCESS_* | PROCESS_COUNT, PROCESS_CPU_USAGE, PROCESS_MEM_USAGE, TIMESTAMP |
| PERF_NETWORK_T | TRAFFIC_* | IN_BPS, IN_PKT, IN_ERR, OUT_BPS, OUT_PKT, OUT_BYTE, TIMESTAMP |
| PERF_ICMP_T | ICMP_* | ICMP_MIN, ICMP_MAX, ICMP_AVG, ICMP_LOSS, TIMESTAMP |

**모든 테이블에 TIMESTAMP 컬럼 필수!**

---

## 빠른 참조표

### Group별 요소 선택 규칙
- CPU_MEM: **1개만 선택 가능** ⚠️ (CPU 또는 MEMORY 중 택 1)
- FILE: 최대 3개
- PROCESS: 최대 3개
- TRAFFIC: 최대 6개 ⭐
- ICMP: 최대 4개

### 차트 표시 제한
- **모든 차트 타입: Top 10까지만 표출**

### 색상 팔레트
- 파란색 계열: CPU, MEMORY, TRAFFIC_IN_*
- 빨간색 계열: FILESYSTEM, DISK_*
- 초록색 계열: PROCESS_*
- 청록색 계열: TRAFFIC_OUT_*
- 보라색 계열: ICMP_*
