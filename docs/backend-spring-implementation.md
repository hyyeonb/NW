# Java Spring Boot 백엔드 구현 가이드

## 프로젝트 구조

```
src/main/java/com/example/nms/
├── controller/
│   └── WidgetDataController.java
├── service/
│   ├── WidgetDataService.java
│   └── impl/
│       └── WidgetDataServiceImpl.java
├── repository/
│   ├── UserDashboardWidgetRepository.java
│   └── MonitoringDataRepository.java
├── dto/
│   ├── WidgetDataResponse.java
│   ├── ChartDataDTO.java
│   └── TimeSeriesPointDTO.java
├── entity/
│   └── UserDashboardWidget.java
├── config/
│   └── MonitoringElementConfig.java
└── exception/
    └── WidgetNotFoundException.java
```

---

## 1. Controller

### WidgetDataController.java

```java
package com.example.nms.controller;

import com.example.nms.dto.WidgetDataResponse;
import com.example.nms.service.WidgetDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class WidgetDataController {

    private final WidgetDataService widgetDataService;

    /**
     * 위젯 차트 데이터 조회
     * GET /dashboard/widget-data/{userDashboardWidgetId}
     */
    @GetMapping("/widget-data/{userDashboardWidgetId}")
    public ResponseEntity<WidgetDataResponse> getWidgetData(
            @PathVariable Long userDashboardWidgetId) {

        log.info("위젯 데이터 조회 요청: userDashboardWidgetId={}", userDashboardWidgetId);

        WidgetDataResponse response = widgetDataService.getWidgetData(userDashboardWidgetId);

        return ResponseEntity.ok(response);
    }
}
```

---

## 2. DTO (Data Transfer Objects)

### WidgetDataResponse.java

```java
package com.example.nms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WidgetDataResponse {
    private boolean success;
    private WidgetData data;
    private ErrorInfo error;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WidgetData {
        private Long widgetId;
        private String chartType;
        private List<ChartDataDTO> chartData;
        private LocalDateTime lastUpdated;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorInfo {
        private String code;
        private String message;
    }

    // 성공 응답 생성
    public static WidgetDataResponse success(Long widgetId, String chartType,
                                            List<ChartDataDTO> chartData) {
        return WidgetDataResponse.builder()
                .success(true)
                .data(WidgetData.builder()
                        .widgetId(widgetId)
                        .chartType(chartType)
                        .chartData(chartData)
                        .lastUpdated(LocalDateTime.now())
                        .build())
                .build();
    }

    // 에러 응답 생성
    public static WidgetDataResponse error(String code, String message) {
        return WidgetDataResponse.builder()
                .success(false)
                .error(ErrorInfo.builder()
                        .code(code)
                        .message(message)
                        .build())
                .build();
    }
}
```

### ChartDataDTO.java

```java
package com.example.nms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChartDataDTO {
    private String elementId;       // "FILESYSTEM", "DISK_READ" 등
    private String name;            // "파일시스템 사용률"
    private Double value;           // 현재 값 (pie/bar 차트용)
    private String color;           // "#ef4444"
    private String unit;            // "%", "MB/s" 등
    private List<TimeSeriesPointDTO> points;  // 시계열 데이터 (line 차트용)
}
```

### TimeSeriesPointDTO.java

```java
package com.example.nms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeSeriesPointDTO {
    private LocalDateTime timestamp;
    private Double value;
}
```

### WidgetConfigDTO.java

```java
package com.example.nms.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WidgetConfigDTO {
    private String group;           // "FILE", "CPU_MEM", "TRAFFIC" 등
    private List<String> elements;  // ["FILESYSTEM", "DISK_READ"]
    private String chartType;       // "pie", "bar", "line"
}
```

---

## 3. Entity

### UserDashboardWidget.java

```java
package com.example.nms.entity;

import lombok.Data;
import javax.persistence.*;

@Data
@Entity
@Table(name = "R_USER_DASHBOARD_WIDGET_T")
public class UserDashboardWidget {

    @Id
    @Column(name = "USER_DASHBOARD_WIDGET_ID")
    private Long userDashboardWidgetId;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "WIDGET_ID")
    private Long widgetId;

    @Column(name = "TITLE")
    private String title;

    @Column(name = "CONFIG", columnDefinition = "TEXT")
    private String config;  // JSON 문자열

    @Column(name = "POS_X")
    private Integer posX;

    @Column(name = "POS_Y")
    private Integer posY;

    @Column(name = "WIDTH")
    private Integer width;

    @Column(name = "HEIGHT")
    private Integer height;

    @Column(name = "SORT_ORDER")
    private Integer sortOrder;
}
```

