import { useState } from 'react';
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
import { bandLabel, governedBounds, diagnoseChains } from '@/lib/workflow/approval-bands';
import { usePolicyConfig } from '@/lib/procurement/use-policy-config';
import {
  CURRENCY_POLICY_KEYS, POLICY_KEY_META, isPolicyToken, policyToken,
} from '@/lib/procurement/policy-tokens';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

// Radix Select cannot hold an empty-string item value.
const OPEN_END = '__open__';
const LITERAL = '__literal__';

export function ApprovalChainsPage() {
  const { data: serverChains = [], isLoading } = useApprovalChains();
  const upsertChain = useUpsertApprovalChain();
  const policyConfig = usePolicyConfig();

  // Diagnostics run over the EDITED view, not the server's, so a gap or an
  // overlap shows while the admin is making it rather than after they save.
  // An unbanded chain is not a problem — that is how a chain says "reachable
  // only by a routing rule naming me".

  // Local edit buffer — only holds chains currently being edited
  const [editBuffer, setEditBuffer] = useState<Record<string, ApprovalChain>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Chains created here and not yet saved.
  //
  // This replaces an effect that pruned the edit buffer of every entry whose id
  // was absent from the server list. It could not tell "deleted on the server"
  // from "created locally, not saved yet" — and a new chain is exactly the
  // second case, so adding one and letting the query refetch silently destroyed
  // it before it could be saved. Tracking the ids we minted answers the
  // question the effect was guessing at.
  //
  // Nothing prunes the buffer now: an entry for a server-deleted chain is in
  // neither list below, so it is simply never read.
  const [localChainIds, setLocalChainIds] = useState<Set<string>>(() => new Set());

  // Merge: server chains + local new chains + edit overrides
  const newChains = Object.values(editBuffer).filter(
    (c) => localChainIds.has(c.id) && !serverChains.some((s) => s.id === c.id),
  );
  const chains: ApprovalChain[] = [
    ...serverChains.map((c) => editBuffer[c.id] ?? c),
    ...newChains,
  ];

  function getEditable(chain: ApprovalChain): ApprovalChain {
    return editBuffer[chain.id] ?? chain;
  }

  const bandProblems = diagnoseChains(chains, policyConfig);

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
    // Derived from the chain rather than `Date.now()`: the clock is impure, and
    // two steps added inside the same millisecond would have collided on it.
    const nextId = `s${Math.max(0, ...chain.steps.map((s) => Number(s.id.replace(/\D/g, '')) || 0)) + 1}`;
    patchEdit(chainId, {
      steps: [...chain.steps, { id: nextId, role: 'New Approver' }],
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

  function addChain() {
    const id = `chain-${Date.now()}`;
    const newChain: ApprovalChain = {
      id,
      name: 'New Chain',
      description: 'Define the approval chain',
      // No band, so it is not selectable by value until the admin sets one.
      // It used to default to 'TBD', which the regex parser read as [0, ∞) —
      // a brand-new chain silently captured every request in the platform.
      threshold: 'By routing rule only',
      minValue: null,
      maxValue: null,
      steps: [{ id: `s${Date.now()}`, role: 'Approver' }],
      referencedBy: [],
    };
    setEditBuffer((prev) => ({ ...prev, [id]: newChain }));
    setLocalChainIds((prev) => new Set(prev).add(id));
    setExpandedId(id);
    setEditingId(id);
  }

  async function saveChain(chainId: string) {
    const edited = getEditable(chains.find((c) => c.id === chainId)!);
    // `threshold` is a rendered label now, written from the bounds rather than
    // typed. It was the parsed source of truth, and a label that can disagree
    // with the band it names is the whole problem being removed.
    const chain = { ...edited, threshold: bandLabel(edited, policyConfig) };
    try {
      await upsertChain.mutateAsync(chain);
      // Remove from edit buffer — server is now source of truth
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[chainId];
        return next;
      });
      // No longer a local-only chain: it exists on the server now.
      setLocalChainIds((prev) => {
        if (!prev.has(chainId)) return prev;
        const next = new Set(prev);
        next.delete(chainId);
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

      {bandProblems.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="size-4 shrink-0" />
            The value bands do not cover every request cleanly
          </p>
          <ul className="mt-1.5 space-y-1 pl-6 text-xs text-amber-800">
            {bandProblems.map((d) => (
              <li key={d.chainId}>
                <span className="font-medium">{d.chainName}</span> — {d.problems.join(' ')}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 pl-6 text-xs text-amber-800">
            A gap means a request reaches the approval stage with nobody able to approve it. An
            overlap means whichever chain is found first silently wins.
          </p>
        </div>
      )}

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
                  {/* Derived from the bounds, never the stored label: a chain
                      edited but not yet saved must show the band it will have.
                      The "EUR" prefix was hardcoded here and now reads wrong —
                      the label already carries its own currency, and an
                      unbanded chain says "By routing rule only". */}
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {bandLabel(chain, policyConfig)}
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

                  {/* Value band. Was a free-text string parsed by regex, where a
                      value with no number in it read as [0, ∞) and shadowed
                      every properly banded chain behind it. */}
                  {isEditing && (
                    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-600">
                        Value band — the request values this chain approves
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <BoundEditor
                          label="From"
                          value={chain.minValue ?? null}
                          onChange={(v) => patchEdit(chain.id, { minValue: v })}
                        />
                        <BoundEditor
                          label="Up to"
                          value={chain.maxValue ?? null}
                          onChange={(v) => patchEdit(chain.id, { maxValue: v })}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {bandLabel(chain, policyConfig)}
                        {!chain.minValue && !chain.maxValue &&
                          ' — this chain is never selected by value. A routing rule must name it.'}
                      </p>
                      {(() => {
                        const g = governedBounds(chain, policyConfig);
                        if (!g.min && !g.max) return null;
                        return (
                          <p className="text-xs text-gray-500">
                            Follows {[g.min, g.max].filter(Boolean).join(' and ')}.
                          </p>
                        );
                      })()}
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

/**
 * One end of a value band: open, a governed threshold, or a typed amount.
 *
 * Open at both ends is the legitimate way to say "this chain is reached by a
 * routing rule naming it, never by value" — which is why absence must not be
 * read as [0, ∞), the bug this whole change removes.
 */
function BoundEditor({
  label, value, onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const mode = value === null || value === '' ? OPEN_END : isPolicyToken(value) ? value : LITERAL;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <Select
        value={mode}
        onValueChange={(v) => {
          if (v === OPEN_END) onChange(null);
          else if (v === LITERAL) onChange('0');
          else onChange(v);
        }}
      >
        <SelectTrigger className="h-8 w-52 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OPEN_END}>No limit</SelectItem>
          <SelectItem value={LITERAL}>A specific amount</SelectItem>
          {CURRENCY_POLICY_KEYS.map((k) => (
            <SelectItem key={k} value={policyToken(k)}>{POLICY_KEY_META[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === LITERAL && (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Amount"
          className="h-8 w-28 text-sm"
        />
      )}
    </div>
  );
}
