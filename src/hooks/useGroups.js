import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api';

export const useGroupTree = () => {
  return useQuery({
    queryKey: ['groupTree'],
    queryFn: async () => {
      const response = await groupsApi.getGroupTree();
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

export const useGroup = (groupId) => {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const response = await groupsApi.getGroup(groupId);
      return response.data?.data || response.data;
    },
    enabled: !!groupId,
  });
};

export const useChildGroups = (parentId) => {
  return useQuery({
    queryKey: ['childGroups', parentId],
    queryFn: async () => {
      const response = await groupsApi.getChildGroups(parentId);
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!parentId,
  });
};

export const useDescendantsCount = (groupId) => {
  return useQuery({
    queryKey: ['descendantsCount', groupId],
    queryFn: async () => {
      const response = await groupsApi.getDescendantsCount(groupId);
      return response.data?.data || 0;
    },
    enabled: !!groupId,
  });
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupTree'] });
      queryClient.invalidateQueries({ queryKey: ['childGroups'] });
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, data }) => groupsApi.updateGroup(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupTree'] });
      queryClient.invalidateQueries({ queryKey: ['group'] });
      queryClient.invalidateQueries({ queryKey: ['childGroups'] });
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupTree'] });
      queryClient.invalidateQueries({ queryKey: ['childGroups'] });
    },
  });
};

export const useMoveGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, parentGroupId }) => groupsApi.moveGroup(groupId, parentGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupTree'] });
      queryClient.invalidateQueries({ queryKey: ['childGroups'] });
    },
  });
};

export const useUpdateGroupIcon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, iconName, iconType }) => groupsApi.updateGroupIcon(groupId, iconName, iconType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupTree'] });
    },
  });
};
