// =============================================================================
// FILE: apps/web/src/components/admin/StatCard.js   (Week 30 Day 3, Batch 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   One small card showing ONE number with its label: "Active shops: 8".
//
// WHY IMPORTANT
//   The Overview shows five numbers now and will show more later (orders, revenue). One
//   card component means they all look the same and one change restyles them all.
//
// DANGER
//   - It only draws. It never fetches or changes the number it is given.
//   - A missing value shows a dash, never "undefined" or "NaN".
//
// WHAT IT SOLVES
//   Repeated card markup (DRY) and inconsistent number formatting.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and separation of concerns: OverviewStats fetches, StatCard draws.
//
// RULES
//   1. label is required: a number alone means nothing.
//   2. Numbers are written the Kenyan way, with separators (1,250).
//   3. A highlight option makes a card stand out (used for suspended shops).
//
// PRACTICAL EXAMPLE
//   <StatCard label="Suspended" value={1} hint="Closed by an admin" highlight />
//
// DECISIONS
//   - The number is a large heading-weight text, the label a small caption above it, so
//     a quick glance reads the number first.
//   - Highlight uses an orange border plus the words, never colour alone.
//
// WHERE USED
//   OverviewStats.js.
//
// TRADEOFFS
//   + One card, many numbers.
//
// HOW TO USE
//   See the practical example.
// =============================================================================

export default function StatCard({ label, value, hint, highlight = false }) {
  // Real numbers get separators. Anything else (missing) shows a dash.
  const shown = typeof value === 'number' ? value.toLocaleString('en-KE') : '—';

  return (
    <div
      className={`rounded-xl border bg-white p-5 ${highlight ? 'border-orange-400' : 'border-slate-200'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand-navy">{shown}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
