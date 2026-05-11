# shared/ — 무도메인 재사용 자산

> 책임: 어떤 도메인에도 속하지 않는 재사용 가능한 모든 것. UI, API, 유틸, 설정, 스타일.

## 구조
```
shared/
├── ui/        # 디자인 시스템 컴포넌트 (Button, Modal, DataTable, Skeleton, Toast 등)
├── api/       # axios 인스턴스, interceptor, 에러 변환
├── lib/       # 순수 유틸 함수 (formatTime, fmtBps, deepEqual)
├── hooks/     # 범용 훅 (useDebounce, useClickOutside, usePopper)
├── config/    # 환경 상수 (env vars, app constants)
└── styles/    # 글로벌 토큰 (CSS variables), reset, 글로벌 스타일
```

## 규칙
- 도메인 모델(Device, Group 등) 참조 금지
- 다른 레이어 참조 금지 (단방향: shared는 외부에 의존하지 않음)
- public API는 `index.js`에서 named export만

## 모듈 가이드

### ui/
- 디자인 토큰 기반 atomic 컴포넌트
- `Component/Component.jsx` + `Component/Component.module.css` + `Component/index.js`
- props는 generic. 도메인 prop 금지

### api/
- `client.js` — axios 인스턴스 + interceptor (401 처리, 에러 변환)
- 모든 HTTP 호출은 client.js를 통해

### lib/
- 순수 함수만. side-effect 금지
- 테스트 커버리지 90% 이상 의무

## Imports
- shared 내부에서 `@entities`, `@features` 등 import 금지
- 다른 레이어가 `@shared`로 import해서 사용
