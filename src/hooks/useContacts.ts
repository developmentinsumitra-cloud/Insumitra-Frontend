import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { deleteOrRequestEntity } from '@utils/deleteAction';

export function useContacts(params?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn:  () => contactsService.list(params),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn:  () => contactsService.get(id),
    enabled:  !!id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: contactsService.create,
    onSuccess: (res: any) => {
      const created = res?.data?.data || res?.data || res;
      if (created && (created.id || created._id)) {
        qc.setQueriesData({ queryKey: ['contacts'] }, (old: any) => {
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
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create contact'),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => contactsService.update(id, body),
    onSuccess: (res: any, variables) => {
      const updated = res?.data?.data || res?.data || res;
      const targetId = variables.id;
      if (targetId) {
        qc.setQueriesData({ queryKey: ['contacts'] }, (old: any) => {
          if (!old) return old;
          const updateItem = (item: any) =>
            (item.id === targetId || item._id === targetId || item.contactId === targetId)
              ? { ...item, ...variables.body, ...(updated && typeof updated === 'object' ? updated : {}) }
              : item;
          if (Array.isArray(old)) return old.map(updateItem);
          if (Array.isArray(old.data)) return { ...old, data: old.data.map(updateItem) };
          if (Array.isArray(old.data?.data)) return { ...old, data: { ...old.data, data: old.data.data.map(updateItem) } };
          return old;
        });
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated');
    },
    onError:   (e: any) => {
      const msgs = e.response?.data?.errors || e.response?.data?.message;
      const errMsg = Array.isArray(msgs) ? msgs.join(', ') : msgs;
      toast.error(errMsg ?? 'Failed to update contact');
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const role = useAuthStore(s => s.user?.role);
  return useMutation({
    mutationFn: (id: string) => deleteOrRequestEntity({
      role,
      entityType: 'Contact',
      entityId: id,
      deleteFn: () => contactsService.remove(id),
      requestReason: 'Employee requested deletion of contact',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(result.mode === 'requested' ? 'Deletion request submitted to admin' : 'Contact deleted');
    },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete contact'),
  });
}

export function useUpcomingBirthdays(days = 30, enabled = false) {
  return useQuery({
    queryKey: ['contacts', 'birthdays', days],
    queryFn:  () => contactsService.birthdays(days),
    enabled,
  });
}
