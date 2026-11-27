import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { policiesService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deleteOrRequestEntity } from '@utils/deleteAction';

export function usePolicies(params?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['policies', params],
    queryFn: () => policiesService.list(params),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: ['policies', id],
    queryFn: () => policiesService.get(id),
    enabled: !!id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: policiesService.create,
    onSuccess: (res: any) => {
      const created = res?.data?.data || res?.data || res;
      if (created && (created.id || created._id)) {
        qc.setQueriesData({ queryKey: ['policies'] }, (old: any) => {
          if (!old) return old;
          const pid = created.id || created._id;
          const prependRow = (list: any[]) => {
            const exists = list.some(item => item.id === pid || item._id === pid);
            return exists ? list : [created, ...list];
          };
          if (Array.isArray(old)) return prependRow(old);
          if (Array.isArray(old.data)) return { ...old, data: prependRow(old.data) };
          if (Array.isArray(old.data?.data)) return { ...old, data: { ...old.data, data: prependRow(old.data.data) } };
          return old;
        });
      }
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policies-emi-tracking'] });
      qc.invalidateQueries({ queryKey: ['policies', 'phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['phc-tracking'] });
      try { localStorage.removeItem('insumitra_phc_tracking_cache'); } catch {}
      window.dispatchEvent(new CustomEvent('insumitra_phc_updated'));
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success('Policy created');
    },
    onError: (e: any) => {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' · ') : (e?.response?.data?.message ?? 'Error creating policy');
      toast.error(msg, { duration: 6000 });
    },
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => policiesService.update(id, body),
    onSuccess: (res: any, variables) => {
      const updated = res?.data?.data || res?.data || res;
      const targetId = variables.id;
      if (targetId) {
        qc.setQueriesData({ queryKey: ['policies'] }, (old: any) => {
          if (!old) return old;
          const updateItem = (item: any) =>
            (item.id === targetId || item._id === targetId)
              ? { ...item, ...variables.body, ...(updated && typeof updated === 'object' ? updated : {}) }
              : item;
          if (Array.isArray(old)) return old.map(updateItem);
          if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateItem) };
          if (Array.isArray(old.data?.data)) return { ...old, data: { ...old.data, data: old.data.data.map(updateItem) } };
          return old;
        });
      }
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policies-emi-tracking'] });
      qc.invalidateQueries({ queryKey: ['policies', 'phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['phc-tracking'] });
      try { localStorage.removeItem('insumitra_phc_tracking_cache'); } catch {}
      window.dispatchEvent(new CustomEvent('insumitra_phc_updated'));
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success('Policy updated');
    },
    onError: (e: any) => {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' · ') : (e?.response?.data?.message ?? 'Error updating policy');
      toast.error(msg, { duration: 6000 });
    },
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  return useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'Policy',
      entityId: id,
      deleteFn: () => policiesService.remove(id),
      requestReason: 'Employee requested deletion of policy',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policies-emi-tracking'] });
      qc.invalidateQueries({ queryKey: ['policies', 'phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['phc-tracking'] });
      try { localStorage.removeItem('insumitra_phc_tracking_cache'); } catch {}
      window.dispatchEvent(new CustomEvent('insumitra_phc_updated'));
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Policy deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting policy'),
  });
}

export function useBulkAssignPolicies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, assignedEmployeeId }: { ids: string[]; assignedEmployeeId: string | null }) =>
      policiesService.bulkAssign(ids, assignedEmployeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['policies-emi-tracking'] });
      qc.invalidateQueries({ queryKey: ['policies', 'phc-tracking'] });
      qc.invalidateQueries({ queryKey: ['phc-tracking'] });
      try { localStorage.removeItem('insumitra_phc_tracking_cache'); } catch {}
      window.dispatchEvent(new CustomEvent('insumitra_phc_updated'));
      toast.success('Policies successfully reassigned');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reassign policies'),
  });
}
