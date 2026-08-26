// Supplier-facing response form for one sourcing event.
//
// The entitlement boundary is the query, not this component:
// useSourcingEventForSupplier() returns null unless the caller holds an
// invitation, and its SELECT omits criteria, weights and budget — so the
// buyer's evaluation scheme never reaches an external party's browser, even in
// the network payload. Nothing here may join those fields back in.
//
// Opening the page marks the invitation viewed, which is what turns the buyer's
// tracking from "invited" into "viewed". Past the deadline the form is
// read-only: a supplier cannot act, so an editable form would be a false
// promise.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/format';
import { useSourcingEventForSupplier } from '@/lib/db/hooks/use-sourcing-events';
import {
  useInvitationsForSupplier,
  useMarkResponseViewed,
  useSubmitResponse,
} from '@/lib/db/hooks/use-sourcing-responses';
import { usePortalSupplierId } from './portal-identity';

export function PortalSourcingResponse() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const supplierId = usePortalSupplierId();

  const { data: event, isLoading } = useSourcingEventForSupplier(eventId, supplierId);
  const { data: invitations = [] } = useInvitationsForSupplier(supplierId);
  const response = invitations.find((r) => r.eventId === eventId);

  const markViewed = useMarkResponseViewed();
  const submit = useSubmitResponse();

  // Captured once per mount rather than read during render: a deadline does not
  // need to be reactive, and calling Date.now() while rendering makes the result
  // depend on when React happens to re-run the component.
  const [now] = useState(() => Date.now());

  // null means "untouched, show what was submitted". Avoids a hydration effect
  // that would setState during render-commit and re-stomp the field on refetch.
  const [price, setPrice] = useState<string | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);

  // Mark viewed once per mount. markResponseViewed is already a no-op unless the
  // status is still not-viewed, but the ref stops a refetch re-firing it.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!response || viewedRef.current) return;
    viewedRef.current = true;
    if (response.status === 'not-viewed') markViewed.mutate(response);
  }, [response, markViewed]);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  // Covers both "no such event" and "not invited" — deliberately the same
  // message, so the page cannot be used to probe which events exist.
  if (!event || !response) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">
          This sourcing event is not available to you.
        </p>
        <Button variant="outline" onClick={() => navigate('/portal/sourcing')}>
          <ArrowLeft className="size-4" />
          Back to invitations
        </Button>
      </div>
    );
  }

  const closed = event.deadline ? new Date(event.deadline).getTime() < now : false;
  const submitted = response.status === 'responded';

  // Show the field's edited value, else whatever was previously submitted.
  const priceValue = price ?? (response.price != null ? String(response.price) : '');
  const leadTimeValue = leadTimeDays ?? (response.leadTimeDays != null ? String(response.leadTimeDays) : '');
  const narrativeValue = narrative ?? response.narrative;

  async function handleSubmit() {
    if (!narrativeValue.trim() && !priceValue) {
      toast.error('Add a price or a short response before submitting.');
      return;
    }
    try {
      await submit.mutateAsync({
        response: response!,
        input: {
          price: priceValue ? Number.parseFloat(priceValue) : undefined,
          leadTimeDays: leadTimeValue ? Number.parseInt(leadTimeValue, 10) : undefined,
          narrative: narrativeValue.trim(),
        },
      });
      toast.success('Response submitted');
      navigate('/portal/sourcing');
    } catch {
      toast.error('Could not submit your response. Please try again.');
    }
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
        <Link to="/portal/sourcing">
          <ArrowLeft className="size-3.5" />
          Back to invitations
        </Link>
      </Button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{event.title}</h1>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {event.type}
          </span>
          <StatusBadge status={response.status} size="sm" />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {event.deadline ? `Responses close ${formatDate(event.deadline)}` : 'No deadline set'}
        </p>
      </div>

      {event.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {event.description}
            </p>
          </CardContent>
        </Card>
      )}

      {event.requirements.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Requirements</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {event.requirements.map((r, i) => (
                <li key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {closed ? 'Your response' : submitted ? 'Your response (you can update it)' : 'Submit your response'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {closed && (
            <p className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              This event has closed. Your response is shown for reference and can no longer be changed.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price ({response.currency})</Label>
              <Input
                id="price"
                type="number"
                inputMode="decimal"
                value={priceValue}
                onChange={(e) => setPrice(e.target.value)}
                disabled={closed}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-time">Lead time (days)</Label>
              <Input
                id="lead-time"
                type="number"
                value={leadTimeValue}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                disabled={closed}
                placeholder="30"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="narrative">Your proposal</Label>
            <Textarea
              id="narrative"
              value={narrativeValue}
              onChange={(e) => setNarrative(e.target.value)}
              disabled={closed}
              className="min-h-[140px]"
              placeholder="How you would meet the requirements above…"
            />
          </div>
          {!closed && (
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submit.isPending}>
                <Send className="size-3.5" />
                {submitted ? 'Update response' : 'Submit response'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
