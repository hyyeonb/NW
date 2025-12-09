import { create } from 'zustand';

export const useGroupStore = create((set, get) => ({
  // 그룹 트리 데이터
  groupTree: [],
  setGroupTree: (tree) => set({ groupTree: tree }),

  // 선택된 그룹
  selectedGroup: null,
  setSelectedGroup: (group) => set({ selectedGroup: group }),

  // 확장된 노드
  expandedNodes: new Set(),
  toggleNode: (groupId) =>
    set((state) => {
      const newExpanded = new Set(state.expandedNodes);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      return { expandedNodes: newExpanded };
    }),
  expandNode: (groupId) =>
    set((state) => {
      const newExpanded = new Set(state.expandedNodes);
      newExpanded.add(groupId);
      return { expandedNodes: newExpanded };
    }),
  collapseNode: (groupId) =>
    set((state) => {
      const newExpanded = new Set(state.expandedNodes);
      newExpanded.delete(groupId);
      return { expandedNodes: newExpanded };
    }),
  expandAll: () =>
    set((state) => {
      const newExpanded = new Set();
      const addAllIds = (nodes) => {
        nodes.forEach((node) => {
          newExpanded.add(node.GROUP_ID);
          if (node.children && node.children.length > 0) {
            addAllIds(node.children);
          }
        });
      };
      addAllIds(state.groupTree);
      return { expandedNodes: newExpanded };
    }),

  // 컨텍스트 메뉴
  contextMenu: null,
  showContextMenu: (x, y, group) => set({ contextMenu: { x, y, group } }),
  hideContextMenu: () => set({ contextMenu: null }),

  // 드래그 앤 드롭
  draggedGroup: null,
  setDraggedGroup: (group) => set({ draggedGroup: group }),

  // 아이콘 모달
  iconModalGroup: null,
  showIconModal: (group) => set({ iconModalGroup: group }),
  hideIconModal: () => set({ iconModalGroup: null }),

  // 그룹 ID로 선택
  selectGroupById: (groupId) => {
    const state = get();
    const findGroup = (nodes) => {
      for (const node of nodes) {
        if (node.GROUP_ID === groupId) return node;
        if (node.children && node.children.length > 0) {
          const found = findGroup(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const group = findGroup(state.groupTree);
    if (group) {
      const expandParents = (nodes, targetId, path = []) => {
        for (const node of nodes) {
          if (node.GROUP_ID === targetId) return path;
          if (node.children && node.children.length > 0) {
            const result = expandParents(node.children, targetId, [...path, node.GROUP_ID]);
            if (result) return result;
          }
        }
        return null;
      };
      const parentIds = expandParents(state.groupTree, groupId) || [];
      const newExpanded = new Set(state.expandedNodes);
      parentIds.forEach((id) => newExpanded.add(id));
      set({ selectedGroup: group, expandedNodes: newExpanded });
    }
  },

  // 리셋
  reset: () =>
    set({
      groupTree: [],
      selectedGroup: null,
      expandedNodes: new Set(),
      contextMenu: null,
      draggedGroup: null,
      iconModalGroup: null,
    }),
}));
