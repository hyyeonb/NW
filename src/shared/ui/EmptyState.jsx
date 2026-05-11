// 도메인-무관 빈 상태 placeholder.

export default function EmptyState({ message }) {
  return (
    <div className="stats-empty">
      <i className="bi bi-inbox"></i>
      <span>{message}</span>
    </div>
  );
}
