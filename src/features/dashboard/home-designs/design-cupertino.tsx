import { Link } from 'react-router-dom';
import { SmartCommandBar } from '../components/smart-command-bar';
import { Eyebrow, FlowLink, PillButton, QuickActionPills, WidgetCard } from './home-design-shared';
import { useDemandPipeline, useHomeKpis, useWelcome } from './home-design-data';

/**
 * 1a — "Cupertino Classic". A centered, apple.com-style home: the real front
 * door (SmartCommandBar) as the hero, a LIVE horizontal pipeline (real stage
 * counts) with travelling glow tokens, then live KPIs + actionable widgets.
 */
export function DesignCupertino() {
  const { name } = useWelcome();
  const pipeline = useDemandPipeline();
  const kpis = useHomeKpis();

  return (
    <div className="bg-white pb-20">
      {/* Hero — the functional front door */}
      <section className="animate-lp-fade px-10 pt-16 pb-8 text-center">
        <Eyebrow className="mb-3.5">Welcome back, {name}</Eyebrow>
        <h1 className="mx-auto mb-4 max-w-[820px] text-[64px] font-semibold leading-[1.05] tracking-[-0.025em] text-[var(--lp-text)]">
          One front door<br />for all of procurement.
        </h1>
        <p className="mx-auto mb-7 max-w-[640px] text-[22px] leading-[1.35] text-[var(--lp-text-2)]">
          Ask for anything below — it’s classified, routed and tracked automatically.
        </p>
        <div className="mx-auto mb-7 max-w-[720px] text-left">
          <SmartCommandBar />
        </div>
        <div className="mb-7 flex items-center justify-center gap-6">
          <PillButton to="/requests/new">Start a request</PillButton>
          <FlowLink targetId="lp-pipeline">See how it flows&nbsp;›</FlowLink>
        </div>
        <QuickActionPills className="justify-center" />
      </section>

      {/* Live horizontal pipeline */}
      <section id="lp-pipeline" className="px-14 pb-10 pt-6">
        <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#f5f5f7,#eef0f3)] px-12 pb-12 pt-14">
          <p className="mb-11 text-center text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--lp-text-3)]">
            Your demand, orchestrated end-to-end
          </p>
          <div className="relative mx-3 h-[150px]">
            {/* track */}
            <div className="absolute left-[4%] right-[4%] top-[34px] h-[3px] rounded bg-[linear-gradient(90deg,#d2d2d7,#0071e3,#d2d2d7)]" />
            {/* travelling tokens */}
            <div className="absolute top-[28px] size-[15px] rounded-full bg-[var(--lp-accent)] shadow-[0_0_16px_4px_rgba(0,113,227,.55)] animate-lp-token" />
            <div className="absolute top-[30px] size-[11px] rounded-full bg-[var(--lp-bright)] shadow-[0_0_12px_3px_rgba(41,151,255,.5)] animate-lp-token [animation-delay:2.2s]" />
            {/* nodes */}
            <div className="absolute inset-x-0 top-0 flex justify-between">
              {pipeline.map((node, i) => {
                const Icon = node.Icon;
                return (
                  <Link key={node.key} to="/requests" className="w-[150px] text-center">
                    <div
                      className="mx-auto flex size-[70px] items-center justify-center rounded-[20px] bg-white shadow-[0_4px_18px_rgba(0,0,0,.08)] animate-lp-node"
                      style={{ animationDelay: `${i * 0.6}s` }}
                    >
                      <Icon className="size-7 text-[var(--lp-text)]" />
                    </div>
                    <div className="mt-3.5 text-[15px] font-semibold text-[var(--lp-text)]">{node.label}</div>
                    <div className="text-[13px] font-medium text-[var(--lp-accent)]">{node.count} in stage</div>
                    <div className="text-[11px] text-[var(--lp-text-3)]">{node.sub}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Live KPIs + actionable widgets, as Apple cards */}
      <section className="px-14 pb-4 pt-2">
        <h2 className="mb-2 text-center text-[42px] font-semibold tracking-[-0.02em] text-[var(--lp-text)]">
          Everything in flight, at a glance.
        </h2>
        <p className="mb-12 text-center text-[20px] text-[var(--lp-text-2)]">Live from your pipeline.</p>

        <div className="mb-6 grid grid-cols-4 gap-5">
          {kpis.map((k) => (
            <div key={k.key} className="rounded-[22px] bg-[var(--lp-surface)] p-7 text-center">
              <div className="text-[44px] font-semibold leading-none tracking-[-0.02em] text-[var(--lp-text)]">{k.value}</div>
              <div className="mt-3 text-[15px] font-medium text-[var(--lp-text)]">{k.label}</div>
              <div className="text-[13px] text-[var(--lp-text-3)]">{k.sub}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <WidgetCard id="attention-required" />
          <WidgetCard id="supplier-risk" />
        </div>
      </section>

      {/* CTA */}
      <section className="px-10 pt-16 text-center">
        <h2 className="mb-6 text-[44px] font-semibold tracking-[-0.02em] text-[var(--lp-text)]">
          Give procurement a front door.
        </h2>
        <PillButton to="/requests/new" size="lg">Start a request</PillButton>
      </section>
    </div>
  );
}
