import { useState, useMemo, useEffect } from 'react';
import { useVendors, useModels, useCreateModel, useUpdateModel, useDeleteModel, useSnmpMetrics, useModelOids, useSaveModelOids } from '../hooks';
import '../styles/model-management.css';

export default function ModelManagement() {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [expandedVendors, setExpandedVendors] = useState({}); // 열린 벤더들 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modelForm, setModelForm] = useState({
    MODEL_NAME: '',
    MODEL_OID: '',
    VENDOR_ID: null,
  });

  // OID 설정 상태
  const [isOidModalOpen, setIsOidModalOpen] = useState(false);
  const [oidFormValues, setOidFormValues] = useState({}); // { METRIC_ID: OID_VALUE }

  // 데이터 조회
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors();
  const { data: models = [], isLoading: modelsLoading } = useModels();
  const { data: metrics = [] } = useSnmpMetrics();
  const { data: modelOids = [], refetch: refetchModelOids } = useModelOids(selectedModel?.MODEL_ID);

  // Mutations
  const createModelMutation = useCreateModel();
  const updateModelMutation = useUpdateModel();
  const deleteModelMutation = useDeleteModel();
  const saveModelOidsMutation = useSaveModelOids();

  // 모델 OID 데이터를 폼 값으로 변환
  useEffect(() => {
    if (modelOids.length > 0) {
      const values = {};
      modelOids.forEach(oid => {
        values[oid.METRIC_ID] = oid.OID || '';
      });
      setOidFormValues(values);
    } else {
      setOidFormValues({});
    }
  }, [modelOids]);

  // 메트릭을 타입별로 그룹화
  const metricsByType = useMemo(() => {
    const grouped = {};
    metrics.forEach(metric => {
      if (!grouped[metric.TYPE]) {
        grouped[metric.TYPE] = [];
      }
      grouped[metric.TYPE].push(metric);
    });
    return grouped;
  }, [metrics]);

  // 벤더별 모델 그룹화
  const vendorModelTree = useMemo(() => {
    const tree = [];

    // 벤더 목록 순회
    vendors.forEach(vendor => {
      const vendorModels = models.filter(m => m.VENDOR_ID === vendor.VENDOR_ID);
      tree.push({
        ...vendor,
        models: vendorModels,
      });
    });

    // 벤더가 없는 모델 (orphan models)
    const orphanModels = models.filter(m => !m.VENDOR_ID || !vendors.find(v => v.VENDOR_ID === m.VENDOR_ID));
    if (orphanModels.length > 0) {
      tree.unshift({
        VENDOR_ID: null,
        VENDOR_NAME: '벤더 미등록',
        models: orphanModels,
      });
    }

    return tree;
  }, [vendors, models]);

  // 벤더 클릭 핸들러
  const handleVendorClick = (vendor) => {
    const vendorKey = vendor.VENDOR_ID ?? 'orphan';
    setExpandedVendors(prev => ({
      ...prev,
      [vendorKey]: !prev[vendorKey]
    }));
    setSelectedVendor(vendor);
    setSelectedModel(null);
  };

  // 모델 클릭 핸들러
  const handleModelClick = (model, e) => {
    e.stopPropagation();
    setSelectedModel(model);
  };

  // 모델 추가 모달 열기
  const handleOpenAddModal = (vendorId = null) => {
    setModalMode('create');
    setModelForm({
      MODEL_NAME: '',
      MODEL_OID: '',
      VENDOR_ID: vendorId,
    });
    setIsModalOpen(true);
  };

  // 모델 수정 모달 열기
  const handleOpenEditModal = (model) => {
    setModalMode('edit');
    setModelForm({
      MODEL_ID: model.MODEL_ID,
      MODEL_NAME: model.MODEL_NAME || '',
      MODEL_OID: model.MODEL_OID || '',
      VENDOR_ID: model.VENDOR_ID,
    });
    setIsModalOpen(true);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModelForm({
      MODEL_NAME: '',
      MODEL_OID: '',
      VENDOR_ID: null,
    });
  };

  // 폼 변경 핸들러
  const handleFormChange = (field, value) => {
    setModelForm(prev => ({ ...prev, [field]: value }));
  };

  // 모델 저장
  const handleSaveModel = async () => {
    if (!modelForm.MODEL_NAME.trim()) {
      alert('모델명을 입력해주세요.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await createModelMutation.mutateAsync(modelForm);
        alert('모델이 생성되었습니다.');
      } else {
        await updateModelMutation.mutateAsync({
          modelId: modelForm.MODEL_ID,
          data: modelForm,
        });
        alert('모델이 수정되었습니다.');
      }
      handleCloseModal();
    } catch (error) {
      console.error('모델 저장 오류:', error);
      alert('모델 저장에 실패했습니다.');
    }
  };

  // 모델 삭제
  const handleDeleteModel = async (model) => {
    if (!confirm(`"${model.MODEL_NAME}" 모델을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteModelMutation.mutateAsync(model.MODEL_ID);
      setSelectedModel(null);
      alert('모델이 삭제되었습니다.');
    } catch (error) {
      console.error('모델 삭제 오류:', error);
      alert('모델 삭제에 실패했습니다.');
    }
  };

  // OID 설정 모달 열기
  const handleOpenOidModal = () => {
    refetchModelOids();
    setIsOidModalOpen(true);
  };

  // OID 설정 모달 닫기
  const handleCloseOidModal = () => {
    setIsOidModalOpen(false);
  };

  // OID 값 변경 핸들러
  const handleOidValueChange = (metricId, value) => {
    setOidFormValues(prev => ({
      ...prev,
      [metricId]: value
    }));
  };

  // OID 설정 저장
  const handleSaveOids = async () => {
    try {
      const oids = Object.entries(oidFormValues)
        .filter(([_, value]) => value && value.trim())
        .map(([metricId, value]) => ({
          METRIC_ID: parseInt(metricId),
          OID: value.trim()
        }));

      await saveModelOidsMutation.mutateAsync({
        modelId: selectedModel.MODEL_ID,
        oids
      });

      alert('OID 설정이 저장되었습니다.');
      handleCloseOidModal();
    } catch (error) {
      console.error('OID 저장 오류:', error);
      alert('OID 저장에 실패했습니다.');
    }
  };

  // 설정된 OID 개수 계산
  const configuredOidCount = useMemo(() => {
    return modelOids.filter(oid => oid.OID && oid.OID.trim()).length;
  }, [modelOids]);

  return (
    <div className="model-management-container">
      {/* 좌측: 벤더-모델 트리 */}
      <div className="model-tree-panel">
        <div className="panel-header">
          <h3><i className="bi bi-diagram-3"></i> 벤더 / 모델</h3>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => handleOpenAddModal(selectedVendor?.VENDOR_ID)}
            title="새 모델 추가"
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        <div className="tree-container">
          {vendorsLoading || modelsLoading ? (
            <div className="tree-loading">
              <i className="bi bi-arrow-repeat spinning"></i> 로딩 중...
            </div>
          ) : vendorModelTree.length === 0 ? (
            <div className="tree-empty">
              <i className="bi bi-inbox"></i>
              <p>등록된 벤더가 없습니다.</p>
            </div>
          ) : (
            <ul className="vendor-tree">
              {vendorModelTree.map(vendor => {
                const vendorKey = vendor.VENDOR_ID ?? 'orphan';
                const isExpanded = expandedVendors[vendorKey];
                return (
                  <li key={vendorKey} className="vendor-node">
                    <div
                      className={`vendor-item ${selectedVendor?.VENDOR_ID === vendor.VENDOR_ID ? 'selected' : ''}`}
                      onClick={() => handleVendorClick(vendor)}
                    >
                      <i className={`bi ${vendor.models.length > 0 ? (isExpanded ? 'bi-chevron-down' : 'bi-chevron-right') : 'bi-dot'}`}></i>
                      <i className="bi bi-building vendor-icon"></i>
                      <span className="vendor-name">{vendor.VENDOR_NAME}</span>
                      <span className="model-count">{vendor.models.length}</span>
                    </div>

                    {isExpanded && vendor.models.length > 0 && (
                      <ul className="model-list">
                        {vendor.models.map(model => (
                          <li
                            key={model.MODEL_ID}
                            className={`model-item ${selectedModel?.MODEL_ID === model.MODEL_ID ? 'selected' : ''}`}
                            onClick={(e) => handleModelClick(model, e)}
                          >
                            <i className="bi bi-cpu model-icon"></i>
                            <span className="model-name">{model.MODEL_NAME || '(이름 없음)'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 우측: 모델 상세 정보 */}
      <div className="model-detail-panel">
        {selectedModel ? (
          <>
            <div className="panel-header">
              <h3><i className="bi bi-cpu"></i> 모델 정보</h3>
            </div>

            <div className="detail-content">
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">모델명</span>
                  <span className="detail-value">{selectedModel.MODEL_NAME || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">모델 OID</span>
                  <span className="detail-value oid">{selectedModel.MODEL_OID || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">벤더</span>
                  <span className="detail-value">{selectedModel.VENDOR_NAME || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">등록일</span>
                  <span className="detail-value">
                    {selectedModel.CREATE_AT ? new Date(selectedModel.CREATE_AT).toLocaleDateString('ko-KR') : '-'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">수정일</span>
                  <span className="detail-value">
                    {selectedModel.MODIFY_AT ? new Date(selectedModel.MODIFY_AT).toLocaleDateString('ko-KR') : '-'}
                  </span>
                </div>
              </div>

              {/* OID 설정 섹션 */}
              <div className="detail-section oid-section">
                <div className="section-header">
                  <h4><i className="bi bi-sliders"></i> SNMP OID 설정</h4>
                  <span className="oid-count-badge">{configuredOidCount}개 설정됨</span>
                </div>
                <p className="section-desc">CPU, 메모리 등 수집 항목의 OID를 모델별로 설정합니다.</p>
                <button className="btn btn-secondary btn-sm" onClick={handleOpenOidModal}>
                  <i className="bi bi-gear"></i> OID 설정
                </button>
              </div>

              <div className="detail-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleOpenEditModal(selectedModel)}
                >
                  <i className="bi bi-pencil"></i> 수정
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteModel(selectedModel)}
                >
                  <i className="bi bi-trash"></i> 삭제
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-selection">
            <p>선택 된 모델이 없습니다</p>
          </div>
        )}
      </div>

      {/* 모델 추가/수정 모달 */}
      {isModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content model-modal">
            <span className="close-btn" onClick={handleCloseModal}>&times;</span>
            <h3 className="modal-title">
              <i className="bi bi-cpu"></i>
              {modalMode === 'create' ? ' 새 모델 추가' : ' 모델 수정'}
            </h3>

            <div className="form-group">
              <label>모델명 *</label>
              <input
                type="text"
                value={modelForm.MODEL_NAME}
                onChange={(e) => handleFormChange('MODEL_NAME', e.target.value)}
                placeholder="모델명을 입력하세요"
              />
            </div>

            <div className="form-group">
              <label>모델 OID</label>
              <input
                type="text"
                value={modelForm.MODEL_OID}
                onChange={(e) => handleFormChange('MODEL_OID', e.target.value)}
                placeholder="ex) .1.3.6.1.4.1.9.1.1"
                className="oid-input"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveModel}
                disabled={createModelMutation.isPending || updateModelMutation.isPending}
              >
                {modalMode === 'create' ? '추가' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OID 설정 모달 */}
      {isOidModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content oid-modal">
            <span className="close-btn" onClick={handleCloseOidModal}>&times;</span>
            <h3 className="modal-title">
              <i className="bi bi-sliders"></i> OID 설정
              <span className="model-name-badge">{selectedModel?.MODEL_NAME}</span>
            </h3>

            <div className="oid-form-container">
              {Object.keys(metricsByType).length === 0 ? (
                <div className="no-metrics">
                  <i className="bi bi-info-circle"></i>
                  <p>등록된 메트릭이 없습니다.</p>
                </div>
              ) : (
                Object.entries(metricsByType).map(([type, typeMetrics]) => (
                  <div key={type} className="oid-type-group">
                    <h4 className="type-header">
                      <i className={`bi ${type === 'CPU' ? 'bi-cpu' : 'bi-memory'}`}></i>
                      {type}
                    </h4>
                    <div className="oid-items">
                      {typeMetrics.map(metric => (
                        <div key={metric.METRIC_ID} className="oid-item">
                          <div className="oid-item-info">
                            <span className="oid-name">{metric.OID_NAME}</span>
                            <span className="oid-desc">{metric.OID_DESC}</span>
                          </div>
                          <input
                            type="text"
                            className="oid-input"
                            value={oidFormValues[metric.METRIC_ID] || ''}
                            onChange={(e) => handleOidValueChange(metric.METRIC_ID, e.target.value)}
                            placeholder=".1.3.6.1.4.1..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseOidModal}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveOids}
                disabled={saveModelOidsMutation.isPending}
              >
                {saveModelOidsMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
