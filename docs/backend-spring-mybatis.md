# MyBatis 사용 시 구현 방법

JPA 대신 MyBatis를 사용하는 경우의 구현 예시

---

## 1. Mapper 인터페이스

### UserDashboardWidgetMapper.java

```java
package com.example.nms.mapper;

import com.example.nms.entity.UserDashboardWidget;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;

@Mapper
public interface UserDashboardWidgetMapper {

    /**
     * 위젯 조회
     */
    Optional<UserDashboardWidget> findById(@Param("userDashboardWidgetId") Long userDashboardWidgetId);
}
```

### MonitoringDataMapper.java

```java
package com.example.nms.mapper;

import com.example.nms.dto.TimeSeriesPointDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface MonitoringDataMapper {

    /**
     * 현재 값 조회 (동적 SQL)
     */
    Double getCurrentValue(Map<String, Object> params);

    /**
     * 시계열 데이터 조회 (동적 SQL)
     */
    List<TimeSeriesPointDTO> getTimeSeriesData(Map<String, Object> params);
}
```

---

## 2. MyBatis XML Mapper

### UserDashboardWidgetMapper.xml

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.nms.mapper.UserDashboardWidgetMapper">

    <resultMap id="UserDashboardWidgetResultMap" type="com.example.nms.entity.UserDashboardWidget">
        <id property="userDashboardWidgetId" column="USER_DASHBOARD_WIDGET_ID"/>
        <result property="userId" column="USER_ID"/>
        <result property="widgetId" column="WIDGET_ID"/>
        <result property="title" column="TITLE"/>
        <result property="config" column="CONFIG"/>
        <result property="posX" column="POS_X"/>
        <result property="posY" column="POS_Y"/>
        <result property="width" column="WIDTH"/>
        <result property="height" column="HEIGHT"/>
        <result property="sortOrder" column="SORT_ORDER"/>
    </resultMap>

    <select id="findById" resultMap="UserDashboardWidgetResultMap">
        SELECT
            USER_DASHBOARD_WIDGET_ID,
            USER_ID,
            WIDGET_ID,
            TITLE,
            CONFIG,
            POS_X,
            POS_Y,
            WIDTH,
            HEIGHT,
            SORT_ORDER
        FROM R_USER_DASHBOARD_WIDGET_T
        WHERE USER_DASHBOARD_WIDGET_ID = #{userDashboardWidgetId}
    </select>

</mapper>
```

### MonitoringDataMapper.xml

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.nms.mapper.MonitoringDataMapper">

    <!-- 현재 값 조회 (동적 SQL) -->
    <select id="getCurrentValue" parameterType="map" resultType="double">
        SELECT ${aggregation}(${columnName}) as value
        FROM ${tableName}
        WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    </select>

    <!-- 시계열 데이터 조회 (동적 SQL) -->
    <select id="getTimeSeriesData" parameterType="map" resultType="com.example.nms.dto.TimeSeriesPointDTO">
        SELECT
            STR_TO_DATE(
                DATE_FORMAT(TIMESTAMP, '%Y-%m-%dT%H:%i:00'),
                '%Y-%m-%dT%H:%i:%s'
            ) as timestamp,
            ${aggregation}(${columnName}) as value
        FROM ${tableName}
        WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY DATE_FORMAT(TIMESTAMP, '%Y-%m-%d %H:%i')
        ORDER BY timestamp ASC
    </select>

</mapper>
```

---

## 3. Repository 구현 (MyBatis)

### MonitoringDataRepositoryImpl.java

