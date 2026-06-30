import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SmartCommandBar } from '../components/smart-command-bar';
import { PillButton, QuickActionPills, WidgetCard } from './home-design-shared';
import { useDemandPipeline, useHomeKpis, useWelcome } from './home-design-data';

/**
 * 1b — "Bento". The real front door over a bento grid of LIVE tiles: a tall
 * pipeline tile (real stage counts), live KPI tiles (one accent), and the
 * actionable widgets. Every tile is functional and links into the app.
 */
export function DesignBento() {
  const { name } = useWelcome();
  const pipeline = useDemandPipeline();
  const kpis = useHomeKpis();

  return (
    <div className="bg-white px-14 pb-20 pt-12">
      {/* Hero copy + front door */}
      <section className="mb-10 text-center">
        <h1 className="mb-4 text-[56px] font-semibold leading-[1.05] tracking-[-0.025em] text-[var(--lp-text)]">
          Procurement,<br />orchestrated.
        </h1>
        <p className="mx-auto mb-6 max-w-[600px] text-[21px] text-[var(--lp-text-2)]">
          Welcome back, {name}. Ask for anything and it runs the whole play — routing, approvals, automation.
        </p>
        <div className="mx-auto mb-5 max-w-[720px] text-left">
          <SmartCommandBar />
        </div>
        <QuickActionPills className="justify-center" />
      </section>

      {/* Bento grid of live tiles */}
      <section className="mb-6 grid auto-rows-[208px] grid-cols-[1.3fr_1fr_1fr] gap-5">
        {/* tall front-door / live pipeline tile */}
        <Link
          to="/requests"
          className="row-span-2 flex flex-col justify-between rounded-[24px] bg-[var(--lp-surface)] p-8 transition-colors hover:bg-[var(--lp-surface-hover)]"
        >
          <div>
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--lp-accent)]">
              The front door
            </div>
            <h3 className="mb-1.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--lp-text)]">
              Everything in flight.
            </h3>
            <p className="mb-5 text-[15px] text-[var(--lp-text-2)]">Live counts by stage.</p>
          </div>
          <ul className="space-y-2.5">
            {pipeline.map((node) => {
              const Icon = node.Icon;
              return (
                <li key={node.key} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-[12px] bg-white shadow-[0_4px_14px_rgba(0,0,0,.06)]">
                    <Icon className="size-4 text-[var(--lp-text)]" />
                  </span>
                  <span className="flex-1 text-[15px] font-medium text-[var(--lp-text)]">{node.label}</span>
                  <span className="text-[18px] font-semibold tabular-nums text-[var(--lp-text)]">{node.count}</span>
                </li>
              );
            })}
          </ul>
        </Link>

        {/* live KPI tiles — the 'sourcing' one is the blue accent tile */}
        {kpis.map((k) => {
          const accent = k.key === 'sourcing';
          return (
            <div
              key={k.key}
              className={cn(
                'flex flex-col justify-between rounded-[24px] p-7',
                accent ? 'bg-[var(--lp-accent)] text-white' : 'bg-[var(--lp-surface)]',
              )}
            >
              <div className={cn('text-[13px] font-medium', accent ? 'text-white/85' : 'text-[var(--lp-text-3)]')}>
                {k.label}
              </div>
              <div>
                <div className={cn('text-[44px] font-semibold leading-none tracking-[-0.02em]', accent ? 'text-white' : 'text-[var(--lp-text)]')}>
                  {k.value}
                </div>
                <div className={cn('mt-1 text-[13px]', accent ? 'text-white/85' : 'text-[var(--lp-text-3)]')}>{k.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* actionable widgets */}
      <section className="mb-12 grid grid-cols-2 gap-5">
        <WidgetCard id="attention-required" />
        <WidgetCard id="supplier-risk" />
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="mb-2.5 text-[44px] font-semibold tracking-[-0.02em] text-[var(--lp-text)]">
          Stop chasing. Start orchestrating.
        </h2>
        <p className="mb-6 text-[20px] text-[var(--lp-text-2)]">See your next request route itself.</p>
        <PillButton to="/requests/new" size="lg">Start a request</PillButton>
      </section>
    </div>
  );
}
