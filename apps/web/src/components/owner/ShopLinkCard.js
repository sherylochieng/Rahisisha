'use client';
// 'use client' — needed because this card reacts to clicks (Copy, Share) and
// talks to the browser (clipboard). Server files cannot do that

// =============================================================================
// FILE: apps/web/src/components/owner/ShopLinkCard.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Every shop has a public address (for example amina.rahisishabiashara.com).
//   This card shows it on the dashboard and lets the owner open it, copy it,
//   or share it to WhatsApp or any app on their phone
//
// WHY IMPORTANT:
// - The link is how customers find the shop. If the owner cannot easily find
//   and share it, nobody visits
//
// DANGER (if this file does not exist):
// - The owner has to guess or retype their own address, and shares a typo
//
// WHAT IT SOLVES:
// - One card: the link, an Open button, a Copy button and a Share button
//
// SYSTEM DESIGN PRINCIPLE: Fail soft
// - Copy and Share depend on the browser. If one is missing or refused, the
//   card still shows the link in plain text so the owner can select it by hand
//
// RULES:
// - This file only DISPLAYS a link it is given. It never builds the link
//   (lib/shopUrl.js does) and never reads cookies or calls the API
// - The link is public. Never pass a secret into this component
// - Never use dangerouslySetInnerHTML. The link is shown as plain text
// - The WhatsApp link is built with encodeURIComponent, so the message cannot
//   break out of the address
//
// DECISIONS:
// 1. A WhatsApp button, because most customers in Kenya share links on WhatsApp
// 2. The system Share sheet (navigator.share) appears only where the browser
//    supports it (mostly phones)
// 3. "Copied" is announced with role="status" so screen readers hear it
// 4. Until the public shop page is built, a small note says so honestly
//
// PRACTICAL EXAMPLE:
//   <ShopLinkCard url="https://amina.rahisishabiashara.com" shopName="Amina's Boutique" />
//
// WHERE USED:
// - (authed)/dashboard/page.js
//
// TRADEOFFS:
// + No libraries, small, works on phone and laptop
// - Older browsers cannot copy with one click. They get the plain text link
//
// HOW TO USE:
//   import ShopLinkCard from '../../../components/owner/ShopLinkCard';
// =============================================================================

// useEffect (Week 29 Weekend): lets us ask the browser about the Share sheet
// AFTER the page has loaded, not while it is first being drawn
import { useEffect, useState } from 'react';

export default function ShopLinkCard({ url, shopName }) {
  // Short message after a click: '' (nothing), 'Copied!' or a gentle error
  const [message, setMessage] = useState('');

  // Is the phone-style Share sheet available in this browser?
  //
  // WEEK 29 WEEKEND FIX (stability, no new feature)
  //   WHAT CHANGED: canShare now starts as false and is switched on by
  //   useEffect right after the page loads.
  //   WHY: before, it read `navigator` while drawing. The server has no Share
  //   sheet (it drew 3 buttons) but the browser has one (it drew 4), so React
  //   saw two different pages and printed "Hydration failed" in the terminal.
  //   Now both start with the same 3 buttons, and the Share button appears a
  //   moment later in browsers that support it. Same result for the owner,
  //   no error.
  //   BEFORE (kept here for the record):
  //     const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // Runs only in the browser, after the first drawing matched the server's
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // The words that go with the link when it is shared
  const shareText = `Visit ${shopName} online: ${url}`;

  // WhatsApp opens with the message ready to send. encodeURIComponent makes
  // spaces and symbols safe inside the address
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // Copy the link to the clipboard
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Copied!');
    } catch {
      // Blocked or unsupported: the link is still visible above to select by hand
      setMessage('Could not copy. Select the link and copy it by hand.');
    }
    // Clear the message after a few seconds
    setTimeout(() => setMessage(''), 3000);
  }

  // Open the phone's own Share sheet (WhatsApp, SMS, email, ...)
  async function handleShare() {
    try {
      await navigator.share({ title: shopName, text: `Visit ${shopName} online`, url });
    } catch {
      // The owner closed the sheet: that is not an error, so say nothing
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-display text-lg font-bold text-brand-navy">Your shop link</h2>
      <p className="mt-1 text-sm text-gray-500">
        This is the address your customers use to find your shop. Share it on
        WhatsApp, Instagram or print it on your receipts.
      </p>

      {/* The link itself, as plain text. break-all stops a long link from
          pushing the card wider than a phone screen */}
      <p className="mt-4 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm font-medium text-brand-navy break-all select-all">
        {url}
      </p>

      {/* Buttons. flex-wrap lets them drop to a second line on a small screen */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Copy link
        </button>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-gray-50"
        >
          Share on WhatsApp
        </a>

        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-gray-50"
          >
            Share…
          </button>
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-gray-50"
        >
          Open
        </a>
      </div>

      {/* "Copied!" announcement. Always in the page (so screen readers notice
          the change), empty most of the time */}
      <p role="status" className="mt-2 min-h-[1.25rem] text-sm text-green-700">
        {message}
      </p>

     {/* The public shop page now exists (follow-up to Week 29 Day 4): say what customers will see */}
      <p className="mt-1 text-xs text-gray-400">
        Customers who open this link see your shop and the products you have set to active.
      </p>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// 'use client'        : this file runs in the browser, because it needs clicks
//                       and the clipboard. Real life: a counter with a person
//                       behind it, not a printed menu
// useState('')        : a small memory for the "Copied!" note
// canShare + useEffect: asks "does this browser have a Share sheet?" AFTER the
//                       page has loaded, never during the first drawing. Real
//                       life (Kenya): the mama mboga hangs the same 3-line
//                       price sign every morning, and adds the 4th line
//                       ("M-Pesa Till") only once the inspector confirms the
//                       Till is allowed. Phones usually have the Share sheet,
//                       laptops often do not
// whatsappHref        : a WhatsApp address with the message already written.
//                       encodeURIComponent protects it from odd characters
// handleCopy          : copies the link. Real life: photocopying your business
//                       card. If the copier is broken, the card is still in
//                       your hand (the link stays visible)
// handleShare         : opens the phone's own share menu
// try / catch         : if something fails we show a calm message, not a crash
// target="_blank" +
// rel="noopener noreferrer" : opens a new tab and stops that tab from
//                       controlling this one (a standard safety habit)
// role="status"       : screen readers read out "Copied!" when it appears
// =============================================================================