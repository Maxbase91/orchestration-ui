import { SmartCommandBar } from '../components/smart-command-bar';
import { FlowLink, PillButton, QuickActionPills } from './home-design-shared';
import { useDemandPipeline, useHomeKpis, useWelcome } from './home-design-data';

/**
 * 1c — "Editorial". Oversized gradient type over the real front door, then a
 * dramatic black section that renders the LIVE pipeline as a vertical flow
 * (real stage counts) with a descending token. Functional throughout.
 */
export function DesignEditorial() {
  const { name } = useWelcome();
  const pipeline = useDemandPipeline();
  const kpis = useHomeKpis();

  return (
    <div className="bg-white pb-20">
      {/* Editorial hero */}
      <section className="mx-auto max-w-[1000px] px-16 pb-12 pt-20">
        <div className="mb-5 text-[21px] font-semibold text-[var(--lp-text-3)]">
          Welcome back, {name}
        </div>
        <h1 className="text-[80px] font-semibold leading-[1.02] tracking-[-0.03em] text-[var(--lp-text)]">
          A request walks in.<br />
          <span className="animate-lp-grad bg-[linear-gradient(90deg,#0071e3,#2997ff,#34c759,#0071e3)] bg-[length:200%_auto] bg-clip-text text-transparent">
            Everything else happens by itself.
          </span>
        </h1>
        <p className="mt-8 max-w-[760px] text-[24px] leading-[1.4] text-[var(--lp-text-2)]">
          Your front door to procurement — it takes the ask, runs the workflow, and clears the manual work
          off your team’s plate.
        </p>
        <div className="mt-8 max-w-[760px]">
          <SmartCommandBar />
        </div>
        <div className="mt-7 flex items-center gap-6">
          <PillButton to="/requests/new">Start a request</PillButton>
          <FlowLink targetId="lp-flow">Watch the flow&nbsp;›</FlowLink>
        </div>
        <QuickActionPills className="mt-7" />
      </section>

      {/* Black vertical live flow */}
      <section id="lp-flow" className="bg-black px-16 py-20 text-white">
        <h2 className="mb-2 text-center text-[44px] font-semibold tracking-[-0.02em]">
          Watch your pipeline go the distance.
        </h2>
        <p className="mb-14 text-center text-[19px] text-[#a1a1a6]">
          Every open request, by stage — live.
        </p>
        <div className="relative mx-auto max-w-[560px]">
          {/* spine */}
          <div className="absolute bottom-2.5 left-[30px] top-2.5 w-[3px] rounded bg-[linear-gradient(180deg,#0071e3,#34c759)]" />
          {/* descending token */}
          <div className="absolute left-[23px] size-[17px] rounded-full bg-white shadow-[0_0_18px_5px_rgba(41,151,255,.8)] animate-lp-token-v" />
          <div className="flex flex-col gap-7">
            {pipeline.map((node, i) => {
              const Icon = node.Icon;
              const last = i === pipeline.length - 1;
              return (
                <div key={node.key} className="flex items-start gap-7">
                  <div
                    className={`z-[1] flex size-[62px] shrink-0 items-center justify-center rounded-[18px] ${
                      last ? 'bg-[linear-gradient(150deg,#0071e3,#34c759)]' : 'bg-[#1c1c1e]'
                    }`}
                  >
                    <Icon className="size-6 text-white" />
                  </div>
                  <div className="pt-1.5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[22px] font-semibold">{node.label}</span>
                      <span className="text-[16px] font-medium text-[var(--lp-bright)]">{node.count} active</span>
                    </div>
                    <div className="mt-1 text-[16px] text-[#a1a1a6]">{node.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live KPI triplet */}
      <section className="px-16 pt-20">
        <div className="grid grid-cols-3 gap-12">
          {kpis.slice(0, 3).map((k) => (
            <div key={k.key}>
              <div className="text-[56px] font-semibold leading-none tracking-[-0.02em] text-[var(--lp-text)]">{k.value}</div>
              <h3 className="mt-3 text-[24px] font-semibold tracking-[-0.01em] text-[var(--lp-text)]">{k.label}</h3>
              <p className="mt-1 text-[16px] text-[var(--lp-text-2)]">{k.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-10 pt-20 text-center">
        <h2 className="mb-6 text-[52px] font-semibold tracking-[-0.025em] text-[var(--lp-text)]">
          Open the front door.
        </h2>
        <PillButton to="/requests/new" size="lg">Start a request</PillButton>
      </section>
    </div>
  );
}
