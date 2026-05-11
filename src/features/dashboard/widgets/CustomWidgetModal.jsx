import { useState } from 'react';
import { useAlert } from '../../../components/CustomAlert';
import { MONITORING_GROUPS } from '../model/monitoringGroups';

function CustomWidgetModal({ onClose, onSave, initialData = null }) {
  const { warning: showWarning } = useAlert();
  const [widgetName, setWidgetName] = useState(initialData?.name || '');
  const [selectedGroup, setSelectedGroup] = useState(initialData?.group || null);
  const [selectedElements, setSelectedElements] = useState(initialData?.elements || []);
  const [chartType, setChartType] = useState(initialData?.chartType || 'bar');

  const handleGroupChange = (groupId) => {
    setSelectedGroup(groupId);
    setSelectedElements([]); // 그룹 변경 시 선택 초기화
  };

  const toggleElement = (elementId) => {
    // CPU_MEM 그룹은 단일 선택만 가능
    if (selectedGroup === 'CPU_MEM') {
      setSelectedElements([elementId]);
    } else {
      // 다른 그룹은 다중 선택 가능
      setSelectedElements(prev =>
        prev.includes(elementId)
          ? prev.filter(id => id !== elementId)
          : [...prev, elementId]
      );
    }
  };

  const handleSave = () => {
    if (!widgetName.trim()) {
      showWarning('위젯 이름을 입력하세요.');
      return;
    }
    if (!selectedGroup) {
      showWarning('모니터링 그룹을 선택하세요.');
      return;
    }
    if (selectedElements.length === 0) {
      showWarning('최소 1개 이상의 모니터링 요소를 선택하세요.');
      return;
    }

    onSave({
      name: widgetName,
      group: selectedGroup,
      elements: selectedElements,
      chartType: chartType,
    });
  };

  const currentGroup = selectedGroup ? MONITORING_GROUPS[selectedGroup] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content custom-widget-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initialData ? '사용자 정의 위젯 수정' : '사용자 정의 위젯 만들기'}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* 위젯 이름 */}
          <div className="custom-widget-section">
            <label className="section-label">위젯 이름</label>
            <input
              type="text"
              className="widget-name-input"
              placeholder="예: 서버 모니터링"
              value={widgetName}
              onChange={(e) => setWidgetName(e.target.value)}
            />
          </div>

          {/* 모니터링 그룹 선택 */}
          <div className="custom-widget-section">
            <label className="section-label">1. 모니터링 카테고리 선택</label>
            <div className="monitoring-groups">
              {Object.values(MONITORING_GROUPS).map(group => (
                <div
                  key={group.id}
                  className={`group-card ${selectedGroup === group.id ? 'selected' : ''}`}
                  onClick={() => handleGroupChange(group.id)}
                >
                  <div className="group-icon" style={{ color: group.color }}>
                    <i className={`bi ${group.icon}`}></i>
                  </div>
                  <span className="group-name">{group.name}</span>
                  {selectedGroup === group.id && (
                    <i className="bi bi-check-circle-fill group-check"></i>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 세부 요소 선택 */}
          {currentGroup && (
            <div className="custom-widget-section">
              <label className="section-label">
                2. {currentGroup.name} 세부 항목 선택
                <span className="selected-count">
                  ({selectedElements.length}개 선택됨)
                  {selectedGroup === 'CPU_MEM' && <span className="single-select-notice"> - 1개만 선택 가능</span>}
                </span>
              </label>
              <div className="monitoring-elements-grid">
                {currentGroup.elements.map(element => (
                  <div
                    key={element.id}
                    className={`monitoring-element-card ${selectedElements.includes(element.id) ? 'selected' : ''}`}
                    onClick={() => toggleElement(element.id)}
                  >
                    <div className="element-icon" style={{ color: element.color }}>
                      <i className={`bi ${element.icon}`}></i>
                    </div>
                    <span className="element-name">{element.name}</span>
                    {selectedElements.includes(element.id) && (
                      <i className="bi bi-check-circle-fill element-check"></i>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 차트 타입 선택 */}
          <div className="custom-widget-section">
            <label className="section-label">
              3. 차트 타입
              <span className="chart-info">(Top 10까지만 표출됩니다)</span>
            </label>
            <div className="chart-type-options">
              <button
                className={`chart-type-option ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
              >
                <i className="bi bi-bar-chart-fill"></i>
                <span>막대 그래프</span>
              </button>
              <button
                className={`chart-type-option ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
              >
                <i className="bi bi-graph-up"></i>
                <span>선 그래프</span>
              </button>
              <button
                className={`chart-type-option ${chartType === 'pie' ? 'active' : ''}`}
                onClick={() => setChartType('pie')}
              >
                <i className="bi bi-pie-chart-fill"></i>
                <span>파이 차트</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button className="btn-save" onClick={handleSave}>
            {initialData ? '수정 완료' : '위젯 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomWidgetModal;
