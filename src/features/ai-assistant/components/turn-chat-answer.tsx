import { BookOpen } from 'lucide-react';
import type { ChatAnswerTurn } from '@/data/types';

interface Props {
  turn: ChatAnswerTurn;
}

// Inline bold: **text** → <strong>
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      : part
  );
}

// Render a line that starts with a bullet or number
function isBulletLine(line: string) {
  return /^[•\-–]\s/.test(line) || /^\d+\.\s/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[•\-–]\s+/, '').replace(/^\d+\.\s+/, '');
}

function MarkdownContent({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');

        // Numbered list (1. 2. 3.)
        if (lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={bIdx} className="list-none space-y-0.5 pl-0">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="flex gap-2">
                  <span className="shrink-0 font-medium text-gray-400 tabular-nums">
                    {lIdx + 1}.
                  </span>
                  <span>{renderInline(stripBullet(line.trim()))}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Bullet list (•, -, –)
        if (lines.some((l) => isBulletLine(l.trim()))) {
          return (
            <ul key={bIdx} className="list-none space-y-0.5 pl-0">
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                if (!isBulletLine(trimmed)) {
                  // Non-bullet line mixed into block — treat as paragraph
                  return (
                    <li key={lIdx} className="text-gray-800">
                      {renderInline(trimmed)}
                    </li>
                  );
                }
                return (
                  <li key={lIdx} className="flex gap-2">
                    <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-gray-300" />
                    <span>{renderInline(stripBullet(trimmed))}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Heading-like line (short, ends with ':' and is the only line)
        if (lines.length === 1 && lines[0].endsWith(':') && lines[0].length < 80) {
          return (
            <p key={bIdx} className="font-semibold text-gray-700 text-[12.5px] uppercase tracking-wide">
              {renderInline(lines[0].slice(0, -1))}
            </p>
          );
        }

        // Regular paragraph(s)
        return (
          <p key={bIdx} className="text-gray-800">
            {renderInline(lines.join(' '))}
          </p>
        );
      })}
    </div>
  );
}

export function TurnChatAnswer({ turn }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-[18px] rounded-tl-[4px] bg-white border border-gray-100 shadow-sm px-4 py-3 text-[13.5px] leading-relaxed text-gray-800">
        <MarkdownContent text={turn.content} />
      </div>
      {turn.source && (
        <div className="flex items-center gap-1 pl-1">
          <BookOpen className="size-3 text-gray-400 shrink-0" />
          <span className="text-[10px] text-gray-400">{turn.source}</span>
        </div>
      )}
    </div>
  );
}
