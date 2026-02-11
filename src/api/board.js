import apiClient from './client';

export const boardApi = {
  // 목록 조회 (페이지네이션 + 검색 + 카테고리)
  getPostList: (page = 1, size = 10, sort = 'POST_ID', order = 'desc', search, category, userId) => {
    const params = new URLSearchParams({ page, size, sort, order });
    if (userId) params.append('userId', userId);
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    return apiClient.get(`/board/posts?${params.toString()}`);
  },

  // 상세 조회 (조회수 증가 + 첨부파일 포함)
  getPost: (postId, userId) =>
    apiClient.get(`/board/posts/${postId}${userId ? `?userId=${userId}` : ''}`),

  // 등록 (multipart: post JSON + files)
  createPost: (postData, files, userId) => {
    const formData = new FormData();
    formData.append('post', new Blob([JSON.stringify(postData)], { type: 'application/json' }));
    if (files && files.length > 0) {
      files.forEach((file) => formData.append('files', file));
    }
    return apiClient.post(`/board/posts?userId=${userId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 수정 (multipart: post JSON + files)
  updatePost: (postId, postData, files) => {
    const formData = new FormData();
    formData.append('post', new Blob([JSON.stringify(postData)], { type: 'application/json' }));
    if (files && files.length > 0) {
      files.forEach((file) => formData.append('files', file));
    }
    return apiClient.put(`/board/posts/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 삭제
  deletePost: (postId) =>
    apiClient.delete(`/board/posts/${postId}`),

  // 첨부파일 다운로드
  downloadAttach: (attachId) =>
    apiClient.get(`/board/attach/${attachId}/download`, { responseType: 'blob' }),
};
