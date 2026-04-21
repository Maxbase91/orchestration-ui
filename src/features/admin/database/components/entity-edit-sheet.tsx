import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDatabaseAdminStore, entityLabels } from '@/stores/database-admin-store';
import type { EntityKey, EntityRecordMap } from '@/stores/database-admin-store';
import type { EntityConfig, FieldConfig } from '../entity-configs/types';
import { RelatedItemsPanel } from './related-items-panel';

interface EntityEditSheetProps<K extends EntityKey> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit' | 'create';
  config: EntityConfig<K>;
  record: EntityRecordMap[K] | null;
  onNavigate: (entity: EntityKey, id: string) => void;
}

export function EntityEditSheet<K extends EntityKey>({
  open,
  onOpenChange,
  mode,
  config,
  record,
  onNavigate,
}: EntityEditSheetProps<K>) {
  const update = useDatabaseAdminStore((s) => s.update);
  const create = useDatabaseAdminStore((s) => s.create);
  const remove = useDatabaseAdminStore((s) => s.remove);

  const [draft, setDraft] = useState<Partial<EntityRecordMap[K]>>({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && record) {
      setDraft(structuredClone(record) as Partial<EntityRecordMap[K]>);
    } else if (mode === 'create') {
      setDraft(config.defaultNew());
    }
  }, [open, mode, record, config]);

  function handleFieldChange(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }) as Partial<EntityRecordMap[K]>);
  }

  async function handleSubmit() {
    for (const field of config.fields) {
      if (field.required && !field.readOnly) {
        const v = (draft as Record<string, unknown>)[field.key];
        if (v === undefined || v === '' || v === null) {
          toast.error(`"${field.label}" is required.`);
          return;
        }
      }
    }
    try {
      if (mode === 'edit' && record) {
        await update(config.key, config.getId(record), draft);
        toast.success(`${entityLabels[config.key].singular} updated.`);
      } else if (mode === 'create') {
        const id = (draft as { id?: string }).id;
        if (!id) {
          toast.error('Record ID is required.');
          return;
        }
        await create(config.key, draft as EntityRecordMap[K]);
        toast.success(`${entityLabels[config.key].singular} created.`);
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast.error(`Save failed: ${message}`);
    }
  }

  async function handleDelete() {
    if (!record) return;
    if (!confirm(`Delete ${config.getDisplayLabel(record)}? This cannot be undone.`)) return;
    try {
      await remove(config.key, config.getId(record));
      toast.success(`${entityLabels[config.key].singular} deleted.`);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast.error(`Delete failed: ${message}`);
    }
  }

  const title =
    mode === 'edit' && record
      ? `${entityLabels[config.key].singular} — ${config.getDisplayLabel(record)}`
      : `New ${entityLabels[config.key].singular}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? `Edit fields below. Changes are saved to the session-only admin database.`
              : `Create a new ${entityLabels[config.key].singular.toLowerCase()} record.`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {config.fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={(draft as Record<string, unknown>)[field.key]}
                onChange={(v) => handleFieldChange(field.key, v)}
                disabled={mode === 'edit' && field.readOnly}
              />
            ))}

            {config.renderComplexFields && record && (
              <div className="mt-6 border-t pt-4">
                {config.renderComplexFields({ record, draft, setDraft: (patch) => setDraft((d) => ({ ...d, ...patch })) })}
              </div>
            )}

            {mode === 'edit' && record && (
              <div className="mt-6 border-t pt-4">
                <RelatedItemsPanel
                  entity={config.key}
                  record={record}
                  onNavigate={onNavigate}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-between border-t px-6 py-3">
          {mode === 'edit' ? (
            <Button variant="ghost" size="sm" className="text-red-600" onClick={handleDelete}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {mode === 'edit' ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface FieldRendererProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

function FieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  const commonLabel = (
    <Label htmlFor={field.key} className="text-xs font-medium text-gray-700">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </Label>
  );

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        {commonLabel}
        <Textarea
          id={field.key}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={3}
        />
        {field.helpText && <p className="text-[11px] text-muted-foreground">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
        <div>
          {commonLabel}
          {field.helpText && <p className="text-[11px] text-muted-foreground">{field.helpText}</p>}
        </div>
        <Switch
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="space-y-1.5">
        {commonLabel}
        <Select
          value={(value as string) ?? ''}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger id={field.key} className="w-full">
            <SelectValue placeholder={field.placeholder ?? 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.helpText && <p className="text-[11px] text-muted-foreground">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'multi-select' && field.options) {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1.5">
        {commonLabel}
        <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 p-2">
          {field.options.map((opt) => {
            const selected = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onChange(
                    selected ? arr.filter((v) => v !== opt.value) : [...arr, opt.value],
                  );
                }}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {field.helpText && <p className="text-[11px] text-muted-foreground">{field.helpText}</p>}
      </div>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  return (
    <div className="space-y-1.5">
      {commonLabel}
      <Input
        id={field.key}
        type={inputType}
        value={(value as string | number | undefined) ?? ''}
        onChange={(e) =>
          onChange(
            field.type === 'number'
              ? e.target.value === ''
                ? undefined
                : Number(e.target.value)
              : e.target.value,
          )
        }
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.min}
        max={field.max}
      />
      {field.helpText && <p className="text-[11px] text-muted-foreground">{field.helpText}</p>}
    </div>
  );
}
