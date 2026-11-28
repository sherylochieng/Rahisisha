// =============================================================================
// FILE: apps/web/src/components/admin/NotificationStatusChip.js   (Week 30 Day 3, Batch 3b-2b, web step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The small coloured pill that says Queued, Sent or Failed, drawn in one place.
//
// WHY IMPORTANT
//   One colour rule everywhere: queued is orange (waiting), sent is blue (done),
//   failed is red (needs a look).
//
// DANGER
//   Never rely on colour alone. The word is always shown too, so it works for
//   colour-blind people and in black-and-white print.
//
// WHAT IT SOLVES
//   Repeated pill markup and inconsistent colours (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and accessibility: colour AND text.
//
// RULES
//   1. Unknown statuses still show, in grey, with their own word.
//
// PRACTICAL EXAMPLE
//   <NotificationStatusChip status="failed" />  ->  a red "Failed" pill
//
// DECISIONS
//   A separate small component (not an extra branch in ShopStatusChip) so a shop's
//   status and a message's status can change independently.
//
// WHERE USED
//   NotificationsTable.js
//
// TRADEOFFS
//   + Simple. - Same pill markup as ShopStatusChip; both are three lines, so a shared base was not worth it yet.
//
// HOW TO USE
//   <NotificationStatusChip status={item.status} />
// =============================================================================

// The look for each known status. Text colours are dark enough to read on their background.
const LOOKS = {
  queued: 'bg-orange-100 text-orange-900',
  sent: 'bg-blue-100 text-blue-900',
  failed: 'bg-red-100 text-red-900',
};

export default function NotificationStatusChip({ status }) {
  const look = LOOKS[status] || 'bg-slate-100 text-slate-800';
  // Capitalise the word: 'queued' -> 'Queued'.
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${look}`}>
      {label}
    </span>
  );
}
