// =============================================================================
// FILE: apps/web/src/components/admin/ShopsTable.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Draws the register of shops as a table: name, owner, plan, status, verified, joined.
//
// WHY IMPORTANT
//   It is the admin's main view of the platform. It must be easy to scan and must not
//   break on a phone.
//
// DANGER
//   - It is a drawing only. It fetches nothing and decides nothing, so it can never show
//     data the page did not give it.
//   - The owner's phone number is NOT shown here. It is personal data: the detail page will
//     show it, where the admin has a reason to look.
//
// WHAT IT SOLVES
//   A clean, readable list with the status and verified marks from the shared components.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: ShopsBrowser fetches and filters, ShopsTable only draws.
//   Data minimisation: show only what the job needs.
//
// RULES
//   1. The table scrolls sideways inside its own box on a narrow screen (never the page).
//   2. A shop with no owner row shows a dash, never a crash.
//   3. Dates are shown in Nairobi time.
//
// PRACTICAL EXAMPLE
//   Mama Njeri Groceries | Mama Njeri | free | Active | Verified | 12 Nov 2026
//
// DECISIONS
//   - The shop name is the link to the shop's page (/admin/shops/<id>). One clear place
//     to click, instead of making the whole row clickable.
//
// WHERE USED
//   ShopsBrowser.js.
//
// TRADEOFFS
//   + Simple and robust.
//
// HOW TO USE
//   <ShopsTable shops={items} />
// =============================================================================

import Link from 'next/link';
import ShopStatusChip from './ShopStatusChip';
import VerifiedMark from './VerifiedMark';
import { formatNairobiDate } from '../../lib/format';

// The column headings, in one list, so the table head and the table body stay in step.
const HEADINGS = ['Shop', 'Owner', 'Plan', 'Status', 'Verified', 'Joined'];

export default function ShopsTable({ shops }) {
  return (
    // The box scrolls sideways on a small screen, so the page itself never does.
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Shops on the platform</caption>
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
          {shops.map((shop) => (
            <tr key={shop.id} className="border-t border-slate-200">
              <td className="px-4 py-3">
                <Link href={`/admin/shops/${shop.id}`} className="font-semibold text-brand-navy underline-offset-4 hover:underline">
                  {shop.name}
                </Link>
                <div className="text-xs text-slate-600">{shop.slug}</div>
              </td>
              <td className="px-4 py-3 text-slate-800">{shop.owner ? shop.owner.name : '—'}</td>
              <td className="px-4 py-3 capitalize text-slate-800">{shop.plan}</td>
              <td className="px-4 py-3"><ShopStatusChip status={shop.status} /></td>
              <td className="px-4 py-3"><VerifiedMark verified={shop.verified} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-800">{formatNairobiDate(shop.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
