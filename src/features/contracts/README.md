# Contract register and detail

The contract register and renewal controls are operated by Procurement,
Operations, and Admin roles. A stable `/contracts/:id` detail route is also
available to requesters so links from requests and expiring-contract alerts do
not fall back to Home. Requester access is read-only: coverage saves, renewal
actions, obligation changes, and purchase-order navigation remain restricted.
