import { usePermissionStore } from '../stores/permissionStore';

/**
 * 페이지 레벨 VIEW 권한 체크
 * 권한이 없으면 접근 거부 화면 표시
 */
export default function PermissionGuard({ pageCode, children }) {
  const canView = usePermissionStore((s) => s.canView);
  const isAdmin = usePermissionStore((s) => s.isAdmin);

  // Admin은 항상 접근 가능
  if (isAdmin || canView(pageCode)) {
    return children;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '16px',
        color: 'var(--theme-text-secondary, #94a3b8)',
      }}
    >
      <i
        className="bi bi-shield-lock"
        style={{ fontSize: '48px', color: 'var(--theme-text-muted, #64748b)' }}
      ></i>
      <h2 style={{ margin: 0, color: 'var(--theme-text-primary, #f8fafc)' }}>
        접근 권한이 없습니다
      </h2>
      <p style={{ margin: 0 }}>
        이 페이지에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.
      </p>
    </div>
  );
}
