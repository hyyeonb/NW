# app/ — 앱 부트스트랩

> 책임: 앱 진입점, providers 조합, router 설정, 글로벌 스타일.

## 구조
```
app/
├── App.jsx           # 최상위 컴포넌트 (provider 조합만)
├── main.jsx          # ReactDOM 렌더 entry
├── providers/        # QueryClient, Theme, Auth, Router 등 provider
├── router/           # React Router 설정 (lazy + guards + meta)
└── README.md
```

## 규칙
- 비즈니스 로직 금지. 오직 조립.
- ≤ 200줄 (App.jsx + main.jsx 합산)
- 새 provider 추가 시 ADR

## 의존
- providers는 `@features`, `@entities`, `@shared`, `@stores`에서 가져옴
- router는 `@pages`의 lazy import만

## Imports
- 다른 레이어에서 `@app`을 import하지 않는다.
