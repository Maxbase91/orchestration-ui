import { useMemo } from 'react';
import { AlertTriangle, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { useAllConversations, useChatFeedback } from '@/lib/db/hooks/use-ai-analytics';
import { PageHeader } from '@/components/shared/page-header';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { PieChartWidget } from '@/components/charts/pie-chart-widget';
import { Card } from '@/components/ui/card';

interface ConvRow {
  id: string;
  title: string;
  created_at: string;
  messages: Array<{ role: string }> | null;
}

interface FeedbackRow {
  polarity: string;
}

interface DailyBucket {
  name: string;
  value: number;
  conversations: number;
  queries: number;
  [key: string]: unknown;
}

function StatCard({ label, value, icon: Icon, sub }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft">
          <Icon className="size-4 text-ink" />
        </div>
      </div>
    </Card>
  );
}

function buildDailyBuckets(convs: ConvRow[], days = 14): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(subDays(now, i));
    const dayStr = format(day, 'MMM d');
    const dayConvs = convs.filter((c) => {
      const d = startOfDay(parseISO(c.created_at));
      return d.getTime() === day.getTime();
    });
    const queries = dayConvs.reduce(
      (sum, c) => sum + (c.messages?.filter((m) => m.role === 'user').length ?? 0),
      0
    );
    buckets.push({ name: dayStr, value: 0, conversations: dayConvs.length, queries });
  }
  return buckets;
}

export function AIAnalyticsPage() {
  // Hooks, not a one-shot `void (async () => …)()`. That IIFE had no catch, so
  // a failed read became an unhandled rejection — an uncaught page error the
  // route sweep reports — and `setLoading(false)` sat after the awaits, leaving
  // the screen on "Loading analytics…" indefinitely. An analytics page that
  // cannot read its data must say so; a permanent spinner reads as "still
  // working" and is indistinguishable from a slow query.
  const conversationsQuery = useAllConversations();
  const feedbackQuery = useChatFeedback();

  const loading = conversationsQuery.isLoading || feedbackQuery.isLoading;
  const failed = conversationsQuery.isError || feedbackQuery.isError;

  const all = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const totalConvs = all.length;

  // One read instead of two against the same table: the second call asked only
  // for a count, which is the length of the list already fetched.
  const convs = useMemo<ConvRow[]>(() => {
    const since = subDays(new Date(), 14).toISOString();
    return all
      .filter((conversation) => conversation.createdAt >= since)
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.createdAt,
        messages: conversation.messages,
      })) as unknown as ConvRow[];
  }, [all]);

  const feedback = useMemo<FeedbackRow[]>(
    () => (feedbackQuery.data ?? []).map((entry) => ({
      polarity: entry.polarity,
      created_at: entry.createdAt,
    })) as unknown as FeedbackRow[],
    [feedbackQuery.data],
  );

  const upVotes = feedback.filter((f) => f.polarity === 'up').length;
  const downVotes = feedback.filter((f) => f.polarity === 'down').length;
  const totalFeedback = upVotes + downVotes;
  const satisfactionPct = totalFeedback > 0 ? Math.round((upVotes / totalFeedback) * 100) : 0;

  const totalQueries = convs.reduce(
    (sum, c) => sum + (c.messages?.filter((m) => m.role === 'user').length ?? 0),
    0
  );

  const dailyBuckets = buildDailyBuckets(convs);

  const feedbackPieData = [
    { name: 'Helpful', value: upVotes, color: '#2E7D4F' },
    { name: 'Not helpful', value: downVotes, color: '#B5392E' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant Analytics"
        subtitle="Usage and answer quality for the last 14 days"
      />

      {/* Three states, not two. Zero conversations and an unreadable table look
          identical on a chart, and reporting the second as the first is the
          invented-number failure this tranche exists to remove. */}
      {failed ? (
        <div className="flex items-start gap-2 rounded-md border border-stop-line bg-stop-soft p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stop" />
          <div className="text-sm text-stop">
            <p className="font-medium">Analytics could not be loaded</p>
            <p className="mt-0.5 text-xs text-stop">
              The assistant conversation and feedback tables could not be read, so the figures
              below would be zeroes rather than measurements. Nothing is shown rather than
              something wrong.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-ink-3">
          Loading analytics…
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total conversations"
              value={totalConvs.toLocaleString()}
              icon={MessageSquare}
              sub="all time"
            />
            <StatCard
              label="User queries (14 d)"
              value={totalQueries.toLocaleString()}
              icon={TrendingUp}
              sub={`${convs.length} conversations`}
            />
            <StatCard
              label="Helpful answers"
              value={upVotes}
              icon={ThumbsUp}
              sub={totalFeedback > 0 ? `${satisfactionPct}% satisfaction` : 'no feedback yet'}
            />
            <StatCard
              label="Not helpful"
              value={downVotes}
              icon={ThumbsDown}
              sub={totalFeedback > 0 ? `${totalFeedback} total votes` : 'no feedback yet'}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="col-span-2 p-5">
              <p className="mb-4 text-sm font-medium text-ink-2">Conversations per day</p>
              <BarChartWidget
                data={dailyBuckets}
                dataKeys={[
                  { key: 'conversations', color: '#1B2A4A', label: 'Conversations' },
                  { key: 'queries', color: '#2D5F8A', label: 'User queries' },
                ]}
                xAxisKey="name"
                height={220}
                showLegend
              />
            </Card>

            <Card className="p-5">
              <p className="mb-4 text-sm font-medium text-ink-2">Answer quality</p>
              {totalFeedback === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-ink-3">
                  No feedback collected yet
                </div>
              ) : (
                <PieChartWidget
                  data={feedbackPieData}
                  height={220}
                  showLegend
                />
              )}
            </Card>
          </div>

          {/* Recent conversations */}
          <Card>
            <div className="border-b border-line-2 px-5 py-3.5">
              <p className="text-sm font-medium text-ink-2">Recent conversations (14 days)</p>
            </div>
            <div className="divide-y divide-line-2">
              {convs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-3">No conversations in this period.</p>
              ) : (
                convs.slice(0, 20).map((c) => {
                  const msgCount = c.messages?.length ?? 0;
                  const userMsgs = c.messages?.filter((m) => m.role === 'user').length ?? 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{c.title}</p>
                        <p className="text-xs text-ink-3">
                          {userMsgs} {userMsgs === 1 ? 'query' : 'queries'} · {msgCount} messages
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ink-3">
                        {format(parseISO(c.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
