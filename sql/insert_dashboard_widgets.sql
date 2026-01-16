-- ==========================================
-- 대시보드 위젯 데이터 INSERT SQL
-- ==========================================

-- 1. 위젯 마스터 테이블 (R_WIDGET_T)
-- 사용 가능한 모든 위젯 타입 정의

-- 기존 데이터 삭제 (필요시 주석 해제)
-- DELETE FROM R_WIDGET_T;
-- ALTER TABLE R_WIDGET_T AUTO_INCREMENT = 1;

-- 위젯 마스터 데이터 INSERT
INSERT INTO r_widget_t (
    WIDGET_CODE,
    NAME,
    ICON,
    CATEGORY,
    DEFAULT_W,
    DEFAULT_H,
    MIN_W,
    MIN_H,
    IS_ACTIVE
) VALUES
('TOPOLOGY', '토폴로지 Map', 'bi-diagram-3', 'network', 2, 2, 1, 1, 1),
('CPU_MEM_TOPN', 'CPU/MEM TOPN', 'bi-cpu', 'chart', 1, 1, 1, 1, 1),
('TRAFFIC_TOPN', 'Traffic IN/OUT TOPN', 'bi-bar-chart', 'chart', 1, 1, 1, 1, 1),
('ALERT_LIST', '알람 리스트', 'bi-bell', 'monitoring', 2, 1, 1, 1, 1),
('FILESYSTEM_TOPN', '파일시스템 TOPN', 'bi-pie-chart', 'chart', 1, 1, 1, 1, 1),
('TRAFFIC_TREND', 'Traffic IN/OUT 추이', 'bi-graph-up', 'chart', 2, 1, 1, 1, 1),
('CUSTOM', '사용자 정의', 'bi-sliders', 'custom', 2, 1, 1, 1, 1);


-- 2. 기본 대시보드 위젯 테이블 (R_DEFAULT_DASHBOARD_WIDGET_T)
-- 모든 사용자에게 기본으로 보여질 대시보드 레이아웃

-- 방법 1: WIDGET_CODE로 자동 매칭 (권장)
INSERT INTO r_default_dashboard_widget_t (WIDGET_ID, TITLE, POS_X, POS_Y, WIDTH, HEIGHT, SORT_ORDER, CONFIG)
SELECT WIDGET_ID, '토폴로지 Map', 0, 0, 2, 2, 0, '{}' FROM r_widget_t WHERE WIDGET_CODE = 'TOPOLOGY'
UNION ALL
SELECT WIDGET_ID, 'CPU/MEM TOPN', 2, 0, 1, 1, 1, '{"chartType":"bar","limit":5}' FROM r_widget_t WHERE WIDGET_CODE = 'CPU_MEM_TOPN'
UNION ALL
SELECT WIDGET_ID, 'Traffic IN/OUT TOPN', 3, 0, 1, 1, 2, '{"chartType":"bar","limit":5}' FROM r_widget_t WHERE WIDGET_CODE = 'TRAFFIC_TOPN'
UNION ALL
SELECT WIDGET_ID, '알람 리스트', 0, 2, 2, 1, 3, '{"limit":10}' FROM r_widget_t WHERE WIDGET_CODE = 'ALERT_LIST'
UNION ALL
SELECT WIDGET_ID, '파일시스템 TOPN', 2, 1, 1, 1, 4, '{"chartType":"bar","limit":5}' FROM r_widget_t WHERE WIDGET_CODE = 'FILESYSTEM_TOPN'
UNION ALL
SELECT WIDGET_ID, 'Traffic IN/OUT 추이', 0, 3, 2, 1, 5, '{"timeRange":"1h","refreshInterval":30}' FROM r_widget_t WHERE WIDGET_CODE = 'TRAFFIC_TREND';


-- 방법 2: WIDGET_ID를 직접 지정 (WIDGET_ID를 알고 있을 때만 사용)
-- 주의: 위 r_widget_t INSERT 후 생성된 실제 WIDGET_ID로 변경 필요
/*
INSERT INTO r_default_dashboard_widget_t (
    WIDGET_ID, TITLE, POS_X, POS_Y, WIDTH, HEIGHT, SORT_ORDER, CONFIG
) VALUES
(1, '토폴로지 Map', 0, 0, 2, 2, 0, '{}'),
(2, 'CPU/MEM TOPN', 2, 0, 1, 1, 1, '{"chartType":"bar","limit":5}'),
(3, 'Traffic IN/OUT TOPN', 3, 0, 1, 1, 2, '{"chartType":"bar","limit":5}'),
(4, '알람 리스트', 0, 2, 2, 1, 3, '{"limit":10}'),
(5, '파일시스템 TOPN', 2, 1, 1, 1, 4, '{"chartType":"bar","limit":5}'),
(6, 'Traffic IN/OUT 추이', 0, 3, 2, 1, 5, '{"timeRange":"1h","refreshInterval":30}');
*/


-- ==========================================
-- 확인 쿼리
-- ==========================================

-- 위젯 마스터 확인
SELECT
    WIDGET_ID,
    WIDGET_CODE,
    NAME,
    ICON,
    CATEGORY,
    DEFAULT_W,
    DEFAULT_H,
    MIN_W,
    MIN_H,
    IS_ACTIVE,
    CREATED_AT
FROM r_widget_t
ORDER BY WIDGET_ID;

-- 기본 대시보드 위젯 확인
SELECT
    d.DEFAULT_DASHBOARD_WIDGET_ID,
    d.WIDGET_ID,
    w.WIDGET_CODE,
    w.NAME,
    d.TITLE,
    d.POS_X,
    d.POS_Y,
    d.WIDTH,
    d.HEIGHT,
    d.SORT_ORDER,
    d.CONFIG
FROM r_default_dashboard_widget_t d
JOIN r_widget_t w ON d.WIDGET_ID = w.WIDGET_ID
ORDER BY d.SORT_ORDER;
