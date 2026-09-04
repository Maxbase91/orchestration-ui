// The only request fields the intake assistant is permitted to fill.
//
// Everything the model returns is untrusted input, and the chat step spreads
// its `extracted` object straight into `IntakeFormData`. The loop used to copy
// every key it was handed, so a response naming `preCheckOutcome`,
// `costCentre`, `commodityClassificationConfirmed` or `miniIrq` would set it
// with nothing in the way — the model answering a governance question on the
// requester's behalf. The system prompt asks it not to; this is what stops it.
//
// Derived fields (`supplierId`, `commodityCode`, `supplierProvenance`, …) are
// resolved by the chat step *after* extraction from directory and taxonomy
// lookups, so they are deliberately absent here.
export const EXTRACTABLE_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'supplier',
  'estimatedValue',
  'deliveryDate',
  'isUrgent',
]);
