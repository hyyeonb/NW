// 인터페이스 이름 → chassis/slot/port 파서 + 속도 표기 감지 + 포트 상태 분류.

// 10/100/1000 같은 속도 표기 감지 (실제 슬롯이 아님).
// 규칙: 숫자 중 하나라도 ≥ 1000 → 거의 확실한 속도.
//      기하급수 ≥ 5배씩 증가하고 첫 값 ≥ 10 → 속도 (10→100→1000).
export function looksLikeSpeed(...nums) {
  if (nums.length === 0) return false;
  if (Math.max(...nums) >= 1000) return true;
  if (nums[0] >= 10 && nums.every((n, i) => i === 0 || n >= nums[i - 1] * 5)) return true;
  return false;
}

// A/B/C, A/B, prefix+숫자, 숫자 등의 인터페이스 이름에서 chassis/slot/port 추출.
export function parseAbcName(name, fallbackIdx = null) {
  if (!name) {
    return { chassis: 1, slot: 1, port: fallbackIdx || 0, label: `port ${fallbackIdx || 0}` };
  }
  let m = name.match(/(\d+)\/(\d+)\/(\d+)\s*$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const c = parseInt(m[3], 10);
    if (!looksLikeSpeed(a, b, c)) {
      return { chassis: a, slot: b, port: c, label: `${a}/${b}/${c}` };
    }
  }
  m = name.match(/(\d+)\/(\d+)\s*$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (!looksLikeSpeed(a, b)) {
      return { chassis: 1, slot: a, port: b, label: `${a}/${b}` };
    }
  }
  m = name.match(/([a-zA-Z][a-zA-Z_]*)[\s\-_]?(\d+)/);
  if (m) {
    const prefix = m[1];
    const num = parseInt(m[2], 10);
    const shortLabel = `${prefix}${num}`;
    return {
      chassis: 1,
      slot: 1,
      port: num,
      label: shortLabel.length <= 12 ? shortLabel : `P${num}`,
    };
  }
  m = name.match(/(\d+)/);
  if (m) {
    return { chassis: 1, slot: 1, port: parseInt(m[1], 10), label: `P${parseInt(m[1], 10)}` };
  }
  return { chassis: 1, slot: 1, port: fallbackIdx || 0, label: name };
}

// 포트 상태(admin/oper) + usage% → 색상/CSS 클래스/라벨.
export function portStatusInfo(port, usagePercent) {
  const oper = port.IF_OPER_STATUS;
  const admin = port.IF_ADMIN_STATUS;
  if (admin !== 1) return { cls: 'admin-down', color: '#94a3b8', label: 'ADMIN DOWN' };
  if (oper !== 1) return { cls: 'down', color: '#ef4444', label: 'DOWN' };
  if (usagePercent >= 80) return { cls: 'warn', color: '#f97316', label: 'WARN' };
  return { cls: 'up', color: '#10b981', label: 'UP' };
}