```java
package com.example.nms.repository;

import com.example.nms.dto.TimeSeriesPointDTO;
import com.example.nms.mapper.MonitoringDataMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Repository
@RequiredArgsConstructor
public class MonitoringDataRepositoryImpl implements MonitoringDataRepository {

    private final MonitoringDataMapper monitoringDataMapper;

    @Override
    public Double getCurrentValue(String tableName, String columnName, String aggregation) {
        Map<String, Object> params = new HashMap<>();
        params.put("tableName", tableName);
        params.put("columnName", columnName);
        params.put("aggregation", aggregation);

        log.debug("현재 값 조회: table={}, column={}, aggregation={}",
                tableName, columnName, aggregation);

        try {
            Double value = monitoringDataMapper.getCurrentValue(params);
            return value != null ? value : 0.0;
        } catch (Exception e) {
            log.error("현재 값 조회 실패", e);
            return 0.0;
        }
    }

    @Override
    public List<TimeSeriesPointDTO> getTimeSeriesData(String tableName, String columnName, String aggregation) {
        Map<String, Object> params = new HashMap<>();
        params.put("tableName", tableName);
        params.put("columnName", columnName);
        params.put("aggregation", aggregation);

        log.debug("시계열 데이터 조회: table={}, column={}, aggregation={}",
                tableName, columnName, aggregation);

        try {
            return monitoringDataMapper.getTimeSeriesData(params);
        } catch (Exception e) {
            log.error("시계열 데이터 조회 실패", e);
            return List.of();
        }
    }
}
```

---

## 4. Service 구현 (MyBatis 버전)

### WidgetDataServiceImpl.java

```java
package com.example.nms.service.impl;

import com.example.nms.config.MonitoringElementConfig;
import com.example.nms.dto.*;
import com.example.nms.entity.UserDashboardWidget;
import com.example.nms.exception.WidgetNotFoundException;
import com.example.nms.mapper.UserDashboardWidgetMapper;
import com.example.nms.repository.MonitoringDataRepository;
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

    private final UserDashboardWidgetMapper widgetMapper;
    private final MonitoringDataRepository monitoringDataRepository;
    private final MonitoringElementConfig elementConfig;
    private final ObjectMapper objectMapper;

    @Override
    public WidgetDataResponse getWidgetData(Long userDashboardWidgetId) {
        try {
            // 1. 위젯 정보 조회
            UserDashboardWidget widget = widgetMapper.findById(userDashboardWidgetId)
                    .orElseThrow(() -> new WidgetNotFoundException(
                            "위젯을 찾을 수 없습니다: " + userDashboardWidgetId));

            log.info("위젯 조회 성공: {}", widget);

            // 2. CONFIG 파싱
            WidgetConfigDTO config = parseConfig(widget.getConfig());
            log.info("CONFIG 파싱 완료: {}", config);

            // 3. 차트 데이터 생성
            List<ChartDataDTO> chartData;

            if ("line".equals(config.getChartType())) {
                chartData = getTimeSeriesData(config.getElements());
            } else {
                chartData = getCurrentValues(config.getElements());
            }

            // 4. 성공 응답
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

    private WidgetConfigDTO parseConfig(String configJson) {
        try {
            return objectMapper.readValue(configJson, WidgetConfigDTO.class);
        } catch (Exception e) {
            log.error("CONFIG 파싱 실패: {}", configJson, e);
            throw new RuntimeException("위젯 설정이 올바르지 않습니다", e);
        }
    }

    private List<ChartDataDTO> getCurrentValues(List<String> elements) {
        List<ChartDataDTO> chartData = new ArrayList<>();

        for (String elementId : elements) {
            MonitoringElementConfig.ElementMetadata meta = elementConfig.getElement(elementId);

            if (meta == null) {
                log.warn("알 수 없는 모니터링 요소: {}", elementId);
                continue;
            }

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

    private List<ChartDataDTO> getTimeSeriesData(List<String> elements) {
        List<ChartDataDTO> chartData = new ArrayList<>();

        for (String elementId : elements) {
            MonitoringElementConfig.ElementMetadata meta = elementConfig.getElement(elementId);

            if (meta == null) {
                log.warn("알 수 없는 모니터링 요소: {}", elementId);
                continue;
            }

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

## 5. application.yml (MyBatis 설정)

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/nms_db?useSSL=false&serverTimezone=UTC
    username: your_username
    password: your_password
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5

mybatis:
  mapper-locations: classpath:mapper/**/*.xml
  type-aliases-package: com.example.nms.entity, com.example.nms.dto
  configuration:
    map-underscore-to-camel-case: true
    default-fetch-size: 100
    default-statement-timeout: 30
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl

logging:
  level:
    com.example.nms: DEBUG
    com.example.nms.mapper: TRACE
```

---

## 6. pom.xml (MyBatis 의존성)

