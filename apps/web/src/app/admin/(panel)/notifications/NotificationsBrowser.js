'use client';

// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/notifications/NotificationsBrowser.js   (Week 30 Day 3, Batch 3b-2b, web step 5)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The notifications screen: the three counts (queued, sent, failed) as filter
//   buttons, a Refresh button, and the table of lines with "Load more".
//
// WHY IMPORTANT
//   A failing sender is invisible until someone looks. This is the place to look.
//
// DANGER
//   1. It shows no phone numbers or message text (the API never sends them).
//   2. Lines on the 'test' channel are practice: nothing reached a phone. The page
//      says so, so nobody mistakes "Sent" for "delivered to a human".
//   3. The counts and the list are two separate calls. Refresh reloads both together.
//
// WHAT IT SOLVES
//   "Is the sender working? What failed and why?"
//
// SYSTEM DESIGN PRINCIPLE
//   Compose shared pieces (DRY): useCursorList, ListStates, FilterPills, useAdminLoad.
//   This file only wires them together.
//
// RULES
//   1. The status choice restarts the list from the top.
//   2. Refresh changes a counter that is part of the filters, so the list restarts, and
//      is also the key that reloads the counts.
//   3. Newest first, 25 at a time.
//
// PRACTICAL EXAMPLE
//   Press "Failed (1)" to see only the failed line and read its note.
//
// DECISIONS
//   - The `refresh` counter is sent with the filters. The API ignores unknown words, and
//     adminApi.listNotifications passes only the words it knows, so it never reaches the server.
//
// WHERE USED
//   notifications/page.js
//
// TRADEOFFS
//   + Reuses the same hooks and components as the Shops page. - Counts can be a few seconds
//     old until you press Refresh.
//
// HOW TO USE
//   <NotificationsBrowser />
// =============================================================================

// PIECE BY PIECE
//   status / refresh      = what the admin chose and how many times they pressed Refresh.
//   summary               = the three counts (useAdminLoad).
//   list                  = the lines (useCursorList).
//   ListStates            = loading, empty, error, Load more (shared).
//   practice note         = a reminder when practice-channel lines are on screen.

import { useState } from 'react';
import { adminApi } from '../../../../lib/admin/adminApi';
import { statusOptions } from '../../../../lib/admin/adminNotifications';
import { useCursorList } from '../../../../hooks/useCursorList';
import { useAdminLoad } from '../../../../hooks/admin/useAdminLoad';
import AdminButton from '../../../../components/admin/AdminButton';
import FilterPills from '../../../../components/admin/FilterPills';
import ListStates from '../../../../components/admin/ListStates';
import NotificationsTable from '../../../../components/admin/NotificationsTable';

export default function NotificationsBrowser() {
  const [status, setStatus] = useState('');
  const [refresh, setRefresh] = useState(0);   // bump it to reload everything

  // The three counts. They reload when Refresh is pressed.
  const summary = useAdminLoad(() => adminApi.getNotificationSummary(), `notification-summary-${refresh}`);

  // The lines. Changing the status or pressing Refresh restarts the list.
  const list = useCursorList({
    fetchPage: (params) => adminApi.listNotifications(params),
    filters: { status, refresh },
  });

  const count = list.items.length;
  const hasPractice = list.items.some((n) => n.channel === 'test');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">Messages queued for shop owners, newest first.</p>
        </div>
        <AdminButton variant="quiet" onClick={() => setRefresh((n) => n + 1)}>Refresh</AdminButton>
      </div>

      <FilterPills
        label="Status"
        options={statusOptions(summary.data)}
        value={status}
        onChange={setStatus}
      />

      {/* A reminder that the practice channel delivers nothing. */}
      {hasPractice && (
        <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Lines on the <strong>test</strong> channel are practice: they are marked Sent, but nothing
          reached a phone. Real WhatsApp and SMS are not connected yet.
        </p>
      )}

      <ListStates {...list} emptyTitle="No messages yet" emptyMessage="Messages appear here when you suspend, reinstate or verify a shop.">
        <p className="mb-3 text-sm text-slate-600">Showing {count} {count === 1 ? 'message' : 'messages'}</p>
        <NotificationsTable items={list.items} />
      </ListStates>
    </div>
  );
}
