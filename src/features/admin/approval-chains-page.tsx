import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import {
  useApprovalChains,
  useUpsertApprovalChain,
} from '@/lib/db/hooks/use-approval-chains';
import type { ApprovalChain } from '@/lib/db/approval-chains';

export function ApprovalChainsPage() {
  const { data: serverChains = [], isLoading } = useApprovalChains();
  const upsertChain = useUpsertApprovalChain();

  // Local edit buffer — only holds chains currently being edited
  const [editBuffer, setEditBuffer] = useState<Record<string, ApprovalChain>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Clear edit buffer for chains that no longer exist (e.g. after delete)
  useEffect(() => {
    if (!serverChains.length) return;
    const ids = new Set(serverChains.map((c) => c.id));
    setEditBuffer((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) { delete next[k]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [serverChains]);

  // Merge: server chains + local new chains + edit overrides
  const newChains = Object.values(editBuffer).filter(
    (c) => !serverChains.some((s) => s.id === c.id),
  );
  const chains: ApprovalChain[] = [
    ...serverChains.map((c) => editBuffer[c.id] ?? c),
    ...newChains,
  ];

  function getEditable(chain: ApprovalChain): ApprovalChain {
    return editBuffer[chain.id] ?? chain;
  }

  function patchEdit(id: string, patch: Partial<ApprovalChain>) {
    setEditBuffer((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? chains.find((c) => c.id === id)!), ...patch },
    }));
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }

  function addStep(chainId: string) {
    const chain = getEditable(chains.find((c) => c.id === chainId)!);
    patchEdit(chainId, {
      steps: [...chain.steps, { id: `s${Date.now()}`, role: 'New Approver' }],
    });
  }

  function removeStep(chainId: string, stepId: string) {
    const chain = getEditable(chains.find((c) => c.id === chainId)!);
    patchEdit(chainId, { steps: chain.steps.filter((s) => s.id !== stepId) });
  }

  function updateStepRole(chainId: string, stepId: string, role: string) {
    const chain = getEditable(chains.find((c) => c.id === chainId)!);
    patchEdit(chainId, {
      steps: chain.steps.map((s) => (s.id === stepId ? { ...s, role } : s)),
    });
  }

  function updateThreshold(chainId: string, threshold: string) {
    patchEdit(chainId, { threshold });
  }

  function addChain() {
    const id = `chain-${Date.now()}`;
    const newChain: ApprovalChain = {
      id,
      name: 'New Chain',
      description: 'Define the approval chain',
      threshold: 'TBD',
      steps: [{ id: `s${Date.now()}`, role: 'Approver' }],
      referencedBy: [],
    };
    setEditBuffer((prev) => ({ ...prev, [id]: newChain }));
    setExpandedId(id);
    setEditingId(id);
  }

  async function saveChain(chainId: string) {
    const chain = getEditable(chains.find((c) => c.id === chainId)!);
    try {
      await upsertChain.mutateAsync(chain);
      // Remove from edit buffer — server is now source of truth
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[chainId];
        return next;
      });
      setEditingId(null);
      toast.success('Approval chain saved');
    } catch (e) {
      console.error('Failed to save approval chain:', e);
      toast.error('Failed to save. Please try again.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading approval chains…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Chains"
        subtitle="Configure approval workflows based on request value"
        actions={
          <Button onClick={addChain}>
            <Plus className="mr-1.5 size-4" />
            Add Chain
          </Button>
        }
      />

      <div className="space-y-3">
        {chains.map((rawChain) => {
          const chain = getEditable(rawChain);
          const isExpanded = expandedId === chain.id;
          const isEditing = editingId === chain.id;
          const isSaving = upsertChain.isPending;

          return (
            <Card key={chain.id} className="overflow-hidden">
              {/* Header */}
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
                onClick={() => toggleExpand(chain.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{chain.name}</p>
                    <p className="text-xs text-muted-foreground">{chain.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    EUR {chain.threshold}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {chain.steps.length} step(s)
                  </span>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-4">
                  {/* Stepper */}
                  <div className="flex items-center gap-2 overflow-x-auto py-2">
                    {chain.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5">
                            <GripVertical className="size-3.5 text-muted-foreground" />
                            <Input
                              value={step.role}
                              onChange={(e) => updateStepRole(chain.id, step.id, e.target.value)}
                              className="h-7 w-32 text-xs"
                            />
                            <button
                              onClick={() => removeStep(chain.id, step.id)}
                              className="text-red-400 hover:text-red-600"
                              disabled={chain.steps.length <= 1}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                              {idx + 1}
                            </div>
                            <span className="whitespace-nowrap text-sm">{step.role}</span>
                          </div>
                        )}
                        {idx < chain.steps.length - 1 && <div className="h-px w-6 bg-gray-300" />}
                      </div>
                    ))}
                    {isEditing && (
                      <Button variant="outline" size="sm" className="h-8" onClick={() => addStep(chain.id)}>
                        <Plus className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Threshold editing */}
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Threshold:</span>
                      <Input
                        value={chain.threshold}
                        onChange={(e) => updateThreshold(chain.id, e.target.value)}
                        className="h-8 w-48 text-sm"
                      />
                    </div>
                  )}

                  {/* Referenced routing rules */}
                  {chain.referencedBy.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Referenced by routing rules:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {chain.referencedBy.map((rule) => (
                          <span key={rule} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                            {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 border-t pt-3">
                    {isEditing ? (
                      <Button size="sm" onClick={() => saveChain(chain.id)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setEditingId(chain.id); }}
                      >
                        <Pencil className="mr-1.5 size-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
