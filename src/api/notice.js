import apiClient from './client';

export const noticeApi = {
  // 목록 조회
  getList: (page = 1, size = 10, search) => {
    const params = new URLSearchParams({ page, size });
    if (search) params.append('search', search);
    return apiClient.get(`/notice/posts?${params.toString()}`);
  },

  // 상세 조회
  getPost: (noticeId) =>
    apiClient.get(`/notice/posts/${noticeId}`),

  // 등록
  createPost: (postData) =>
    apiClient.post('/notice/posts', postData),

  // 수정
  updatePost: (noticeId, postData) =>
    apiClient.put(`/notice/posts/${noticeId}`, postData),

  // 삭제
  deletePost: (noticeId) =>
    apiClient.delete(`/notice/posts/${noticeId}`),
};
