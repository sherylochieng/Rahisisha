'use client';
// Runs in the browser: it loads one thing with the admin cookie.

// =============================================================================
// FILE: apps/web/src/hooks/useAdminLoad.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Loads ONE thing for an admin screen (one shop, one admin) and tells the screen whether
//   it is loading, failed, not found, or ready. It can also load again after a change.
//
// WHY IMPORTANT
//   useCursorList handles lists. Detail screens need the same safety for a single item:
//   no stale answers, a 401 goes to sign in, and a reload after suspend or verify.
//
// DANGER
//   - Only the newest request may update the screen. Remove the counter and opening shop A,
//     then quickly shop B, can show A's data under B's name.
//   - 404 is reported as notFound, not as a scary error.
//
// WHAT IT SOLVES
//   Repeated loading / error / 401 code on every detail screen (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: the hook fetches, the screen draws. Latest-request-wins.
//
// RULES
//   1. load is called with no arguments and must return the API envelope { data }.
//   2. key identifies what is loaded (for example the shop id). A new key loads again.
//   3. reload() fetches again WITHOUT blanking the screen (used after an action).
//
// PRACTICAL EXAMPLE
//   const { data, loading, error, notFound, reload } =
//     useAdminLoad(() => adminApi.getShop(id), id);
//
// DECISIONS
//   - The loader is kept in a ref, so a new function each render does not reload.
//   - A reload keeps the old data on screen while the new data arrives.
//
// WHERE USED
//   ShopDetail.js now. The admins pages later.
//
// TRADEOFFS
//   + One tested place for the single-item pattern.
//
// HOW TO USE
//   See the practical example.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { redirectIfSignedOut } from '../lib/adminSession';

export function useAdminLoad(load, key) {
  const router = useRouter();

  // The newest loader, without being a reason to reload.
  const loadRef = useRef(load);
  loadRef.current = load;

  const [state, setState] = useState({ data: null, loading: true, error: '', notFound: false });
  const latest = useRef(0); // the number of the newest call

  // The one fetch routine. quiet = true keeps the old data on screen (used by reload).
  const run = useCallback((quiet) => {
    latest.current += 1;
    const mine = latest.current;
    if (!quiet) setState({ data: null, loading: true, error: '', notFound: false });

    loadRef.current()
      .then((res) => {
        if (mine !== latest.current) return; // a newer call exists, ignore this answer
        setState({ data: res.data, loading: false, error: '', notFound: false });
      })
      .catch((err) => {
        if (mine !== latest.current) return;
        if (redirectIfSignedOut(err, router)) return;
        if (err.status === 404) {
          setState({ data: null, loading: false, error: '', notFound: true });
          return;
        }
        // Keep any old data (quiet reload) and show the message.
        setState((s) => ({ ...s, loading: false, error: err.message, notFound: false }));
      });
  }, [router]);

  // Load on arrival, and again whenever the key changes.
  useEffect(() => {
    run(false);
    // A new key makes older answers stale. Counting up does that.
    return () => { latest.current += 1; };
  }, [key, run]);

  const reload = useCallback(() => run(true), [run]);
  const retry = useCallback(() => run(false), [run]);

  return { ...state, reload, retry };
}
