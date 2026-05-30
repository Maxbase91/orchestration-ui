import { useEffect, useState } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase-client';
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
  conversations: number;
  queries: number;
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
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#1B2A4A]/8">
          <Icon className="size-4 text-[#1B2A4A]" />
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
    buckets.push({ name: dayStr, conversations: dayConvs.length, queries });
  }
  return buckets;
}

export function AIAnalyticsPage() {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [totalConvs, setTotalConvs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const since = subDays(new Date(), 14).toISOString();

      const [{ data: recentConvs }, { count }, { data: fb }] = await Promise.all([
        supabase
          .from('assistant_conversations')
          .select('id, title, created_at, messages')
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
        supabase
          .from('assistant_conversations')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('chat_feedback')
          .select('polarity, created_at'),
      ]);

      setConvs((recentConvs ?? []) as ConvRow[]);
      setTotalConvs(count ?? 0);
      setFeedback((fb ?? []) as FeedbackRow[]);
      setLoading(false);
    })();
  }, []);

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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
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
              <p className="mb-4 text-sm font-medium text-gray-700">Conversations per day</p>
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
              <p className="mb-4 text-sm font-medium text-gray-700">Answer quality</p>
              {totalFeedback === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
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
            <div className="border-b border-gray-100 px-5 py-3.5">
              <p className="text-sm font-medium text-gray-700">Recent conversations (14 days)</p>
            </div>
            <div className="divide-y divide-gray-50">
              {convs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No conversations in this period.</p>
              ) : (
                convs.slice(0, 20).map((c) => {
                  const msgCount = c.messages?.length ?? 0;
                  const userMsgs = c.messages?.filter((m) => m.role === 'user').length ?? 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-800">{c.title}</p>
                        <p className="text-xs text-gray-400">
                          {userMsgs} {userMsgs === 1 ? 'query' : 'queries'} · {msgCount} messages
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">
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
