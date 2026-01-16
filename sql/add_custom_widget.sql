-- ==========================================
-- 사용자 정의 위젯만 추가하는 SQL
-- ==========================================

-- 이미 CUSTOM 위젯이 있는지 확인
SELECT * FROM r_widget_t WHERE WIDGET_CODE = 'CUSTOM';

-- CUSTOM 위젯이 없으면 아래 쿼리 실행
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
) VALUES (
    'CUSTOM',
    '사용자 정의',
    'bi-sliders',
    'custom',
    2,
    1,
    1,
    1,
    1
);

-- 결과 확인
SELECT
    WIDGET_ID,
    WIDGET_CODE,
    NAME,
    ICON,
    CATEGORY,
    DEFAULT_W,
    DEFAULT_H,
    IS_ACTIVE,
    CREATED_AT
FROM r_widget_t
WHERE WIDGET_CODE = 'CUSTOM';
