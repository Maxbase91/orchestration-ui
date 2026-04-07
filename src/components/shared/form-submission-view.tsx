import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FormSubmission } from '@/data/form-submissions';
import type { FormTemplate, FormField } from '@/data/form-templates';

interface FormSubmissionViewProps {
  submission: FormSubmission;
  template?: FormTemplate;
  compact?: boolean;
}

const statusStyles: Record<string, string> = {
  completed:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'in-progress':
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  draft:
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const statusLabels: Record<string, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  draft: 'Draft',
};

export function FormSubmissionView({
  submission,
  template,
  compact = false,
}: FormSubmissionViewProps) {
  const fields = template?.fields ?? [];

  // In compact mode, only show fields that have a value and skip separators/info-text
  const visibleFields = compact
    ? fields.filter(
        (f) =>
          f.fieldType !== 'separator' &&
          f.fieldType !== 'info-text' &&
          hasValue(submission.values[f.id]),
      )
    : fields.filter((f) => f.fieldType !== 'info-text');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-2',
          compact && 'items-center',
        )}
      >
        <div>
          <h4 className="text-sm font-semibold">{submission.formName}</h4>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Submitted by {submission.submittedBy} on{' '}
              {new Date(submission.submittedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <Badge
          variant="secondary"
          className={cn('text-xs', statusStyles[submission.status])}
        >
          {statusLabels[submission.status] ?? submission.status}
        </Badge>
      </div>

      {/* Fields */}
      <div
        className={cn(
          'grid gap-x-6',
          compact ? 'grid-cols-2 gap-y-2' : 'grid-cols-1 gap-y-4 sm:grid-cols-2',
        )}
      >
        {visibleFields.map((field) => (
          <SubmissionField
            key={field.id}
            field={field}
            value={submission.values[field.id]}
            compact={compact}
          />
        ))}
      </div>

      {/* Fallback when no template is provided */}
      {fields.length === 0 && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {Object.entries(submission.values).map(([key, val]) => (
            <div key={key} className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground">{key}</p>
              <RawValue value={val} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Field display ────────────────────────────────────────────────────

function SubmissionField({
  field,
  value,
  compact,
}: {
  field: FormField;
  value: string | string[] | boolean | undefined;
  compact: boolean;
}) {
  // Separators render as section headers
  if (field.fieldType === 'separator') {
    return (
      <div className="col-span-full pt-2">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {field.label}
        </h5>
        <hr className="mt-1 border-border" />
      </div>
    );
  }

  // Determine if this field should span full width
  const isWide =
    field.width !== 'half' &&
    (field.fieldType === 'textarea' || field.fieldType === 'multi-select');

  return (
    <div className={cn('space-y-0.5', isWide && 'col-span-full')}>
      <p
        className={cn(
          'font-medium text-muted-foreground',
          compact ? 'text-[11px]' : 'text-xs',
        )}
      >
        {field.label}
      </p>
      {field.fieldType === 'checkbox' ? (
        <CheckboxValue checked={!!value} />
      ) : field.fieldType === 'multi-select' ? (
        <MultiSelectValue
          values={Array.isArray(value) ? value : []}
          options={field.options}
        />
      ) : field.fieldType === 'select' || field.fieldType === 'radio' ? (
        <p className={cn('text-foreground', compact ? 'text-xs' : 'text-sm')}>
          {field.options?.find((o) => o.value === value)?.label ??
            (value as string) ??
            '\u2014'}
        </p>
      ) : (
        <p className={cn('text-foreground', compact ? 'text-xs' : 'text-sm')}>
          {(value as string) || '\u2014'}
        </p>
      )}
    </div>
  );
}

// ── Value renderers ──────────────────────────────────────────────────

function CheckboxValue({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm',
        checked ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
      )}
    >
      {checked ? '\u2713 Yes' : '\u2717 No'}
    </span>
  );
}

function MultiSelectValue({
  values,
  options,
}: {
  values: string[];
  options?: { value: string; label: string }[];
}) {
  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {options?.find((o) => o.value === v)?.label ?? v}
        </span>
      ))}
    </div>
  );
}

function RawValue({ value }: { value: string | string[] | boolean }) {
  if (typeof value === 'boolean') {
    return <CheckboxValue checked={value} />;
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }
  return (
    <p className="text-sm text-foreground">{(value as string) || '\u2014'}</p>
  );
}

// ── Utils ────────────────────────────────────────────────────────────

function hasValue(value: string | string[] | boolean | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== '';
}
