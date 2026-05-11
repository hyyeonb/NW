# entities/ — 핵심 도메인 모델

> 책임: 비즈니스 도메인의 핵심 entity 정의. 모델 + API + 표시 atom.

## 구조
```
entities/
└── <entity>/                  # device, group, metric, user 등
    ├── index.js               # public API
    ├── model.js               # 타입 정의(JSDoc), 직렬화/역직렬화
    ├── api.js                 # entity 단위 API 호출
    ├── queryKeys.js           # React Query queryKey factory
    └── ui/                    # entity 표시 atom (DeviceBadge, GroupChip 등)
```

## 도메인 entity (예정)
- `device/` — 장비 (Device, DeviceMetric)
- `group/` — 그룹 (Group, WatchGroup)
- `metric/` — 메트릭 (CpuMem, Traffic, Icmp)
- `user/` — 사용자 + 권한
- `fault/` — 장애 (Error)

## 규칙
- entity 1개 = 폴더 1개
- features에서 import해서 사용
- 다른 entity import 금지 (entity는 독립)

## queryKeys 컨벤션
```js
// entities/device/queryKeys.js
export const deviceKeys = {
  all: ['devices'],
  byGroup: (groupId) => ['devices', 'byGroup', groupId],
  detail: (deviceId) => ['devices', 'detail', deviceId],
  metrics: (deviceId, range) => ['devices', 'metrics', deviceId, range],
};
```

## Imports
- entities는 `@shared`만 import
- 다른 entity, features, pages, app 모두 import 금지
