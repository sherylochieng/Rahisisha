'use client';
// 'use client': a dropdown reacts to clicks and the aisle list is fetched in the
// browser, so this part cannot be a server file.

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/CategorySelect.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The "Category (optional)" dropdown, as its own piece. It fetches the
//   aisle list itself (useCategories) and shows "No category" plus the aisles.
//
// WHY IMPORTANT
//   ProductForm only needs to say "put the category box here". Anything else
//   that needs an aisle picker later (a bulk-edit screen, a marketplace
//   filter) reuses this instead of copying the markup.
//
// DANGER (what breaks without it)
//   The dropdown markup, its loading state and its error line pasted into
//   every form that needs it.
//
// WHAT IT SOLVES
//   <CategorySelect value={categoryId} onChange={setCategoryId}
//                   disabled={loading} error={fieldErrors.categoryId} />
//   value is the aisle id, or '' for no category.
//
// SYSTEM DESIGN PRINCIPLE
//   A controlled component: the parent owns the value, this file only draws
//   and reports changes. Data fetching (hook) and look (formParts) stay in
//   their own files.
//
// RULES
//   1. The parent keeps the value in state, so the right option is selected
//      when the list arrives after the page opens.
//   2. If the list cannot load, still show "No category" (the field is optional).
//
// WHERE USED
//   components/ProductForm.js
//
// TRADEOFFS
//   + Reusable and small. - Fixed wording (label, hint) for now.
//
// HOW TO USE
//   import CategorySelect from './CategorySelect';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// useCategories()  = ASK THE INFORMATION DESK FOR THE AISLE MAP (once per tab).
// value / onChange = THE PARENT HOLDS THE PEN; we only show and report.
// disabled         = LOCKED WHILE SAVING, OR WHILE THE LIST IS STILL ARRIVING.
// <option value="">= "NO AISLE": choosing it removes the category on save.
// ═══════════════════════════════════════════════════════════

import { useCategories } from '../hooks/useCategories';
import { inputClass, FieldError } from './formParts';

export default function CategorySelect({ value, onChange, disabled = false, error = '' }) {
  const { categories, loading } = useCategories();

  return (
    <div>
      <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
        Category (optional)
      </label>
      <select
        id="categoryId"
        name="categoryId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? 'categoryId-error' : undefined}
        className={inputClass(error)}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-400">Shoppers can filter your shop by category.</p>
      <FieldError id="categoryId-error" message={error} />
    </div>
  );
}
