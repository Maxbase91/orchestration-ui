// One confirmation for deleting a configuration record.
//
// Six admin screens had a `useDeleteX` hook exported and used by nothing, so a
// cost centre, delivery location, approval chain, form, agent or routing rule
// could be created and edited but never removed. Adding six one-click delete
// buttons would have traded one problem for a worse one: these are records that
// live data points at, and only `approval_chains` has a foreign key to stop a
// bad one.
//
// So the dialog names the record, states what deleting it does to the records
// that reference it, and surfaces the database's own refusal rather than a
// generic "failed". A delete Postgres rejects because a request still names the
// row is the constraint working, and saying "Failed to delete" hides the one
// fact the admin needs.
import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/** Postgres rejected the delete because something still references the row. */
function isStillReferenced(message: string): boolean {
  return /foreign key|still referenced|violates/i.test(message);
}

export interface ConfirmDeleteDialogProps {
  /** What is being deleted, as the admin would name it. */
  label: string;
  /** The kind of thing, lower case: "cost centre", "routing rule". */
  noun: string;
  /**
   * What happens to records that already reference this one.
   *
   * Required rather than optional on purpose: every one of these tables is
   * referenced by something, and a delete dialog that does not say so is asking
   * the admin to confirm a consequence nobody has told them about.
   */
  consequence: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({
  label, noun, consequence, open, onOpenChange, onConfirm,
}: ConfirmDeleteDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        isStillReferenced(message)
          // The specific, actionable reason. The generic toast these screens
          // would otherwise show ("Failed to delete") makes a working
          // constraint look like a broken button.
          ? `This ${noun} cannot be deleted while other records still reference it. Reassign them first.`
          : message,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Clear the error on close so reopening does not show a stale failure
        // from a previous attempt against a different record.
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this {noun}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1">
              <p className="font-medium text-ink">{label}</p>
              <p>{consequence}</p>
              <p className="text-xs">This cannot be undone.</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-stop-line bg-stop-soft p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stop" />
            <p className="text-xs text-stop">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending
              ? <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              : <Trash2 className="mr-1.5 size-3.5" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
