// 그룹 트리 기반 장애 등급 상위 전파.
// 자식 그룹의 장애 등급을 모든 조상 그룹에 전파 (가장 높은 등급으로).

const LEVEL_PRIORITY = { C: 4, M: 3, N: 2, W: 1 };

// groupTree: 트리 노드 배열. groupErrorMap: Map<GROUP_NAME, level('C'|'M'|'N'|'W')>
// → 새 Map 반환 (조상에도 등급 전파됨). groupTree 비어있으면 입력 Map 그대로.
export function propagateGroupErrors(groupTree, groupErrorMap) {
  if (!groupTree || groupTree.length === 0) return groupErrorMap;

  const enhanced = new Map(groupErrorMap);

  const visit = (nodes, ancestors) => {
    for (const node of nodes) {
      const myLevel = groupErrorMap.get(node.GROUP_NAME);
      if (myLevel) {
        for (const anc of ancestors) {
          const existing = enhanced.get(anc);
          if ((LEVEL_PRIORITY[myLevel] || 0) > (LEVEL_PRIORITY[existing] || 0)) {
            enhanced.set(anc, myLevel);
          }
        }
      }
      if (node.children?.length > 0) {
        visit(node.children, [...ancestors, node.GROUP_NAME]);
      }
    }
  };

  visit(groupTree, []);
  return enhanced;
}
