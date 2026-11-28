'use client';
// Runs in the browser: it loads the numbers with the admin cookie.

// =============================================================================
// FILE: apps/web/src/components/admin/OverviewStats.js   (Week 30 Day 3, Batch 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The row of overview numbers on the admin home page: total shops, active, suspended,
//   verified and new this week.
//
// WHY IMPORTANT
//   It is the first thing the admin sees. A blank or broken first screen makes the whole
//   panel feel unreliable, so every state is handled: loading, error with Try again, ready.
//
// DANGER
//   - It shows counts only. Never add names or phone numbers to this screen.
//   - A 401 sends the admin to sign in (handled by useAdminLoad). Other errors keep them here.
//
// WHAT IT SOLVES
//   "How is the platform doing?" at a glance, without opening the shops list.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: useAdminLoad fetches, StatCard draws, this file arranges them
//   and chooses what to show for each state.
//
// RULES
//   1. States: loading, error with Try again, ready.
//   2. The cards come from one list (CARDS), so adding a number is one line.
//   3. The grid collapses to one column on a phone.
//
// PRACTICAL EXAMPLE
//   Total 9, Active 8, Suspended 1 (highlighted), Verified 2, New this week 3.
//
// DECISIONS
//   - The suspended card is highlighted only when the count is above zero, so a quiet
//     platform looks quiet.
//   - No auto-refresh. The admin reloads the page. Real-time numbers are not worth the load.
//
// WHERE USED
//   app/admin/(panel)/page.js.
//
// TRADEOFFS
//   + Small and robust.
//   - Numbers are as of page load.
//
// HOW TO USE
//   <OverviewStats />
// =============================================================================

// PIECE BY PIECE
//   useAdminLoad(...)  = the numbers plus loading / error flags.
//   CARDS              = the list of cards: which number, which label, which hint.
//   the render         = loading text, error with Try again, or the grid.

import { adminApi } from '../../lib/admin/adminApi';
import { useAdminLoad } from '../../hooks/admin/useAdminLoad';
import AdminButton from './AdminButton';
import StatCard from './StatCard';
import FormError from '../shared/FormError';

// One line per number. key is the name in the API's answer.
const CARDS = [
  { key: 'total', label: 'All shops', hint: 'Not counting deleted shops' },
  { key: 'active', label: 'Active', hint: 'Open for customers' },
  { key: 'suspended', label: 'Suspended', hint: 'Closed by an admin' },
  { key: 'verified', label: 'Verified', hint: 'Checked by an admin' },
  { key: 'newThisWeek', label: 'New this week', hint: 'Joined in the last 7 days' },
];

export default function OverviewStats() {
  const { data, loading, error, retry } = useAdminLoad(() => adminApi.getStats(), 'overview-stats');

  if (loading) {
    return <p role="status" className="py-6 text-sm text-slate-600">Loading numbers...</p>;
  }

  // An error and nothing to show: say it, and offer to try again.
  if (!data) {
    return (
      <div className="space-y-3">
        <FormError message={error || 'We could not load the numbers.'} />
        <AdminButton onClick={retry}>Try again</AdminButton>
      </div>
    );
  }

  const shops = data.shops;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {CARDS.map((card) => (
        <StatCard
          key={card.key}
          label={card.label}
          value={shops[card.key]}
          hint={card.hint}
          // Only draw attention to suspended shops when there are some.
          highlight={card.key === 'suspended' && shops.suspended > 0}
        />
      ))}
    </div>
  );
}
