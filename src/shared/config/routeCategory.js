// URL prefix → CSS class 매핑 (사이드바 메뉴 그룹 색상과 매칭).

const ROUTE_CATEGORY = [
  { prefix: ['/dashboard', '/topology', '/user-topology'], cls: 'c-blue' },
  { prefix: ['/watch/', '/perf/'],                         cls: 'c-emerald' },
  { prefix: ['/fault/'],                                   cls: 'c-red' },
  { prefix: ['/mgmt/'],                                    cls: 'c-violet' },
  { prefix: ['/history/'],                                 cls: 'c-amber' },
  { prefix: ['/tools/'],                                   cls: 'c-cyan' },
  { prefix: ['/board/'],                                   cls: 'c-pink' },
  { prefix: ['/settings/', '/preview/'],                   cls: 'c-slate' },
];

export function getPageCategory(pathname) {
  for (const { prefix, cls } of ROUTE_CATEGORY) {
    if (prefix.some(p => pathname === p || pathname.startsWith(p))) return cls;
  }
  return '';
}
