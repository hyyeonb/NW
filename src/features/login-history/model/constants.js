// LoginHistory 도메인 상수.

export const LOGIN_TYPE_BADGE = {
  LOCAL: { label: 'Local', className: 'badge-info' },
  KAKAO: { label: 'Kakao', className: 'badge-warning' },
  GOOGLE: { label: 'Google', className: 'badge-danger' },
  NAVER: { label: 'Naver', className: 'badge-success' },
};

export const ACTION_TYPE_BADGE = {
  PAGE_VIEW: { label: '진입', className: 'badge-muted' },
  VIEW: { label: '조회', className: 'badge-info' },
  CREATE: { label: '등록', className: 'badge-success' },
  UPDATE: { label: '수정', className: 'badge-warning' },
  DELETE: { label: '삭제', className: 'badge-danger' },
  CONTROL: { label: '제어', className: 'badge-purple' },
};

export const TARGET_TYPE_LABEL = {
  DEVICE: '장비', GROUP: '그룹', PORT: '포트', DEVICE_SCOPE: '수집 설정',
  DEVICE_SNMP: 'SNMP 설정', DEVICE_SSH: 'SSH 접속 정보', MODEL: '모델',
  DEV_CODE: '장비 분류', TEMP_DEVICE: '신규 자산', NOTICE: '공지사항',
  BOARD_FILE: '자료실', THRESHOLD: '시스템 임계치', DEVICE_THRESHOLD: '장비별 임계치',
  WATCH_GROUP: '관제 그룹', WATCH_CONTROL: '관제 수집', ERROR: '장애 인지',
  USER_PERMISSION: '사용자 권한', USER_STATUS: '사용자 상태',
  USER_SETTING: '사용자 설정', USER_REVIEW: '가입 심사',
  ACCOUNT: '계정 정보', PASSWORD: '비밀번호', DASHBOARD: '대시보드',
  TOPOLOGY: '토폴로지', USER_TOPOLOGY: '사용자 토폴로지', MODEL_OID: '모델 OID',
  MIDDLEWARE: '미들웨어',
};

export const PAGE_CODE_LABEL = {
  dashboard: '대시보드', topology: '토폴로지', user_topology: '사용자 토폴로지',
  watch_realtime: '실시간 관제', perf_stats: '성능 통계',
  fault_realtime: '실시간 장애', fault_history: '장애 이력', fault_stats: '장애 통계',
  group_mgmt: '그룹 관리', asset_mgmt: '자산 관리', asset_config: '자산 Config',
  new_asset_mgmt: '신규 자산', model_mgmt: '모델 관리',
  login_history: '로그인 이력', ssh_sessions: 'SSH 이력',
  board_files: '자료실', board_notices: '공지사항',
  system_admin: '시스템 관리', account_settings: '계정 설정',
};