---

## 4. Config (모니터링 요소 설정)

### MonitoringElementConfig.java

```java
package com.example.nms.config;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

@Component
public class MonitoringElementConfig {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ElementMetadata {
        private String table;       // 테이블 명
        private String column;      // 컬럼 명
        private String name;        // 표시 이름
        private String color;       // 차트 색상
        private String unit;        // 단위
        private String aggregation; // AVG, MAX, MIN, SUM
    }

    private final Map<String, ElementMetadata> elements = new HashMap<>();

    public MonitoringElementConfig() {
        initializeElements();
    }

    private void initializeElements() {
        // CPU/Memory 그룹
        elements.put("CPU", ElementMetadata.builder()
                .table("PERF_CPU_T")
                .column("CPU_USAGE")
                .name("CPU 사용률")
                .color("#3b82f6")
                .unit("%")
                .aggregation("AVG")
                .build());

        elements.put("MEMORY", ElementMetadata.builder()
                .table("PERF_MEMORY_T")
                .column("MEM_USAGE")
                .name("Memory 사용률")
                .color("#8b5cf6")
                .unit("%")
                .aggregation("AVG")
                .build());

        // File System 그룹
        elements.put("FILESYSTEM", ElementMetadata.builder()
                .table("PERF_FILESYSTEM_T")
                .column("FS_USAGE")
                .name("파일시스템 사용률")
                .color("#ef4444")
                .unit("%")
                .aggregation("AVG")
                .build());

        elements.put("DISK_READ", ElementMetadata.builder()
                .table("PERF_DISK_T")
                .column("DISK_READ_RATE")
                .name("Disk Read")
                .color("#f97316")
                .unit("MB/s")
                .aggregation("AVG")
                .build());

        elements.put("DISK_WRITE", ElementMetadata.builder()
                .table("PERF_DISK_T")
                .column("DISK_WRITE_RATE")
                .name("Disk Write")
                .color("#fb923c")
                .unit("MB/s")
                .aggregation("AVG")
                .build());

        // Process 그룹
        elements.put("PROCESS_COUNT", ElementMetadata.builder()
                .table("PERF_PROCESS_T")
                .column("PROCESS_COUNT")
                .name("프로세스 수")
                .color("#10b981")
                .unit("개")
                .aggregation("AVG")
                .build());

        elements.put("PROCESS_CPU", ElementMetadata.builder()
                .table("PERF_PROCESS_T")
                .column("PROCESS_CPU_USAGE")
                .name("프로세스 CPU")
                .color("#22c55e")
                .unit("%")
                .aggregation("AVG")
                .build());

        elements.put("PROCESS_MEM", ElementMetadata.builder()
                .table("PERF_PROCESS_T")
                .column("PROCESS_MEM_USAGE")
                .name("프로세스 Memory")
                .color("#4ade80")
                .unit("%")
                .aggregation("AVG")
                .build());

        // Traffic 그룹
        elements.put("TRAFFIC_IN_BPS", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("IN_BPS")
                .name("Traffic IN (bps)")
                .color("#06b6d4")
                .unit("bps")
                .aggregation("AVG")
                .build());

        elements.put("TRAFFIC_IN_PKT", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("IN_PKT")
                .name("Traffic IN (pkt)")
                .color("#0891b2")
                .unit("pkt/s")
                .aggregation("AVG")
                .build());

        elements.put("TRAFFIC_IN_ERR", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("IN_ERR")
                .name("Traffic IN (err)")
                .color("#0e7490")
                .unit("err/s")
                .aggregation("AVG")
                .build());

        elements.put("TRAFFIC_OUT_BPS", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("OUT_BPS")
                .name("Traffic OUT (bps)")
                .color("#22d3ee")
                .unit("bps")
                .aggregation("AVG")
                .build());

        elements.put("TRAFFIC_OUT_PKT", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("OUT_PKT")
                .name("Traffic OUT (pkt)")
                .color("#67e8f9")
                .unit("pkt/s")
                .aggregation("AVG")
                .build());

        elements.put("TRAFFIC_OUT_BYTE", ElementMetadata.builder()
                .table("PERF_NETWORK_T")
                .column("OUT_BYTE")
                .name("Traffic OUT (byte)")
                .color("#a5f3fc")
                .unit("byte/s")
                .aggregation("AVG")
                .build());

        // ICMP 그룹
        elements.put("ICMP_MIN", ElementMetadata.builder()
                .table("PERF_ICMP_T")
                .column("ICMP_MIN")
                .name("ICMP Min")
                .color("#6366f1")
                .unit("ms")
                .aggregation("MIN")
                .build());

        elements.put("ICMP_MAX", ElementMetadata.builder()
                .table("PERF_ICMP_T")
                .column("ICMP_MAX")
                .name("ICMP Max")
                .color("#818cf8")
                .unit("ms")
                .aggregation("MAX")
                .build());

        elements.put("ICMP_AVG", ElementMetadata.builder()
                .table("PERF_ICMP_T")
                .column("ICMP_AVG")
                .name("ICMP Avg")
                .color("#a5b4fc")
                .unit("ms")
                .aggregation("AVG")
                .build());

        elements.put("ICMP_LOSS", ElementMetadata.builder()
                .table("PERF_ICMP_T")
                .column("ICMP_LOSS")
                .name("ICMP Loss")
                .color("#c7d2fe")
                .unit("%")
                .aggregation("AVG")
                .build());
    }

    public ElementMetadata getElement(String elementId) {
        return elements.get(elementId);
    }

    public boolean hasElement(String elementId) {
        return elements.containsKey(elementId);
    }
}
```

