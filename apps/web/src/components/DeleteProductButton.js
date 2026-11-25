'use client';
// 'use client': this button reacts to taps and talks to the API from the
// browser. Server files cannot do that

// =============================================================================
// FILE: apps/web/src/components/DeleteProductButton.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - A Delete button for one product row, with an "are you sure?" step, so an
//   owner can remove a product she no longer sells (issues #6 and #7)
//
// WHY IMPORTANT:
// - Without it, a product added by mistake stays in the list forever
// - The "are you sure?" step stops a slip of the thumb on a phone from
//   removing a product
//
// DANGER:
// - Delete is a soft delete in the API: the product is hidden, not erased, so
//   old orders keep their records. But the owner cannot bring it back from the
//   app, so we always ask first
// - Never delete on the first tap
//
// WHAT IT SOLVES:
// - A two-step delete (tap Delete, then tap Yes) with a friendly message if
//   something goes wrong
//
// SYSTEM DESIGN PRINCIPLE: Make the dangerous action take two deliberate steps
// - Real life: a till that asks "void this sale?" before it voids it
//
// RULES:
// - All API calls go through lib/api.js (api.deleteProduct), never fetch()
// - The shop is taken from the login cookie by the API, never sent from here
// - While the request runs, both buttons are disabled so it cannot be sent twice
// - Never show a raw technical error. Messages come from lib/api.js
//
// PRACTICAL EXAMPLE:
// - Amina taps Delete on "Sample: Sugar 1kg". The row now asks "Delete this
//   product?". She taps "Yes, delete". The API hides it, the list refreshes
//   and the sugar is gone
//
// WHERE USED:
// - (authed)/products/page.js, once in every product row
//
// TRADEOFFS:
// + No pop-up library and no browser confirm box (those look different on every
//   phone and can be blocked)
// - No "undo" yet. A later version could keep deleted products in an archive
//
// HOW TO USE:
//   <DeleteProductButton productId={product.id} productName={product.name} />
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '../lib/api';

export default function DeleteProductButton({ productId, productName }) {
  const router = useRouter();

  // 'idle' = just the Delete button, 'confirming' = asking "are you sure?",
  // 'deleting' = request in flight
  const [step, setStep] = useState('idle');
  const [error, setError] = useState('');

  async function handleDelete() {
    setStep('deleting');
    setError('');
    try {
      await api.deleteProduct(productId);
      // Success: re-read the list so the product disappears right away
      router.refresh();
    } catch (err) {
      // Go back to the first step and say what went wrong, in plain words
      setStep('idle');
      setError(err.message || 'Could not delete the product. Please try again.');
    }
  }

  // STEP 1: just the Delete button
  if (step === 'idle') {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setError(''); setStep('confirming'); }}
          className="text-sm font-medium text-red-600 hover:underline"
          aria-label={`Delete ${productName}`}
        >
          Delete
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // STEP 2: "are you sure?" (also shown while the request runs, with the
  // buttons switched off)
  const busy = step === 'deleting';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-700">Delete this product?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Deleting...' : 'Yes, delete'}
      </button>
      <button
        type="button"
        onClick={() => setStep('idle')}
        disabled={busy}
        className="text-xs font-medium text-gray-600 hover:underline disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// step ('idle' | 'confirming' | 'deleting')
//                   : which of the three screens the button is on. Real life: a
//                     till at "ring up", "void this sale?" and "voiding..."
// handleDelete      : the second tap. Sends the delete, then refreshes the list
// api.deleteProduct : the one place that talks to the API (DELETE /products/:id)
// router.refresh()  : re-reads the list from the server so the row vanishes.
//                     Real life: after removing stock, look at the shelf again
// catch -> setStep('idle') : on failure we go back to the first step and show a
//                     message, so the owner can try again
// disabled={busy}   : while the request runs, a second tap does nothing, so the
//                     same product is never deleted twice
// aria-label        : a screen reader says "Delete Sample: Sugar 1kg" instead
//                     of just "Delete", so people know which row
// =============================================================================