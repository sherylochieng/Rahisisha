// =============================================================================
// FILE: apps/web/src/components/admin/ShopSummary.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The "file cover" of one shop: its name, status, verified mark, plan, owner and dates,
//   and the reason if it is suspended.
//
// WHY IMPORTANT
//   Before an admin suspends or verifies a shop, they must see the facts: who owns it, how
//   old it is, and what has already been done.
//
// DANGER
//   - It shows the owner's PHONE NUMBER. That is personal data. It is shown here because
//     the admin has a reason to look (to contact the owner). Do not copy it to the list.
//   - The suspended reason is typed by an admin. It is shown as plain text only.
//
// WHAT IT SOLVES
//   One tidy summary, built from the shared status and verified components (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: draws only. Data minimisation: the phone appears only on the
//   detail page, not in the list.
//
// RULES
//   1. A shop with no owner row shows a dash, never a crash.
//   2. The suspended box shows only when the status is suspended.
//   3. Times are Nairobi time.
//
// PRACTICAL EXAMPLE
//   <ShopSummary shop={shop} />
//
// DECISIONS
//   - A definition list (term and value pairs), which screen readers read well.
//
// WHERE USED
//   ShopDetail.js.
//
// TRADEOFFS
//   + One place for the shop's facts.
//
// HOW TO USE
//   <ShopSummary shop={shop} />
// =============================================================================

import ShopStatusChip from './ShopStatusChip';
import VerifiedMark from './VerifiedMark';
import { formatNairobiDate, formatNairobiTime } from '../../lib/format';

// One term and value pair, so the markup is written once.
function Fact({ term, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{term}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function ShopSummary({ shop }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">{shop.name}</h1>
        <ShopStatusChip status={shop.status} />
        <VerifiedMark verified={shop.verified} />
      </div>
      <p className="mt-1 text-sm text-slate-600">{shop.slug}</p>

      {/* Only for a suspended shop: when and why. Plain text. */}
      {shop.status === 'suspended' && (
        <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
          <p className="font-semibold">Suspended {shop.suspendedAt ? formatNairobiTime(shop.suspendedAt) : ''}</p>
          {shop.suspendedReason && <p className="mt-1">Reason: {shop.suspendedReason}</p>}
        </div>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact term="Owner">{shop.owner ? shop.owner.name : '—'}</Fact>
        <Fact term="Owner phone">{shop.owner && shop.owner.phone ? shop.owner.phone : '—'}</Fact>
        <Fact term="Plan"><span className="capitalize">{shop.plan}</span></Fact>
        <Fact term="Joined">{formatNairobiDate(shop.createdAt)}</Fact>
        {shop.verifiedAt && <Fact term="Verified on">{formatNairobiDate(shop.verifiedAt)}</Fact>}
      </dl>
    </section>
  );
}
