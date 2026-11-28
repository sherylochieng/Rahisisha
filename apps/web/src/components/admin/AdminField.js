// =============================================================================
// FILE: apps/web/src/components/admin/AdminField.js   (Week 30 Day 3, Batch 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   One labelled input box for the admin panel: the label above, the box below, the
//   orange focus ring.
//
// WHY IMPORTANT
//   The long list of look-classes for an input is written once. Every admin form
//   (sign in now, search and reason boxes later) looks and behaves the same.
//
// DANGER
//   - Always give an id: the label points at it, so screen readers and taps on the
//     label work.
//
// WHAT IT SOLVES
//   Repeated input markup (DRY) and forgotten labels.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and accessibility by default: you cannot make an unlabelled field with this.
//
// RULES
//   1. id, name and label are required.
//   2. Extra input settings (type, autoComplete, required, ...) pass straight through.
//
// PRACTICAL EXAMPLE
//   <AdminField id="phone" name="phone" label="Phone" type="tel" autoComplete="username" required />
//
// DECISIONS
//   - Uses the rest-props pattern so we do not list every possible input setting.
//
// WHERE USED
//   AdminLoginForm.js, and the shop search and reason boxes next.
//
// TRADEOFFS
//   + One look for every field.
//
// HOW TO USE
//   See the practical example above.
// =============================================================================

export default function AdminField({ id, name, label, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
        {...inputProps}
      />
    </div>
  );
}
