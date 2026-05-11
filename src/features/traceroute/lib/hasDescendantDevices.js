// 그룹 트리에서 자손 그룹에 매핑된 장비가 있는지 재귀 확인.

export function hasDescendantDevices(children, filteredDevices) {
  if (!children?.length) return false;
  return children.some(c =>
    filteredDevices.some(d => d.GROUP_ID === c.GROUP_ID) ||
    hasDescendantDevices(c.children, filteredDevices)
  );
}
