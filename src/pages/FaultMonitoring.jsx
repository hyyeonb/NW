import { useState, useEffect } from 'react';
import '../styles/fault-monitoring.css';

const FAULT_TABS = [
  { id: 'all', label: '통합 장애', icon: 'bi-grid-3x3-gap' },
  { id: 'failure', label: '고장 장애', icon: 'bi-x-octagon' },
  { id: 'performance', label: '성능 장애', icon: 'bi-graph-down' },
  { id: 'trap', label: '트랩 장애', icon: 'bi-broadcast' },
];

export default function FaultMonitoring() {
  const [activeTab, setActiveTab] = useState('all');
  const [faults, setFaults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFault, setSelectedFault] = useState(null);

  // 더미 데이터 (실제로는 API에서 가져옴)
  const dummyFaults = [
    {
      id: 1,
      type: 'failure',
      severity: 'critical',
      deviceName: 'Core-Switch-01',
      deviceIp: '192.168.1.1',
      message: 'PING 응답 없음 - 장비 연결 불가',
      occurredAt: '2024-12-09 14:30:25',
      status: 'active',
    },
    {
      id: 2,
      type: 'performance',
      severity: 'warning',
      deviceName: 'Access-Switch-03',
      deviceIp: '192.168.1.103',
      message: 'CPU 사용률 85% 초과',
      occurredAt: '2024-12-09 14:28:10',
      status: 'active',
    },
    {
      id: 3,
      type: 'trap',
      severity: 'info',
      deviceName: 'Router-02',
      deviceIp: '192.168.1.2',
      message: 'Link Up - GigabitEthernet0/1',
      occurredAt: '2024-12-09 14:25:00',
      status: 'cleared',
    },
    {
      id: 4,
      type: 'failure',
      severity: 'major',
      deviceName: 'Server-DB-01',
      deviceIp: '192.168.10.50',
      message: 'SNMP 응답 시간 초과',
      occurredAt: '2024-12-09 14:20:15',
      status: 'active',
    },
    {
      id: 5,
      type: 'performance',
      severity: 'critical',
      deviceName: 'Core-Router-01',
      deviceIp: '192.168.1.254',
      message: '메모리 사용률 95% 초과',
      occurredAt: '2024-12-09 14:15:30',
      status: 'active',
    },
    {
      id: 6,
      type: 'trap',
      severity: 'warning',
      deviceName: 'Access-Switch-05',
      deviceIp: '192.168.1.105',
      message: 'Port Security Violation - Fa0/24',
      occurredAt: '2024-12-09 14:10:45',
      status: 'active',
    },
  ];

  useEffect(() => {
    // 탭 변경 시 데이터 로드
    setIsLoading(true);
    setTimeout(() => {
      if (activeTab === 'all') {
        setFaults(dummyFaults);
      } else {
        setFaults(dummyFaults.filter(f => f.type === activeTab));
      }
      setIsLoading(false);
    }, 300);
  }, [activeTab]);

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'major': return 'severity-major';
      case 'warning': return 'severity-warning';
      case 'info': return 'severity-info';
      default: return '';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical': return '심각';
      case 'major': return '주의';
      case 'warning': return '경고';
      case 'info': return '정보';
      default: return severity;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'failure': return '고장';
      case 'performance': return '성능';
      case 'trap': return '트랩';
      default: return type;
    }
  };

  const getStatusLabel = (status) => {
    return status === 'active' ? '발생' : '해제';
  };

  const getFaultCounts = () => {
    return {
      all: dummyFaults.length,
      failure: dummyFaults.filter(f => f.type === 'failure').length,
      performance: dummyFaults.filter(f => f.type === 'performance').length,
      trap: dummyFaults.filter(f => f.type === 'trap').length,
    };
  };

  const counts = getFaultCounts();

  return (
    <div className="fault-monitoring-page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-exclamation-triangle"></i>
            장애 모니터링
          </h1>
          <span className="page-subtitle">실시간 장애 현황을 모니터링합니다</span>
        </div>
        <div className="page-header-right">
          <button className="btn btn-ghost">
            <i className="bi bi-arrow-clockwise"></i>
            새로고침
          </button>
          <button className="btn btn-ghost">
            <i className="bi bi-funnel"></i>
            필터
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="fault-tabs">
        {FAULT_TABS.map(tab => (
          <button
            key={tab.id}
            className={`fault-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`bi ${tab.icon}`}></i>
            <span>{tab.label}</span>
            <span className="fault-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {/* 장애 테이블 */}
      <div className="fault-content glass-card">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>장애 정보를 불러오는 중...</span>
          </div>
        ) : faults.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-check-circle"></i>
            <h3>현재 발생한 장애가 없습니다</h3>
            <p>모든 장비가 정상 상태입니다</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="fault-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>심각도</th>
                  <th style={{ width: '80px' }}>유형</th>
                  <th style={{ width: '150px' }}>장비명</th>
                  <th style={{ width: '130px' }}>IP 주소</th>
                  <th>장애 내용</th>
                  <th style={{ width: '160px' }}>발생 시간</th>
                  <th style={{ width: '80px' }}>상태</th>
                  <th style={{ width: '100px' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {faults.map(fault => (
                  <tr
                    key={fault.id}
                    className={`${fault.status === 'cleared' ? 'cleared' : ''} ${selectedFault?.id === fault.id ? 'selected' : ''}`}
                    onClick={() => setSelectedFault(fault)}
                  >
                    <td>
                      <span className={`severity-badge ${getSeverityClass(fault.severity)}`}>
                        {getSeverityLabel(fault.severity)}
                      </span>
                    </td>
                    <td>
                      <span className="type-badge">{getTypeLabel(fault.type)}</span>
                    </td>
                    <td className="device-name">{fault.deviceName}</td>
                    <td className="device-ip">{fault.deviceIp}</td>
                    <td className="fault-message">{fault.message}</td>
                    <td className="occurred-at">{fault.occurredAt}</td>
                    <td>
                      <span className={`status-badge ${fault.status}`}>
                        {getStatusLabel(fault.status)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" title="상세보기">
                          <i className="bi bi-eye"></i>
                        </button>
                        <button className="btn-icon" title="확인처리">
                          <i className="bi bi-check-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
