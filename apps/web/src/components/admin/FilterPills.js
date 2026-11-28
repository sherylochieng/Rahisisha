// =============================================================================
// FILE: apps/web/src/components/admin/FilterPills.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   A row of small buttons where exactly one is chosen (All / Active / Suspended).
//   Used for any "pick one filter" on any admin list.
//
// WHY IMPORTANT
//   The status filter and the verified filter are the same kind of control. One component
//   builds both, and every list we add later.
//
// DANGER
//   - It does not fetch anything. It only reports the choice. The page decides what to do.
//
// WHAT IT SOLVES
//   Repeated filter-button markup (DRY) and missing keyboard / screen reader support.
//
// SYSTEM DESIGN PRINCIPLE
//   A controlled component: the page owns the value, this file only draws it and reports
//   clicks. Accessibility by default: a labelled group of real buttons.
//
// RULES
//   1. options is a list of { value, label }. value '' means "no filter".
//   2. label (the group name) is required so screen readers can announce it.
//
// PRACTICAL EXAMPLE
//   <FilterPills label="Status" value={status} onChange={setStatus}
//      options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }]} />
//
// DECISIONS
//   - Real <button>s with aria-pressed, so Tab and Enter work.
//   - The chosen pill is navy with white text, the others are white with a border.
//
// WHERE USED
//   ShopsBrowser.js (twice), and any later admin list.
//
// TRADEOFFS
//   + Small, reusable.
//
// HOW TO USE
//   See the practical example.
// =============================================================================

export default function FilterPills({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {/* The visible group name, small and quiet. */}
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>

      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            aria-pressed={chosen}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
              chosen
                ? 'border-brand-navy bg-brand-navy text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-brand-navy'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
