// Admin — service description configuration.
//
// Three things, matching what the description actually is: the prompt that
// generates it, the components the requester is asked for, and what comes out
// (a compact narrative and a detailed section-based document). Plus what a
// sourcing event raised from the demand starts with, since that is the main
// reason to capture the description carefully in the first place.
//
// A table rather than a settings store, because api/generate-sow and
// api/chat-intake read this server-side and cannot see localStorage — the same
// gap that stops /admin/thresholds reaching the intake conversation today.

import { useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useServiceDescriptionTemplates,
  useSaveServiceDescriptionTemplate,
  useDeleteServiceDescriptionTemplate,
} from '@/lib/db/hooks/use-service-description-templates';
import { useProcurementCategories } from '@/lib/db/hooks/use-procurement-categories';
import type {
  ConfiguredSlot,
  ServiceDescriptionTemplate,
} from '@/lib/procurement/service-description-config';
import { DEFAULT_TEMPLATE, renderSystemPrompt } from '@/lib/procurement/service-description-defaults';

/** A new row starts from the built-in so an admin edits rather than authors. */
function blankTemplate(category: string, label: string): ServiceDescriptionTemplate {
  return { ...DEFAULT_TEMPLATE, category, label, categoryGuidance: '' };
}

export function ServiceDescriptionPage() {
  const { data: templates = [], isLoading, isError } = useServiceDescriptionTemplates();
  const { data: categories = [] } = useProcurementCategories();
  const save = useSaveServiceDescriptionTemplate();
  const remove = useDeleteServiceDescriptionTemplate();

  const [selectedCategory, setSelectedCategory] = useState('default');
  const [draft, setDraft] = useState<ServiceDescriptionTemplate | null>(null);

  const stored = useMemo(
    () => templates.find((t) => t.category === selectedCategory),
    [templates, selectedCategory],
  );
  // The draft falls back to the stored row, then to the built-in, so the editor
  // always shows what would actually run rather than an empty form.
  const current = draft ?? stored ?? blankTemplate(selectedCategory, selectedCategory);
  const isDirty = draft !== null;

  // Categories that have no row of their own fall through to `default`; showing
  // that is the difference between "configured" and "inheriting".
  const configured = new Set(templates.map((t) => t.category));

  function patch(p: Partial<ServiceDescriptionTemplate>) {
    setDraft({ ...current, ...p });
  }

  function patchSlot(index: number, p: Partial<ConfiguredSlot>) {
    const slots = current.slots.map((s, i) => (i === index ? { ...s, ...p } : s));
    patch({ slots });
  }

  async function handleSave() {
    try {
      await save.mutateAsync({ ...current, category: selectedCategory });
      setDraft(null);
      toast.success(`Service description config saved for “${selectedCategory}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(selectedCategory);
      setDraft(null);
      toast.success(`“${selectedCategory}” now inherits the default configuration`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  }


  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Description"
        subtitle="The prompt, the components asked, and what gets generated"
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!isDirty || save.isPending}>
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
          </div>
        }
      />

      {/* The editor never blocks on the read. Resolution falls back to the
          built-in template everywhere else — generation, seeding, the intake
          conversation — so an unreadable table must leave the admin looking at
          what would actually run, not at a spinner or an empty form. */}
      {(isLoading || isError) && (
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? 'Loading stored configuration — showing the built-in until it arrives.'
            : 'Stored configuration could not be read. Showing the built-in, which is what generation falls back to. Saving will overwrite the stored row.'}
        </p>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[220px] space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={(v) => { setSelectedCategory(v); setDraft(null); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (all categories)</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}{configured.has(c.id) ? '' : ' — inherits default'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={current.active} onCheckedChange={(v) => patch({ active: v })} />
            <Label className="text-sm">Active</Label>
          </div>
          {selectedCategory !== 'default' && stored && (
            <Button variant="outline" size="sm" className="ml-auto text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDelete} disabled={remove.isPending}>
              <Trash2 className="size-3.5" />
              Revert to default
            </Button>
          )}
        </CardContent>
      </Card>

      {/* (a) the prompt */}
      <Card>
        <CardHeader><CardTitle className="text-base">Generation prompt</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Category guidance</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={current.categoryGuidance}
              onChange={(e) => patch({ categoryGuidance: e.target.value })}
              placeholder="Per-section drafting guidance for this category…"
            />
            <p className="text-xs text-muted-foreground">
              Interpolated into the system prompt at <code>{'{{guidance}}'}</code>. Leave empty to use
              the built-in guidance for this category.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">System prompt</Label>
            <Textarea
              rows={12}
              className="font-mono text-xs"
              value={current.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              <code>{'{{guidance}}'}</code> and <code>{'{{outputFormat}}'}</code> are substituted at
              generation time. The output format is built from the sections below, so adding a
              section actually changes what the model is asked for.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="w-32 space-y-1.5">
              <Label className="text-xs">Temperature</Label>
              <Input type="number" step="0.1" min={0} max={1} value={current.temperature}
                onChange={(e) => patch({ temperature: Number(e.target.value) })} />
            </div>
            <div className="w-32 space-y-1.5">
              <Label className="text-xs">Max tokens</Label>
              <Input type="number" min={256} value={current.maxTokens}
                onChange={(e) => patch({ maxTokens: Number(e.target.value) })} />
            </div>
          </div>
          <details className="rounded-md border bg-gray-50 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              <Wand2 className="mr-1 inline size-3" />
              Preview the assembled prompt
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-snug">
              {renderSystemPrompt(current)}
            </pre>
          </details>
        </CardContent>
      </Card>

      {/* (b) which components are asked */}
      <Card>
        <CardHeader><CardTitle className="text-base">Components asked at intake</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The questions the intake conversation works through, in order. A component with a
            condition is only asked when it holds — thresholds written as
            <code> policy:criticalServiceThreshold</code> follow the Decisioning Thresholds screen
            rather than being pinned here.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Component</th>
                  <th className="py-1.5 pr-3 font-medium">Question</th>
                  <th className="py-1.5 pr-3 font-medium w-20">Required</th>
                  <th className="py-1.5 font-medium">Asked when</th>
                </tr>
              </thead>
              <tbody>
                {current.slots.map((slot, i) => (
                  <tr key={slot.id} className="border-b align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-gray-900">{slot.id}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        → {slot.targetKind}.{slot.targetField}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Textarea rows={2} className="text-xs" value={slot.prompt}
                        onChange={(e) => patchSlot(i, { prompt: e.target.value })} />
                      {/* The rationale is offered only for a CONDITIONAL slot:
                          a question every demand is asked does not need to
                          justify itself, and an "asked because" line on one
                          would be noise the requester learns to skip. */}
                      {(slot.conditions?.length ?? 0) > 0 && (
                        <div className="mt-1.5">
                          <Label className="text-[10px] text-muted-foreground">
                            Asked because… (shown to the requester; empty hides the line)
                          </Label>
                          <Textarea rows={2} className="mt-0.5 text-[11px]" value={slot.why ?? ''}
                            onChange={(e) => patchSlot(i, { why: e.target.value })} />
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Switch checked={slot.required}
                        onCheckedChange={(v) => patchSlot(i, { required: v })} />
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {slot.conditions?.length
                        ? slot.conditions.map((c, ci) => (
                            <div key={ci} className="font-mono text-[11px]">
                              {c.field} {c.operator} {c.value}
                            </div>
                          ))
                        : <span className="text-[11px]">always</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* (c) what is generated */}
      <Card>
        <CardHeader><CardTitle className="text-base">What is generated</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium">Detailed — sections</p>
            <div className="flex flex-wrap gap-2">
              {current.sections.map((sec) => (
                <span key={sec.id}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    sec.asked ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}>
                  {sec.label}
                  {!sec.asked && <span className="text-[10px]">inferred</span>}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              A section marked <em>inferred</em> is written by the model and never asked for, so it is
              labelled rather than presented as something the requester said.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Compact — narrative composition</p>
            <Input className="font-mono text-xs" value={current.narrativeSections.join(', ')}
              onChange={(e) => patch({
                narrativeSections: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              })} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Section ids, in the order they appear in the compact summary.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* (d) downstream reuse */}
      <Card>
        <CardHeader><CardTitle className="text-base">Reuse in later steps</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium">Sourcing — requirements seeded from</p>
            <Input className="font-mono text-xs"
              value={current.sourcingRequirementSections.join(', ')}
              onChange={(e) => patch({
                sourcingRequirementSections: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              })} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              A sourcing event raised from a request starts with these sections as its requirements
              instead of an empty list.
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Sourcing — starting evaluation criteria</p>
            <div className="space-y-1.5">
              {current.defaultCriteria.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input className="text-xs" value={c.label}
                    onChange={(e) => patch({
                      defaultCriteria: current.defaultCriteria.map((x, xi) =>
                        xi === i ? { ...x, label: e.target.value } : x),
                    })} />
                  <Input type="number" className="w-20 text-xs" value={c.weight}
                    onChange={(e) => patch({
                      defaultCriteria: current.defaultCriteria.map((x, xi) =>
                        xi === i ? { ...x, weight: Number(e.target.value) } : x),
                    })} />
                  <Button variant="ghost" size="sm"
                    onClick={() => patch({
                      defaultCriteria: current.defaultCriteria.filter((_, xi) => xi !== i),
                    })}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <Button variant="outline" size="sm"
                  onClick={() => patch({
                    defaultCriteria: [...current.defaultCriteria, {
                      id: `c${current.defaultCriteria.length + 1}`, label: '', weight: 0,
                    }],
                  })}>
                  <Plus className="size-3.5" />
                  Add criterion
                </Button>
                {/* Publishing an event is blocked when weights do not total 100,
                    so the total is shown here rather than discovered later. */}
                <span className={`text-xs ${
                  current.defaultCriteria.reduce((s, c) => s + c.weight, 0) === 100
                    ? 'text-green-700' : 'text-amber-700'
                }`}>
                  Total {current.defaultCriteria.reduce((s, c) => s + c.weight, 0)}% — must be 100%
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-gray-50 p-3 text-xs text-muted-foreground">
            <strong className="text-gray-900">Risk and other forms.</strong> Any form built in the Form
            Builder can pre-fill a field from a service-description section — pick one of the
            “Service description — …” sources on the field. A form whose trigger stage is
            <code> risk</code> then appears on the risk step already populated with what the
            requester gave at intake.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
