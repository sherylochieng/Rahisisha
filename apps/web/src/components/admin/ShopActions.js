'use client';
// Runs in the browser: it sends the admin's actions with the admin cookie.

// =============================================================================
// FILE: apps/web/src/components/admin/ShopActions.js   (Week 30 Day 3, Batch 2, part 3b)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The "Actions" card on a shop's page: the buttons that fit this shop, the confirmation
//   box that opens when one is clicked, and the "done" message after.
//
// WHY IMPORTANT
//   This is the moment an admin changes something real. It must offer only sensible
//   actions, always ask for a reason, and always refresh what is on screen afterwards.
//
// DANGER
//   - The buttons are only an offer. The API is the real lock (requirePlatformAdmin, the
//     state checks, the audit receipt in the same transaction).
//   - A 409 means the page was out of date (another admin changed the shop first). We
//     refresh the page and show the API's message, never pretend it worked.
//
// WHAT IT SOLVES
//   Running the four actions safely from one place, with one confirmation path.
//
// SYSTEM DESIGN PRINCIPLE
//   Data-driven: the buttons come from shopActions.js. Separation of concerns: this file
//   runs the flow, ReasonDialog asks the question, adminApi talks to the server.
//
// RULES
//   1. Show only the actions availableActions(shop) returns.
//   2. Every action goes through ReasonDialog (a written reason).
//   3. After success: close the box, show the done message, ask the page to refresh.
//   4. After 409 or 404: ask the page to refresh, and keep the message in the box.
//   5. A 401 sends the admin to sign in.
//
// PRACTICAL EXAMPLE
//   Admin opens Mama Njeri Groceries (active, not verified). Sees Suspend shop and
//   Verify shop. Clicks Verify, writes "Checked her stall and ID in person", confirms.
//   The page refreshes: Verified tick, new receipt at the top.
//
// DECISIONS
//   - The buttons in the card are calm (quiet). Only the red confirm button inside the
//     box looks dangerous, and only for suspend.
//   - The done message is plain text with role="status" so screen readers announce it.
//
// WHERE USED
//   ShopDetail.js.
//
// TRADEOFFS
//   + One flow for every action. A fifth action is one entry in shopActions.js.
//
// HOW TO USE
//   <ShopActions shop={shop} onDone={reload} />
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../../lib/adminApi';
import { redirectIfSignedOut } from '../../lib/adminSession';
import { SHOP_ACTIONS, availableActions } from '../../lib/shopActions';
import AdminButton from './AdminButton';
import ReasonDialog from './ReasonDialog';

export default function ShopActions({ shop, onDone }) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState(null); // which action's box is open
  const [notice, setNotice] = useState('');      // the "done" message

  const keys = availableActions(shop);
  // A deleted shop has nothing to offer.
  if (keys.length === 0) return null;

  // Called by the box when the admin confirms. Throws on failure so the box shows it.
  async function confirm(reason) {
    const config = SHOP_ACTIONS[openKey];
    try {
      await adminApi[config.apiMethod](shop.id, reason);
    } catch (err) {
      // Signed out: go to sign in. The page is leaving, so nothing more to do.
      if (redirectIfSignedOut(err, router)) return;
      // Out of date (409) or gone (404): refresh the page behind the box.
      if (err.status === 409 || err.status === 404) onDone();
      throw err; // the box shows the API's message
    }
    setOpenKey(null);
    setNotice(config.doneMessage);
    onDone(); // refresh the shop and its receipts
  }

  return (
    <section aria-labelledby="actions-heading" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="actions-heading" className="text-lg font-bold text-brand-navy">Actions</h2>

      <div className="flex flex-wrap gap-3">
        {keys.map((key) => (
          <AdminButton
            key={key}
            variant="quiet"
            onClick={() => {
              setNotice('');
              setOpenKey(key);
            }}
          >
            {SHOP_ACTIONS[key].buttonLabel}
          </AdminButton>
        ))}
      </div>

      {notice && <p role="status" className="text-sm font-semibold text-brand-navy">{notice}</p>}

      {/* key makes a fresh, empty box for each action. */}
      {openKey && (
        <ReasonDialog
          key={openKey}
          config={SHOP_ACTIONS[openKey]}
          onConfirm={confirm}
          onCancel={() => setOpenKey(null)}
        />
      )}
    </section>
  );
}
