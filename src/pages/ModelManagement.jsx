import { useState, useMemo, useEffect } from 'react';
import { useVendors, useModels, useCreateModel, useUpdateModel, useDeleteModel, useSnmpMetrics, useModelOids, useSaveModelOids, useDevCodeTree } from '../hooks';
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
    DEV_CODE_ID: null,
  });
  const [showDevCodeTree, setShowDevCodeTree] = useState(false);

  // OID 설정 상태
  const [isOidModalOpen, setIsOidModalOpen] = useState(false);
  const [oidFormValues, setOidFormValues] = useState({}); // { METRIC_ID: OID_VALUE }

  // 데이터 조회
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors();
  const { data: models = [], isLoading: modelsLoading } = useModels();
  const { data: metrics = [] } = useSnmpMetrics();
  const { data: modelOids = [], refetch: refetchModelOids } = useModelOids(selectedModel?.MODEL_ID);
  const { data: devCodeTree = [] } = useDevCodeTree();

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

  // 첫 번째 벤더의 첫 번째 모델 자동 선택 (애니메이션 적용)
  useEffect(() => {
    let timer1 = null;
    let timer2 = null;
    let isMounted = true;

    if (!selectedModel && vendors.length > 0 && models.length > 0) {
      // 벤더별 모델 찾기
      for (const vendor of vendors) {
        const vendorModels = models.filter(m => m.VENDOR_ID === vendor.VENDOR_ID);
        if (vendorModels.length > 0) {
          const vendorKey = vendor.VENDOR_ID ?? 'orphan';
          // 약간의 딜레이 후 벤더 펼치기
          timer1 = setTimeout(() => {
            if (isMounted) {
              setExpandedVendors(prev => ({ ...prev, [vendorKey]: true }));
              setSelectedVendor(vendor);
            }
          }, 50);
          // 모델 선택은 조금 더 딜레이
          timer2 = setTimeout(() => {
            if (isMounted) {
              setSelectedModel(vendorModels[0]);
            }
          }, 100);
          break;
        }
      }
    }

    // Cleanup: 컴포넌트 언마운트 시 타이머 정리
    return () => {
      isMounted = false;
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
    };
  }, [vendors, models]);

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
    const isExpanding = !expandedVendors[vendorKey];

    setExpandedVendors(prev => ({
      ...prev,
      [vendorKey]: !prev[vendorKey]
    }));
    setSelectedVendor(vendor);

    // 벤더 펼칠 때 첫 번째 모델 자동 선택
    if (isExpanding) {
      const vendorModels = models.filter(m => m.VENDOR_ID === vendor.VENDOR_ID);
      if (vendorModels.length > 0) {
        setSelectedModel(vendorModels[0]);
      }
    }
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
      DEV_CODE_ID: null,
    });
    setShowDevCodeTree(false);
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
      DEV_CODE_ID: model.DEV_CODE_ID || null,
    });
    setShowDevCodeTree(false);
    setIsModalOpen(true);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setShowDevCodeTree(false);
    setModelForm({
      MODEL_NAME: '',
      MODEL_OID: '',
      VENDOR_ID: null,
      DEV_CODE_ID: null,
    });
  };

  // 장비군 선택 핸들러
  const handleSelectDevCode = (devCode) => {
    setModelForm(prev => ({ ...prev, DEV_CODE_ID: devCode.DEV_CODE_ID }));
    setShowDevCodeTree(false);
  };

  // 선택된 장비군 이름 찾기 (재귀)
  const findDevCodeName = (devCodeId, tree = devCodeTree) => {
    for (const node of tree) {
      if (node.DEV_CODE_ID === devCodeId) return node.CODE_NM;
      if (node.children?.length > 0) {
        const found = findDevCodeName(devCodeId, node.children);
        if (found) return found;
      }
    }
    return null;
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
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <i className="bi bi-cpu"></i>
            모델 관리
          </h1>
          <span className="page-subtitle">장비 모델 및 OID를 관리합니다</span>
        </div>
      </div>

      {/* 패널 래퍼 */}
      <div className="model-panels-wrapper">
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

                    {vendor.models.length > 0 && (
                      <ul className={`model-list ${isExpanded ? 'expanded' : ''}`}>
                        {vendor.models.map(model => (
                          <li
                            key={model.MODEL_ID}
                            className={`model-item ${selectedModel?.MODEL_ID === model.MODEL_ID ? 'selected' : ''}`}
                            onClick={(e) => handleModelClick(model, e)}
                          >
                            <i className="bi bi-cpu model-icon"></i>
                            <span className="model-name" title={model.MODEL_NAME || '(이름 없음)'}>{model.MODEL_NAME || '(이름 없음)'}</span>
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
          <div className="model-detail-content">
            {/* 모델 헤더 영역 */}
            <div className="model-hero">
              <div className="model-hero-icon">
                <i className="bi bi-cpu-fill"></i>
              </div>
              <div className="model-hero-info">
                <h2 className="model-hero-name">{selectedModel.MODEL_NAME || '이름 없음'}</h2>
                <div className="model-hero-meta">
                  <span className="meta-badge vendor">
                    <i className="bi bi-building"></i>
                    {selectedModel.VENDOR_NAME || '벤더 미지정'}
                  </span>
                  {selectedModel.DEV_CODE_NM && (
                    <span className="meta-badge device-type">
                      <i className="bi bi-diagram-3"></i>
                      {selectedModel.DEV_CODE_NM}
                    </span>
                  )}
                </div>
              </div>
              <div className="model-hero-actions">
                <button
                  className="action-btn edit"
                  onClick={() => handleOpenEditModal(selectedModel)}
                  title="모델 수정"
                >
                  <i className="bi bi-pencil-fill"></i>
                </button>
                <button
                  className="action-btn delete"
                  onClick={() => handleDeleteModel(selectedModel)}
                  title="모델 삭제"
                >
                  <i className="bi bi-trash-fill"></i>
                </button>
              </div>
            </div>

            {/* 정보 카드 그리드 */}
            <div className="model-info-grid">
              {/* OID 정보 카드 */}
              <div className="info-card oid-card">
                <div className="oid-card-content">
                  <span className="oid-card-label">모델 식별 OID</span>
                  <div className="oid-card-value-wrap">
                    <code className="oid-card-value">{selectedModel.MODEL_OID || '미설정'}</code>
                    {selectedModel.MODEL_OID && (
                      <button
                        className="oid-copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedModel.MODEL_OID);
                        }}
                        title="OID 복사"
                      >
                        <i className="bi bi-copy"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SNMP OID 설정 카드 */}
              <div className="info-card snmp-card" onClick={handleOpenOidModal}>
                <div className="snmp-card-visual">
                  <div className="snmp-ring">
                    <svg viewBox="0 0 36 36">
                      <path
                        className="ring-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="ring-fill"
                        strokeDasharray={`${Math.min(configuredOidCount * 10, 100)}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="ring-value">{configuredOidCount}</span>
                  </div>
                </div>
                <div className="snmp-card-info">
                  <span className="snmp-card-title">SNMP 수집 설정</span>
                  <span className="snmp-card-desc">OID {configuredOidCount}개 설정됨</span>
                </div>
                <i className="bi bi-chevron-right card-arrow"></i>
              </div>

              {/* 등록 정보 카드 */}
              <div className="info-card date-card">
                <div className="date-rows">
                  <div className="date-row">
                    <div className="date-led created"></div>
                    <span className="date-label">생성일</span>
                    <span className="date-value">
                      {selectedModel.CREATE_AT
                        ? new Date(selectedModel.CREATE_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '-'}
                    </span>
                  </div>
                  <div className="date-row">
                    <div className="date-led modified"></div>
                    <span className="date-label">수정일</span>
                    <span className="date-value">
                      {selectedModel.MODIFY_AT
                        ? new Date(selectedModel.MODIFY_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-selection">
            <div className="no-selection-icon">
              <i className="bi bi-cpu"></i>
            </div>
            <h3>모델을 선택하세요</h3>
            <p>좌측 트리에서 모델을 선택하면<br/>상세 정보가 표시됩니다</p>
          </div>
        )}
        </div>
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

            <div className="form-group">
              <label>장비군</label>
              <div className="dev-code-selector">
                <div
                  className="dev-code-input"
                  onClick={() => setShowDevCodeTree(true)}
                >
                  <span className={modelForm.DEV_CODE_ID ? 'selected' : 'placeholder'}>
                    {modelForm.DEV_CODE_ID
                      ? findDevCodeName(modelForm.DEV_CODE_ID) || '선택됨'
                      : '장비군 선택 (선택사항)'}
                  </span>
                  <i className="bi bi-folder2-open"></i>
                </div>
              </div>
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

      {/* 장비군 선택 모달 */}
      {showDevCodeTree && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content dev-code-modal">
            <span className="close-btn" onClick={() => setShowDevCodeTree(false)}>&times;</span>
            <h3 className="modal-title">
              <i className="bi bi-folder2"></i> 장비군 선택
            </h3>

            <div className="dev-code-tree-container">
              <div
                className={`dev-code-option none-option ${!modelForm.DEV_CODE_ID ? 'selected' : ''}`}
                onClick={() => {
                  setModelForm(prev => ({ ...prev, DEV_CODE_ID: null }));
                  setShowDevCodeTree(false);
                }}
              >
                <i className="bi bi-x-circle"></i> 선택 안함
              </div>
              {devCodeTree.length === 0 ? (
                <div className="no-dev-codes">
                  <i className="bi bi-folder-x"></i>
                  <p>등록된 장비군이 없습니다.</p>
                </div>
              ) : (
                <DevCodeTreeNode
                  nodes={devCodeTree}
                  onSelect={handleSelectDevCode}
                  selectedId={modelForm.DEV_CODE_ID}
                />
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDevCodeTree(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 장비군 트리 노드 컴포넌트
function DevCodeTreeNode({ nodes, onSelect, selectedId, depth = 0 }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="dev-code-tree" style={{ paddingLeft: depth > 0 ? '16px' : '0' }}>
      {nodes.map(node => (
        <div key={node.DEV_CODE_ID}>
          <div
            className={`dev-code-option ${selectedId === node.DEV_CODE_ID ? 'selected' : ''}`}
            onClick={() => onSelect(node)}
          >
            {node.children?.length > 0 && (
              <i
                className={`bi ${expanded[node.DEV_CODE_ID] ? 'bi-chevron-down' : 'bi-chevron-right'} expand-icon`}
                onClick={(e) => toggleExpand(node.DEV_CODE_ID, e)}
              ></i>
            )}
            {!node.children?.length && <span className="expand-spacer"></span>}
            <i className="bi bi-folder2"></i>
            <span>{node.CODE_NM}</span>
          </div>
          {node.children?.length > 0 && expanded[node.DEV_CODE_ID] && (
            <DevCodeTreeNode
              nodes={node.children}
              onSelect={onSelect}
              selectedId={selectedId}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}
