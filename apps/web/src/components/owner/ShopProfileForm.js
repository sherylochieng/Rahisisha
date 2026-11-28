'use client';
// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/owner/ShopProfileForm.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The owner's "Shop profile" form: town, a one-line description, the WhatsApp
//   number, delivery areas, and the switch "Show my shop in the marketplace".
//   It saves them with one button.
//
// WHY IMPORTANT
//   This is how a shop introduces itself to strangers. Town and the one-line
//   description appear on the public shop page. The marketplace switch is the owner's
//   yes or no to being listed (it is OFF until they turn it on).
//
// DANGER
//   1. It is a CLIENT file ('use client'): it holds the typing, the picking and the
//      Save click.
//   2. The WhatsApp number is PRIVATE. The text under the box says so. It is not shown
//      on the public page.
//   3. Turning the marketplace switch on only records the choice. Nothing public
//      happens until the marketplace is built (a later batch).
//   4. It sends ALL the boxes on every save, so what the owner sees is what is saved.
//      An empty box clears that field.
//   5. No opening hours on purpose: an online shop takes orders 24/7.
//
// WHAT IT SOLVES
//   One form, with a clear message beside any box the server did not accept, and a
//   pop-up "Changes saved" that is seen wherever the owner is on the page.
//
// SYSTEM DESIGN PRINCIPLE
//   Same pattern as ProductForm: useFormState for the red banner and the busy button,
//   shared FormError, inputClass, FieldError and SubmitButton (DRY), field errors
//   mapped from error.details. The "saved" pop-up is the shared Toast component.
//
// RULES
//   1. The page (server file) loads the saved card and passes it in as `profile`.
//   2. Limits match the server: town 60, description 160, areas 300.
//   3. Never show the number anywhere except in its own box.
//
// PRACTICAL EXAMPLE
//   Mama Njeri types "Kitengela, Nairobi" and a line about her shop, adds her number and
//   presses Save. A green "Changes saved" note pops up. Her shop link now shows the town
//   and the line.
//
// DECISIONS
//   - The town box guides the owner with an example ("Utawala, Nairobi").
//   - The marketplace switch is a real button with role="switch" and aria-checked.
//   - The description has a live counter (x / 160).
//   - After saving we stay on the page (no redirect) and call router.refresh().
//
// WHERE USED
//   app/(authed)/shop-profile/page.js
//
// TRADEOFFS
//   + Simple and familiar. - Saving sends everything, not only the changed boxes.
//   - Opening hours were left out for now (shops are online all day).
//
// HOW TO USE
//   import ShopProfileForm from '../../../components/owner/ShopProfileForm';
//   <ShopProfileForm profile={profile} />
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. profile            = THE CARD AS IT IS NOW, handed in by the page.
// 2. town, ...          = THE BOXES ON THE CARD. Each starts with the saved words.
// 3. listed             = THE SWITCH ON THE WALL: on = "list me", off = "do not list me".
// 4. fieldErrors        = THE CLERK'S RED PEN: a short message beside the wrong box.
// 5. handleSubmit       = "SAVE": check the easy things here, send, then show the result.
// 6. err.details        = THE SERVER POINTING AT A BOX: whatsappNumber -> the number box.
// 7. note / <Toast>     = THE "CHANGES SAVED" STICKY NOTE that floats in the corner and fades away.
// ═══════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from '../../lib/api';
import { useFormState } from '../../hooks/useFormState';
import FormError from '../shared/FormError';
import SubmitButton from '../shared/SubmitButton';
import Toast from '../shared/Toast';
import { inputClass, FieldError } from '../shared/formParts';

// The limits (the server enforces the same ones)
const LIMITS = { town: 60, description: 160, areas: 300 };

