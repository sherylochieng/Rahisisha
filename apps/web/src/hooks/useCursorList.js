'use client';
// Runs in the browser: it loads lists with the admin cookie.

// =============================================================================
// FILE: apps/web/src/hooks/useCursorList.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   All the tricky "load a list a page at a time" logic, written ONCE: first page,
//   "Load more", filters that restart the list, and answers that arrive out of order.
//
// WHY IMPORTANT
//   Shops, Receipts and Admins are three lists that all need exactly this. Written once
//   here, a bug is fixed once, and each list screen stays tiny.
//
// DANGER
//   - The "latest call wins" counter is the heart of this file. Remove it and a slow
//     answer for "ma" can overwrite the fast answer for "mama". Do not simplify it away.
//   - Only a 401 sends the admin to sign in. Other errors keep them on the page.
//
// WHAT IT SOLVES
//   Duplicated paging and race-condition code, and inconsistent loading / error behaviour.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: a hook decides HOW data is fetched, a component decides WHAT is
//   drawn. Keyset (cursor) paging: "give me the next 25 after this one" stays fast on a
//   huge list. Latest-request-wins removes race conditions.
//
// RULES
//   1. fetchPage(params) must return the API envelope { data, nextCursor }.
//   2. params = { ...filters, cursor, limit }.
//   3. Changing any filter restarts from the first page.
//   4. "Load more" appends and keeps the filters.
//   5. Filters must be plain values (strings, numbers). They are compared by their JSON.
//
// PRACTICAL EXAMPLE
//   const list = useCursorList({
//     fetchPage: (params) => adminApi.listShops(params),
//     filters: { status, verified, q },
//   });
//   list.items, list.loading, list.error, list.nextCursor, list.loadMore(), list.retry()
//
// DECISIONS
//   - fetchPage is kept in a ref, so a new function each render never restarts the list.
//   - Filters are compared by JSON text, so a new object each render does not either.
//   - Page size defaults to 25.
//
// WHERE USED
//   shops/ShopsBrowser.js now. Receipts and Admins lists next.
//
// TRADEOFFS
//   + One tested place for the hardest part of every list.
//   - Filters must be plain values (on purpose).
//
// HOW TO USE
//   See the practical example, then draw with <ListStates ...>.
// =============================================================================

// PIECE BY PIECE
//   fetchRef   = always the newest fetchPage, without being a reason to reload.
//   filterKey  = the filters as text, so we notice real changes only.
//   latest     = a counter: only the newest call may update the screen.
//   attempt    = bumped by retry() to run the first load again.
//   effect     = first page, on load and whenever filters or attempt change.
//   loadMore() = next page using the cursor, appended to the list.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { redirectIfSignedOut } from '../lib/admin/adminSession';

export function useCursorList({ fetchPage, filters, pageSize = 25 }) {
  const router = useRouter();

  // Keep the newest fetchPage without making it a reason to reload the list.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  // The filters as text: a new object with the same values is NOT a change.
  const filterKey = JSON.stringify(filters);

  const [state, setState] = useState({
    items: [],
    nextCursor: null,
    loading: true,      // the first page is loading
    loadingMore: false, // "Load more" is loading
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0); // the number of the newest call

  // First page: on load, and whenever the filters (or a retry) change.
  useEffect(() => {
    latest.current += 1;
    const mine = latest.current; // this call's number
    setState((s) => ({ ...s, loading: true, error: '' }));

    fetchRef.current({ ...JSON.parse(filterKey), limit: pageSize })
      .then((res) => {
        if (mine !== latest.current) return; // a newer call exists, ignore this answer
        setState({ items: res.data, nextCursor: res.nextCursor ?? null, loading: false, loadingMore: false, error: '' });
      })
      .catch((err) => {
        if (mine !== latest.current) return;
        if (redirectIfSignedOut(err, router)) return;
        setState({ items: [], nextCursor: null, loading: false, loadingMore: false, error: err.message });
      });
  }, [filterKey, pageSize, attempt, router]);

  // Next page: adds to the list and keeps the filters.
  const loadMore = useCallback(async () => {
    const mine = latest.current;
    const cursor = state.nextCursor;
    setState((s) => ({ ...s, loadingMore: true, error: '' }));
    try {
      const res = await fetchRef.current({ ...JSON.parse(filterKey), cursor, limit: pageSize });
      if (mine !== latest.current) return; // filters changed meanwhile, drop this page
      setState((s) => ({ ...s, items: [...s.items, ...res.data], nextCursor: res.nextCursor ?? null, loadingMore: false }));
    } catch (err) {
      if (mine !== latest.current) return;
      if (redirectIfSignedOut(err, router)) return;
      setState((s) => ({ ...s, loadingMore: false, error: err.message }));
    }
  }, [state.nextCursor, filterKey, pageSize, router]);

  // Run the first load again (the "Try again" button).
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, loadMore, retry };
}
