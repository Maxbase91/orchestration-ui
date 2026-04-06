import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { aiAgents } from '@/data/ai-agents';
import type { Node } from '@xyflow/react';

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({ ...node.data });

  useEffect(() => {
    setFormData({ ...node.data });
  }, [node.id, node.data]);

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
        return (
          <>
            <Field label="Assign to">
              <Input value={(formData.assignee as string) ?? ''} onChange={(e) => set('assignee', e.target.value)} placeholder="e.g. Line Manager" />
            </Field>
            <Field label="Instructions">
              <Textarea value={(formData.instructions as string) ?? ''} onChange={(e) => set('instructions', e.target.value)} rows={3} placeholder="Task instructions..." />
            </Field>
            <Field label="Timeout (days)">
              <Input type="number" value={(formData.timeout as number) ?? ''} onChange={(e) => set('timeout', Number(e.target.value))} min={0} />
            </Field>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Escalate on timeout</Label>
              <Switch checked={!!formData.escalateOnTimeout} onCheckedChange={(v) => set('escalateOnTimeout', v)} />
            </div>
          </>
        );

      case 'approval':
        return (
          <>
            <Field label="Approver">
              <Input value={(formData.approver as string) ?? ''} onChange={(e) => set('approver', e.target.value)} placeholder="e.g. Budget Owner" />
            </Field>
            <Field label="Approval type">
              <Select value={(formData.approvalType as string) ?? 'single'} onValueChange={(v) => set('approvalType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="majority">Majority</SelectItem>
                  <SelectItem value="unanimous">Unanimous</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timeout (days)">
              <Input type="number" value={(formData.timeout as number) ?? ''} onChange={(e) => set('timeout', Number(e.target.value))} min={0} />
            </Field>
            <Field label="Auto-approve conditions">
              <Input value={(formData.autoApproveConditions as string) ?? ''} onChange={(e) => set('autoApproveConditions', e.target.value)} placeholder="e.g. value < 1000" />
            </Field>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Allow delegation</Label>
              <Switch checked={!!formData.allowDelegation} onCheckedChange={(v) => set('allowDelegation', v)} />
            </div>
          </>
        );

      case 'aiAgent':
        return (
          <>
            <Field label="AI Agent">
              <Select value={(formData.agentId as string) ?? ''} onValueChange={(v) => set('agentId', v)}>
                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent>
                  {aiAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Confidence threshold">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={(formData.confidenceThreshold as number) ?? 80}
                  onChange={(e) => set('confidenceThreshold', Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-700 w-10 text-right">{(formData.confidenceThreshold as number) ?? 80}%</span>
              </div>
            </Field>
            <Field label="Fallback action">
              <Select value={(formData.fallbackAction as string) ?? 'escalate'} onValueChange={(v) => set('fallbackAction', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="escalate">Escalate to human</SelectItem>
                  <SelectItem value="skip">Skip step</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );

      case 'decision':
        return (
          <>
            <Field label="Condition field">
              <Input value={(formData.conditionField as string) ?? ''} onChange={(e) => set('conditionField', e.target.value)} placeholder="e.g. request.value" />
            </Field>
            <Field label="Operator">
              <Select value={(formData.conditionOperator as string) ?? 'equals'} onValueChange={(v) => set('conditionOperator', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Value">
              <Input value={(formData.conditionValue as string) ?? ''} onChange={(e) => set('conditionValue', e.target.value)} placeholder="e.g. 5000" />
            </Field>
          </>
        );

      case 'timer':
        return (
          <>
            <Field label="Duration">
              <Input type="number" value={(formData.duration as number) ?? ''} onChange={(e) => set('duration', Number(e.target.value))} min={0} />
            </Field>
            <Field label="Unit">
              <Select value={(formData.unit as string) ?? 'days'} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Action on expiry">
              <Select value={(formData.actionOnExpiry as string) ?? 'escalate'} onValueChange={(v) => set('actionOnExpiry', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="escalate">Escalate</SelectItem>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="notify">Notify</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );

      case 'systemAction':
        return (
          <>
            <Field label="Action type">
              <Select value={(formData.actionType as string) ?? 'send-email'} onValueChange={(v) => set('actionType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send-email">Send Email</SelectItem>
                  <SelectItem value="update-status">Update Status</SelectItem>
                  <SelectItem value="create-po">Create PO</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Configuration">
              <Textarea value={(formData.configuration as string) ?? ''} onChange={(e) => set('configuration', e.target.value)} rows={3} placeholder="Action configuration..." />
            </Field>
          </>
        );

      case 'notification':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Channels</Label>
              {(['email', 'in-app', 'sms'] as const).map((ch) => {
                const channels = (formData.channels as string[]) ?? [];
                return (
                  <div key={ch} className="flex items-center gap-2">
                    <Checkbox
                      checked={channels.includes(ch)}
                      onCheckedChange={(checked) => {
                        set('channels', checked ? [...channels, ch] : channels.filter((c) => c !== ch));
                      }}
                    />
                    <Label className="text-sm capitalize">{ch}</Label>
                  </div>
                );
              })}
            </div>
            <Field label="Recipient">
              <Input value={(formData.recipient as string) ?? ''} onChange={(e) => set('recipient', e.target.value)} placeholder="e.g. requestor" />
            </Field>
            <Field label="Template">
              <Input value={(formData.template as string) ?? ''} onChange={(e) => set('template', e.target.value)} placeholder="Template name..." />
            </Field>
          </>
        );

      default:
        return <p className="text-sm text-gray-500">No configuration available for this node type.</p>;
    }
  }

  return (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Node Configuration</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{node.type?.replace(/([A-Z])/g, ' $1').trim()}</p>
      </div>

      <div className="p-4 space-y-4">
        <Field label="Label">
          <Input value={(formData.label as string) ?? ''} onChange={(e) => set('label', e.target.value)} />
        </Field>

        {renderFields()}

        <div className="flex gap-2 pt-2 border-t border-gray-200">
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
