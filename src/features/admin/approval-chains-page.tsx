import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';

interface ApprovalStep {
  id: string;
  role: string;
}

interface ApprovalChain {
  id: string;
  name: string;
  description: string;
  threshold: string;
  steps: ApprovalStep[];
  referencedBy: string[];
}

const initialChains: ApprovalChain[] = [
  {
    id: 'chain-1',
    name: 'Standard',
    description: 'For requests between EUR 10k and EUR 100k',
    threshold: '10,000 - 100,000',
    steps: [
      { id: 's1', role: 'Budget Owner' },
      { id: 's2', role: 'Category Manager' },
      { id: 's3', role: 'Finance' },
    ],
    referencedBy: ['Standard Goods', 'Standard Services', 'Software Licensing'],
  },
  {
    id: 'chain-2',
    name: 'Fast-Track',
    description: 'For requests under EUR 10k',
    threshold: '< 10,000',
    steps: [{ id: 's1', role: 'Category Manager' }],
    referencedBy: ['Low-Value Purchases', 'Catalogue Orders'],
  },
  {
    id: 'chain-3',
    name: 'VP-Level',
    description: 'For requests between EUR 100k and EUR 500k',
    threshold: '100,000 - 500,000',
    steps: [
      { id: 's1', role: 'Budget Owner' },
      { id: 's2', role: 'Category Manager' },
      { id: 's3', role: 'Finance' },
      { id: 's4', role: 'VP Procurement' },
    ],
    referencedBy: ['High-Value Consulting', 'IT Infrastructure'],
  },
  {
    id: 'chain-4',
    name: 'Board-Level',
    description: 'For requests over EUR 500k',
    threshold: '> 500,000',
    steps: [
      { id: 's1', role: 'Budget Owner' },
      { id: 's2', role: 'Category Manager' },
      { id: 's3', role: 'Finance' },
      { id: 's4', role: 'VP Procurement' },
      { id: 's5', role: 'CFO' },
      { id: 's6', role: 'Board' },
    ],
    referencedBy: ['Strategic Engagements'],
  },
];

export function ApprovalChainsPage() {
  const [chains, setChains] = useState<ApprovalChain[]>(initialChains);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }

  function addStep(chainId: string) {
    setChains((prev) =>
      prev.map((c) =>
        c.id === chainId
          ? {
              ...c,
              steps: [
                ...c.steps,
                { id: `s${Date.now()}`, role: 'New Approver' },
              ],
            }
          : c
      )
    );
  }

  function removeStep(chainId: string, stepId: string) {
    setChains((prev) =>
      prev.map((c) =>
        c.id === chainId
          ? { ...c, steps: c.steps.filter((s) => s.id !== stepId) }
          : c
      )
    );
  }

  function updateStepRole(chainId: string, stepId: string, role: string) {
    setChains((prev) =>
      prev.map((c) =>
        c.id === chainId
          ? {
              ...c,
              steps: c.steps.map((s) =>
                s.id === stepId ? { ...s, role } : s
              ),
            }
          : c
      )
    );
  }

  function updateThreshold(chainId: string, threshold: string) {
    setChains((prev) =>
      prev.map((c) =>
        c.id === chainId ? { ...c, threshold } : c
      )
    );
  }

  function addChain() {
    const newChain: ApprovalChain = {
      id: `chain-${Date.now()}`,
      name: 'New Chain',
      description: 'Define the approval chain',
      threshold: 'TBD',
      steps: [{ id: `s${Date.now()}`, role: 'Approver' }],
      referencedBy: [],
    };
    setChains((prev) => [...prev, newChain]);
    setExpandedId(newChain.id);
    setEditingId(newChain.id);
    toast.success('New approval chain added');
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
        {chains.map((chain) => {
          const isExpanded = expandedId === chain.id;
          const isEditing = editingId === chain.id;

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
                    <p className="text-xs text-muted-foreground">
                      {chain.description}
                    </p>
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
                              onChange={(e) =>
                                updateStepRole(
                                  chain.id,
                                  step.id,
                                  e.target.value
                                )
                              }
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
                            <span className="whitespace-nowrap text-sm">
                              {step.role}
                            </span>
                          </div>
                        )}
                        {idx < chain.steps.length - 1 && (
                          <div className="h-px w-6 bg-gray-300" />
                        )}
                      </div>
                    ))}
                    {isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => addStep(chain.id)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Threshold editing */}
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Threshold:
                      </span>
                      <Input
                        value={chain.threshold}
                        onChange={(e) =>
                          updateThreshold(chain.id, e.target.value)
                        }
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
                          <span
                            key={rule}
                            className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                          >
                            {rule}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 border-t pt-3">
                    {isEditing ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          toast.success('Approval chain saved');
                        }}
                      >
                        Save Changes
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(chain.id);
                        }}
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
