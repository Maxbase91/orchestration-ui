// Approval Chains page → Roles: which system role acts as each functional role
// named on a chain step or a workflow stage.
//
// This was a constant in code (CHAIN_ROLE_TO_SYSTEM_ROLE). Nobody could change
// who approves as "Finance" or "CFO"; "Vendor management", a live stage owner,
// had no entry, so its stage was left unassigned; and "Budget Owner" fell back
// to any requester — including the one who raised the request.
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { roles as systemRoles, type Role } from '@/config/roles';
import type { FunctionalRole } from '@/data/functional-roles';
import { useFunctionalRoles, useUpsertFunctionalRole, useDeleteFunctionalRole } from '@/lib/db/hooks/use-functional-roles';
import { useApprovalChains } from '@/lib/db/hooks/use-approval-chains';
import { useWorkflowTemplates } from '@/lib/db/hooks/use-workflow-templates';

/** The three roles resolved from a record; `acts as` only decides when it names nobody. */
const RECORD_BACKED: Record<string, string> = {
  'Budget Owner': "the cost centre's owner",
  'Category Manager': "the category's managers",
  'Contract Owner': "the contract's owner",
};

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

export function ApprovalRolesPanel() {
  const { data: rolesList = [], isLoading } = useFunctionalRoles();
  const { data: chains = [] } = useApprovalChains();
  const { data: templates = [] } = useWorkflowTemplates();
  const upsert = useUpsertFunctionalRole();
  const remove = useDeleteFunctionalRole();
  const [newName, setNewName] = useState('');

  // Where each role is named, so a role still in use cannot be deleted from
  // under a chain or a stage.
  const usage = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (role: string | undefined, where: string) => {
      if (!role) return;
      map.set(role, [...(map.get(role) ?? []), where]);
    };
    for (const chain of chains) for (const step of chain.steps) add(step.role, `chain ${chain.name}`);
    for (const t of templates) for (const node of t.nodes) add(node.role, `${t.id} ${node.label}`);
    return map;
  }, [chains, templates]);

  const unknown = [...usage.keys()].filter((name) => !rolesList.some((r) => r.name === name));

  async function save(role: FunctionalRole) {
    try {
      await upsert.mutateAsync(role);
      toast.success(`"${role.name}" acts as ${systemRoles.find((r) => r.id === role.actsAs)?.label ?? role.actsAs}`);
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name || rolesList.some((r) => r.name.toLowerCase() === name.toLowerCase())) return;
    await save({ name, actsAs: 'procurement-manager', description: '', sortOrder: 50 });
    setNewName('');
  }

  return (
    <Card className="space-y-4 p-5" aria-label="Roles">
      <div>
        <h2 className="text-sm font-semibold text-ink">Roles</h2>
        <p className="mt-0.5 max-w-3xl text-xs text-ink-3">
          The roles named on chain steps and workflow stages, and which system role acts as each. Budget Owner,
          Category Manager and Contract Owner are first resolved from the record (the cost centre&apos;s owner, the
          category&apos;s managers, the contract&apos;s owner); <span className="font-medium">acts as</span> decides when the
          record names nobody. Nobody may approve a step on a request they raised.
        </p>
      </div>

      {unknown.length > 0 && (
        <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          Named but not configured — nobody can act on these: {unknown.join(', ')}. Add them below.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Functional roles">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Acts as</th>
              <th className="py-2 pr-3 font-medium">Named on</th>
              <th className="py-2 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="py-3 text-ink-3">Loading roles…</td></tr>
            )}
            {rolesList.map((role) => {
              const where = usage.get(role.name) ?? [];
              return (
                <tr key={role.name} className="border-b border-line-2 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-ink">{role.name}</span>
                    {RECORD_BACKED[role.name] && (
                      <span className="block text-[11px] text-ink-3">First: {RECORD_BACKED[role.name]}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={`${role.name} acts as`}
                      className={selectClass}
                      value={role.actsAs}
                      onChange={(e) => void save({ ...role, actsAs: e.target.value as Role })}
                    >
                      {systemRoles.filter((r) => r.id !== 'supplier').map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-ink-2">
                    {where.length === 0 ? <span className="text-ink-3">not named anywhere</span> : `${where.length} place${where.length === 1 ? '' : 's'}`}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-ink-3 hover:text-stop"
                      disabled={where.length > 0 || Boolean(RECORD_BACKED[role.name])}
                      title={where.length > 0 ? `Named on ${where.join(', ')}` : 'Delete role'}
                      aria-label={`Delete ${role.name}`}
                      onClick={() => void remove.mutateAsync(role.name).then(() => toast.success(`"${role.name}" deleted`))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Input
          aria-label="New role name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          placeholder="New role, e.g. Head of Security"
          className="h-8 max-w-xs text-xs"
        />
        <Button size="sm" variant="outline" onClick={() => void add()} disabled={!newName.trim()}>
          <Plus className="mr-1 size-3.5" /> Add role
        </Button>
      </div>
    </Card>
  );
}