```xml
<dependencies>
    <!-- Spring Boot Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- MyBatis Spring Boot Starter -->
    <dependency>
        <groupId>org.mybatis.spring.boot</groupId>
        <artifactId>mybatis-spring-boot-starter</artifactId>
        <version>3.0.3</version>
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

    <!-- Jackson -->
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

## 7. 디렉토리 구조

```
src/main/
├── java/com/example/nms/
│   ├── controller/
│   │   └── WidgetDataController.java
│   ├── service/
│   │   ├── WidgetDataService.java
│   │   └── impl/
│   │       └── WidgetDataServiceImpl.java
│   ├── repository/
│   │   ├── MonitoringDataRepository.java
│   │   └── MonitoringDataRepositoryImpl.java
│   ├── mapper/
│   │   ├── UserDashboardWidgetMapper.java
│   │   └── MonitoringDataMapper.java
│   ├── dto/
│   │   ├── WidgetDataResponse.java
│   │   ├── ChartDataDTO.java
│   │   ├── TimeSeriesPointDTO.java
│   │   └── WidgetConfigDTO.java
│   ├── entity/
│   │   └── UserDashboardWidget.java
│   ├── config/
│   │   └── MonitoringElementConfig.java
│   └── exception/
│       └── WidgetNotFoundException.java
└── resources/
    ├── mapper/
    │   ├── UserDashboardWidgetMapper.xml
    │   └── MonitoringDataMapper.xml
    └── application.yml
```

---

## 8. 주의사항 (MyBatis 동적 SQL)

### ⚠️ SQL Injection 방지

MyBatis에서 `${}` 사용 시 SQL Injection 위험이 있으므로, 테이블명/컬럼명을 화이트리스트로 검증해야 합니다.

```java
// MonitoringElementConfig에서 검증
public ElementMetadata getElement(String elementId) {
    ElementMetadata meta = elements.get(elementId);
    if (meta == null) {
        throw new IllegalArgumentException("유효하지 않은 element ID: " + elementId);
    }
    return meta;
}
```

### ✅ 안전한 동적 SQL 사용

```xml
<!-- ✅ 안전: 화이트리스트로 검증된 값만 사용 -->
<select id="getCurrentValue" parameterType="map" resultType="double">
    SELECT ${aggregation}(${columnName}) as value
    FROM ${tableName}
    WHERE TIMESTAMP >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
</select>

<!-- ❌ 위험: 사용자 입력을 직접 사용하면 안됨 -->
```

---

## 9. 성능 최적화 (캐싱)

### CacheConfig.java

```java
package com.example.nms.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(30))  // 30초 캐시
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
    }
}
```

### Service에 캐싱 적용

```java
@Service
@RequiredArgsConstructor
public class WidgetDataServiceImpl implements WidgetDataService {

    @Override
    @Cacheable(value = "widgetData", key = "#userDashboardWidgetId")
    public WidgetDataResponse getWidgetData(Long userDashboardWidgetId) {
        // ... 기존 로직
    }
}
```

---

## 10. 테스트 (MyBatis)

### WidgetDataServiceTest.java

```java
package com.example.nms.service;

import com.example.nms.dto.WidgetDataResponse;
import com.example.nms.entity.UserDashboardWidget;
import com.example.nms.mapper.UserDashboardWidgetMapper;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class WidgetDataServiceTest {

    @Autowired
    private WidgetDataService widgetDataService;

    @Test
    void 위젯_데이터_조회_테스트() {
        // Given
        Long widgetId = 90L;

        // When
        WidgetDataResponse response = widgetDataService.getWidgetData(widgetId);

        // Then
        assertTrue(response.isSuccess());
        assertNotNull(response.getData());
        assertNotNull(response.getData().getChartData());
    }
}
```

---

## 체크리스트

- [ ] MyBatis Mapper 인터페이스 생성
- [ ] XML Mapper 파일 작성
- [ ] Repository 구현
- [ ] Service 로직 구현
- [ ] MonitoringElementConfig 화이트리스트 검증
- [ ] SQL Injection 방지 확인
- [ ] 캐싱 설정 (선택사항)
- [ ] 테스트 코드 작성
- [ ] 로깅 설정
