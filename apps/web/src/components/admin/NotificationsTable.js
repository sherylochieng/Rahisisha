// =============================================================================
// FILE: apps/web/src/components/admin/NotificationsTable.js   (Week 30 Day 3, Batch 3b-2b, web step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Draws the table of outbox lines: which message, for which shop, its status,
//   how many tries, and a one-line note.
//
// WHY IMPORTANT
//   This is how head office sees whether owners are really being told.
//
// DANGER
//   1. It receives lines WITHOUT phone numbers or message text (the API never
//      sends them). Do not add them to this table.
//   2. last_error is text from our own sender. It is rendered as plain text.
//
// WHAT IT SOLVES
//   "Show me the messages, readable on a phone or a desk."
//
// SYSTEM DESIGN PRINCIPLE
//   Presentational component: gets data in, draws it, owns no state. Same shape as ShopsTable.
//
// RULES
//   1. A caption for screen readers, real <th scope="col"> headings.
//   2. The shop name links to that shop's page.
//   3. Wide tables scroll sideways instead of breaking the layout.
//
// PRACTICAL EXAMPLE
//   <NotificationsTable items={list.items} />
//
// DECISIONS
//   Words come from lib/admin/adminNotifications.js, so this file has no wording of its own.
//
// WHERE USED
//   app/admin/(panel)/notifications/NotificationsBrowser.js
//
// TRADEOFFS
//   + Simple, accessible. - No sorting; the order is always newest first.
//
// HOW TO USE
//   <NotificationsTable items={...} />
// =============================================================================

import Link from 'next/link';
import NotificationStatusChip from './NotificationStatusChip';
import { templateLabel, describeNote } from '../../lib/admin/adminNotifications';
import { formatNairobiTime } from '../../lib/format';

// The column headings, in order.
const HEADINGS = ['Message', 'Shop', 'Status', 'Channel', 'Tries', 'Note', 'Created'];

export default function NotificationsTable({ items }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Messages queued for shop owners</caption>
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
          <tr>
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-t border-slate-200 align-top">
              <td className="px-4 py-3 font-semibold text-brand-navy">{templateLabel(n.template)}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/shops/${n.shopId}`} className="text-brand-navy underline-offset-4 hover:underline">
                  {n.shopName}
                </Link>
              </td>
              <td className="px-4 py-3"><NotificationStatusChip status={n.status} /></td>
              <td className="px-4 py-3 text-slate-800">{n.channel}</td>
              <td className="px-4 py-3 text-slate-800">{n.attempts}</td>
              <td className="min-w-[14rem] px-4 py-3 text-slate-800">{describeNote(n)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">{formatNairobiTime(n.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
