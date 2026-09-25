// The Status Answers agent's configuration: what may be asked about each
// object, and whose records each role may ask about.
//
// Attributes are listed from the data model itself — every key a live record
// of the object carries — merged with what is saved. One the configuration has
// not seen yet (a column added since) shows as "New", switched off, until an
// admin enables it: nothing starts answering on its own.
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { AIAgent } from '@/data/types';
import { roles, type Role } from '@/config/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSaveAiAgent } from '@/lib/db/hooks/use-ai-agents';
import {
  STATUS_OBJECTS, STATUS_OBJECT_META, statusConfigFromStored, mergeDiscoveredAttributes,
  type StatusAgentConfig, type StatusObject, type StatusAttribute, type StatusAccess, type AttributeMode, type AttributeVisibility,
} from '@/lib/assistant/status-config';
import { discoverAttributeKeys } from '@/lib/assistant/status-lookup';

const MODE_LABEL: Record<AttributeMode, string> = {
  summary: 'In the status answer',
  ask: 'When asked for',
  off: 'Off',
};
const VISIBILITY_LABEL: Record<AttributeVisibility, string> = {
  everyone: 'Anyone who can see the record',
  procurement: 'Procurement roles only',
};
const ACCESS_LABEL: Record<StatusAccess, string> = { none: 'None', own: 'Own', all: 'All' };

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

export function StatusAgentConfigPanel({ agent }: { agent: AIAgent }) {
  const saveAgent = useSaveAiAgent();
  // The admin's edits; null until the first one, so the saved config (and what
  // discovery adds to it) shows live until then.
  const [edited, setEdited] = useState<StatusAgentConfig | null>(null);

  const discovered = useQueries({
    queries: STATUS_OBJECTS.map((object) => ({
      queryKey: ['status-agent', 'attributes', object],
      queryFn: () => discoverAttributeKeys(object),
    })),
  });

  const { base, added } = useMemo(() => {
    let config = statusConfigFromStored(agent.config);
    const newKeys = new Set<string>();
    STATUS_OBJECTS.forEach((object, i) => {
      const result = mergeDiscoveredAttributes(config, object, discovered[i]?.data ?? []);
      config = result.config;
      result.added.forEach((key) => newKeys.add(`${object}:${key}`));
    });
    return { base: config, added: newKeys };
  }, [agent.config, discovered]);
  const config = edited ?? base;

  const setAttribute = (object: StatusObject, key: string, patch: Partial<StatusAttribute>) => {
    setEdited({
      ...config,
      objects: { ...config.objects, [object]: config.objects[object].map((a) => (a.key === key ? { ...a, ...patch } : a)) },
    });
  };
  const setAccess = (role: Role, object: StatusObject, access: StatusAccess) => {
    setEdited({ ...config, access: { ...config.access, [role]: { ...config.access[role], [object]: access } } });
  };

  async function save() {
    try {
      await saveAgent.mutateAsync({ ...agent, config, lastUpdated: new Date().toISOString() });
      setEdited(null);
      toast.success('Status answers saved');
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <section aria-label="Status answers configuration" className="space-y-6 rounded-lg border border-line bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">What can be asked</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-ink-3">
            Every attribute of each object, listed from the data. <span className="font-medium">In the status answer</span> is
            said whenever someone asks where something is; <span className="font-medium">When asked for</span> only when the
            question names it (&ldquo;what&apos;s the due date of INV-…?&rdquo;). An attribute added to the data later appears here as
            New and switched off.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saveAgent.isPending || edited === null}>
          <Save className="size-4" />
          {saveAgent.isPending ? 'Saving…' : edited === null ? 'Saved' : 'Save'}
        </Button>
      </div>

      <Tabs defaultValue="request">
        <TabsList>
          {STATUS_OBJECTS.map((object) => (
            <TabsTrigger key={object} value={object}>{STATUS_OBJECT_META[object].plural.replace(' waiting on you', '')}</TabsTrigger>
          ))}
        </TabsList>
        {STATUS_OBJECTS.map((object) => (
          <TabsContent key={object} value={object}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label={`${STATUS_OBJECT_META[object].label} attributes`}>
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="py-2 pr-3 font-medium">Attribute</th>
                    <th className="py-2 pr-3 font-medium">Label the chatbot uses</th>
                    <th className="py-2 pr-3 font-medium">Answered</th>
                    <th className="py-2 font-medium">Who may see it</th>
                  </tr>
                </thead>
                <tbody>
                  {config.objects[object].map((attribute) => (
                    <tr key={attribute.key} className="border-b border-line-2 last:border-0" data-attribute={`${object}:${attribute.key}`}>
                      <td className="py-1.5 pr-3">
                        <span className="font-mono text-[11px] text-ink-2">{attribute.key}</span>
                        {attribute.derived && <span className="ml-1.5 rounded-full bg-idle-soft px-1.5 py-0.5 text-[10px] text-ink-3" title="Worked out for the answer, not stored on the record">derived</span>}
                        {added.has(`${object}:${attribute.key}`) && <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] text-warn">New</span>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <Input
                          aria-label={`Label for ${attribute.key}`}
                          value={attribute.label}
                          onChange={(e) => setAttribute(object, attribute.key, { label: e.target.value })}
                          className="h-8 min-w-44 text-xs"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <select
                          aria-label={`When ${attribute.key} is answered`}
                          className={selectClass}
                          value={attribute.mode}
                          onChange={(e) => setAttribute(object, attribute.key, { mode: e.target.value as AttributeMode })}
                        >
                          {(Object.keys(MODE_LABEL) as AttributeMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5">
                        <select
                          aria-label={`Who may see ${attribute.key}`}
                          className={selectClass}
                          value={attribute.visibility}
                          disabled={attribute.mode === 'off'}
                          onChange={(e) => setAttribute(object, attribute.key, { visibility: e.target.value as AttributeVisibility })}
                        >
                          {(Object.keys(VISIBILITY_LABEL) as AttributeVisibility[]).map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div>
        <h3 className="text-sm font-semibold text-ink">Whose records each role can ask about</h3>
        <p className="mt-0.5 max-w-2xl text-xs text-ink-3">
          <span className="font-medium">Own</span>: a request you raised, are buying for or own; the POs and invoices from it; a
          contract linked to it or that you own; its supplier. Approvals are always the ones waiting on you.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" aria-label="Access by role">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="py-2 pr-3 font-medium">Role</th>
                {STATUS_OBJECTS.map((object) => <th key={object} className="py-2 pr-3 font-medium">{STATUS_OBJECT_META[object].label}s</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-line-2 last:border-0">
                  <td className="py-1.5 pr-3 text-ink-2">{role.label}</td>
                  {STATUS_OBJECTS.map((object) => (
                    <td key={object} className="py-1.5 pr-3">
                      <select
                        aria-label={`${role.label} — ${STATUS_OBJECT_META[object].label}s`}
                        className={selectClass}
                        value={config.access[role.id][object]}
                        onChange={(e) => setAccess(role.id, object, e.target.value as StatusAccess)}
                      >
                        {(Object.keys(ACCESS_LABEL) as StatusAccess[])
                          // Approvals are always the asker's own; "All" would mean nothing different.
                          .filter((a) => object !== 'approval' || a !== 'all')
                          .map((a) => <option key={a} value={a}>{ACCESS_LABEL[a]}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