---

## 5. Service

### WidgetDataService.java (인터페이스)

```java
package com.example.nms.service;

import com.example.nms.dto.WidgetDataResponse;

public interface WidgetDataService {
    WidgetDataResponse getWidgetData(Long userDashboardWidgetId);
}
```

### WidgetDataServiceImpl.java

```java
package com.example.nms.service.impl;

import com.example.nms.config.MonitoringElementConfig;
import com.example.nms.dto.*;
import com.example.nms.entity.UserDashboardWidget;
import com.example.nms.exception.WidgetNotFoundException;
import com.example.nms.repository.MonitoringDataRepository;
import com.example.nms.repository.UserDashboardWidgetRepository;
import com.example.nms.service.WidgetDataService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WidgetDataServiceImpl implements WidgetDataService {

    private final UserDashboardWidgetRepository widgetRepository;
    private final MonitoringDataRepository monitoringDataRepository;
    private final MonitoringElementConfig elementConfig;
    private final ObjectMapper objectMapper;

    @Override
    public WidgetDataResponse getWidgetData(Long userDashboardWidgetId) {
        try {
            // 1. 위젯 정보 조회
            UserDashboardWidget widget = widgetRepository.findById(userDashboardWidgetId)
                    .orElseThrow(() -> new WidgetNotFoundException(
                            "위젯을 찾을 수 없습니다: " + userDashboardWidgetId));

            log.info("위젯 조회 성공: {}", widget);

            // 2. CONFIG 파싱
            WidgetConfigDTO config = parseConfig(widget.getConfig());
            log.info("CONFIG 파싱 완료: {}", config);

            // 3. 차트 데이터 생성
            List<ChartDataDTO> chartData;

            if ("line".equals(config.getChartType())) {
                // 시계열 데이터
                chartData = getTimeSeriesData(config.getElements());
            } else {
                // 현재 값 (pie, bar)
                chartData = getCurrentValues(config.getElements());
            }

            // 4. 성공 응답 반환
            return WidgetDataResponse.success(
                    userDashboardWidgetId,
                    config.getChartType(),
                    chartData
            );

        } catch (WidgetNotFoundException e) {
            log.error("위젯을 찾을 수 없음: {}", e.getMessage());
            return WidgetDataResponse.error("WIDGET_NOT_FOUND", e.getMessage());

        } catch (Exception e) {
            log.error("위젯 데이터 조회 실패", e);
            return WidgetDataResponse.error("INTERNAL_ERROR", "서버 오류가 발생했습니다");
        }
    }

    /**
     * CONFIG JSON 파싱
     */
    private WidgetConfigDTO parseConfig(String configJson) {
        try {
            return objectMapper.readValue(configJson, WidgetConfigDTO.class);
        } catch (Exception e) {
            log.error("CONFIG 파싱 실패: {}", configJson, e);
            throw new RuntimeException("위젯 설정이 올바르지 않습니다", e);
        }
    }

    /**
     * 현재 값 조회 (Pie/Bar Chart)
     */
    private List<ChartDataDTO> getCurrentValues(List<String> elements) {
        List<ChartDataDTO> chartData = new ArrayList<>();

        for (String elementId : elements) {
            MonitoringElementConfig.ElementMetadata meta = elementConfig.getElement(elementId);

            if (meta == null) {
                log.warn("알 수 없는 모니터링 요소: {}", elementId);
                continue;
            }

            // 최근 5분간 평균값 조회
            Double value = monitoringDataRepository.getCurrentValue(
                    meta.getTable(),
                    meta.getColumn(),
                    meta.getAggregation()
            );

            chartData.add(ChartDataDTO.builder()
                    .elementId(elementId)
                    .name(meta.getName())
                    .value(value != null ? Math.round(value * 100.0) / 100.0 : 0.0)
                    .color(meta.getColor())
                    .unit(meta.getUnit())
                    .build());
        }

        return chartData;
    }

    /**
     * 시계열 데이터 조회 (Line Chart)
     */
    private List<ChartDataDTO> getTimeSeriesData(List<String> elements) {
        List<ChartDataDTO> chartData = new ArrayList<>();

        for (String elementId : elements) {
            MonitoringElementConfig.ElementMetadata meta = elementConfig.getElement(elementId);

            if (meta == null) {
                log.warn("알 수 없는 모니터링 요소: {}", elementId);
                continue;
            }

            // 최근 1시간, 5분 간격 시계열 데이터 조회
            List<TimeSeriesPointDTO> points = monitoringDataRepository.getTimeSeriesData(
                    meta.getTable(),
                    meta.getColumn(),
                    meta.getAggregation()
            );

            chartData.add(ChartDataDTO.builder()
                    .elementId(elementId)
                    .name(meta.getName())
                    .color(meta.getColor())
                    .unit(meta.getUnit())
                    .points(points)
                    .build());
        }

        return chartData;
    }
}
```

