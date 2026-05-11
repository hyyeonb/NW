<!-- 
PR 분류 (1개만 골라 prefix를 제목에 붙이세요):
  feat:               신규 기능
  refactor:extract    순수 추출 (Phase 2: utils/constants/types)
  refactor:decompose  컴포넌트 분해 (Phase 4)
  refactor:consolidate 횡단 통합 (Phase 5)
  fix                 버그 수정
  chore:rules         규칙·도구 변경
  chore:test          테스트 추가/변경
  chore:docs          문서
  perf                성능 개선
-->

## 변경 요약

<!-- 1~3줄로 무엇을 왜 바꿨는지. -->

## 변경 종류

- [ ] feat — 새 기능
- [ ] refactor:extract — 순수 추출
- [ ] refactor:decompose — 컴포넌트 분해
- [ ] refactor:consolidate — 횡단 통합
- [ ] fix
- [ ] chore (rules / test / docs)
- [ ] perf

## 영향 범위

- [ ] UI 변경 있음 (스크린샷 첨부 필수)
- [ ] API 변경 있음 (호환성 노트 작성)
- [ ] DB 마이그레이션 있음
- [ ] 빌드/번들 영향 (사이즈 변동 첨부)
- [ ] 보안 관련

## 회귀 위험 / 롤백

- 회귀 위험: 낮음 / 중간 / 높음
- 롤백 방법: revert 가능 / 추가 조치 필요 (설명)

## 테스트 / 검증

- [ ] `npm run build` 통과
- [ ] `npm run lint` 통과 (error 0건)
- [ ] `npm test` 통과 (해당 시)
- [ ] 수동 검증 시나리오 (체크리스트):
  - [ ] ...

## 관련 ADR / 이슈

- ADR: <NNNN-title> (구조 변경 PR은 필수)
- Issue: #
- Refactor plan reference: `docs/refactoring-plan.md` Phase ?

## 체크리스트 (모두 충족해야 머지)

- [ ] 1 PR = 1 종류 변경 (혼합 금지)
- [ ] 사이즈 한계 위반 시 ADR 첨부
- [ ] 테스트 추가/갱신 (해당 시)
- [ ] 문서 업데이트 (RULES.md, README, ADR)
- [ ] 시각/기능 회귀 0건 (refactor 시)

---

🤖 본 PR은 NMS Frontend 리팩터링 마스터 플랜에 따라 생성됨. `docs/refactoring-plan.md` 참고.
