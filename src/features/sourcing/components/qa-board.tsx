import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QAItem {
  id: string;
  supplierName: string;
  question: string;
  answer?: string;
  askedAt: string;
  answeredAt?: string;
}

const mockQAItems: QAItem[] = [
  {
    id: 'qa-1',
    supplierName: 'Accenture',
    question: 'Can you clarify the expected SLA for response times in Section 3.2?',
    answer: 'Response times should not exceed 4 hours for P1 incidents and 8 hours for P2. This has been clarified in Amendment 1.',
    askedAt: '2025-02-10',
    answeredAt: '2025-02-11',
  },
  {
    id: 'qa-2',
    supplierName: 'Deloitte',
    question: 'Is there a preference for on-site vs remote delivery? The RFP mentions both.',
    answer: 'Hybrid model preferred - minimum 2 days on-site per week during the first 3 months, then flexible.',
    askedAt: '2025-02-12',
    answeredAt: '2025-02-13',
  },
  {
    id: 'qa-3',
    supplierName: 'Capgemini',
    question: 'Will you accept consortium bids for the cloud migration workstream?',
    answer: 'Yes, consortium bids are acceptable provided the lead partner is clearly identified and takes contractual responsibility.',
    askedAt: '2025-02-14',
    answeredAt: '2025-02-15',
  },
  {
    id: 'qa-4',
    supplierName: 'KPMG',
    question: 'What is the budget range for this engagement?',
    askedAt: '2025-02-16',
  },
  {
    id: 'qa-5',
    supplierName: 'Accenture',
    question: 'Are there any incumbent suppliers currently providing similar services?',
    answer: 'Yes, the current contract with Capgemini expires in Q2 2025. This sourcing event is for the replacement period.',
    askedAt: '2025-02-17',
    answeredAt: '2025-02-18',
  },
];

export function QABoard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" />
          Q&A Board
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockQAItems.map((item) => (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-600">{item.supplierName}</span>
              <span className="text-xs text-muted-foreground">{item.askedAt}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-gray-900">{item.question}</p>
            {item.answer ? (
              <div className="mt-2 rounded bg-green-50 p-2">
                <span className="text-xs font-medium text-green-700">Answer ({item.answeredAt})</span>
                <p className="mt-0.5 text-sm text-gray-700">{item.answer}</p>
              </div>
            ) : (
              <div className="mt-2 rounded bg-amber-50 p-2">
                <span className="text-xs font-medium text-amber-700">Awaiting response</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
