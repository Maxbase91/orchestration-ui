// How a status answer reads, wherever it is shown — the Home box and the
// Status Answers agent's test panel render the same component, so what an
// admin tests is what a requester sees.
import { Link } from 'react-router-dom';
import type { StatusAnswer, StatusItem } from '@/lib/assistant/status-answer';

function Item({ item, onNavigate }: { item: StatusItem; onNavigate?: () => void }) {
  return (
    <div className="space-y-1.5">
      <Link to={item.link} onClick={onNavigate} className="text-sm font-semibold text-accent hover:underline">
        {item.title}
      </Link>
      {item.facts.length > 0 && (
        <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
          {item.facts.map((fact) => (
            <div key={fact.key} className="contents">
              <dt className="text-ink-3">{fact.label}</dt>
              <dd className="text-ink tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function StatusAnswerView({ answer, onNavigate }: { answer: StatusAnswer; onNavigate?: () => void }) {
  if (answer.kind === 'record') return <Item item={answer.item} onNavigate={onNavigate} />;
  if (answer.kind === 'list') {
    if (answer.items.length === 0) {
      return <p className="text-sm text-ink-2">{answer.object === 'approval' ? 'Nothing is waiting on you.' : `${answer.heading}: none open.`}</p>;
    }
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{answer.heading}</p>
        {answer.items.map((item) => <Item key={item.link + item.title} item={item} onNavigate={onNavigate} />)}
        {answer.more > 0 && <p className="text-xs text-ink-3">and {answer.more} more</p>}
      </div>
    );
  }
  return <p className="text-sm text-ink-2">{answer.message}</p>;
}
