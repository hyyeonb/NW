import { usePermissionStore } from '../stores/permissionStore';

/**
 * EDIT 권한이 없으면 children을 숨김
 * 사용: <EditGuard pageCode="asset_mgmt"><button>삭제</button></EditGuard>
 */
export default function EditGuard({ pageCode, children }) {
  const canEdit = usePermissionStore((s) => s.canEdit);
  const isAdmin = usePermissionStore((s) => s.isAdmin);

  if (isAdmin || canEdit(pageCode)) {
    return children;
  }

  return null;
}
