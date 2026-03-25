import { useState } from 'react';

const MOCK_USERS = [
  { id: 30, name: 'tests2', email: 'tests2', type: 'LOCAL', status: 'ACTIVE', reviewed: false },
  { id: 28, name: '문찬', email: 'mun23502350@gmail.com', type: 'KAKAO', status: 'ACTIVE', reviewed: false },
  { id: 24, name: '에스티엔', email: 'hyeonbinyang72@daum.net', type: 'LOCAL', status: 'ACTIVE', reviewed: true },
  { id: 21, name: '오석영', email: 'dig03208@naver.com', type: 'LOCAL', status: 'ACTIVE', reviewed: true },
  { id: 18, name: '양현빈', email: 'dev3-hyunbin', type: 'LOCAL', status: 'ACTIVE', reviewed: true },
  { id: 17, name: '백승동', email: 'mcd100@stninfotech.com', type: 'KAKAO', status: 'SUSPENDED', reviewed: true },
];

const styles = {
  page: {
    padding: '32px',
    minHeight: '100vh',
    background: 'var(--theme-bg-primary, #0f0f23)',
    color: 'var(--theme-text-primary, #f8fafc)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--theme-text-tertiary, #94a3b8)',
    marginBottom: '32px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(20px)',
  },
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#818cf8',
    marginBottom: '4px',
  },
  cardDesc: {
    fontSize: '0.75rem',
    color: 'var(--theme-text-muted, #64748b)',
    marginBottom: '16px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--theme-text-primary, #f8fafc)',
  },
  email: {
    display: 'block',
    fontSize: 11,
    color: 'var(--theme-text-muted, #64748b)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeBadge: (type) => ({
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 500,
    ...(type === 'KAKAO' ? { background: 'rgba(254,229,0,0.15)', color: '#f9c800' } :
      type === 'NAVER' ? { background: 'rgba(3,199,90,0.15)', color: '#03c75a' } :
      type === 'GOOGLE' ? { background: 'rgba(66,133,244,0.15)', color: '#4285f4' } :
      { background: 'rgba(148,163,184,0.1)', color: '#64748b' }),
  }),
  suspendedBadge: {
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 500,
    background: 'rgba(239,68,68,0.15)',
    color: '#ef4444',
  },
  selectedLabel: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 32px',
    borderRadius: 12,
    background: 'rgba(99,102,241,0.9)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
};

