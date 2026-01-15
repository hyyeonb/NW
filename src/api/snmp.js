import apiClient from './client';

export const snmpApi = {
  // 모든 메트릭 조회
  getMetrics: () => apiClient.get('/snmp/metrics'),

  // 모델의 OID 설정 조회
  getModelOids: (modelId) => apiClient.get(`/snmp/model/${modelId}/oids`),

  // 모델 OID 단일 저장
  saveModelOid: (modelId, oid) => apiClient.post(`/snmp/model/${modelId}/oid`, oid),

  // 모델 OID 일괄 저장
  saveModelOids: (modelId, oids) => apiClient.post(`/snmp/model/${modelId}/oids`, oids),

  // OID 삭제
  deleteOid: (oidId) => apiClient.delete(`/snmp/oid/${oidId}`),
};