---

## 6. Repository (JPA 방식)

### UserDashboardWidgetRepository.java

```java
package com.example.nms.repository;

import com.example.nms.entity.UserDashboardWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserDashboardWidgetRepository
        extends JpaRepository<UserDashboardWidget, Long> {
}
```

### MonitoringDataRepository.java

```java
package com.example.nms.repository;

import com.example.nms.dto.TimeSeriesPointDTO;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MonitoringDataRepository {

    /**
     * 현재 값 조회 (최근 5분간 평균/최대/최소)
     */
    Double getCurrentValue(String tableName, String columnName, String aggregation);

    /**
     * 시계열 데이터 조회 (최근 1시간, 5분 간격)
     */
    List<TimeSeriesPointDTO> getTimeSeriesData(String tableName, String columnName, String aggregation);
}
```

### MonitoringDataRepositoryImpl.java

```java
package com.example.nms.repository;

import com.example.nms.dto.TimeSeriesPointDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Slf4j
@Repository
@RequiredArgsConstructor
public class MonitoringDataRepositoryImpl implements MonitoringDataRepository {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Double getCurrentValue(String tableName, String columnName, String aggregation) {
        String sql = String.format(
                "SELECT %s(%s) as value " +
                "FROM %s " +
                "WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
                aggregation, columnName, tableName
        );

        log.debug("현재 값 조회 SQL: {}", sql);

        try {
            return jdbcTemplate.queryForObject(sql, Double.class);
        } catch (Exception e) {
            log.error("현재 값 조회 실패: table={}, column={}", tableName, columnName, e);
            return 0.0;
        }
    }

    @Override
    public List<TimeSeriesPointDTO> getTimeSeriesData(String tableName, String columnName, String aggregation) {
        String sql = String.format(
                "SELECT " +
                "  DATE_FORMAT(TIMESTAMP, '%%Y-%%m-%%dT%%H:%%i:00') as timestamp, " +
                "  %s(%s) as value " +
                "FROM %s " +
                "WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 1 HOUR) " +
                "GROUP BY DATE_FORMAT(TIMESTAMP, '%%Y-%%m-%%d %%H:%%i') " +
                "ORDER BY timestamp ASC",
                aggregation, columnName, tableName
        );

        log.debug("시계열 데이터 조회 SQL: {}", sql);

        try {
            return jdbcTemplate.query(sql, this::mapToTimeSeriesPoint);
        } catch (Exception e) {
            log.error("시계열 데이터 조회 실패: table={}, column={}", tableName, columnName, e);
            return List.of();
        }
    }

    private TimeSeriesPointDTO mapToTimeSeriesPoint(ResultSet rs, int rowNum) throws SQLException {
        return TimeSeriesPointDTO.builder()
                .timestamp(rs.getTimestamp("timestamp").toLocalDateTime())
                .value(Math.round(rs.getDouble("value") * 100.0) / 100.0)
                .build();
    }
}
```

