'use client';
// Runs in the browser: it is a pop-up box with a form inside.

// =============================================================================
// FILE: apps/web/src/components/admin/ReasonDialog.js   (Week 30 Day 3, Batch 2, part 3b)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The confirmation box every shop action goes through: "Suspend this shop?", an
//   explanation, a box for the written reason, and Cancel / Confirm buttons.
//
// WHY IMPORTANT
//   Suspending a shop stops a real person's business. Nobody should be able to do it by
//   one accidental click. The box makes the admin stop, read, and write why.
//
// DANGER
//   - For suspend, the reason is shown to the shop OWNER. The box says so in an orange
//     notice. That notice comes from config.warnsOwner. Do not remove it.
//   - While a request is running, both buttons are locked and Esc does nothing, so the
//     action cannot be sent twice or abandoned half way.
//
// WHAT IT SOLVES
//   An accident-proof, accessible confirmation with a validated reason.
//
// SYSTEM DESIGN PRINCIPLE
//   Use the browser's own <dialog>. showModal() gives focus trapping, the Esc key and a
//   dimmed background for free, with no extra library. Validate early (the same 5 to 500
//   rule as the API), but the API is still the real check.
//
// RULES
//   1. The reason must be 5 to 500 characters after trimming.
//   2. onConfirm(reason) must return a promise. If it fails, the message is shown here
//      and the box stays open so the admin can try again.
//   3. On success the parent closes the box.
//
// PRACTICAL EXAMPLE
//   Admin clicks Suspend shop. The box asks "Suspend this shop?", warns the owner will see
//   the reason, and waits for "Customers reported fake M-Pesa messages" before it allows
//   Confirm.
//
// DECISIONS
//   - Danger confirm button is red (variant danger) only for suspend.
//   - The Cancel button uses loading to lock itself while busy and keeps its own word.
//
// WHERE USED
//   ShopActions.js.
//
// TRADEOFFS
//   + Small, accessible, no library.
//
// HOW TO USE
//   <ReasonDialog config={SHOP_ACTIONS.suspend} onConfirm={async (reason) => {...}} onCancel={close} />
// =============================================================================

// PIECE BY PIECE
//   ref        = the <dialog> element, so we can open it as a modal.
//   reason     = what the admin typed.
//   busy       = a request is running (locks the buttons and Esc).
//   error      = a message to show (too short, or the API's answer).
//   submit()   = check the reason, call onConfirm, show any error.

import { useEffect, useRef, useState } from 'react';
import AdminButton from './AdminButton';
import AdminField from './AdminField';
import FormError from '../shared/FormError';

const REASON_MIN = 5;
const REASON_MAX = 500;

export default function ReasonDialog({ config, onConfirm, onCancel }) {
  const ref = useRef(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Open as a modal as soon as the box appears.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const clean = reason.trim();

    // Same rule as the API, so the admin hears about it straight away.
    if (clean.length < REASON_MIN) {
      setError(`Please write a reason of at least ${REASON_MIN} characters.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onConfirm(clean);
      // On success the parent closes this box, so there is nothing to reset.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="reason-title"
      // Esc: ignore it while a request is running, otherwise close through the parent.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-xl p-0 shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="space-y-4 p-6">
        <h2 id="reason-title" className="text-lg font-bold text-brand-navy">{config.title}</h2>
        <p className="text-sm text-slate-700">{config.explain}</p>

        {/* Only suspend: the owner will read this reason. */}
        {config.warnsOwner && (
          <p className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm font-semibold text-orange-950">
            This reason will be shown to the shop owner. Write it clearly and politely.
          </p>
        )}

        <AdminField
          id="shop-action-reason"
          name="reason"
          label="Reason (required)"
          multiline
          autoFocus
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby="reason-count"
        />
        <p id="reason-count" className="-mt-2 text-right text-xs text-slate-600">
          {reason.length} / {REASON_MAX}
        </p>

        <FormError message={error} />

        <div className="flex justify-end gap-3">
          {/* loading locks the button while busy, loadingText keeps its word. */}
          <AdminButton variant="quiet" loading={busy} loadingText="Cancel" onClick={onCancel}>
            Cancel
          </AdminButton>
          <AdminButton
            type="submit"
            variant={config.danger ? 'danger' : 'primary'}
            loading={busy}
            loadingText="Working..."
          >
            {config.confirmLabel}
          </AdminButton>
        </div>
      </form>
    </dialog>
  );
}
