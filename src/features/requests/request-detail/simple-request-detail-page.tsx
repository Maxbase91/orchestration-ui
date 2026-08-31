/**
 * Requester-focused request status page. It intentionally keeps the same
 * request record and permission checks as Expert mode, but removes operational
 * workflow controls from the first screen.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Clock, MessageSquare, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { useSupplierLookup, useSuppliers } from '@/lib/db/hooks/use-suppliers';
import { useServiceDescription } from '@/lib/db/hooks/use-service-descriptions';
import { useCommentsByRequest, useAddComment } from '@/lib/db/hooks/use-comments';
import { useUpdateRequest } from '@/lib/db/hooks/use-requests';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProcurementRequest } from '@/data/types';

const STATUS_COPY: Record<string, string> = {
  draft: 'This request is saved for later and has not been sent yet.',
  intake: 'The request has been received and is being checked.',
  validation: 'A procurement specialist is validating the request details.',
  risk: 'The required risk checks are being completed.',
  onboarding: 'The supplier information is being prepared.',
  approval: 'The request is waiting for the required approvals.',
  sourcing: 'The procurement team is comparing options and suppliers.',
  contracting: 'The agreement is being prepared.',
  po: 'The purchase order is being processed.',
  receipt: 'The delivery is awaiting confirmation.',
  invoice: 'The invoice is being checked.',
  payment: 'Payment is being processed.',
  completed: 'This request has been completed.',
  cancelled: 'This request has been cancelled.',
  'referred-back': 'More information is needed before this request can continue.',
};

function statusExplanation(request: ProcurementRequest): string {
  if (request.buyingChannel === 'framework-call-off' && request.status === 'validation') {
    return 'The contract, supplier, risk, and order details are being checked before this call-off can be released.';
  }
  if (request.buyingChannel === 'framework-call-off' && request.status === 'approval') {
    return 'The budget owner is confirming authority for this call-off. This is separate from the contract and compliance check.';
  }
  return STATUS_COPY[request.status] ?? 'This request is progressing through its assigned process.';
}

function prettyStatus(status: string): string {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SimpleRequestDetailPage({ request }: { request: ProcurementRequest }) {
  const currentRole = useAuthStore((state) => state.currentRole);
  const canOpenPurchaseOrders = ['procurement-manager', 'operations-lead', 'admin'].includes(currentRole);
  useSuppliers();
  useUsers();
  const { currentUser } = useAuthStore();
  const lookupUser = useUserLookup();
  const lookupSupplier = useSupplierLookup();
  const { data: description } = useServiceDescription(request.id);
  const { data: comments = [] } = useCommentsByRequest(request.id);
  const addComment = useAddComment();
  const updateRequest = useUpdateRequest();
  const [comment, setComment] = useState('');
  const requestor = lookupUser(request.requestorId);
  const owner = lookupUser(request.ownerId);
  const supplier = lookupSupplier(request.supplierId);
  const canWithdraw = request.requestorId === currentUser.id && ['draft', 'intake', 'validation'].includes(request.status);
  const statusText = statusExplanation(request);
  const visibleComments = comments.filter((item) => !item.isInternal);

  const postComment = async () => {
    const text = comment.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({
        requestId: request.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorInitials: currentUser.initials,
        content: text,
        isInternal: false,
        stage: request.status,
        mentions: [],
      });
      setComment('');
      toast.success('Message sent to the request team');
    } catch (error) {
      toast.error(`Message failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const withdraw = async () => {
    try {
      await updateRequest.mutateAsync({ id: request.id, patch: { status: 'cancelled' } });
      toast.success('Request withdrawn');
    } catch (error) {
      toast.error(`Could not withdraw request: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Simple requester view</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-gray-500">{request.id}</p><h1 className="text-2xl font-semibold text-gray-900">{request.title}</h1></div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">{prettyStatus(request.status)}</span>
        </div>
      </header>

      <Card className="border-blue-100 bg-blue-50/40"><CardContent className="space-y-3 p-5"><div className="flex items-start gap-3"><Clock className="mt-0.5 size-5 text-blue-600" /><div><p className="font-semibold text-gray-900">What is happening</p><p className="mt-1 text-sm text-gray-700">{statusText}</p></div></div><div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-gray-500">Current owner</p><p className="font-medium text-gray-900">{owner?.name ?? 'The procurement team'}</p></div><div><p className="text-xs text-gray-500">Needed by</p><p className="font-medium text-gray-900">{formatDate(request.deliveryDate)}</p></div><div><p className="text-xs text-gray-500">Days in current stage</p><p className="font-medium text-gray-900">{request.daysInStage}</p></div></div></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Request summary</CardTitle></CardHeader><CardContent className="space-y-3"><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-gray-500">How it will be handled</dt><dd className="font-medium text-gray-900">{request.buyingChannel === 'catalogue' ? 'Catalogue order' : request.buyingChannel === 'framework-call-off' ? 'Existing contract' : request.buyingChannel === 'p-card' ? 'Purchasing card' : 'Procurement review'}</dd></div><div><dt className="text-xs text-gray-500">Estimated value</dt><dd className="font-medium text-gray-900">{formatCurrency(request.value, request.currency)}</dd></div><div><dt className="text-xs text-gray-500">Requested by</dt><dd className="font-medium text-gray-900">{requestor?.name ?? 'You'}</dd></div><div><dt className="text-xs text-gray-500">Supplier</dt><dd className="font-medium text-gray-900">{supplier ? <Link className="text-blue-600 hover:underline" to={`/suppliers/${supplier.id}`}>{supplier.name}</Link> : 'To be identified'}</dd></div></dl><div className="border-t border-gray-100 pt-3"><p className="text-xs text-gray-500">Why this is needed</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{request.businessJustification || description?.narrative || request.description}</p></div></CardContent></Card>

      {description?.narrative && <Card><CardHeader><CardTitle className="text-base">Service description</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{description.narrative}</p></CardContent></Card>}

      {(request.contractId || request.poId) && <Card><CardHeader><CardTitle className="text-base">Linked records</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-2">{request.contractId && <Link className="text-sm text-blue-600 hover:underline" to={`/contracts/${request.contractId}`}>Open existing contract</Link>}{request.poId && (canOpenPurchaseOrders ? <Link className="text-sm text-blue-600 hover:underline" to={`/purchasing/orders/${request.poId}`}>Open purchase order</Link> : <span className="text-sm text-muted-foreground">Purchase order details are available to operations.</span>)}</CardContent></Card>}

      {request.status !== 'completed' && request.status !== 'cancelled' && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4" />Contact the request team</CardTitle></CardHeader><CardContent className="space-y-3"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Add information or ask a question…" className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /><div className="flex justify-end"><Button size="sm" onClick={() => void postComment()} disabled={!comment.trim() || addComment.isPending}><Send className="size-3.5" />Send message</Button></div>{visibleComments.length > 0 && <div className="space-y-2 border-t border-gray-100 pt-3">{visibleComments.slice(-3).map((item) => <div key={item.id} className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-500"><strong>{item.authorName}</strong> · {formatDate(item.timestamp)}</p><p className="mt-1 text-sm text-gray-700">{item.content}</p></div>)}</div>}</CardContent></Card>}

      {canWithdraw && <div className="flex justify-end"><Button variant="outline" className="text-red-700" onClick={() => void withdraw()} disabled={updateRequest.isPending}><XCircle className="size-4" />Withdraw request</Button></div>}
      {request.status === 'completed' && <div className="flex items-center justify-center gap-2 text-sm text-green-700"><CheckCircle className="size-4" />This request is complete.</div>}
    </div>
  );
}
