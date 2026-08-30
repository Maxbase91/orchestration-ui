# UI E2E ui-e2e-20260830194413

Base: https://orchestration-ui.vercel.app
Live writes enabled: false

| Scenario | Role | Stage | Action | Result | Screenshot |
|---|---|---|---|---|---|
| shell | requester | home | open home | OBSERVED | [image](001-shell-requester-home.png) |
| route-sweep | requester | route | open / | OBSERVED |  |
| route-sweep | requester | route | open / | OBSERVED | [image](002-route-sweep-requester-route.png) |
| route-sweep | requester | route | open /requests/new | OBSERVED |  |
| route-sweep | requester | route | open /requests/new | OBSERVED | [image](003-route-sweep-requester-route.png) |
| route-sweep | requester | route | open /requests/my | OBSERVED |  |
| route-sweep | requester | route | open /requests/my | OBSERVED | [image](004-route-sweep-requester-route.png) |
| route-sweep | requester | route | open /help/kb | OBSERVED |  |
| route-sweep | requester | route | open /help/kb | OBSERVED | [image](005-route-sweep-requester-route.png) |
| route-sweep | requester | route | open /help/support | OBSERVED |  |
| route-sweep | requester | route | open /help/support | OBSERVED | [image](006-route-sweep-requester-route.png) |
| route-sweep | procurement | route | open /requests | OBSERVED |  |
| route-sweep | procurement | route | open /requests | OBSERVED | [image](007-route-sweep-procurement-route.png) |
| route-sweep | procurement | route | open /approvals | OBSERVED |  |
| route-sweep | procurement | route | open /approvals | OBSERVED | [image](008-route-sweep-procurement-route.png) |
| route-sweep | procurement | route | open /sourcing | OBSERVED |  |
| route-sweep | procurement | route | open /sourcing | OBSERVED | [image](009-route-sweep-procurement-route.png) |
| route-sweep | procurement | route | open /contracts | OBSERVED |  |
| route-sweep | procurement | route | open /contracts | OBSERVED | [image](010-route-sweep-procurement-route.png) |
| route-sweep | procurement | route | open /purchasing/invoices | OBSERVED |  |
| route-sweep | procurement | route | open /purchasing/invoices | OBSERVED | [image](011-route-sweep-procurement-route.png) |
| route-sweep | procurement | route | open /purchasing/payments | OBSERVED |  |
| route-sweep | procurement | route | open /purchasing/payments | OBSERVED | [image](012-route-sweep-procurement-route.png) |
| route-sweep | vendor | route | open /suppliers | OBSERVED |  |
| route-sweep | vendor | route | open /suppliers | OBSERVED | [image](013-route-sweep-vendor-route.png) |
| route-sweep | vendor | route | open /suppliers/risk | OBSERVED |  |
| route-sweep | vendor | route | open /suppliers/risk | OBSERVED | [image](014-route-sweep-vendor-route.png) |
| route-sweep | vendor | route | open /suppliers/onboarding | OBSERVED |  |
| route-sweep | vendor | route | open /suppliers/onboarding | OBSERVED | [image](015-route-sweep-vendor-route.png) |
| route-sweep | vendor | route | open /contracts | OBSERVED |  |
| route-sweep | vendor | route | open /contracts | OBSERVED | [image](016-route-sweep-vendor-route.png) |
| route-sweep | operations | route | open /tasks | OBSERVED |  |
| route-sweep | operations | route | open /tasks | OBSERVED | [image](017-route-sweep-operations-route.png) |
| route-sweep | operations | route | open /purchasing/receipt | OBSERVED |  |
| route-sweep | operations | route | open /purchasing/receipt | OBSERVED | [image](018-route-sweep-operations-route.png) |
| route-sweep | operations | route | open /purchasing/invoices | OBSERVED |  |
| route-sweep | operations | route | open /purchasing/invoices | OBSERVED | [image](019-route-sweep-operations-route.png) |
| route-sweep | operations | route | open /purchasing/match | OBSERVED |  |
| route-sweep | operations | route | open /purchasing/match | OBSERVED | [image](020-route-sweep-operations-route.png) |
| route-sweep | admin | route | open /admin/rules | OBSERVED |  |
| route-sweep | admin | route | open /admin/rules | OBSERVED | [image](021-route-sweep-admin-route.png) |
| route-sweep | admin | route | open /admin/policies | OBSERVED |  |
| route-sweep | admin | route | open /admin/policies | OBSERVED | [image](022-route-sweep-admin-route.png) |
| route-sweep | admin | route | open /admin/workflows | OBSERVED |  |
| route-sweep | admin | route | open /admin/workflows | OBSERVED | [image](023-route-sweep-admin-route.png) |
| route-sweep | admin | route | open /admin/database | OBSERVED |  |
| route-sweep | admin | route | open /admin/database | OBSERVED | [image](024-route-sweep-admin-route.png) |
| route-sweep | admin | route | open /admin/audit | OBSERVED |  |
| route-sweep | admin | route | open /admin/audit | OBSERVED | [image](025-route-sweep-admin-route.png) |
| route-sweep | supplier | route | open /portal | OBSERVED |  |
| route-sweep | supplier | route | open /portal | OBSERVED | [image](026-route-sweep-supplier-route.png) |
| route-sweep | supplier | route | open /portal/sourcing | OBSERVED |  |
| route-sweep | supplier | route | open /portal/sourcing | OBSERVED | [image](027-route-sweep-supplier-route.png) |
| route-sweep | supplier | route | open /portal/invoices | OBSERVED |  |
| route-sweep | supplier | route | open /portal/invoices | OBSERVED | [image](028-route-sweep-supplier-route.png) |
| route-sweep | supplier | route | open /portal/documents | OBSERVED |  |
| route-sweep | supplier | route | open /portal/documents | OBSERVED | [image](029-route-sweep-supplier-route.png) |
| route-sweep | supplier | route | open /portal/messages | OBSERVED |  |
| route-sweep | supplier | route | open /portal/messages | OBSERVED | [image](030-route-sweep-supplier-route.png) |
| catalogue | requester | simple-checkout-filled | fill mandatory order details | OBSERVED | [image](031-catalogue-requester-simple-checkout-filled.png) |
| catalogue | requester | expert-checkout-filled | fill mandatory order details | OBSERVED | [image](032-catalogue-requester-expert-checkout-filled.png) |
| responsive | requester | 320px | open home | OBSERVED | [image](033-responsive-requester-320px.png) |
| responsive | requester | 375px | open home | OBSERVED | [image](034-responsive-requester-375px.png) |
