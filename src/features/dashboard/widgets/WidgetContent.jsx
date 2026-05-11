import CustomWidgetContent from './CustomWidgetContent';

function WidgetContent({ widget, widgetTypes, isEditMode, onDeviceClick }) {
  const type = widgetTypes[widget.type];

  switch (widget.type) {
    case 'CPU_MEM_TOPN':
    case 'TRAFFIC_TOPN':
    case 'FILESYSTEM_TOPN':
    case 'TRAFFIC_TREND':
      // 차트 위젯은 CustomWidgetContent로 통합
      return <CustomWidgetContent widget={widget} isEditMode={isEditMode} onDeviceClick={onDeviceClick} />;

    case 'ALERT_LIST':
      return (
        <div className="widget-content-inner">
          <div className="alert-table">
            <table>
              <thead>
                <tr>
                  <th>등급</th>
                  <th>장비명</th>
                  <th>알람 내용</th>
                  <th>발생 시간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="alert-row critical">
                  <td><span className="alert-badge critical">Critical</span></td>
                  <td>Server-01</td>
                  <td>서버 응답 없음</td>
                  <td>2분 전</td>
                </tr>
                <tr className="alert-row warning">
                  <td><span className="alert-badge warning">Warning</span></td>
                  <td>Switch-02</td>
                  <td>CPU 사용량 85%</td>
                  <td>15분 전</td>
                </tr>
                <tr className="alert-row info">
                  <td><span className="alert-badge info">Info</span></td>
                  <td>Router-01</td>
                  <td>백업 완료</td>
                  <td>1시간 전</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'CUSTOM':
      // 실제 데이터를 사용하는 별도 컴포넌트 사용
      return null; // WidgetContent 외부에서 처리

    case 'REALTIME_ALERT':
      // 실제 데이터를 사용하는 별도 컴포넌트 사용
      return null; // WidgetContent 외부에서 처리

    case 'ALERT_SUMMARY':
      // 별도 컴포넌트로 처리 (강조 효과 포함)
      return null;

    case 'DEVICE_SUMMARY':
      return null; // 별도 컴포넌트로 처리

    default:
      return (
        <div className="widget-content-inner">
          <div className="widget-placeholder">
            <i className={`bi ${type?.icon || 'bi-grid'}`}></i>
            <span>{type?.name || widget.type}</span>
          </div>
        </div>
      );
  }
}

export default WidgetContent;
