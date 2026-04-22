import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  GripVertical,
  X,
  Type,
  AlignLeft,
  Hash,
  List,
  CircleDot,
  CheckSquare,
  Calendar,
  Upload,
  Minus,
  Info,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFormTemplates } from '@/lib/db/hooks/use-form-templates';
import type { FormTemplate, FormField, FormFieldType } from '@/data/form-templates';
import { DynamicForm } from '@/components/shared/dynamic-form';

// ── Constants ───────────────────────────────────────────────────────

const STAGES = [
  'intake',
  'validation',
  'approval',
  'sourcing',
  'contracting',
  'po',
  'receipt',
  'invoice',
  'payment',
] as const;

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake',
  validation: 'Validation',
  approval: 'Approval',
  sourcing: 'Sourcing',
  contracting: 'Contracting',
  po: 'Purchase Order',
  receipt: 'Goods Receipt',
  invoice: 'Invoice',
  payment: 'Payment',
};

const CATEGORIES = ['Risk', 'Procurement', 'Compliance', 'Operations'] as const;

const FIELD_TYPE_OPTIONS: { type: FormFieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type className="size-3.5" /> },
  { type: 'textarea', label: 'Text Area', icon: <AlignLeft className="size-3.5" /> },
  { type: 'number', label: 'Number', icon: <Hash className="size-3.5" /> },
  { type: 'select', label: 'Select', icon: <List className="size-3.5" /> },
  { type: 'radio', label: 'Radio', icon: <CircleDot className="size-3.5" /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="size-3.5" /> },
  { type: 'date', label: 'Date', icon: <Calendar className="size-3.5" /> },
  { type: 'file-upload', label: 'File Upload', icon: <Upload className="size-3.5" /> },
  { type: 'separator', label: 'Section Header', icon: <Minus className="size-3.5" /> },
  { type: 'info-text', label: 'Info Text', icon: <Info className="size-3.5" /> },
];

const FIELD_ICONS: Record<FormFieldType, React.ReactNode> = {
  text: <Type className="size-3.5 text-gray-400" />,
  textarea: <AlignLeft className="size-3.5 text-gray-400" />,
  number: <Hash className="size-3.5 text-gray-400" />,
  select: <List className="size-3.5 text-gray-400" />,
  'multi-select': <List className="size-3.5 text-gray-400" />,
  radio: <CircleDot className="size-3.5 text-gray-400" />,
  checkbox: <CheckSquare className="size-3.5 text-gray-400" />,
  date: <Calendar className="size-3.5 text-gray-400" />,
  'file-upload': <Upload className="size-3.5 text-gray-400" />,
  separator: <Minus className="size-3.5 text-gray-400" />,
  'info-text': <Info className="size-3.5 text-gray-400" />,
};

const PRE_POPULATE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'supplierName', label: 'Supplier Name' },
  { value: 'value', label: 'Value' },
  { value: 'category', label: 'Category' },
  { value: 'commodityCode', label: 'Commodity Code' },
  { value: 'costCentre', label: 'Cost Centre' },
  { value: 'sraStatus', label: 'SRA Status' },
  { value: 'poId', label: 'PO ID' },
];

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  disabled: 'bg-red-100 text-red-600',
};

const categoryBadge: Record<string, string> = {
  Risk: 'bg-amber-100 text-amber-700',
  Procurement: 'bg-blue-100 text-blue-700',
  Compliance: 'bg-purple-100 text-purple-700',
  Operations: 'bg-emerald-100 text-emerald-700',
};

// ── Page Component ──────────────────────────────────────────────────