// ─── 방안 A: 이름 옆에 작은 도트 ───
function StyleA({ users }) {
  return (
    <div style={styles.list}>
      {users.map((u) => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{
            ...styles.avatar,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
          }}>
            {u.name.charAt(0)}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>
              {u.name}
              {!u.reviewed && (
                <span style={{
                  display: 'inline-block',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  marginLeft: 6,
                  verticalAlign: 'middle',
                }} />
              )}
            </span>
            <span style={styles.email}>{u.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {u.status === 'SUSPENDED' && <span style={styles.suspendedBadge}>정지</span>}
            <span style={styles.typeBadge(u.type)}>{u.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 방안 B: 아바타에 뱃지 오버레이 ───
function StyleB({ users }) {
  return (
    <div style={styles.list}>
      {users.map((u) => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              ...styles.avatar,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8',
            }}>
              {u.name.charAt(0)}
            </div>
            {!u.reviewed && (
              <div style={{
                position: 'absolute', top: -2, right: -2,
                width: 10, height: 10,
                borderRadius: '50%',
                background: '#f59e0b',
                border: '2px solid #1a1a2e',
              }} />
            )}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>{u.name}</span>
            <span style={styles.email}>{u.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {u.status === 'SUSPENDED' && <span style={styles.suspendedBadge}>정지</span>}
            <span style={styles.typeBadge(u.type)}>{u.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 방안 C: "NEW" 텍스트 뱃지 ───
function StyleC({ users }) {
  return (
    <div style={styles.list}>
      {users.map((u) => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{
            ...styles.avatar,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
          }}>
            {u.name.charAt(0)}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>
              {u.name}
              {!u.reviewed && (
                <span style={{
                  marginLeft: 6,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  background: 'rgba(245,158,11,0.2)',
                  color: '#f59e0b',
                  verticalAlign: 'middle',
                  letterSpacing: '0.5px',
                }}>NEW</span>
              )}
            </span>
            <span style={styles.email}>{u.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {u.status === 'SUSPENDED' && <span style={styles.suspendedBadge}>정지</span>}
            <span style={styles.typeBadge(u.type)}>{u.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 방안 D: 하단 얇은 그라데이션 언더라인 ───
function StyleD({ users }) {
  return (
    <div style={styles.list}>
      {users.map((u) => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {!u.reviewed && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: '10%', right: '10%',
              height: 2,
              borderRadius: 1,
              background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
            }} />
          )}
          <div style={{
            ...styles.avatar,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
          }}>
            {u.name.charAt(0)}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>{u.name}</span>
            <span style={styles.email}>{u.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {u.status === 'SUSPENDED' && <span style={styles.suspendedBadge}>정지</span>}
            <span style={styles.typeBadge(u.type)}>{u.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 방안 E: 배경 미세 틴트 ───
function StyleE({ users }) {
  return (
    <div style={styles.list}>
      {users.map((u) => (
        <div key={u.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: !u.reviewed
            ? 'rgba(245,158,11,0.04)'
            : 'rgba(255,255,255,0.02)',
          border: !u.reviewed
            ? '1px solid rgba(245,158,11,0.1)'
            : '1px solid transparent',
        }}>
          <div style={{
            ...styles.avatar,
            background: !u.reviewed ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
            color: !u.reviewed ? '#f59e0b' : '#818cf8',
          }}>
            {u.name.charAt(0)}
          </div>
          <div style={styles.info}>
            <span style={styles.name}>{u.name}</span>
            <span style={styles.email}>{u.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {u.status === 'SUSPENDED' && <span style={styles.suspendedBadge}>정지</span>}
            <span style={styles.typeBadge(u.type)}>{u.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminStyleTest() {
  const [selected, setSelected] = useState(null);

  const options = [
    { key: 'A', title: 'A. 이름 옆 도트', desc: '이름 우측에 작은 주황 점으로 미확인 표시', Component: StyleA },
    { key: 'B', title: 'B. 아바타 뱃지', desc: '아바타 우상단에 알림 도트 오버레이', Component: StyleB },
    { key: 'C', title: 'C. NEW 텍스트 뱃지', desc: '이름 옆에 "NEW" 텍스트 뱃지', Component: StyleC },
    { key: 'D', title: 'D. 하단 그라데이션 라인', desc: '카드 하단에 얇은 주황 그라데이션 언더라인', Component: StyleD },
    { key: 'E', title: 'E. 배경 틴트', desc: '미확인 카드 전체에 미세한 주황 배경 + 테두리', Component: StyleE },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>미확인 사용자 표시 방식 선택</h1>
      <p style={styles.subtitle}>
        각 방안을 비교하고 클릭하여 선택하세요. tests2, 문찬이 미확인 사용자 / 백승동이 정지 계정입니다.
      </p>

      <div style={styles.grid}>
        {options.map(({ key, title, desc, Component }) => (
          <div
            key={key}
            onClick={() => setSelected(key)}
            style={{
              ...styles.card,
              cursor: 'pointer',
              border: selected === key
                ? '2px solid #6366f1'
                : '1px solid rgba(255,255,255,0.08)',
              transition: 'border 0.2s',
            }}
          >
            <div style={styles.cardTitle}>{title}</div>
            <div style={styles.cardDesc}>{desc}</div>
            <Component users={MOCK_USERS} />
          </div>
        ))}
      </div>

      {selected && (
        <div style={styles.selectedLabel}>
          방안 {selected} 선택됨
        </div>
      )}
    </div>
  );
}
