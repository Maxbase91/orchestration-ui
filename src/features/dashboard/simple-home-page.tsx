/**
 * Requester-first home for Simple mode. It keeps the front door focused on
 * starting and tracking a request; operational metrics remain in Expert mode.
 */
import { useMemo, useState } from 'react';
import { ArrowRight, Clock3, FileText, HelpCircle, Plus, Sparkles, Upload, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useRequests } from '@/lib/db/hooks/use-requests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProcurementRequest } from '@/data/types';

const ACTIVE_STATUSES = new Set<ProcurementRequest['status']>([
  'draft', 'intake', 'validation', 'risk', 'onboarding', 'approval', 'sourcing',
  'contracting', 'po', 'receipt', 'invoice', 'payment', 'referred-back',
]);

const STATUS_COPY: Partial<Record<ProcurementRequest['status'], string>> = {
  draft: 'Saved for later',
  'referred-back': 'Needs your information',
  intake: 'Being checked',
  validation: 'Being reviewed',
  approval: 'Waiting for approval',
  sourcing: 'Options are being compared',
  contracting: 'Agreement is being prepared',
  po: 'Purchase order is being processed',
  completed: 'Complete',
};

function requestDate(request: ProcurementRequest): string {
  return request.updatedAt || request.createdAt;
}

export function SimpleHomePage() {
  const { currentUser } = useAuthStore();
  const { data: requests = [], isLoading } = useRequests();
  const myRequests = useMemo(
    () => requests
      .filter((request) => request.requestorId === currentUser.id || request.ownerId === currentUser.id)
      .sort((a, b) => requestDate(b).localeCompare(requestDate(a))),
    [currentUser.id, requests],
  );
  const activeRequests = myRequests.filter((request) => ACTIVE_STATUSES.has(request.status)).slice(0, 5);
  const recentRequests = myRequests.filter((request) => !ACTIVE_STATUSES.has(request.status)).slice(0, 3);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const startFromText = () => {
    const value = description.trim();
    if (value) window.location.href = `/requests/new?q=${encodeURIComponent(value)}`;
  };
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const response = await fetch('/api/intake-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, contentType: file.type, dataBase64: btoa(binary) }) });
      const body = await response.json() as { attachment?: { extractedText?: string; dataBase64?: string }; error?: string };
      if (body.attachment?.extractedText) {
        try { sessionStorage.setItem('intakeAttachment', JSON.stringify(body.attachment)); } catch { /* extraction still works if storage is full */ }
        window.location.href = `/requests/new?q=${encodeURIComponent(body.attachment.extractedText)}`;
      } else setUploadError(body.error ?? 'We could not read that document. You can paste its text instead.');
    } catch {
      // Upload is an accelerator, not a prerequisite; preserve the text entry
      // path and make the failure visible rather than leaving an unhandled
      // promise rejection on the requester home page.
      setUploadError('We could not read that document. You can paste its text instead.');
    } finally { setUploading(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Simple requester view</p>
        <h1 className="text-2xl font-semibold text-gray-900">What do you need help buying?</h1>
        <p className="text-sm text-muted-foreground">Start with a few words. We’ll find the right way to handle it.</p>
      </header>

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Start a new request</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600">Tell us what you need, and we’ll check the catalogue, existing contracts, and the fastest compliant route.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Describe what you need" value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); startFromText(); } }} placeholder="e.g. 20 laptops for the new team" className="min-h-11 flex-1 rounded-md border border-blue-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <Button onClick={startFromText} disabled={!description.trim()} className="shrink-0"><Plus className="size-4" />Start with this<ArrowRight className="size-4" /></Button>
            <Button asChild variant="outline" className="shrink-0"><Link to="/requests/new"><Plus className="size-4" />Open full intake</Link></Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <label htmlFor="home-intake-upload" className="inline-flex cursor-pointer items-center gap-1 font-medium text-blue-700 hover:underline"><Upload className="size-3.5" />{uploading ? <><Loader2 className="size-3.5 animate-spin" />Reading document…</> : 'Upload a PDF or DOCX'}</label>
            <input id="home-intake-upload" type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); }} />
            <span>{uploadError || 'We’ll extract the details and ask only what’s missing.'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Your requests</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link to="/requests/my">View all<ArrowRight className="size-3.5" /></Link></Button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading your requests…</p>}
          {!isLoading && activeRequests.length === 0 && <p className="text-sm text-muted-foreground">You have no requests in progress.</p>}
          {activeRequests.length > 0 && <div className="divide-y divide-gray-100">{activeRequests.map((request) => <RequestRow key={request.id} request={request} />)}</div>}
        </CardContent>
      </Card>

      {recentRequests.length > 0 && <Card><CardHeader><CardTitle className="text-base">Recently completed</CardTitle></CardHeader><CardContent><div className="divide-y divide-gray-100">{recentRequests.map((request) => <RequestRow key={request.id} request={request} />)}</div></CardContent></Card>}

      <Card className="bg-gray-50/70"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><HelpCircle className="mt-0.5 size-5 text-gray-500" /><div><p className="font-medium text-gray-900">Need help?</p><p className="text-sm text-gray-600">Find answers or contact the request team.</p></div></div><div className="flex gap-3 text-sm"><Link className="font-medium text-blue-600 hover:underline" to="/help/kb">Knowledge base</Link><Link className="font-medium text-blue-600 hover:underline" to="/help/support">Contact support</Link></div></CardContent></Card>
    </div>
  );
}

function RequestRow({ request }: { request: ProcurementRequest }) {
  return <Link to={`/requests/${request.id}`} className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-gray-50"><div className="flex min-w-0 items-center gap-3"><FileText className="size-4 shrink-0 text-gray-400" /><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{request.title}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><Clock3 className="size-3" />{STATUS_COPY[request.status] ?? 'In progress'} · {formatDate(requestDate(request))}</p></div></div><div className="flex shrink-0 items-center gap-2"><StatusBadge status={request.status} size="sm" /><span className="hidden text-xs text-gray-500 sm:inline">{formatCurrency(request.value, request.currency)}</span><ArrowRight className="size-3.5 text-gray-400" /></div></Link>;
}
