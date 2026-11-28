'use client';
// Runs in the browser: it holds the search words and filters the admin chose.

// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/shops/ShopsBrowser.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The shops screen: the search box and the two filters, joined to the shared list pieces.
//   It decides WHICH shops to ask for. Everything else lives in shared files.
//
// WHY IMPORTANT
//   It is how the admin finds a shop among hundreds, and it shows the pattern every later
//   admin list copies.
//
// DANGER
//   - Filters must stay plain values (strings). useCursorList compares them by their text.
//   - Do not add fetching code here. It belongs in useCursorList.
//
// WHAT IT SOLVES
//   Search and filter for shops, with almost no code of its own.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns and DRY. Each job has its own file:
//     useCursorList  = how the pages are fetched (race-safe, cursor paging)
//     ListStates     = loading, empty, error, Load more
//     ShopsTable     = drawing the rows
//     FilterPills    = the filter buttons
//     this file      = which shops to ask for
//
// RULES
//   1. Typing is debounced (350 ms), so we ask once per pause.
//   2. Changing a filter or the search starts again from the first page (the hook does it).
//
// PRACTICAL EXAMPLE
//   Type "njeri": after a short pause only Mama Njeri Groceries remains. Choose Suspended
//   to see only shut shops.
//
// DECISIONS
//   - No total count: the API does not send one (counting a big table on every search is
//     slow). We say "Showing N shops".
//   - Deleted shops are not a filter. The API hides them by default.
//
// WHERE USED
//   app/admin/(panel)/shops/page.js.
//
// TRADEOFFS
//   + Tiny and easy to read.
//   - No total count (on purpose).
//
// HOW TO USE
//   Rendered by the page. No props.
// =============================================================================

// PIECE BY PIECE
//   status / verified / search = what the admin chose.
//   q                          = the search words, after typing pauses.
//   list                       = the hook's result: items, loading, error, loadMore, retry.

import { useState } from 'react';
import { adminApi } from '../../../../lib/admin/adminApi';
import { useCursorList } from '../../../../hooks/useCursorList';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import AdminField from '../../../../components/admin/AdminField';
import FilterPills from '../../../../components/admin/FilterPills';
import ListStates from '../../../../components/admin/ListStates';
import ShopsTable from '../../../../components/admin/ShopsTable';

// The filter choices. value '' means "no filter".
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];
const VERIFIED_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Not verified' },
];

export default function ShopsBrowser() {
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 350); // search words after the typing pauses

  // The shared list logic: we only say what to fetch and with which filters.
  const list = useCursorList({
    fetchPage: (params) => adminApi.listShops(params),
    filters: { status, verified, q },
  });

  const count = list.items.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Shops</h1>
        <p className="mt-1 text-sm text-slate-600">Every shop on the platform, newest first.</p>
      </div>

      {/* The controls: search words and the two filters. */}
      <div className="space-y-4">
        <div className="max-w-md">
          <AdminField
            id="shop-search"
            name="search"
            label="Search by shop name or address word"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <FilterPills label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <FilterPills label="Verified" options={VERIFIED_OPTIONS} value={verified} onChange={setVerified} />
        </div>
      </div>

      {/* Loading, empty, error and "Load more" are handled by the shared component. */}
      <ListStates {...list} emptyTitle="No shops match" emptyMessage="Try a different search or clear a filter.">
        <p className="mb-3 text-sm text-slate-600">Showing {count} {count === 1 ? 'shop' : 'shops'}</p>
        <ShopsTable shops={list.items} />
      </ListStates>
    </div>
  );
}
