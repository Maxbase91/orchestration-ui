// TanStack Query bindings for the service description configuration.
//
// `useServiceDescriptionTemplate` resolves category-first with a `default`
// fallback and never returns null — generation and seeding must always have a
// template to work from, so the built-in stands in when nothing is configured.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteServiceDescriptionTemplate,
  listServiceDescriptionTemplates,
  resolveServiceDescriptionTemplate,
  saveServiceDescriptionTemplate,
} from '../service-description-templates';
import type { ServiceDescriptionTemplate } from '@/lib/procurement/service-description-config';

const KEYS = {
  all: ['service-description-templates'] as const,
  forCategory: (category: string) =>
    ['service-description-templates', 'category', category] as const,
};

export function useServiceDescriptionTemplates() {
  return useQuery({ queryKey: KEYS.all, queryFn: listServiceDescriptionTemplates });
}

/** The template that applies to a category, falling back to `default`. */
export function useServiceDescriptionTemplate(category: string | undefined) {
  return useQuery({
    queryKey: KEYS.forCategory(category ?? 'default'),
    queryFn: () => resolveServiceDescriptionTemplate(category),
  });
}

/**
 * Invalidates the whole prefix, not just the edited category: a `default` row
 * is the fallback for every category that has none, so editing it changes what
 * those categories resolve to.
 */
function useTemplateMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useSaveServiceDescriptionTemplate() {
  return useTemplateMutation((t: ServiceDescriptionTemplate) => saveServiceDescriptionTemplate(t));
}

export function useDeleteServiceDescriptionTemplate() {
  return useTemplateMutation((category: string) => deleteServiceDescriptionTemplate(category));
}
