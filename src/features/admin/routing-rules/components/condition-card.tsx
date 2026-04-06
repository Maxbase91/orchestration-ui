import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELD_OPTIONS = [
  { value: 'value', label: 'Value' },
  { value: 'category', label: 'Category' },
  { value: 'supplierId', label: 'Supplier Status' },
  { value: 'contractId', label: 'Contract Exists' },
  { value: 'riskLevel', label: 'Risk Level' },
  { value: 'region', label: 'Region' },
  { value: 'commodityCode', label: 'Commodity Code' },
  { value: 'priority', label: 'Priority' },
  { value: 'isUrgent', label: 'Is Urgent' },
];

const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'in', label: 'is in' },
  { value: 'between', label: 'between' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'risk_rating', label: 'risk rating is' },
];

const CATEGORY_VALUES = [
  'goods', 'services', 'software', 'consulting',
  'contingent-labour', 'contract-renewal', 'supplier-onboarding',
];

const RISK_VALUES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];

interface ConditionCardProps {
  condition: { field: string; operator: string; value: string };
  onChange: (condition: { field: string; operator: string; value: string }) => void;
  onRemove: () => void;
}

export function ConditionCard({ condition, onChange, onRemove }: ConditionCardProps) {
  const needsValueInput = !['is_empty', 'is_not_empty'].includes(condition.operator);

  function getValueInput() {
    if (!needsValueInput) return null;

    if (condition.field === 'category') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.field === 'riskLevel' || condition.operator === 'risk_rating') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select risk level" />
          </SelectTrigger>
          <SelectContent>
            {RISK_VALUES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.field === 'priority') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_VALUES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (condition.field === 'isUrgent' || condition.field === 'contractId') {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Enter value"
        className="w-full"
      />
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="grid flex-1 gap-2 sm:grid-cols-3">
        <Select
          value={condition.field}
          onValueChange={(v) => onChange({ ...condition, field: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={condition.operator}
          onValueChange={(v) => onChange({ ...condition, operator: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {getValueInput()}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-red-500"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
