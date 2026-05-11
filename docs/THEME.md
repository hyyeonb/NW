# 테마 시스템 (Light / Dark)

NMS 프론트엔드의 라이트/다크 모드 구현 가이드. 새 컴포넌트/페이지를 테마에 대응시킬 때 이 문서를 참고하세요.

---

## 1. 전체 구조

```
사용자 토글 (Sidebar)
   ↓
useThemeStore (zustand)
   ↓ setAttribute
<html data-theme="light"> 또는 <html data-theme="dark">
   ↓ CSS 토큰 바인딩
var(--theme-*) 변수 해석
   ↓
컴포넌트/페이지 스타일
```

테마 전환은 **CSS 토큰 스위칭**으로 이뤄집니다. `<html>`의 `data-theme` 속성이 바뀌면 `:root[data-theme="dark"]` 와 `:root[data-theme="light"]` 둘 중 해당하는 토큰 블록이 활성화되고, 모든 컴포넌트가 `var(--theme-*)`로 색상을 참조하므로 자동 전환.

---

## 2. 핵심 파일

### 2-1. 토큰 (CSS 변수)

| 파일 | 역할 |
|---|---|
| `src/styles/tokens/_theme.css` | **테마 토큰 단일 출처**. `--theme-*` 모든 변수 정의. `[data-theme="dark"]` / `[data-theme="light"]` 블록 각각 존재 |
| `src/styles/tokens/_colors.css` | 테마 무관 색상 (상태색 등) |
| `src/styles/tokens/_spacing.css` | 간격 |
| `src/styles/tokens/_typography.css` | 폰트 |
| `src/styles/tokens/_effects.css` | 그림자/블러 |

### 2-2. 상태 관리

- `src/stores/themeStore.js` — zustand 스토어
  - `theme`: `'light' | 'dark' | 'auto'`
  - `resolvedTheme`: `'light' | 'dark'` (auto 를 실제 값으로 해석)
  - `setTheme()`, `toggleTheme()`
  - 내부에서 `document.documentElement.setAttribute('data-theme', resolvedTheme)` 수행

### 2-3. 테마 토글 UI

- `src/components/Sidebar.jsx` — 세그먼트 컨트롤 (☀️ 라이트 / 🌙 다크)

### 2-4. 페이지별 라이트 전용 오버라이드

대부분의 기본 스타일은 다크 기준이고, 라이트 모드에서 **재배경/재색상이 필요한** 요소는 페이지별 `*-light.css` 파일에 몰아서 선언:

| 파일 | 대상 |
|---|---|
| `src/styles/dashboard-light.css` | 대시보드 위젯, 사이드바, 토글, 서머리 카드 |
| `src/styles/dashboard-responsive.css` | 사이드바 → 상단바 변환 등 (≤1024px) |
| `src/styles/topology-light.css` | 토폴로지 사이드바, 캔버스 배경 |
| `src/styles/realtime-performance-light.css` | 실시간 감시 LIVE 칩, 관제 중지 버튼, chart-disabled 등 |
| `src/styles/performance-test.css` 내부 `[data-theme^="light"]` 블록 | 성능통계 스냅샷 카드, 커스텀 날짜 입력 |
| `src/styles/performance-test-responsive.css` | 성능통계 PDF 모달 라이트 + overflow 가드 |
| `src/styles/fault-stats.css` 내부 | 장애 통계 패널 헤더, 상태 뱃지 |

**규칙**: 다크 기본 스타일 파일에는 `data-theme` 셀렉터를 쓰지 않고, 라이트 오버라이드가 필요한 건 별도 `-light.css`로 분리.

---

## 3. 사용 가능한 토큰

`_theme.css` 에 정의된 `--theme-*` 토큰군 (약 70+):

### 배경
- `--theme-bg-primary` 페이지 배경
- `--theme-bg-secondary` 섹션 배경
- `--theme-bg-tertiary` 패널 바디
- `--theme-bg-card` 카드 (투명 블러)
- `--theme-bg-elevated` 모달/드롭다운
- `--theme-bg-input`, `--theme-bg-hover`
- `--theme-bg-panel`, `--theme-bg-panel-solid`, `--theme-bg-panel-header`, `--theme-bg-panel-hover`
- `--theme-bg-table-row`, `--theme-bg-table-row-hover`, `--theme-bg-table-row-selected`

### 텍스트
- `--theme-text-primary` 주 본문
- `--theme-text-secondary` 본문
- `--theme-text-tertiary` 보조
- `--theme-text-muted`, `--theme-text-disabled`

### 보더
- `--theme-border-default`, `--theme-border-hover`
- `--theme-border-panel`, `--theme-border-input`, `--theme-border-subtle`

### 액센트 (브랜드)
- `--theme-accent-primary`, `--theme-accent-light`, `--theme-accent-lighter`, `--theme-accent-dark`
- `--theme-accent-bg` (액센트 톤 투명 배경)
- `--theme-accent-hover`

### 상태 (Level)
- `--theme-critical`, `--theme-critical-bg`, `--theme-critical-border`
- `--theme-major`, `--theme-minor`, `--theme-warning`
- `--theme-success`, `--theme-info`
- `--theme-danger`, `--theme-danger-bg`, `--theme-danger-border`

### 그림자
- `--theme-shadow-sm`, `--theme-shadow-md`, `--theme-shadow-lg`
- `--theme-shadow-accent` (액센트 컬러 글로우)

---

## 4. 다크/라이트 컬러 팔레트 개요

