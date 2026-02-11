import '../styles/board.css';

export default function NoticeBoard() {
  return (
    <div className="board-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-megaphone"></i>
            공지사항
          </h1>
          <span className="page-subtitle">공지사항을 확인합니다</span>
        </div>
      </div>

      <div className="board-panels-wrapper">
        <div className="board-main-panel">
          <div className="board-empty-state">
            <i className="bi bi-megaphone"></i>
            <p>등록된 공지사항이 없습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
