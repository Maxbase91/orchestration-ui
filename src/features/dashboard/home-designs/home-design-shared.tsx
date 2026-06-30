import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, ShoppingBag, ListTodo, FileSignature, Receipt, Route, PenTool, UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { openAIChat } from '@/features/ai-assistant/ai-chat-overlay';
import { allQuickActions, widgetRegistry } from '../widget-registry';
import { widgetComponents } from '../widgets';

// ── Quick-action pills (same actions as the dashboard, Apple-styled) ────────
const qaIcon: Record<string, LucideIcon> = {
  Plus, Search, CheckCircle, Sparkles, FileText, AlertTriangle, Building2,
  BarChart3, Shield, ShoppingBag, ListTodo, FileSignature, Receipt, Route, PenTool, UserCog,
  Workflow: BarChart3,
};

export function QuickActionPills({ className }: { className?: string }) {
  const currentRole = useAuthStore((s) => s.currentRole);
  const dashboardStore = useDashboardStore();
  const actions = dashboardStore
    .getQuickActions(currentRole)
    .map((id) => allQuickActions.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const pill =
    'inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-[15px] font-medium text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-surface-hover)]';

  return (
    <div className={cn('flex flex-wrap gap-2.5', className)}>
      {actions.map((action) => {
        const Icon = qaIcon[action.icon] ?? Plus;
        const inner = (
          <>
            <Icon className="size-4 text-[var(--lp-accent)]" />
            {action.label}
          </>
        );
        return action.action === 'open-ai-chat' ? (
          <button key={action.id} type="button" className={pill} onClick={() => openAIChat()}>
            {inner}
          </button>
        ) : (
          <Link key={action.id} to={action.to ?? '/'} className={pill}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

// ── Primary CTA pill + flow link ────────────────────────────────────────────
export function PillButton({
  to, onClick, children, size = 'md',
}: { to?: string; onClick?: () => void; children: ReactNode; size?: 'md' | 'lg' }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to && navigate(to))}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[var(--lp-accent)] font-medium text-white transition-colors hover:bg-[var(--lp-accent-hover)]',
        size === 'lg' ? 'px-8 py-3.5 text-[19px]' : 'px-6 py-3 text-[17px]',
      )}
    >
      {children}
    </button>
  );
}

export function FlowLink({ targetId, children }: { targetId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })}
      className="text-[17px] text-[#0066cc] hover:underline"
    >
      {children}
    </button>
  );
}

// ── A real widget rendered inside an Apple surface card ─────────────────────
export function WidgetCard({ id, className }: { id: string; className?: string }) {
  const Comp = widgetComponents[id];
  const meta = widgetRegistry.find((w) => w.id === id);
  if (!Comp) return null;
  return (
    <div className={cn('rounded-[22px] bg-[var(--lp-surface)] p-6', className)}>
      {meta && (
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--lp-accent)]">
          {meta.title}
        </p>
      )}
      <Comp />
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[21px] font-semibold text-[var(--lp-accent)] tracking-[-0.01em]', className)}>
      {children}
    </div>
  );
}
