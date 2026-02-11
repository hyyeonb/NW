import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardApi } from '../api';

// 게시글 목록 조회
export const useBoardPosts = (page = 1, size = 10, sort = 'POST_ID', order = 'desc', search, category, userId) => {
  return useQuery({
    queryKey: ['boardPosts', page, size, sort, order, search || '', category || '', userId || ''],
    queryFn: async () => {
      const response = await boardApi.getPostList(page, size, sort, order, search, category, userId);
      const pageData = response.data?.data || response.data || {};
      return {
        content: Array.isArray(pageData.content) ? pageData.content : [],
        page: pageData.page || page,
        size: pageData.size || size,
        totalElements: pageData.totalElements || 0,
        totalPages: pageData.totalPages || 0,
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });
};

// 게시글 상세 조회
export const useBoardPost = (postId, userId) => {
  return useQuery({
    queryKey: ['boardPost', postId, userId || ''],
    queryFn: async () => {
      const response = await boardApi.getPost(postId, userId);
      return response.data?.data || response.data || null;
    },
    enabled: !!postId,
  });
};

// 게시글 등록
export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postData, files, userId }) =>
      boardApi.createPost(postData, files, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardPosts'] });
    },
  });
};

// 게시글 수정
export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, postData, files }) =>
      boardApi.updatePost(postId, postData, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardPosts'] });
      queryClient.invalidateQueries({ queryKey: ['boardPost'] });
    },
  });
};

// 게시글 삭제
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId) => boardApi.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardPosts'] });
    },
  });
};
