import { useState } from 'react';
import { Info, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormField, FormTemplate } from '@/data/form-templates';

interface DynamicFormProps {
  template: FormTemplate;
  initialValues?: Record<string, string | string[] | boolean>;
  prePopulateContext?: Record<string, string>;
  readOnly?: boolean;
  onSubmit?: (values: Record<string, string | string[] | boolean>) => void;
  onCancel?: () => void;
}

function resolveDefault(
  field: FormField,
  initialValues?: Record<string, string | string[] | boolean>,
  prePopulateContext?: Record<string, string>,
): string | string[] | boolean {
  if (initialValues && field.id in initialValues) {
    return initialValues[field.id];
  }
  if (field.prePopulateFrom && prePopulateContext?.[field.prePopulateFrom]) {
    return prePopulateContext[field.prePopulateFrom];
  }
  // Fallback: allow callers to prefill a field by its exact id, without
  // needing to declare a prePopulateFrom mapping in the form template.
  if (prePopulateContext && field.id in prePopulateContext) {
    return prePopulateContext[field.id];
  }
  if (field.fieldType === 'checkbox') {
    return false;
  }
  if (field.fieldType === 'multi-select') {
    return [] as string[];
  }
  return field.defaultValue ?? '';
}

export function DynamicForm({
  template,
  initialValues,
  prePopulateContext,
  readOnly = false,
  onSubmit,
  onCancel,
}: DynamicFormProps) {
  const [values, setValues] = useState<
    Record<string, string | string[] | boolean>
  >(() => {
    const initial: Record<string, string | string[] | boolean> = {};
    for (const field of template.fields) {
      initial[field.id] = resolveDefault(field, initialValues, prePopulateContext);
    }
    return initial;
  });

  function setValue(id: string, value: string | string[] | boolean) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.(values);
  }

  // Group consecutive half-width fields into rows
  const rows: { fields: FormField[]; isHalfRow: boolean }[] = [];
  let halfBuffer: FormField[] = [];

  function flushHalf() {
    if (halfBuffer.length > 0) {
      rows.push({ fields: [...halfBuffer], isHalfRow: true });
      halfBuffer = [];
    }
  }

  for (const field of template.fields) {
    if (field.width === 'half') {
      halfBuffer.push(field);
      if (halfBuffer.length === 2) {
        flushHalf();
      }
    } else {
      flushHalf();
      rows.push({ fields: [field], isHalfRow: false });
    }
  }
  flushHalf();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {rows.map((row, rowIdx) => {
        if (row.isHalfRow) {
          return (
            <div key={rowIdx} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {row.fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(v) => setValue(field.id, v)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          );
        }
        const field = row.fields[0];
        return (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(v) => setValue(field.id, v)}
            readOnly={readOnly}
          />
        );
      })}

      {!readOnly && (
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button type="submit">Submit</Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

// ── Field Renderer ───────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  value: string | string[] | boolean;
  onChange: (value: string | string[] | boolean) => void;
  readOnly: boolean;
}

function FieldRenderer({ field, value, onChange, readOnly }: FieldRendererProps) {
  switch (field.fieldType) {
    case 'separator':
      return (
        <div className="pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {field.label}
          </h3>
          <hr className="mt-2 border-border" />
        </div>
      );

    case 'info-text':
      return (
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {field.infoContent}
          </p>
        </div>
      );

    case 'text':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue value={value as string} />
          ) : (
            <Input
              id={field.id}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
          )}
        </FieldWrapper>
      );

    case 'textarea':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue value={value as string} />
          ) : (
            <Textarea
              id={field.id}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
          )}
        </FieldWrapper>
      );

    case 'number':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue value={value as string} />
          ) : (
            <Input
              id={field.id}
              type="number"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              min={field.validation?.min}
              max={field.validation?.max}
            />
          )}
        </FieldWrapper>
      );

    case 'date':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue value={value as string} />
          ) : (
            <Input
              id={field.id}
              type="date"
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              required={field.required}
            />
          )}
        </FieldWrapper>
      );

    case 'select':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue
              value={
                field.options?.find((o) => o.value === value)?.label ??
                (value as string)
              }
            />
          ) : (
            <Select
              value={(value as string) ?? ''}
              onValueChange={(v) => onChange(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.placeholder ?? 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldWrapper>
      );

    case 'multi-select': {
      const selected = (Array.isArray(value) ? value : []) as string[];
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <div className="flex flex-wrap gap-1.5">
              {selected.length > 0 ? (
                selected.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {field.options?.find((o) => o.value === v)?.label ?? v}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {field.options?.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        if (c) {
                          onChange([...selected, opt.value]);
                        } else {
                          onChange(selected.filter((v) => v !== opt.value));
                        }
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          )}
        </FieldWrapper>
      );
    }

    case 'radio':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue
              value={
                field.options?.find((o) => o.value === value)?.label ??
                (value as string)
              }
            />
          ) : (
            <div className="flex flex-wrap gap-4">
              {field.options?.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={field.id}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={() => onChange(opt.value)}
                    className="size-4 accent-primary"
                    required={field.required}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        </FieldWrapper>
      );

    case 'checkbox':
      return (
        <div className="space-y-1">
          {readOnly ? (
            <div className="flex items-center gap-2 text-sm">
              <span>{value ? '\u2713' : '\u2717'}</span>
              <span>{field.label}</span>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                id={field.id}
                checked={!!value}
                onCheckedChange={(c) => onChange(!!c)}
                className="mt-0.5"
              />
              <span>
                {field.label}
                {field.required && (
                  <span className="ml-0.5 text-destructive">*</span>
                )}
              </span>
            </label>
          )}
          {field.helpText && (
            <p className="pl-6 text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'file-upload':
      return (
        <FieldWrapper field={field}>
          {readOnly ? (
            <ReadOnlyValue value={(value as string) || 'No files uploaded'} />
          ) : (
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 transition-colors hover:border-muted-foreground/40">
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">
                  PDF, DOCX, XLSX up to 10 MB
                </p>
              </div>
            </div>
          )}
        </FieldWrapper>
      );

    default:
      return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function FieldWrapper({
  field,
  children,
}: {
  field: FormField;
  children: React.ReactNode;
}) {
  // Checkboxes handle their own label
  if (field.fieldType === 'checkbox') return <>{children}</>;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && (
          <span className="ml-0.5 text-destructive">*</span>
        )}
      </Label>
      {children}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <p
      className={cn(
        'min-h-[1.5rem] text-sm',
        value ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {value || '\u2014'}
    </p>
  );
}
