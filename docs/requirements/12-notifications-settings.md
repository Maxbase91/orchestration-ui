# FR-12: Notifications & Settings

**Version:** 1.0 · **Date:** June 2026 · **Roles:** All internal roles

---

## Purpose

Notifications keep users informed of approvals, status changes, and SLA warnings. Settings allow per-user configuration of currency, match tolerance, notification channels, and display preferences.

---

## User Stories

| ID | Role | Story | Priority |
|----|------|-------|----------|
| FR12-01 | any internal | I receive an in-app notification when a request needs my approval | Must |
| FR12-02 | any internal | I can disable email notifications for low-priority events | Must |
| FR12-03 | any internal | My notification preferences survive a page reload | Must |
| FR12-04 | any internal | I can change the currency used in KPI cards | Should |
| FR12-05 | ops-lead | I can change the invoice match tolerance | Should |

---

## Notification Types (7)

| Type | Default channels |
|------|-----------------|
| Approval Requests | In-app ✅ Email ✅ Push ✅ |
| Status Updates | In-app ✅ Email ✅ Push ❌ |
| SLA Warnings | In-app ✅ Email ✅ Push ✅ |
| Escalations | In-app ✅ Email ✅ Push ✅ |
| Comments | In-app ✅ Email ❌ Push ❌ |
| System Alerts | In-app ✅ Email ✅ Push ❌ |
| AI Insights | In-app ✅ Email ❌ Push ❌ |

FR12-10 · Notification preferences persist to `user_preferences.prefs.notifications` via `useUpdateUserPreferences()` with 600ms debounce.
FR12-11 · On mount, `notification-preferences.tsx` loads from `useUserPreferences(userId).data.prefs.notifications`.
FR12-12 · Quiet hours and Daily Digest settings also persist in the same JSONB blob.

---

## Settings Page

FR12-20 · **Currency**: stored in `useSettingsStore().currency` (Zustand + localStorage `settings` key) + synced to `user_preferences.prefs.currency`. KPI cards read from store.
FR12-21 · **Invoice Match Tolerance**: `useSettingsStore().matchTolerancePct` (default 2%). Applied in `three-way-match-page.tsx:buildFields()`.
FR12-22 · **Date Format**: local state only (display-only, not yet applied globally).
FR12-23 · **Dark Mode**: disabled (Coming soon badge).
FR12-24 · **Language**: disabled (English only).

---

## Notification Feed

FR12-30 · Bell icon in topbar shows unread count.
FR12-31 · `/notifications` page shows all notifications sorted by timestamp.
FR12-32 · Mark as read: `useMarkNotificationRead()` mutation.
FR12-33 · Mark all as read: `useMarkAllNotificationsRead()`.

---

## Key Files

- `src/features/notifications/components/notification-preferences.tsx`
- `src/features/settings/settings-page.tsx`
- `src/stores/settings-store.ts`
- `src/lib/db/hooks/use-user-preferences.ts`
- `src/lib/db/user-preferences.ts`
