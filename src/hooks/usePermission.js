import { usePermissionStore } from '../stores/permissionStore';

/**
 * 권한 확인 훅
 */
export function usePermission() {
  const { isAdmin, allGroupView, canView, canEdit, pageAccess, groupAccess } =
    usePermissionStore();

  return {
    isAdmin,
    allGroupView,
    canView,
    canEdit,
    pageAccess,
    groupAccess,
  };
}

export default usePermission;
