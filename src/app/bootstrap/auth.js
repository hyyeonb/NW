// 401 발생 시 authStore 초기화 콜백 등록.
// api/client.js 가 stores/authStore 를 직접 import 하지 않도록 의존성을 역전 (Phase 2 PR #2).
// 이 모듈은 main.jsx 가 한 번만 side-effect import 하면 충분.

import { registerOn401 } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

registerOn401(() => {
  useAuthStore.getState().setUser(null);
});