export default function ShopProfileForm({ profile }) {
  const router = useRouter();
  const { error, loading, startSubmit, failSubmit, resetSubmit } = useFormState();

  // Which boxes have a problem: { town: 'message', ... }
  const [fieldErrors, setFieldErrors] = useState({});

  // The words in the description box, kept in state only to count the letters
  const [description, setDescription] = useState(profile?.short_description ?? '');

  // The marketplace switch (starts from the saved choice; a new shop starts OFF)
  const [listed, setListed] = useState(Boolean(profile?.list_in_marketplace));

  // The pop-up note ("Changes saved"). Empty = no note. useCallback keeps the same
  // function between renders, so the Toast's timer is not restarted by every keystroke.
  const [note, setNote] = useState('');
  const clearNote = useCallback(() => setNote(''), []);

  async function handleSubmit(e) {
    e.preventDefault();
    startSubmit();
    setFieldErrors({});
    setNote('');

    // Read every box out of the form
    const form = new FormData(e.target);
    const body = {
      town: String(form.get('town') || '').trim(),
      shortDescription: description.trim(),
      whatsappNumber: String(form.get('whatsapp') || '').trim(),
      deliveryAreas: String(form.get('areas') || '').trim(),
      listInMarketplace: listed,
    };

    // Easy checks here (the server checks again; it is the real guard)
    const problems = {};
    if (body.town.length > LIMITS.town) problems.town = `Keep the town under ${LIMITS.town} letters.`;
    if (body.shortDescription.length > LIMITS.description) problems.description = `Keep it under ${LIMITS.description} letters.`;
    if (body.deliveryAreas.length > LIMITS.areas) problems.areas = `Keep it under ${LIMITS.areas} letters.`;
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      failSubmit('Please fix the highlighted fields.');
      return;
    }

    try {
      await api.saveShopProfile(body);
      resetSubmit();
      setNote('Changes saved');   // the pop-up
      router.refresh();           // the server copy of the page is now fresh
    } catch (err) {
      // The server pointed at particular boxes: show a message beside each
      if (err.status === 400 && err.details) {
        const found = {};
        if (err.details.town) found.town = `Keep the town under ${LIMITS.town} letters.`;
        if (err.details.shortDescription) found.description = `Keep it under ${LIMITS.description} letters.`;
        if (err.details.whatsappNumber) found.whatsapp = 'Enter a Kenyan mobile number like 0712 345 678.';
        if (err.details.deliveryAreas) found.areas = `Keep it under ${LIMITS.areas} letters.`;
        if (Object.keys(found).length > 0) {
          setFieldErrors(found);
          failSubmit('Please fix the highlighted fields.');
          return;
        }
      }
      failSubmit(err.message || 'Could not save your profile. Please try again.');
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-xl">
        <FormError message={error} />

        {/* Town or area */}
        <div>
          <label htmlFor="town" className="block text-sm font-medium text-gray-700 mb-1">
            Town or area
          </label>
          <input
            id="town"
            name="town"
            type="text"
            maxLength={LIMITS.town}
            defaultValue={profile?.town ?? ''}
            disabled={loading}
            aria-invalid={fieldErrors.town ? 'true' : 'false'}
            aria-describedby={fieldErrors.town ? 'town-error' : 'town-hint'}
            className={inputClass(fieldErrors.town)}
            placeholder="Utawala, Nairobi"
          />
          <p id="town-hint" className="mt-1 text-xs text-gray-400">
            Write the area and the city, for example Utawala, Nairobi.
          </p>
          <FieldError id="town-error" message={fieldErrors.town} />
        </div>

        {/* One-line description, with a letter counter */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            About your shop (one line)
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={LIMITS.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            aria-invalid={fieldErrors.description ? 'true' : 'false'}
            aria-describedby={fieldErrors.description ? 'description-error' : 'description-hint'}
            className={inputClass(fieldErrors.description)}
            placeholder="Fresh vegetables and groceries, delivered the same day."
          />
          <p id="description-hint" className="mt-1 text-xs text-gray-400">
            Shown under your shop name. {description.length} / {LIMITS.description}
          </p>
          <FieldError id="description-error" message={fieldErrors.description} />
        </div>

        {/* WhatsApp number: private */}
        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp number
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={profile?.whatsapp_number ? `+${profile.whatsapp_number}` : ''}
            disabled={loading}
            aria-invalid={fieldErrors.whatsapp ? 'true' : 'false'}
            aria-describedby={fieldErrors.whatsapp ? 'whatsapp-error' : 'whatsapp-hint'}
            className={inputClass(fieldErrors.whatsapp)}
            placeholder="0712 345 678"
          />
          <p id="whatsapp-hint" className="mt-1 text-xs text-gray-400">
            Private. It is not shown on your shop page. We will use it to send you messages.
          </p>
          <FieldError id="whatsapp-error" message={fieldErrors.whatsapp} />
        </div>

        {/* Delivery areas */}
        <div>
          <label htmlFor="areas" className="block text-sm font-medium text-gray-700 mb-1">Delivery areas</label>
          <input
            id="areas"
            name="areas"
            type="text"
            maxLength={LIMITS.areas}
            defaultValue={profile?.delivery_areas ?? ''}
            disabled={loading}
            aria-invalid={fieldErrors.areas ? 'true' : 'false'}
            aria-describedby={fieldErrors.areas ? 'areas-error' : undefined}
            className={inputClass(fieldErrors.areas)}
            placeholder="Utawala, Embakasi, Kitengela"
          />
          <FieldError id="areas-error" message={fieldErrors.areas} />
        </div>

        {/* THE MARKETPLACE SWITCH. A real button, so keyboard and screen readers work. */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id="marketplace-label" className="text-sm font-medium text-gray-800">
                Show my shop in the marketplace
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {listed
                  ? 'On. When the marketplace opens, shoppers will be able to find your shop there.'
                  : 'Off. Only people with your shop link can see your shop. You can turn this on any time.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={listed}
              aria-labelledby="marketplace-label"
              disabled={loading}
              onClick={() => setListed(!listed)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${listed ? 'bg-brand-orange' : 'bg-gray-300'}`}
            >
              {/* The round knob slides to the right when the switch is on */}
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${listed ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        </div>

        <SubmitButton loading={loading} loadingText="Saving...">
          Save profile
        </SubmitButton>
      </form>

      {/* The floating "Changes saved" note */}
      <Toast message={note} onClose={clearNote} />
    </>
  );
}
