// =============================================================================
// FILE: apps/web/src/components/admin/ListStates.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Decides what an admin list shows: loading, empty, error with "Try again", or the list
//   itself with a "Load more" button. One place, so every admin list behaves the same.
//
// WHY IMPORTANT
//   Loading, empty and error screens are the most forgotten part of any page. Here they
//   are done once, so no list can forget them.
//
// DANGER
//   - It draws only. It never fetches. The numbers and messages come from useCursorList.
//   - An error with no items shows "Try again", so the admin is never stuck on a blank page.
//
// WHAT IT SOLVES
//   Repeated state-switching code in every list screen (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   Design for every state. Separation of concerns: the hook fetches, this decides which
//   state to show, the table draws rows. It reuses the shared EmptyState and FormError.
//
// RULES
//   1. children (the table) is shown only when there are items.
//   2. "Load more" shows only when hasMore is true.
//   3. An error is always shown (also when more pages fail to load, above the old items).
//
// PRACTICAL EXAMPLE
//   <ListStates {...list} emptyTitle="No shops match" emptyMessage="Try a different search.">
//     <ShopsTable shops={list.items} />
//   </ListStates>
//
// DECISIONS
//   - Takes the hook's whole result with {...list}, so screens pass one thing.
//
// WHERE USED
//   ShopsBrowser.js now. Receipts and Admins lists next.
//
// TRADEOFFS
//   + One look and one behaviour for every list.
//
// HOW TO USE
//   See the practical example.
// =============================================================================

import AdminButton from './AdminButton';
import EmptyState from '../shared/EmptyState';
import FormError from '../shared/FormError';

export default function ListStates({
  items,
  nextCursor,
  loading,
  loadingMore,
  error,
  loadMore,
  retry,
  emptyTitle,
  emptyMessage,
  children,
}) {
  return (
    <>
      {/* An error is always shown. */}
      <FormError message={error} />

      {loading ? (
        // 1. First page is loading.
        <p role="status" className="py-8 text-center text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 && !error ? (
        // 2. Loaded fine, nothing to show.
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : items.length > 0 ? (
        // 3. We have rows: the caller's list, then "Load more" if there are more pages.
        <>
          {children}
          {nextCursor && (
            <div className="flex justify-center">
              <AdminButton loading={loadingMore} loadingText="Loading..." onClick={loadMore}>
                Load more
              </AdminButton>
            </div>
          )}
        </>
      ) : (
        // 4. Error and nothing to show: offer to try again.
        <div className="flex justify-center">
          <AdminButton onClick={retry}>Try again</AdminButton>
        </div>
      )}
    </>
  );
}
