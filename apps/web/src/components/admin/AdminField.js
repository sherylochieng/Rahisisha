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
//   3. multiline makes it a taller text box (for written reasons) with the same look.
//
// PRACTICAL EXAMPLE
//   <AdminField id="phone" name="phone" label="Phone" type="tel" autoComplete="username" required />
//
// DECISIONS
//   - Uses the rest-props pattern so we do not list every possible input setting.
//
// WHERE USED
//   AdminLoginForm.js, the shop search box, and the reason box in ReasonDialog.js.
//
// TRADEOFFS
//   + One look for every field.
//
// HOW TO USE
//   See the practical example above.
// =============================================================================

// One look for both kinds of box, written once.
const BOX_CLASSES = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/40';

export default function AdminField({ id, name, label, multiline = false, ...inputProps }) {
  // A taller box for written text (the reason). Everything else is the same.
  const Box = multiline ? 'textarea' : 'input';
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <Box
        id={id}
        name={name}
        className={BOX_CLASSES}
        {...(multiline ? { rows: 4 } : {})}
        {...inputProps}
      />
    </div>
  );
}
