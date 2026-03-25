import { create } from 'zustand';

export const usePermissionStore = create((set, get) => ({
  isAdmin: false,
  allGroupView: true,
  pageAccess: {},   // { [pageCode]: { canView, canEdit } }
  groupAccess: [],  // [{ GROUP_TYPE, GROUP_ID, CAN_VIEW, CAN_EDIT, GROUP_NAME }]

  setPermissions: (permissions) => {
    if (!permissions) return;

    // pageAccess 배열을 map으로 변환
    const pageMap = {};
    if (permissions.pageAccess) {
      permissions.pageAccess.forEach((pa) => {
        pageMap[pa.PAGE_CODE] = {
          canView: pa.CAN_VIEW,
          canEdit: pa.CAN_EDIT,
          pageName: pa.PAGE_NAME,
          pageGroup: pa.PAGE_GROUP,
          pagePath: pa.PAGE_PATH,
        };
      });
    }

    set({
      isAdmin: permissions.admin || permissions.isAdmin || false,
      allGroupView: permissions.allGroupView !== false,
      pageAccess: pageMap,
      groupAccess: permissions.groupAccess || [],
    });
  },

  clearPermissions: () =>
    set({
      isAdmin: false,
      allGroupView: true,
      pageAccess: {},
      groupAccess: [],
    }),

  canView: (pageCode) => {
    const { isAdmin, pageAccess } = get();
    if (isAdmin) return true;
    return pageAccess[pageCode]?.canView === true;
  },

  canEdit: (pageCode) => {
    const { isAdmin, pageAccess } = get();
    if (isAdmin) return true;
    return pageAccess[pageCode]?.canEdit === true;
  },
}));
