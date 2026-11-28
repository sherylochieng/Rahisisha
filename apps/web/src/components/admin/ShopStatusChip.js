// =============================================================================
// FILE: apps/web/src/components/admin/ShopStatusChip.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The small coloured pill that says Active, Suspended or Deleted, drawn in one place.
//
// WHY IMPORTANT
//   The shops list and the shop detail page both show a status. One component means one
//   colour rule: a suspended shop is always orange, everywhere.
//
// DANGER
//   - Do not rely on colour alone to tell the states apart. The word is always shown too,
//     so it works for colour-blind people and in black-and-white print.
//
// WHAT IT SOLVES
//   Repeated pill markup and inconsistent colours (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and accessibility: colour AND text, never colour alone. Blue and orange are
//   easy to tell apart (unlike red and green).
//
// RULES
//   1. Unknown statuses still show, in grey, with their own word. Nothing disappears.
//
// PRACTICAL EXAMPLE
//   <ShopStatusChip status="suspended" />  ->  an orange "Suspended" pill
//
// DECISIONS
//   - Active is blue (the platform colour), suspended is orange (attention).
//
// WHERE USED
//   ShopsTable.js, and the shop detail page next.
//
// TRADEOFFS
//   + One place to change a colour.
//
// HOW TO USE
//   <ShopStatusChip status={shop.status} />
// =============================================================================

// The look for each known status. Text colours are dark enough to read on their background.
const LOOKS = {
  active: 'bg-blue-100 text-blue-900',
  suspended: 'bg-orange-100 text-orange-900',
  deleted: 'bg-slate-200 text-slate-800',
};

export default function ShopStatusChip({ status }) {
  const look = LOOKS[status] || 'bg-slate-100 text-slate-800';
  // Capitalise the first letter for display: "active" -> "Active".
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${look}`}>
      {label}
    </span>
  );
}