---

## 7. Exception

### WidgetNotFoundException.java

```java
package com.example.nms.exception;

public class WidgetNotFoundException extends RuntimeException {
    public WidgetNotFoundException(String message) {
        super(message);
    }
}
```

---

## 8. application.yml 설정

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/nms_db?useSSL=false&serverTimezone=UTC
    username: your_username
    password: your_password
    driver-class-name: com.mysql.cj.jdbc.Driver

  jpa:
    hibernate:
      ddl-auto: none
    show-sql: true
    properties:
      hibernate:
        format_sql: true

logging:
  level:
    com.example.nms: DEBUG
    org.springframework.jdbc: DEBUG
```

---

## 9. 테스트 코드

### WidgetDataServiceTest.java

```java
package com.example.nms.service;

import com.example.nms.dto.WidgetDataResponse;
import com.example.nms.entity.UserDashboardWidget;
import com.example.nms.repository.UserDashboardWidgetRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class WidgetDataServiceTest {

    @Autowired
    private WidgetDataService widgetDataService;

    @Autowired
    private UserDashboardWidgetRepository widgetRepository;

    @Test
    void 위젯_데이터_조회_성공() {
        // Given
        UserDashboardWidget widget = new UserDashboardWidget();
        widget.setUserDashboardWidgetId(1L);
        widget.setWidgetId(28L);
        widget.setTitle("테스트 위젯");
        widget.setConfig("{\"group\":\"FILE\",\"elements\":[\"FILESYSTEM\",\"DISK_READ\"],\"chartType\":\"pie\"}");
        widgetRepository.save(widget);

        // When
        WidgetDataResponse response = widgetDataService.getWidgetData(1L);

        // Then
        assertTrue(response.isSuccess());
        assertNotNull(response.getData());
        assertEquals("pie", response.getData().getChartType());
        assertEquals(2, response.getData().getChartData().size());
    }

    @Test
    void 위젯_없음_에러() {
        // When
        WidgetDataResponse response = widgetDataService.getWidgetData(999L);

        // Then
        assertFalse(response.isSuccess());
        assertEquals("WIDGET_NOT_FOUND", response.getError().getCode());
    }
}
```

---

## 10. pom.xml 의존성

```xml
<dependencies>
    <!-- Spring Boot Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Spring Boot JPA -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- MySQL Driver -->
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>8.0.33</version>
    </dependency>

    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>

    <!-- Jackson (JSON 처리) -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>

    <!-- Spring Boot Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 11. 응답 예시

### 성공 응답 (Pie Chart)

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
        "unit": "%",
        "points": null
      },
      {
        "elementId": "DISK_READ",
        "name": "Disk Read",
        "value": 45.2,
        "color": "#f97316",
        "unit": "MB/s",
        "points": null
      }
    ],
    "lastUpdated": "2025-12-24T10:30:00"
  },
  "error": null
}
```

### 에러 응답

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WIDGET_NOT_FOUND",
    "message": "위젯을 찾을 수 없습니다: 90"
  }
}
```

---

## 12. 구현 체크리스트

- [ ] Entity 및 Repository 생성
- [ ] MonitoringElementConfig에 모든 모니터링 요소 등록
- [ ] Service 로직 구현
- [ ] Controller 엔드포인트 생성
- [ ] Exception Handler 추가
- [ ] 테스트 코드 작성
- [ ] 로깅 설정
- [ ] 성능 최적화 (필요시 캐싱)
- [ ] API 문서화 (Swagger)
