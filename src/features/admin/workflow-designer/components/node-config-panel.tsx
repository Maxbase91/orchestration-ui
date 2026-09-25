// Workflow designer — right-hand node configuration panel. Renders the
// type-specific settings form for the selected canvas node; edits are staged
// in local form state and only written back to the graph on Save.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAiAgents } from '@/lib/db/hooks/use-ai-agents';
import { useFunctionalRoles } from '@/lib/db/hooks/use-functional-roles';
import type { Node, Edge } from '@xyflow/react';
import { ConditionCard } from '@/features/admin/routing-rules/components/condition-card';
import type { EdgeCondition } from '@/lib/workflow/edge-conditions';

interface NodeConfigPanelProps {
  node: Node;
  /** Every edge on the canvas — a decision node configures its own branches,
   *  because a branch condition belongs to the branch, not to the node. */
  edges: Edge[];
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeConfigPanel({
  node, edges, onUpdate, onUpdateEdge, onDelete, onClose,
}: NodeConfigPanelProps) {
  const nodeLabel = (id: string) => id;
  const { data: aiAgents = [] } = useAiAgents();
  const { data: functionalRoles = [] } = useFunctionalRoles();
  // Staged edits, initialised from the node. The caller keys this panel on the
  // node id, so selecting a different node remounts it with fresh state — which
  // is what the effect that used to copy `node.data` into state was for.
  //
  // Keying on the id is also stricter than that effect was: it also listed
  // `node.data`, so any change to that object's identity threw away whatever
  // the user had typed but not yet saved, for the node they were still editing.
  const [formData, setFormData] = useState<Record<string, unknown>>({ ...node.data });

  function handleSave() {
    onUpdate(node.id, formData);
    onClose();
  }

  function set(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function renderFields() {
    switch (node.type) {
      case 'userTask':
        // These four are the fields the runtime actually reads (see
        // lib/workflow/node-config.ts). They were previously named assignee /
        // instructions / timeout, collected here and discarded on save; they now
        // persist under the names the engine uses.
        return (
          <>
            <Field label="Owner role">
              {/* Picked from the configured roles (Approval Chains → Roles): a
                  typed name that matched nothing left the stage unassigned —
                  which is what happened to "Vendor management". */}
              <select
                aria-label="Owner role"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={(formData.role as string) ?? ''}
                onChange={(e) => set('role', e.target.value)}
              >
                <option value="">No owner</option>
                {typeof formData.role === 'string' && formData.role !== '' && !functionalRoles.some((r) => r.name === formData.role) && (
                  <option value={formData.role}>{formData.role} (not configured)</option>
                )}
                {functionalRoles.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Who acts as each role is set under Approval Chains → Roles.
              </p>
            </Field>
            <Field label="Purpose / exit criteria">
              <Textarea
                value={(formData.purpose as string) ?? ''}
                onChange={(e) => set('purpose', e.target.value)}
                rows={3}
                placeholder="What has to be true before this stage can be completed?"
              />
            </Field>
            {/* Shown to the requester on the Channel page before they submit,
                and on the request's Workflow tab — "You: …". Leave it empty
                where the requester does nothing: the page then says nothing. */}
            <Field label="What the requester does here">
              <Textarea
                aria-label="What the requester does here"
                value={(formData.requesterAction as string) ?? ''}
                onChange={(e) => set('requesterAction', e.target.value)}
                rows={2}
                placeholder="e.g. Describe what you need and submit it. Leave empty if they do nothing here."
              />
            </Field>
            <Field label="SLA (working days)">
              <Input
                type="number"
                value={(formData.slaDays as number) ?? ''}
                onChange={(e) => set('slaDays', Number(e.target.value))}
                min={0}
              />
            </Field>
            <Field label="Leaving this stage">
              <Select
                value={(formData.gate as string) ?? 'manual'}
                onValueChange={(v) => set('gate', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Needs the owner to complete it</SelectItem>
                  <SelectItem value="auto">Advances automatically</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {/* "Escalate on timeout" was here. The save path never carried it
                and there is no escalation mechanism for a stage SLA to trigger,
                so it was a switch that changed nothing. An overdue stage is
                surfaced by the SLA deadline, which is `slaDays` above. */}
          </>
        );

      // `approval`, `timer` and `subWorkflow` are gone from the palette, and
      // their config with them. Approval chains decide who approves — by value
      // band, or by a routing rule naming one — so a second approver field here
      // was a control the runtime never read. Waiting is `slaDays` on the stage.
      // Sub-workflow had no runtime at all. The auto-approve condition field
      // went with them: a fifth dialect for expressing a threshold, with no
      // reader anywhere.

      case 'decision': {
        // A decision does not carry a condition — its BRANCHES do, and they
        // differ, which is the whole point of branching. This panel collected
        // one conditionField/Operator/Value for the node, persisted none of it,
        // and left the real decision in free-text edge labels: WF-002's
        // `> €5K` never evaluated, so every catalogue order took the same
        // branch regardless of value.
        const outgoing = edges.filter((e) => e.source === node.id);
        return (
          <div className="space-y-3">
            <p className="text-xs text-ink-3">
              Each outgoing branch carries its own condition. They are tried in order; the
              branch with no condition is the default and is taken when none of the others
              holds.
            </p>
            {outgoing.length === 0 && (
              <p className="text-xs text-warn">
                This decision has no outgoing branches, so nothing can follow it.
              </p>
            )}
            {outgoing.map((edge) => {
              const target = nodeLabel(edge.target);
              const condition = (edge.data?.condition as EdgeCondition | undefined) ?? null;
              return (
                <div key={edge.id} className="rounded-md border border-line p-2.5">
                  <p className="mb-1.5 text-xs font-medium text-ink-2">→ {target}</p>
                  {condition ? (
                    <ConditionCard
                      condition={condition}
                      onChange={(next) => onUpdateEdge(edge.id, { condition: next })}
                      onRemove={() => onUpdateEdge(edge.id, { condition: null })}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-3">
                        No condition — this is the default branch.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onUpdateEdge(edge.id, {
                          condition: { field: 'value', operator: 'greater_than', value: '' },
                        })}
                      >
                        Add condition
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {outgoing.length > 0 && outgoing.every((e) => e.data?.condition) && (
              <p className="text-xs text-warn">
                Every branch has a condition, so a request matching none of them falls through
                to the first. Leave one branch unconditional as the default.
              </p>
            )}
          </div>
        );
      }

      case 'systemAction':
      case 'aiAgent':
      case 'notification':
        // All three persist as the template's `integration` type, which the
        // engine handles; `integrationKind` is what keeps them distinct on
        // reload. Before this they saved as plain stages — the label survived
        // and the node kind did not.
        return (
          <>
            <Field label="Integration kind">
              <Select
                value={(formData.integrationKind as string) ?? node.type ?? 'systemAction'}
                onValueChange={(v) => set('integrationKind', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="systemAction">System action</SelectItem>
                  <SelectItem value="aiAgent">AI agent</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {(formData.integrationKind ?? node.type) === 'aiAgent' && (
              <Field label="Agent">
                <Select
                  value={(formData.agentId as string) ?? ''}
                  onValueChange={(v) => set('agentId', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                  <SelectContent>
                    {aiAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <p className="text-xs text-ink-3">
              The engine logs and continues past an integration node — there are no live
              upstream connections in this release.
            </p>
          </>
        );

      default:
        return <p className="text-sm text-ink-3">No configuration available for this node type.</p>;
    }
  }

  return (
    <div className="w-72 shrink-0 border-l border-line bg-card overflow-y-auto">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Node Configuration</h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-2 text-lg leading-none">&times;</button>
        </div>
        <p className="text-xs text-ink-3 mt-0.5 capitalize">{node.type?.replace(/([A-Z])/g, ' $1').trim()}</p>
      </div>

      <div className="p-4 space-y-4">
        <Field label="Label">
          <Input value={(formData.label as string) ?? ''} onChange={(e) => set('label', e.target.value)} />
        </Field>

        {renderFields()}

        <div className="flex gap-2 pt-2 border-t border-line">
          <Button size="sm" onClick={handleSave} className="flex-1">Save</Button>
          <Button size="sm" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        </div>

        <Button
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={() => {
            onDelete(node.id);
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