export function FormBuilderPage() {
  const { data: serverForms = [] } = useFormTemplates();
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  // Initialise local edit state from the server list on first load.
  useEffect(() => {
    if (forms.length === 0 && serverForms.length > 0) {
      setForms(serverForms);
      setSelectedFormId((prev) => prev ?? serverForms[0]?.id ?? null);
    }
  }, [forms.length, serverForms]);

  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? null;
  const selectedField = selectedForm?.fields.find((f) => f.id === selectedFieldId) ?? null;

  // Group forms by category
  const grouped = useMemo(() => {
    const groups: Record<string, FormTemplate[]> = {};
    for (const cat of CATEGORIES) {
      groups[cat] = forms.filter((f) => f.category === cat);
    }
    return groups;
  }, [forms]);

  // ── Form mutations ──────────────────────────────────────────

  const updateForm = useCallback(
    (updates: Partial<FormTemplate>) => {
      if (!selectedFormId) return;
      setForms((prev) =>
        prev.map((f) =>
          f.id === selectedFormId ? { ...f, ...updates, lastModified: new Date().toISOString() } : f,
        ),
      );
    },
    [selectedFormId],
  );

  const updateField = useCallback(
    (fieldId: string, updates: Partial<FormField>) => {
      if (!selectedFormId) return;
      setForms((prev) =>
        prev.map((f) => {
          if (f.id !== selectedFormId) return f;
          return {
            ...f,
            lastModified: new Date().toISOString(),
            fields: f.fields.map((field) =>
              field.id === fieldId ? { ...field, ...updates } : field,
            ),
          };
        }),
      );
    },
    [selectedFormId],
  );

  const addField = useCallback(
    (fieldType: FormFieldType) => {
      if (!selectedFormId) return;
      const newField: FormField = {
        id: `f-${Date.now()}`,
        fieldType,
        label: fieldType === 'separator' ? 'New Section' : fieldType === 'info-text' ? '' : 'New Field',
        required: false,
        width: 'full',
        ...(fieldType === 'select' || fieldType === 'radio' || fieldType === 'multi-select'
          ? { options: [{ value: 'option-1', label: 'Option 1' }] }
          : {}),
        ...(fieldType === 'info-text' ? { infoContent: 'Enter information text here.' } : {}),
      };
      setForms((prev) =>
        prev.map((f) =>
          f.id === selectedFormId
            ? { ...f, fields: [...f.fields, newField], lastModified: new Date().toISOString() }
            : f,
        ),
      );
      setSelectedFieldId(newField.id);
      setAddFieldOpen(false);
    },
    [selectedFormId],
  );

  const removeField = useCallback(
    (fieldId: string) => {
      if (!selectedFormId) return;
      if (selectedFieldId === fieldId) setSelectedFieldId(null);
      setForms((prev) =>
        prev.map((f) =>
          f.id === selectedFormId
            ? { ...f, fields: f.fields.filter((field) => field.id !== fieldId), lastModified: new Date().toISOString() }
            : f,
        ),
      );
    },
    [selectedFormId, selectedFieldId],
  );

  const toggleStage = useCallback(
    (stage: string) => {
      if (!selectedForm) return;
      const stages = selectedForm.triggerStages.includes(stage)
        ? selectedForm.triggerStages.filter((s) => s !== stage)
        : [...selectedForm.triggerStages, stage];
      updateForm({ triggerStages: stages });
    },
    [selectedForm, updateForm],
  );

  const addNewForm = useCallback(() => {
    const newForm: FormTemplate = {
      id: `FORM-${String(forms.length + 1).padStart(3, '0')}`,
      name: 'New Form',
      description: '',
      status: 'draft',
      category: 'Procurement',
      triggerStages: [],
      fields: [],
      version: '1.0',
      lastModified: new Date().toISOString(),
      createdBy: 'u1',
    };
    setForms((prev) => [...prev, newForm]);
    setSelectedFormId(newForm.id);
    setSelectedFieldId(null);
  }, [forms.length]);

  // ── Trigger description ─────────────────────────────────────

  const triggerDescription = useMemo(() => {
    if (!selectedForm) return '';
    const stages = selectedForm.triggerStages.map((s) => STAGE_LABELS[s] ?? s).join(', ');
    if (!stages) return 'No stages configured.';
    const conditions = selectedForm.triggerConditions;
    if (conditions && conditions.length > 0) {
      const conds = conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ');
      return `This form triggers during ${stages} when ${conds}.`;
    }
    return `This form triggers during ${stages} for all requests.`;
  }, [selectedForm]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <PageHeader
          title="Form Builder"
          subtitle="Design and configure forms that are triggered during workflow stages."
        />
      </div>
      <div className="flex flex-1 overflow-hidden border-t border-gray-200">
        {/* ── Left Panel: Form List ──────────────────────────── */}
        <div className="w-1/4 min-w-[240px] border-r border-gray-200 overflow-y-auto bg-gray-50/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Forms</h2>
            <Button size="sm" variant="outline" onClick={addNewForm}>
              <Plus className="size-3.5" />
              Add Form
            </Button>
          </div>
          <div className="p-2 space-y-4">
            {CATEGORIES.map((cat) => {
              const catForms = grouped[cat];
              if (!catForms || catForms.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {cat}
                  </p>
                  <div className="space-y-1">
                    {catForms.map((form) => (
                      <button
                        key={form.id}
                        type="button"
                        onClick={() => {
                          setSelectedFormId(form.id);
                          setSelectedFieldId(null);
                        }}
                        className={cn(
                          'w-full text-left rounded-md px-3 py-2.5 transition-colors',
                          selectedFormId === form.id
                            ? 'bg-white border-2 border-blue-500 shadow-sm'
                            : 'hover:bg-white border border-transparent',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{form.name}</p>
                          <Badge
                            variant="secondary"
                            className={cn('text-[10px] shrink-0', statusBadge[form.status])}
                          >
                            {form.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', categoryBadge[form.category])}
                          >
                            {form.category}
                          </Badge>
                          {form.triggerStages.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
                            >
                              {STAGE_LABELS[s] ?? s}
                            </span>
                          ))}
                          {form.triggerStages.length > 3 && (
                            <span className="text-[10px] text-gray-400">
                              +{form.triggerStages.length - 3}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {form.fields.filter((f) => f.fieldType !== 'separator' && f.fieldType !== 'info-text').length} fields
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center Panel: Form Editor ─────────────────────── */}
        <div className="w-1/2 overflow-y-auto">
          {selectedForm ? (
            <div className="p-6 space-y-6">
              {/* Header section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    value={selectedForm.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    className="text-lg font-semibold flex-1"
                  />
                  <Select
                    value={selectedForm.status}
                    onValueChange={(v) =>
                      updateForm({ status: v as FormTemplate['status'] })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-gray-400 shrink-0">v{selectedForm.version}</span>
                </div>
                <Textarea
                  value={selectedForm.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Form description..."
                  className="text-sm"
                  rows={2}
                />
              </div>

              {/* Trigger Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trigger Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-500">Triggered during</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {STAGES.map((stage) => {
                        const active = selectedForm.triggerStages.includes(stage);
                        return (
                          <button
                            key={stage}
                            type="button"
                            onClick={() => toggleStage(stage)}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                              active
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100',
                            )}
                          >
                            {STAGE_LABELS[stage]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div>
                    <Label className="text-xs text-gray-500">Conditions</Label>
                    {selectedForm.triggerConditions && selectedForm.triggerConditions.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {selectedForm.triggerConditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <Input
                              value={cond.field}
                              onChange={(e) => {
                                const newConds = [...(selectedForm.triggerConditions ?? [])];
                                newConds[idx] = { ...newConds[idx], field: e.target.value };
                                updateForm({ triggerConditions: newConds });
                              }}
                              className="w-28 text-xs"
                              placeholder="Field"
                            />
                            <Select
                              value={cond.operator}
                              onValueChange={(v) => {
                                const newConds = [...(selectedForm.triggerConditions ?? [])];
                                newConds[idx] = { ...newConds[idx], operator: v };
                                updateForm({ triggerConditions: newConds });
                              }}
                            >
                              <SelectTrigger className="w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">equals</SelectItem>
                                <SelectItem value="not_equals">not equals</SelectItem>
                                <SelectItem value="contains">contains</SelectItem>
                                <SelectItem value="greater_than">greater than</SelectItem>
                                <SelectItem value="less_than">less than</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              value={cond.value}
                              onChange={(e) => {
                                const newConds = [...(selectedForm.triggerConditions ?? [])];
                                newConds[idx] = { ...newConds[idx], value: e.target.value };
                                updateForm({ triggerConditions: newConds });
                              }}
                              className="w-28 text-xs"
                              placeholder="Value"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newConds = (selectedForm.triggerConditions ?? []).filter(
                                  (_, i) => i !== idx,
                                );
                                updateForm({
                                  triggerConditions: newConds.length > 0 ? newConds : undefined,
                                });
                              }}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => {
                        const newConds = [
                          ...(selectedForm.triggerConditions ?? []),
                          { field: '', operator: 'equals', value: '' },
                        ];
                        updateForm({ triggerConditions: newConds });
                      }}
                    >
                      <Plus className="size-3" />
                      Add Condition
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 italic">{triggerDescription}</p>
                </CardContent>
              </Card>

              {/* Fields Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Form Fields</h3>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddFieldOpen(!addFieldOpen)}
                    >
                      <Plus className="size-3.5" />
                      Add Field
                      <ChevronDown className="size-3" />
                    </Button>
                    {addFieldOpen && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                        {FIELD_TYPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => addField(opt.type)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {selectedForm.fields.map((field) => (
                    <div
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors',
                        selectedFieldId === field.id
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="size-3.5 text-gray-300 shrink-0 cursor-grab" />
                        {FIELD_ICONS[field.fieldType]}
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {field.label || '(untitled)'}
                        </span>
                        {field.required && (
                          <span className="text-[10px] text-red-500">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">
                          {field.width === 'half' ? 'Half' : 'Full'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                          className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedForm.fields.length === 0 && (
                    <p className="py-8 text-center text-sm text-gray-400">
                      No fields yet. Click "Add Field" to get started.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button>Save Form</Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select a form to edit or create a new one
            </div>
          )}
        </div>

        {/* ── Right Panel: Field Config + Preview ───────────── */}
        <div className="w-1/4 min-w-[240px] border-l border-gray-200 overflow-y-auto flex flex-col">
          {/* Field Configuration */}
          <div className="flex-1 border-b border-gray-200 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Field Configuration</h2>
            </div>
            {selectedField ? (
              <FieldConfigPanel field={selectedField} onUpdate={(updates) => updateField(selectedField.id, updates)} />
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                {selectedForm ? 'Select a field to configure' : 'No form selected'}
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Live Preview</h2>
            </div>
            {selectedForm ? (
              <div className="p-4">
                <DynamicForm template={selectedForm} readOnly={false} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                No form selected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field Config Panel ──────────────────────────────────────────────

function FieldConfigPanel({
  field,
  onUpdate,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const hasOptions =
    field.fieldType === 'select' ||
    field.fieldType === 'radio' ||
    field.fieldType === 'multi-select';

  return (
    <div className="p-4 space-y-4">
      {/* Label */}
      <div className="space-y-1">
        <Label className="text-xs">Label</Label>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="text-sm"
        />
      </div>

      {/* Placeholder (not for separator, info-text, checkbox) */}
      {field.fieldType !== 'separator' &&
        field.fieldType !== 'info-text' &&
        field.fieldType !== 'checkbox' && (
          <div className="space-y-1">
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={field.placeholder ?? ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="text-sm"
            />
          </div>
        )}

      {/* Help text */}
      <div className="space-y-1">
        <Label className="text-xs">Help Text</Label>
        <Input
          value={field.helpText ?? ''}
          onChange={(e) => onUpdate({ helpText: e.target.value })}
          className="text-sm"
        />
      </div>

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Required</Label>
        <Switch checked={field.required} onCheckedChange={(c) => onUpdate({ required: c })} />
      </div>

      {/* Width */}
      <div className="space-y-1">
        <Label className="text-xs">Width</Label>
        <div className="flex gap-2">
          {(['full', 'half'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onUpdate({ width: w })}
              className={cn(
                'flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                field.width === w
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {w === 'full' ? 'Full' : 'Half'}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-populate from */}
      <div className="space-y-1">
        <Label className="text-xs">Pre-populate from</Label>
        <Select
          value={field.prePopulateFrom ?? ''}
          onValueChange={(v) => onUpdate({ prePopulateFrom: v || undefined })}
        >
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            {PRE_POPULATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Info-text content */}
      {field.fieldType === 'info-text' && (
        <div className="space-y-1">
          <Label className="text-xs">Content</Label>
          <Textarea
            value={field.infoContent ?? ''}
            onChange={(e) => onUpdate({ infoContent: e.target.value })}
            rows={4}
            className="text-sm"
          />
        </div>
      )}

      {/* Number min/max */}
      {field.fieldType === 'number' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Min</Label>
            <Input
              type="number"
              value={field.validation?.min ?? ''}
              onChange={(e) =>
                onUpdate({
                  validation: {
                    ...field.validation,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max</Label>
            <Input
              type="number"
              value={field.validation?.max ?? ''}
              onChange={(e) =>
                onUpdate({
                  validation: {
                    ...field.validation,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* Options editor */}
      {hasOptions && (
        <div className="space-y-2">
          <Label className="text-xs">Options</Label>
          {(field.options ?? []).map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Input
                value={opt.value}
                onChange={(e) => {
                  const newOpts = [...(field.options ?? [])];
                  newOpts[idx] = { ...newOpts[idx], value: e.target.value };
                  onUpdate({ options: newOpts });
                }}
                className="text-xs flex-1"
                placeholder="Value"
              />
              <Input
                value={opt.label}
                onChange={(e) => {
                  const newOpts = [...(field.options ?? [])];
                  newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                  onUpdate({ options: newOpts });
                }}
                className="text-xs flex-1"
                placeholder="Label"
              />
              <button
                type="button"
                onClick={() => {
                  const newOpts = (field.options ?? []).filter((_, i) => i !== idx);
                  onUpdate({ options: newOpts });
                }}
                className="p-0.5 text-gray-300 hover:text-red-500"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="text-xs w-full"
            onClick={() => {
              const newOpts = [
                ...(field.options ?? []),
                { value: `option-${(field.options?.length ?? 0) + 1}`, label: `Option ${(field.options?.length ?? 0) + 1}` },
              ];
              onUpdate({ options: newOpts });
            }}
          >
            <Plus className="size-3" />
            Add Option
          </Button>
        </div>
      )}
    </div>
  );
}
