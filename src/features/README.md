# features/ — 도메인 기능 (캡슐화)

> 책임: 사용자 행위 단위로 묶인 feature. 자족적, 캡슐화, public API 노출.

## 구조
```
features/
└── <feature>/
    ├── index.js               # public API (외부 import 진입점)
    ├── components/            # feature 전용 컴포넌트
    ├── hooks/                 # feature 전용 훅
    ├── services/              # 비즈니스 로직 + API 래핑
    ├── model/                 # 타입, 검증, 변환, 상수
    └── __tests__/             # 테스트
```

## Feature 후보 (마이그레이션 대상)
- `performance-explorer/` — 성능 감시 페이지의 도메인 로직
- `realtime-performance/` — 실시간 성능 감시
- `topology/` — 네트워크/사용자 토폴로지 공통
- `dashboard/` — 대시보드 위젯 시스템
- `asset-management/` — 자산 관리 CRUD
- `device-detail/` — 장비 상세 모달 + 탭
- `fault-monitoring/` — 장애 감시
- `chart/` — 차트 빌더 (CPU/MEM/Traffic/ICMP 공용)
- `permission/` — 권한 가드
- `theme/` — 다크/라이트 토글

## 규칙
- 1 feature = 1 폴더, 자족적
- public API는 `index.js`에서 named export
- feature 내부 구조는 캡슐화 (외부에서 `features/X/components/Y` 직접 import 금지)
- cross-feature 직접 import 금지 (shared/event 또는 store 경유)
- ≤ 7 직속 파일 (큰 feature는 sub-folder)

## public API 패턴
```js
// features/performance-explorer/index.js
export { PEDeviceCard } from './components/PEDeviceCard';
export { useDeviceCardData } from './hooks/useDeviceCardData';
// internal 모듈은 export 금지
```

## Imports
- features는 `@entities`, `@shared`, `@stores`만 import
- 다른 features import 금지
- pages가 features를 사용 (조립)
