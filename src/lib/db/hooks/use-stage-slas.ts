// Stage SLAs derived from the workflow templates — see
// src/lib/workflow/stage-sla.ts for why the templates own them.
import { useMemo } from 'react';
import { stageSlasFromTemplates, type StageSla } from '@/lib/workflow/stage-sla';
import { useWorkflowTemplates } from './use-workflow-templates';

export function useStageSlas(): { data: StageSla[]; isLoading: boolean } {
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const data = useMemo(() => stageSlasFromTemplates(templates), [templates]);
  return { data, isLoading };
}
