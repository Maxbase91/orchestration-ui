import { useState } from 'react';
import { Calendar, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/lib/db/hooks/use-users';

interface Delegation {
  id: string;
  delegateId: string;
  delegateName: string;
  fromDate: string;
  toDate: string;
  scope: string;
}

const initialDelegations: Delegation[] = [
  {
    id: 'del-1',
    delegateId: 'u4',
    delegateName: 'Michael Torres',
    fromDate: '2025-02-15',
    toDate: '2025-02-28',
    scope: 'All approvals',
  },
];

export function DelegationManager() {
  const { data: users = [] } = useUsers();
  const [delegations, setDelegations] = useState<Delegation[]>(initialDelegations);
  const [showForm, setShowForm] = useState(false);
  const [delegateId, setDelegateId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [scope, setScope] = useState('all');

  const handleAdd = () => {
    const delegate = users.find((u) => u.id === delegateId);
    if (!delegate || !fromDate || !toDate) return;

    const newDelegation: Delegation = {
      id: `del-${Date.now()}`,
      delegateId,
      delegateName: delegate.name,
      fromDate,
      toDate,
      scope: scope === 'all' ? 'All approvals' : 'Specific types only',
    };

    setDelegations((prev) => [...prev, newDelegation]);
    setShowForm(false);
    setDelegateId('');
    setFromDate('');
    setToDate('');
    setScope('all');
  };

  const handleRemove = (id: string) => {
    setDelegations((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {delegations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Active Delegations</h3>
          {delegations.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <UserCheck className="size-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Delegated to {d.delegateName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {d.fromDate} to {d.toDate} &middot; {d.scope}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(d.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          <Calendar className="size-4" />
          I'm going on leave
        </Button>
      ) : (
        <div className="rounded-md border p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Set up delegation</h3>

          <div className="space-y-2">
            <Label htmlFor="delegate">Delegate</Label>
            <Select value={delegateId} onValueChange={setDelegateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a delegate" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => !u.isOOO)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope">Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All approvals</SelectItem>
                <SelectItem value="specific">Only for specific types</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleAdd} disabled={!delegateId || !fromDate || !toDate}>
              Save delegation
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
