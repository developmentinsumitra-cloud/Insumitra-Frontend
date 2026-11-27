import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimsService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deleteOrRequestEntity } from '@utils/deleteAction';

export function useClaims(params?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['claims', params],
    queryFn: () => claimsService.list(params),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['claims', id],
    queryFn: () => claimsService.get(id),
    enabled: !!id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useClaimSummary() {
  return useQuery({
    queryKey: ['claims', 'summary'],
    queryFn: () => claimsService.summary(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimsService.create,
    onSuccess: (res: any) => {
      const created = res?.data?.data || res?.data || res;
      if (created && (created.id || created._id)) {
        qc.setQueriesData({ queryKey: ['claims'] }, (old: any) => {
          if (!old) return old;
          const cid = created.id || created._id;
          const prependRow = (list: any[]) => {
            const exists = list.some(item => item.id === cid || item._id === cid);
            return exists ? list : [created, ...list];
          };
          if (Array.isArray(old)) return prependRow(old);
          if (Array.isArray(old.data)) return { ...old, data: prependRow(old.data) };
          if (Array.isArray(old.data?.data)) return { ...old, data: { ...old.data, data: prependRow(old.data.data) } };
          return old;
        });
      }
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success('Claim created');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Error'),
  });
}

export function useUpdateClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => claimsService.updateStatus(id, status),
    onSuccess: (res: any, variables) => {
      const targetId = variables.id;
      if (targetId) {
        qc.setQueriesData({ queryKey: ['claims'] }, (old: any) => {
          if (!old) return old;
          const updateItem = (item: any) => (item.id === targetId || item._id === targetId) ? { ...item, status: variables.status } : item;
          if (Array.isArray(old)) return old.map(updateItem);
          if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateItem) };
          if (Array.isArray(old.data?.data)) return { ...old, data: { ...old.data, data: old.data.data.map(updateItem) } };
          return old;
        });
      }
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success('Status updated');
    },
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  return useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'Claim',
      entityId: id,
      deleteFn: () => claimsService.remove(id),
      requestReason: 'Employee requested deletion of claim',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['contact-activity'] });
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Claim deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting claim'),
  });
}

export function useAddClaimExpense(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => claimsService.addExpense(claimId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claim', claimId] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      toast.success('Expense added');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to add expense'),
  });
}

export function useRemoveClaimExpense(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => claimsService.removeExpense(claimId, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claim', claimId] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      toast.success('Expense removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to remove expense'),
  });
}
