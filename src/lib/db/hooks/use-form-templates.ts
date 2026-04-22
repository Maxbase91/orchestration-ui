import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormTemplate } from '@/data/form-templates';
import {
  listFormTemplates,
  getFormTemplate,
  saveFormTemplate,
  deleteFormTemplate,
} from '../form-templates';

const KEYS = {
  all: ['form-templates'] as const,
  list: () => ['form-templates', 'list'] as const,
  detail: (id: string) => ['form-templates', 'detail', id] as const,
};

export function useFormTemplates() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: listFormTemplates,
  });
}

export function useFormTemplate(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getFormTemplate(id!),
    enabled: Boolean(id),
  });
}

export function useFormTemplateLookup() {
  const { data } = useFormTemplates();
  return {
    byId: (id: string | undefined): FormTemplate | undefined => {
      if (!id) return undefined;
      return data?.find((t) => t.id === id);
    },
    forStage: (stage: string): FormTemplate[] =>
      (data ?? []).filter((t) => t.triggerStages.includes(stage)),
  };
}

export function useSaveFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: FormTemplate) => saveFormTemplate(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFormTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
