import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkflowTemplate } from '@/data/types';
import {
  listWorkflowTemplates,
  getWorkflowTemplate,
  saveWorkflowTemplate,
  deleteWorkflowTemplate,
} from '../workflow-templates';

const KEYS = {
  all: ['workflow-templates'] as const,
  list: () => ['workflow-templates', 'list'] as const,
  detail: (id: string) => ['workflow-templates', 'detail', id] as const,
};

export function useWorkflowTemplates() {
  return useQuery({ queryKey: KEYS.list(), queryFn: listWorkflowTemplates });
}

export function useWorkflowTemplate(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => getWorkflowTemplate(id!),
    enabled: Boolean(id),
  });
}

export function useSaveWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: WorkflowTemplate) => saveWorkflowTemplate(record),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkflowTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
