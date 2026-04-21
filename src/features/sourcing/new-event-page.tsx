import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { useSuppliers } from '@/lib/db/hooks/use-suppliers';

const STEPS = [
  'Event Details',
  'Select Suppliers',
  'Requirements',
  'Evaluation Criteria',
  'Review & Publish',
] as const;

const CATEGORIES = [
  'IT Consulting',
  'Cloud Services',
  'Facilities',
  'Contingent Labour',
  'Marketing',
  'Professional Services',
  'Hardware',
  'Software',
];

interface CriteriaRow {
  id: string;
  name: string;
  weight: number;
  scoringType: '1-5';
}

interface RequirementSection {
  id: string;
  title: string;
  content: string;
}

export function NewEventPage() {
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const [step, setStep] = useState(0);

  // Step 1: Event details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [eventType, setEventType] = useState<'RFI' | 'RFP' | 'RFQ'>('RFP');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');

  // Step 2: Suppliers
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Step 3: Requirements
  const [requirements, setRequirements] = useState<RequirementSection[]>([
    { id: '1', title: 'Technical Requirements', content: '' },
    { id: '2', title: 'Commercial Requirements', content: '' },
  ]);

  // Step 4: Criteria
  const [criteria, setCriteria] = useState<CriteriaRow[]>([
    { id: '1', name: 'Technical Capability', weight: 40, scoringType: '1-5' },
    { id: '2', name: 'Price', weight: 30, scoringType: '1-5' },
    { id: '3', name: 'Experience', weight: 20, scoringType: '1-5' },
    { id: '4', name: 'Sustainability', weight: 10, scoringType: '1-5' },
  ]);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.categories.some((c) =>
        c.toLowerCase().includes(supplierSearch.toLowerCase())
      )
  );

  function toggleSupplier(id: string) {
    setSelectedSuppliers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function addRequirement() {
    setRequirements((prev) => [
      ...prev,
      { id: String(Date.now()), title: '', content: '' },
    ]);
  }

  function removeRequirement(id: string) {
    setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRequirement(
    id: string,
    field: 'title' | 'content',
    value: string
  ) {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function addCriteria() {
    setCriteria((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', weight: 0, scoringType: '1-5' },
    ]);
  }

  function removeCriteria(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCriteria(
    id: string,
    field: 'name' | 'weight',
    value: string | number
  ) {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  function handlePublish() {
    toast.success('Sourcing event published successfully');
    navigate('/sourcing');
  }

  function handleSaveDraft() {
    toast.success('Sourcing event saved as draft');
    navigate('/sourcing');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Sourcing Event"
        subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      />

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={i <= step ? 'font-medium text-gray-900' : ''}
            >
              {s}
            </span>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
      </div>

      {/* Step 1: Event Details */}
      {step === 0 && (
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. IT Consulting Framework 2025-2027"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the sourcing event..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as 'RFI' | 'RFP' | 'RFQ')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFI">RFI - Request for Information</SelectItem>
                  <SelectItem value="RFP">RFP - Request for Proposal</SelectItem>
                  <SelectItem value="RFQ">RFQ - Request for Quotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Submission Deadline</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budgetMin">Budget Min</Label>
              <Input
                id="budgetMin"
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budgetMax">Budget Max</Label>
              <Input
                id="budgetMax"
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="100,000"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Select Suppliers */}
      {step === 1 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedSuppliers.length} supplier(s) selected
            </p>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="divide-y rounded-lg border">
            {filteredSuppliers.map((supplier) => (
              <label
                key={supplier.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedSuppliers.includes(supplier.id)}
                  onCheckedChange={() => toggleSupplier(supplier.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{supplier.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {supplier.country} — {supplier.categories.slice(0, 3).join(', ')}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Tier {supplier.tier}
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Step 3: Requirements */}
      {step === 2 && (
        <Card className="p-6 space-y-4">
          {requirements.map((req) => (
            <div key={req.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Input
                  value={req.title}
                  onChange={(e) =>
                    updateRequirement(req.id, 'title', e.target.value)
                  }
                  placeholder="Section title"
                  className="max-w-xs font-medium"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRequirement(req.id)}
                  disabled={requirements.length <= 1}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
              <Textarea
                value={req.content}
                onChange={(e) =>
                  updateRequirement(req.id, 'content', e.target.value)
                }
                placeholder="Describe the requirements for this section..."
                rows={4}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRequirement}>
            <Plus className="mr-1.5 size-4" />
            Add Section
          </Button>
        </Card>
      )}

      {/* Step 4: Evaluation Criteria */}
      {step === 3 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Total weight:{' '}
              <span
                className={
                  totalWeight === 100
                    ? 'font-medium text-green-600'
                    : 'font-medium text-red-600'
                }
              >
                {totalWeight}%
              </span>{' '}
              {totalWeight !== 100 && '(must equal 100%)'}
            </p>
          </div>
          <div className="space-y-3">
            {criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Input
                  value={c.name}
                  onChange={(e) =>
                    updateCriteria(c.id, 'name', e.target.value)
                  }
                  placeholder="Criteria name"
                  className="flex-1"
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={c.weight}
                    onChange={(e) =>
                      updateCriteria(c.id, 'weight', Number(e.target.value))
                    }
                    className="w-20 text-center"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="text-xs text-muted-foreground w-16">
                  Score 1-5
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCriteria(c.id)}
                  disabled={criteria.length <= 1}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addCriteria}>
            <Plus className="mr-1.5 size-4" />
            Add Criteria
          </Button>
        </Card>
      )}

      {/* Step 5: Review & Publish */}
      {step === 4 && (
        <div className="space-y-4">
          <Card className="p-6 space-y-3">
            <h3 className="font-medium">Event Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Title:</span>{' '}
                {title || '(not set)'}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span> {eventType}
              </div>
              <div>
                <span className="text-muted-foreground">Category:</span>{' '}
                {category || '(not set)'}
              </div>
              <div>
                <span className="text-muted-foreground">Timeline:</span>{' '}
                {startDate || '?'} to {endDate || '?'}
              </div>
              <div>
                <span className="text-muted-foreground">Budget Range:</span>{' '}
                {budgetMin || '0'} - {budgetMax || '?'}
              </div>
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="font-medium">
              Suppliers ({selectedSuppliers.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedSuppliers.map((id) => {
                const s = suppliers.find((sup) => sup.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                  >
                    {s?.name ?? id}
                  </span>
                );
              })}
              {selectedSuppliers.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  No suppliers selected
                </span>
              )}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="font-medium">
              Requirements ({requirements.length} sections)
            </h3>
            {requirements.map((r) => (
              <div key={r.id} className="text-sm">
                <span className="font-medium">{r.title || '(untitled)'}:</span>{' '}
                <span className="text-muted-foreground">
                  {r.content
                    ? `${r.content.substring(0, 80)}...`
                    : '(empty)'}
                </span>
              </div>
            ))}
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="font-medium">
              Evaluation Criteria ({criteria.length})
            </h3>
            <div className="space-y-1">
              {criteria.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.name || '(unnamed)'}</span>
                  <span className="text-muted-foreground">{c.weight}%</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium border-t pt-1">
                <span>Total</span>
                <span
                  className={
                    totalWeight === 100 ? 'text-green-600' : 'text-red-600'
                  }
                >
                  {totalWeight}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="mr-1.5 size-4" />
          Back
        </Button>

        <div className="flex gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button variant="outline" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button onClick={handlePublish}>
                <Check className="mr-1.5 size-4" />
                Publish Event
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next
              <ChevronRight className="ml-1.5 size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
