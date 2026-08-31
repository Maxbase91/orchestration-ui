# Request lifecycle

Request creation supports one unified Simple/Expert journey plus governed
catalogue and contract call-off checkouts. Contract call-offs use the same
server-authoritative request → PR → conditional internal PO seam as catalogue
orders. Full demand intake creates a structured service description and enters
the first actionable workflow stage.

Requester fields are collected before submission; stage-owned forms and actions
are shown only to the role that must act next.

Full-demand submission is dispatcher-routed through `/api/intake-submit` and
commits the request, service description, intake compliance, stage history and
workflow instance atomically. Date answers are parsed to ISO dates before the
server accepts them; prose in a date slot is rejected and re-asked. The legacy
`businessJustification` compatibility field is left empty for new structured
intake records so the confirmed description is not duplicated.
