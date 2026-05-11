// 로그인 시작 ~ 종료 시각 차이를 사람-친화 문구로 표기.
// loginAt만 있으면 현재까지의 활성 세션 길이.
export function formatSessionDuration(loginAt, logoutAt) {
  if (!loginAt) return '-';
  const start = new Date(loginAt);
  const end = logoutAt ? new Date(logoutAt) : new Date();
  const diff = Math.floor((end - start) / 1000);
  if (diff < 60) return `${diff}초`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 ${diff % 60}초`;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}시간 ${mins}분`;
}
