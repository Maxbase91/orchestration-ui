import { useState } from 'react';
import { Sparkles, RefreshCw, Pencil, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ServiceDescriptionGeneratorProps {
  category: string;
  supplierName?: string;
  onGenerated: (description: string) => void;
}

interface FormAnswers {
  objective: string;
  deliverables: string;
  duration: string;
  skills: string;
  compliance: string;
  location: string;
}

const DURATION_OPTIONS = [
  { value: '1-3 months', label: '1-3 months' },
  { value: '3-6 months', label: '3-6 months' },
  { value: '6-12 months', label: '6-12 months' },
  { value: '12+ months', label: '12+ months' },
];

const LOCATION_OPTIONS = [
  { value: 'on-site', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

function getContextualSentence(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('migration')) {
    return 'This includes planning, execution, and post-migration validation.';
  }
  if (lower.includes('strategy') || lower.includes('strategic')) {
    return 'The engagement will culminate in a strategic roadmap.';
  }
  if (lower.includes('audit') || lower.includes('review') || lower.includes('assessment')) {
    return 'A comprehensive audit report with findings is expected.';
  }
  if (lower.includes('implement') || lower.includes('deploy')) {
    return 'The provider will deliver a fully implemented and tested solution.';
  }
  if (lower.includes('train') || lower.includes('workshop')) {
    return 'The engagement includes knowledge transfer and training materials.';
  }
  if (lower.includes('support') || lower.includes('maintain')) {
    return 'Ongoing support and maintenance procedures will be established.';
  }
  return 'The provider is expected to deliver measurable outcomes aligned with the stated objectives.';
}

function generateDescription(answers: FormAnswers, category: string, supplierName?: string): string {
  const locationMap: Record<string, string> = {
    'on-site': 'on-site at the organisation\'s premises',
    'remote': 'remotely',
    'hybrid': 'in a hybrid arrangement (on-site and remote)',
  };

  const locationText = locationMap[answers.location] ?? answers.location;
  const supplierText = supplierName ? ` The preferred supplier is ${supplierName}.` : '';
  const complianceText = answers.compliance.trim()
    ? ` The engagement must comply with: ${answers.compliance.trim()}.`
    : '';

  const contextSentence = getContextualSentence(
    `${answers.objective} ${answers.deliverables}`
  );

  return `The organisation requires ${category} services to ${answers.objective.trim()}.

Scope of Work:
The selected provider will be responsible for delivering: ${answers.deliverables.trim()}. The engagement is expected to span ${answers.duration}, with work performed ${locationText}.${supplierText}

Requirements:
The provider must demonstrate proven expertise in ${answers.skills.trim()}.${complianceText}

${contextSentence}`;
}

export function ServiceDescriptionGenerator({
  category,
  supplierName,
  onGenerated,
}: ServiceDescriptionGeneratorProps) {
  const [answers, setAnswers] = useState<FormAnswers>({
    objective: '',
    deliverables: '',
    duration: '',
    skills: '',
    compliance: '',
    location: '',
  });
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate =
    answers.objective.trim().length > 0 &&
    answers.deliverables.trim().length > 0 &&
    answers.duration !== '' &&
    answers.skills.trim().length > 0 &&
    answers.location !== '';

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const text = generateDescription(answers, category, supplierName);
      setGeneratedText(text);
      setIsGenerating(false);
    }, 500);
  };

  const handleUse = () => {
    onGenerated(generatedText);
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleEditManually = () => {
    onGenerated(generatedText);
  };

  const updateAnswer = <K extends keyof FormAnswers>(key: K, value: FormAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (generatedText) setGeneratedText('');
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-blue-900">AI Service Description Generator</h3>
      </div>
      <p className="text-xs text-blue-700">
        Answer the questions below and we will generate a professional service description for your request.
      </p>

      {/* Questions */}
      <div className="space-y-3">
        {/* 1. Primary objective */}
        <div className="space-y-1">
          <Label htmlFor="sdg-objective" className="text-sm text-gray-700">
            1. What is the primary objective?
          </Label>
          <Textarea
            id="sdg-objective"
            rows={2}
            value={answers.objective}
            onChange={(e) => updateAnswer('objective', e.target.value)}
            placeholder="e.g. migrate on-premise infrastructure to cloud"
          />
        </div>

        {/* 2. Key deliverables */}
        <div className="space-y-1">
          <Label htmlFor="sdg-deliverables" className="text-sm text-gray-700">
            2. What are the key deliverables?
          </Label>
          <Textarea
            id="sdg-deliverables"
            rows={3}
            value={answers.deliverables}
            onChange={(e) => updateAnswer('deliverables', e.target.value)}
            placeholder="e.g. architecture design, migration plan, execution, testing, documentation"
          />
        </div>

        {/* 3. Expected duration */}
        <div className="space-y-1">
          <Label className="text-sm text-gray-700">3. Expected duration</Label>
          <Select
            value={answers.duration}
            onValueChange={(v) => updateAnswer('duration', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration..." />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 4. Required expertise */}
        <div className="space-y-1">
          <Label htmlFor="sdg-skills" className="text-sm text-gray-700">
            4. Required expertise or skills
          </Label>
          <Input
            id="sdg-skills"
            value={answers.skills}
            onChange={(e) => updateAnswer('skills', e.target.value)}
            placeholder="e.g. AWS, Kubernetes, data engineering"
          />
        </div>

        {/* 5. Compliance requirements */}
        <div className="space-y-1">
          <Label htmlFor="sdg-compliance" className="text-sm text-gray-700">
            5. Compliance requirements <span className="text-gray-400">(optional)</span>
          </Label>
          <Textarea
            id="sdg-compliance"
            rows={2}
            value={answers.compliance}
            onChange={(e) => updateAnswer('compliance', e.target.value)}
            placeholder="e.g. ISO 27001, GDPR, SOC 2"
          />
        </div>

        {/* 6. Work location */}
        <div className="space-y-1">
          <Label className="text-sm text-gray-700">6. Work location</Label>
          <Select
            value={answers.location}
            onValueChange={(v) => updateAnswer('location', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location..." />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate button */}
      {!generatedText && (
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate Description
            </>
          )}
        </Button>
      )}

      {/* Generated output */}
      {generatedText && (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Generated Description
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-line">{generatedText}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleUse}>
              <CheckCircle className="size-3.5" />
              Use this description
            </Button>
            <Button size="sm" variant="outline" onClick={handleRegenerate}>
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={handleEditManually}>
              <Pencil className="size-3.5" />
              Edit manually
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
