import { useState } from 'react';
import { Play, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RoutingRule } from '@/data/types';
import {
  evaluateRoutingRules,
  diagnoseRule,
  type RoutingContext,
} from '@/lib/routing/evaluate-routing-rules';

const CHANNEL_LABELS: Record<string, string> = {
  'procurement-led': 'Procurement-Led Sourcing',
  'business-led': 'Business-Led',
  'direct-po': 'Direct PO',
  'framework-call-off': 'Framework Call-Off',
  'catalogue': 'Catalogue',
};

interface RuleTestPanelProps {
  rules: RoutingRule[];
}

interface TestResult {
  rule: RoutingRule;
  channel: string;
  approvals: string;
}

interface CoverageResult {
  totalRules: number;
  activeRules: number;
  firedRules: string[];
  deadRules: string[];
}

export function RuleTestPanel({ rules }: RuleTestPanelProps) {
  const [testValue, setTestValue] = useState('');
  const [testCategory, setTestCategory] = useState('');
  const [testSupplierStatus, setTestSupplierStatus] = useState('');
  const [testContractExists, setTestContractExists] = useState(false);
  const [testRiskLevel, setTestRiskLevel] = useState('');
  // Previously unrepresented in the tester, so any rule keyed on them was
  // reported dead regardless of the inputs.
  const [testPriority, setTestPriority] = useState('');
  const [testCommodityCode, setTestCommodityCode] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);

  /**
   * The test context, evaluated by the SAME function production uses.
   *
   * This panel used to carry its own condition evaluator with branches marked
   * "simplified" that returned false for priority, isUrgent and commodityCode —
   * and it implemented `contractId is_empty`, which the runtime did not. So the
   * tester confirmed rules that never fired, which is how RR-001 came to sit
   * active and dead with a match count implying otherwise. A tester that does
   * not test what runs is worse than no tester.
   */
  function testContext(): RoutingContext {
    const val = Number(testValue);
    return {
      ...(Number.isFinite(val) && testValue !== '' ? { value: val } : {}),
      ...(testCategory ? { category: testCategory } : {}),
      ...(testSupplierStatus ? { supplierId: testSupplierStatus } : {}),
      ...(testContractExists ? { contractId: 'CON-TEST' } : {}),
      ...(testRiskLevel ? { riskRating: testRiskLevel as RoutingContext['riskRating'] } : {}),
      ...(testPriority ? { priority: testPriority, isUrgent: testPriority === 'urgent' } : {}),
      ...(testCommodityCode ? { commodityCode: testCommodityCode } : {}),
    };
  }

  function evaluateRule(rule: RoutingRule): boolean {
    return evaluateRoutingRules([rule], testContext()) !== null;
  }

  function handleTest() {
    setCoverage(null);
    const matched = rules.find((r) => evaluateRule(r));
    if (matched) {
      setResult({
        rule: matched,
        channel: CHANNEL_LABELS[matched.action.buyingChannel] || matched.action.buyingChannel,
        approvals: matched.action.approvalChain,
      });
    } else {
      setResult(null);
    }
  }

  function handleTestAll() {
    setResult(null);
    const activeRules = rules.filter((r) => r.status === 'active');
    const fired: string[] = [];
    const dead: string[] = [];

    for (const rule of activeRules) {
      if (evaluateRule(rule)) {
        fired.push(rule.id);
      } else {
        // "Did not match these inputs" and "can never match anything" are very
        // different findings; a broken rule is flagged as broken.
        dead.push(diagnoseRule(rule).length > 0 ? `${rule.id} (broken)` : rule.id);
      }
    }

    setCoverage({
      totalRules: rules.length,
      activeRules: activeRules.length,
      firedRules: fired,
      deadRules: dead,
    });
  }

  return (
    <div className="flex h-full flex-col border-l border-gray-200">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Test Rule</h2>
        <p className="mt-0.5 text-xs text-gray-500">Simulate a request to test rule matching</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <Label className="text-xs text-gray-500">Value (EUR)</Label>
          <Input
            type="number"
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder="e.g. 75000"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Category</Label>
          <Select value={testCategory} onValueChange={setTestCategory}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="goods">Goods</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="software">Software</SelectItem>
              <SelectItem value="consulting">Consulting</SelectItem>
              <SelectItem value="contingent-labour">Contingent Labour</SelectItem>
              <SelectItem value="contract-renewal">Contract Renewal</SelectItem>
              <SelectItem value="supplier-onboarding">Supplier Onboarding</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500">Supplier Status</Label>
          <Select value={testSupplierStatus} onValueChange={setTestSupplierStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-500">Contract Exists</Label>
          <Switch checked={testContractExists} onCheckedChange={setTestContractExists} />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Risk Rating</Label>
          <Select value={testRiskLevel} onValueChange={setTestRiskLevel}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Both were unrepresented here, so any rule keyed on them — including
            the live "Urgent request fast-track" — was reported dead whatever
            the inputs. */}
        <div>
          <Label className="text-xs text-gray-500">Priority</Label>
          <Select value={testPriority} onValueChange={setTestPriority}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-500">Commodity Code</Label>
          <Input
            className="mt-1"
            placeholder="e.g. 43211500"
            value={testCommodityCode}
            onChange={(e) => setTestCommodityCode(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleTest} className="flex-1">
            <Play className="size-3.5" />
            Test
          </Button>
          <Button variant="outline" onClick={handleTestAll} className="flex-1">
            <Zap className="size-3.5" />
            Test All
          </Button>
        </div>

        {/* Single test result */}
        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700">Rule Matched</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{result.rule.name}</p>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>
                <span className="font-medium">Channel:</span> {result.channel}
              </p>
              <p>
                <span className="font-medium">Approvals:</span>{' '}
                {result.approvals.split(' > ').join(' \u2192 ')}
              </p>
            </div>
          </div>
        )}

        {result === null && !coverage && testValue && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">No rule matched for this input.</p>
          </div>
        )}

        {/* Coverage result */}
        {coverage && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-medium text-gray-500">Rule Coverage Summary</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-lg font-bold text-gray-900">{coverage.totalRules}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="rounded bg-gray-50 p-2">
                  <p className="text-lg font-bold text-gray-900">{coverage.activeRules}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
                <div className="rounded bg-green-50 p-2">
                  <p className="text-lg font-bold text-green-700">{coverage.firedRules.length}</p>
                  <p className="text-xs text-green-600">Fired</p>
                </div>
                <div className="rounded bg-amber-50 p-2">
                  <p className="text-lg font-bold text-amber-700">{coverage.deadRules.length}</p>
                  <p className="text-xs text-amber-600">Did Not Fire</p>
                </div>
              </div>
            </div>

            {coverage.deadRules.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-600" />
                  <p className="text-xs font-medium text-amber-700">
                    Rules that did not fire with test data
                  </p>
                </div>
                <ul className="mt-2 space-y-1">
                  {coverage.deadRules.map((id) => {
                    const r = rules.find((rule) => rule.id === id);
                    return (
                      <li key={id} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="font-mono text-amber-600">{id}</span>
                        <span>{r?.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