### 다크 모드 (`[data-theme="dark"]`)
- 페이지: `#0c0c14` 거의 검정 (약간 푸른톤)
- 카드: 반투명 어두운 레이어 + 블러
- 텍스트 주: `#f8fafc` 거의 흰색
- 액센트: 인디고 `#6366f1`

### 라이트 모드 (`[data-theme="light"]`) — "Hybrid Ops" 스타일
- 페이지: `#e8ecf1` 약간 회색 (눈 피로 감소)
- 카드: `#fbfcfd` 거의 흰색 (미세한 회색)
- 위젯 헤더: `#f0f3f7`
- 텍스트 주: `#0a0e17` 거의 검정 (가독성)
- 텍스트 보조: `#2d3748`
- 액센트: 로열블루 `#2563eb`
- 네비 배경: `#dde3ec` (페이지와 조화)

---

## 5. ECharts 테마 처리

ECharts는 Canvas 렌더링이라 CSS 변수가 적용 안 됨. JS 레벨에서 테마값을 별도 주입.

### 5-1. 헬퍼

`src/constants/chartTheme.js`:
```js
export function getChartTheme(resolvedTheme) {
  if (resolvedTheme?.startsWith('light')) return { /* 라이트 팔레트 */ };
  return { /* 다크 팔레트 */ };
}
```

반환값 예시:
- `textPrimary`, `textSecondary`, `textTertiary`, `textMuted`
- `tooltipBg`, `tooltipBorder`
- `axisLabel`, `axisLine`, `splitLine`

### 5-2. 사용 패턴

```jsx
import { useThemeStore } from '../stores/themeStore';
import { getChartTheme } from '../constants/chartTheme';

function MyChart() {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const chartTheme = getChartTheme(resolvedTheme);

  const option = useMemo(() => ({
    textStyle: { color: chartTheme.textPrimary },
    xAxis: { axisLabel: { color: chartTheme.axisLabel } },
    tooltip: { backgroundColor: chartTheme.tooltipBg },
    // ...
  }), [chartTheme]);

  return <SafeECharts option={option} />;
}
```

**주의**: `option`을 만드는 `useMemo` 의존성 배열에 `chartTheme` 또는 `resolvedTheme`을 반드시 포함. 안 그러면 테마 전환 시 차트가 옛 색으로 남음.

### 5-3. SafeECharts

`src/components/SafeECharts.jsx` 공통 래퍼. 내부에서 tooltip 기본값을 자동 주입:
- `appendToBody: true` (부모 `overflow: hidden` 탈출)
- `extraCssText: z-index: 9999`

모든 차트는 반드시 이 래퍼 경유.

---

## 6. 캔버스 기반 (ForceGraph 등)

ForceGraph2D는 ECharts처럼 Canvas라 CSS 변수 안 먹힘. `backgroundColor` prop을 `resolvedTheme` 기반 분기로 직접 지정:

```jsx
<ForceGraph2D
  backgroundColor={resolvedTheme === 'light' ? '#e8ecf1' : '#0f172a'}
  ...
/>
```

토폴로지 페이지 (`NetworkTopology.jsx`) 참고.

---

## 7. 새 컴포넌트에 테마 대응 붙이는 체크리스트

- [ ] 하드코딩된 색상 (`#fff`, `rgba(0,0,0,.5)` 등) **금지**. 반드시 `var(--theme-*)`
- [ ] 상태별 색상도 토큰 사용 (`var(--theme-critical)` 등)
- [ ] 텍스트 계층에 맞는 토큰 선택 (`primary` / `secondary` / `tertiary` / `muted`)
- [ ] 반투명 블러가 필요하면 `--theme-bg-panel` 계열 사용
- [ ] 차트/캔버스가 있으면 `useThemeStore` + `getChartTheme` + `SafeECharts` 패턴
- [ ] 라이트 모드에서 시각적 확인 (특히 그림자/테두리가 너무 약해지지 않는지)

---

## 8. 레거시 변수 매핑

일부 오래된 CSS는 `--bg-secondary`, `--text-primary` 같은 prefix 없는 변수를 썼음. 이런 곳은 해당 페이지의 `-light.css` 최상단에서 테마 토큰으로 매핑해서 호환 유지:

```css
html[data-theme^="light"] {
  --bg-secondary: var(--theme-bg-secondary);
  --text-primary: var(--theme-text-primary);
}
```

(예: `topology-light.css` 참고) 새 코드는 `--theme-*` 직접 사용 권장.

---

## 9. 알려진 주의사항

- **CSS 애니메이션 + 조건부 렌더링**: `animation: fadeIn`을 가진 요소가 테마 전환 시 unmount/remount 되면 매번 애니메이션 재생. 테마 무관하게 렌더 유지되도록 설계.
- **notMerge={false}**: ECharts 옵션 업데이트 시 notMerge=true면 매번 차트 완전 재생성 → 깜빡임. 테마만 바뀔 때는 false 유지.
- **React.memo**: 실시간 위젯은 반드시 `memo` + custom comparator 로 불필요 리렌더 방지.
- **테마 토큰 이름만 바꾸지 말 것**: `_theme.css` 변수명을 바꾸면 수십 개 CSS 파일이 연쇄 깨짐. 추가는 OK, 이름 변경은 전체 grep 후.

---

## 10. 관련 문서

- `frontend/docs/TOSS_DESIGN_SPEC.md` — Toss 스타일 디자인 가이드 (현재 라이트/다크 톤의 근거)
- `docs/design-system.md` (middleware repo) — 전체 디자인 시스템 요약
