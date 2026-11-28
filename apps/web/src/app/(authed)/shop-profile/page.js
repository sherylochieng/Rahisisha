// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/(authed)/shop-profile/page.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The owner's "Shop profile" page at /shop-profile. It loads the saved business card
//   and shows the form to change it.
//
// WHY IMPORTANT
//   It is where an owner writes the town and one-line description that strangers see,
//   and where they choose whether to appear in the marketplace.
//
// DANGER
//   1. A SERVER page: it reads the card with the owner's login cookie (serverGet), so
//      the form opens already filled in. No flash of an empty form.
//   2. It sits inside the (authed) group, so the layout already checks the login and
//      draws the sidebar. Do not repeat that here.
//
// WHAT IT SOLVES
//   Load, then hand to the form. The form does the typing and saving.
//
// SYSTEM DESIGN PRINCIPLE
//   Server page fetches, client form interacts (same as Edit product).
//
// RULES
//   1. No form logic here.
//   2. Keep the title and the helper line short and plain.
//
// PRACTICAL EXAMPLE
//   Mama Njeri taps "Shop profile" in the menu and sees her saved town, line and hours.
//
// WHERE USED
//   The sidebar link "Shop profile" (components/owner/Sidebar.js).
//
// HOW TO USE
//   Visit /shop-profile while logged in.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// metadata       = THE BROWSER TAB TITLE.
// serverGet(...) = ASK THE API FOR MY CARD, using my login cookie.
// <ShopProfileForm profile={...} /> = THE FORM, already filled with the saved words.
// ═══════════════════════════════════════════════════════════

import { serverGet } from '../../../lib/serverApi';
import ShopProfileForm from '../../../components/owner/ShopProfileForm';

export const metadata = {
  title: 'Shop profile',
};

export default async function ShopProfilePage() {
  const profile = await serverGet('/shop/profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Shop profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell shoppers where you are and what you sell. Town and the one-line description
          show on your shop page.
        </p>
      </div>

      {/* key: a fresh form each time the saved card changes, so no old words linger */}
      <ShopProfileForm key={JSON.stringify(profile)} profile={profile} />
    </div>
  );
}
