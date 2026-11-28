'use client';
// 'use client': a hook that remembers things between renders only works in the
// browser, not on the server.

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/hooks/useCategories.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Any screen that needs the aisle list (today the product form) asks
//   this hook. It fetches GET /v1/categories once and remembers the answer.
//
// WHY IMPORTANT
//   Add product and Edit product are separate pages. Without a memory,
//   every visit would ask the API again for the same ten words.
//
// DANGER (what breaks without it)
//   Each screen fetching on its own: repeated code, repeated requests, and
//   different failure handling in each place.
//
// WHAT IT SOLVES
//   const { categories, loading } = useCategories();
//   categories = [{ id, slug, name }], loading = true until the first answer.
//   If the API cannot be reached, categories stays [] and the form still
//   works (the category is optional), so a hiccup never blocks saving.
//
// SYSTEM DESIGN PRINCIPLE
//   One hook per shared piece of data (like useFormState for forms).
//   A module-level `cached` variable lives as long as the browser tab:
//   simple and enough for a list head office changes rarely.
//
// RULES
//   1. Never cache a failure: only a real answer is remembered.
//   2. Never let an unmounted screen set state (the `alive` flag).
//
// WHERE USED
//   components/ProductForm.js
//
// TRADEOFFS
//   + No extra library. - A head-office change shows after a page refresh
//     (the API also caches for 5 minutes).
//
// HOW TO USE
//   const { categories, loading } = useCategories();
//   categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// cached         = THE NOTICEBOARD COPY: once someone has read the aisle
//                  list, everyone in this tab reuses the copy.
// useState(cached ?? []) = START WITH THE COPY IF WE HAVE ONE, so the
//                  dropdown is full on the very first paint.
// useEffect      = "WHEN THE SCREEN OPENS, GO AND ASK" (once).
// alive          = IF THE OWNER LEAVES BEFORE THE ANSWER ARRIVES, DO NOT
//                  WRITE ON A SCREEN THAT IS GONE.
// .catch(() => {}) = A FAILED ASK IS NOT AN ERROR SCREEN: the aisle is
//                  optional, so we just show an empty dropdown.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Remembered for as long as this browser tab is open. null = not fetched yet.
let cached = null;

export function useCategories() {
  const [categories, setCategories] = useState(cached ?? []);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached !== null) return undefined; // already have the list
    let alive = true;

    api
      .listCategories()
      .then((res) => {
        cached = res?.data ?? [];           // remember only a real answer
        if (alive) setCategories(cached);
      })
      .catch(() => {})                      // optional field: stay quiet
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { categories, loading };
}
