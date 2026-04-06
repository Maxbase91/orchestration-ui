import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { AISuggestionCard } from '@/components/shared/ai-suggestion-card';
import { ScoringMatrix, type Criterion, type SupplierScore } from './components/scoring-matrix';

const criteria: Criterion[] = [
  { id: 'technical', name: 'Technical Capability', weight: 35 },
  { id: 'price', name: 'Price Competitiveness', weight: 30 },
  { id: 'experience', name: 'Experience', weight: 20 },
  { id: 'risk', name: 'Risk Profile', weight: 15 },
];

const initialSuppliers: SupplierScore[] = [
  {
    supplierId: 'SUP-001',
    supplierName: 'Accenture',
    scores: { technical: 4, price: 3, experience: 5, risk: 4 },
    shortlisted: true,
  },
  {
    supplierId: 'SUP-003',
    supplierName: 'Deloitte',
    scores: { technical: 4, price: 4, experience: 4, risk: 4 },
    shortlisted: true,
  },
  {
    supplierId: 'SUP-005',
    supplierName: 'Capgemini',
    scores: { technical: 3, price: 5, experience: 3, risk: 3 },
    shortlisted: false,
  },
];

export function EvaluationCentrePage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [showAI, setShowAI] = useState(true);

  const handleScoreChange = useCallback((supplierId: string, criterionId: string, score: number) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.supplierId === supplierId
          ? { ...s, scores: { ...s.scores, [criterionId]: score } }
          : s
      )
    );
  }, []);

  const handleShortlistToggle = useCallback((supplierId: string) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.supplierId === supplierId ? { ...s, shortlisted: !s.shortlisted } : s
      )
    );
  }, []);

  return (
    <div className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate('/sourcing')}
      >
        <ArrowLeft className="size-3.5" />
        Back to Events
      </Button>

      <PageHeader
        title="Evaluation Centre"
        subtitle="SRC-001: IT Consulting Framework 2025-2027"
      />

      {showAI && (
        <AISuggestionCard
          title="AI-Assisted Scoring Analysis"
          confidence={0.82}
          onDismiss={() => setShowAI(false)}
          showExplanation
          explanation="Analysis based on submitted RFP responses, past performance data, and compliance documentation."
        >
          <p>
            Based on submitted responses, <strong>Accenture</strong> meets 8 of 10 technical requirements
            and has the strongest track record. <strong>Deloitte</strong> provides the best balance of
            price and capability. <strong>Capgemini</strong> offers the most competitive pricing but has
            gaps in cloud migration experience.
          </p>
        </AISuggestionCard>
      )}

      <ScoringMatrix
        criteria={criteria}
        suppliers={suppliers}
        onScoreChange={handleScoreChange}
        onShortlistToggle={handleShortlistToggle}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="size-4" />
            Award Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Based on weighted scoring, the recommended award is to{' '}
              <strong>
                {[...suppliers]
                  .filter((s) => s.shortlisted)
                  .sort((a, b) => {
                    const aTotal = criteria.reduce((sum, c) => sum + (a.scores[c.id] ?? 0) * c.weight, 0);
                    const bTotal = criteria.reduce((sum, c) => sum + (b.scores[c.id] ?? 0) * c.weight, 0);
                    return bTotal - aTotal;
                  })[0]?.supplierName ?? 'N/A'}
              </strong>{' '}
              as the primary supplier, with the second-ranked shortlisted supplier as backup.
            </p>
            <div className="flex gap-2">
              <Button size="sm">
                <Award className="size-3.5" />
                Proceed to Award
              </Button>
              <Button variant="outline" size="sm">
                Request Additional Information
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
