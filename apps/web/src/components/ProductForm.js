'use client';
// 'use client' — needed because a form reacts to typing and clicks and talks to
// the API from the browser. Server files cannot do that

// =============================================================================
// FILE: apps/web/src/components/ProductForm.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The owner needs a way to add a product: a name, a price, an optional code
//   (SKU), an optional description and a status
// - Week 30: and now ONE optional PHOTO. The owner taps "Choose photo", the photo
//   goes straight to Cloudinary, and only its web address is saved
// - Week 30 Day 3: the SAME form now also EDITS a product (issues #6 and #7).
//   Give it a `product` and it starts filled in and saves changes
//
// WHY IMPORTANT:
// - Without it the only way to add products is by hand in the database. A shop
//   cannot run on that
// - Without edit, a typo in a price can never be fixed from the app
//
// DANGER (if this file does not exist):
// - Products can only come from seed scripts, and the Products page stays empty
//
// WHAT IT SOLVES:
// - A friendly form with the problems shown next to the right box
// - Converts the typed price (shillings) into whole cents before sending
// - In edit mode, converts the stored cents back into shillings for the box
// - Photo: checks the file, uploads it, shows a preview, lets the owner remove
//   or replace it, and blocks Save while an upload is still running
//
// SYSTEM DESIGN PRINCIPLE: Check twice, trust once
// - The form checks first, only to give a fast, friendly answer. The API checks
//   again and is the one that decides. Never rely on the form alone
//
// RULES:
// - Money is sent as whole cents (priceCents), made by kesToCents. Never
//   multiply a decimal by 100 here
// - Money shown in a box comes from centsToKes (whole-number maths, no / 100)
// - All API calls go through lib/api.js (api.createProduct, api.updateProduct),
//   never fetch()
// - Empty optional boxes are LEFT OUT of the request. Sending "" for the SKU
//   would clash with the "one SKU per shop" rule in the database
// - The price must fit the database column (a 32-bit whole number of cents,
//   so a little under KES 21,474,836). Bigger prices are refused here
// - Never show a raw technical error. Messages come from lib/api.js (and, for
//   photos, from lib/uploadPhoto.js)
// - The photo is uploaded the moment it is chosen; Save only sends its ADDRESS.
//   imageUrl is sent only when it CHANGED: a new address to set it, null to
//   remove it, nothing to leave it alone
// - This form never decides WHICH shop the product belongs to. The API takes
//   the shop from the login cookie
//
// DECISIONS:
// 1. noValidate switches off the browser's own pop-ups so OUR messages appear
//    under each box (same as the signup form)
// 2. A duplicate SKU (409) is shown under the SKU box, where the fix is
// 3. After success we go back to /products and refresh, so the new product is
//    in the list right away
// 4. Status starts as "active" (on sale), because most owners add products to
//    sell them. Draft and archived are one click away
// 5. (Week 30) One form for both jobs. `product` empty = ADD, `product` given =
//    EDIT. Two forms would drift apart and every fix would be needed twice
//
// PRACTICAL EXAMPLE:
// - Amina types "Red dress", "1,500" and presses Add product. The API gets
//   { name: "Red dress", priceCents: 150000, status: "active" } and she lands
//   on the list with her new dress at the top
// - Later she opens the dress, changes the price to "1,200" and presses Save
//   changes. The API gets a PATCH with priceCents 120000, and the list shows it
//
// WHERE USED:
// - (authed)/products/new/page.js        (ADD mode)
// - (authed)/products/[id]/edit/page.js  (EDIT mode)
//
// TRADEOFFS:
// + No libraries, small, reuses FormError, SubmitButton and useFormState
// - One photo per product (a gallery is future work)
// - A photo chosen but then abandoned (form closed without saving) stays at
//   Cloudinary; a clean-up job is future work
// - Editing cannot CLEAR the SKU or the description. The API leaves a field
//   alone when it is not sent, and this form leaves empty boxes out (known limit)
//
// HOW TO USE:
//   import ProductForm from '../../../../components/ProductForm';
//   <ProductForm />                      // add a new product
//   <ProductForm product={product} />    // edit an existing product
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api } from '../lib/api';
import { kesToCents } from '../lib/kesToCents';
import { uploadProductPhoto, checkPhotoFile } from '../lib/uploadPhoto';
import { centsToKes } from '../lib/centsToKes';
import { useFormState } from '../hooks/useFormState';
import FormError from './FormError';
// The look of a box and its red error note now live in one shared file
import { inputClass, FieldError } from './formParts';
// (Week 30 Day 3, Batch 4a-2) the Category dropdown, as its own piece
import CategorySelect from './CategorySelect';
import SubmitButton from './SubmitButton';

// The biggest price the database column can hold (a 32-bit whole number)
const MAX_PRICE_CENTS = 2147483647;

// product = null  -> ADD mode (empty boxes, button says "Add product")
// product = {...} -> EDIT mode (boxes filled in, button says "Save changes")
// Real life: the same order book, used for a new order or to correct an old one.
export default function ProductForm({ product = null }) {
  const isEdit = Boolean(product);
  const router = useRouter();
  const { error, loading, startSubmit, failSubmit } = useFormState();

  // Messages under each box, for example { price: 'Enter a price like 350' }
  const [fieldErrors, setFieldErrors] = useState({});

  // Photo: the address now shown (null = no photo), whether an upload is
  // running, and a message if the photo had a problem
  const originalImageUrl = product?.image_url ?? null;
  const [imageUrl, setImageUrl] = useState(originalImageUrl);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Category (Batch 4a-2): the aisle this product is filed under.
  // '' means "no category". We keep it in state (not read from the form box)
  // so the right option is still selected when the list arrives a moment
  // after the page opens. Real life: the aisle number on the product slip.
  const originalCategoryId = product?.category_id ?? '';
  const [categoryId, setCategoryId] = useState(originalCategoryId);

  // Runs when the owner picks a file. Checks it, uploads it, keeps its address.
  async function handlePhotoChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;

    setPhotoError('');
    const problem = checkPhotoFile(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }

    setUploading(true);
    try {
      setImageUrl(await uploadProductPhoto(file));
    } catch (err) {
      setPhotoError(err.message || 'We could not upload the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    startSubmit();
    setFieldErrors({});

    // STEP 1: read the boxes by their name=
    const form = new FormData(e.target);
    const name = String(form.get('name') || '').trim();
    const priceText = String(form.get('price') || '');
    const sku = String(form.get('sku') || '').trim();
    const description = String(form.get('description') || '').trim();
    const status = String(form.get('status') || 'active');

    // STEP 2: friendly checks, to catch the obvious mistakes without a round trip
    const problems = {};
    if (name.length < 1) problems.name = 'Enter the product name.';
    const priceCents = kesToCents(priceText);
    if (priceCents === null) {
      problems.price = 'Enter a price like 350 or 350.50 (numbers only).';
    } else if (priceCents > MAX_PRICE_CENTS) {
      problems.price = 'That price is too large. Please enter a smaller amount.';
    }
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      failSubmit('Please fix the highlighted fields.');
      return;
    }

    // STEP 3: build the request. Optional boxes are left out when empty
    const body = { name, priceCents, status };
    if (sku) body.sku = sku;
    if (description) body.description = description;
    // Photo: send only when it changed (a new address, or null to remove)
    if (imageUrl !== originalImageUrl) body.imageUrl = imageUrl;
    // Category: same rule as the photo. Send only when it changed: an id to
    // set it, null to remove it. A plain price edit never touches the aisle.
    if (categoryId !== originalCategoryId) body.categoryId = categoryId || null;

    try {
      // EDIT sends a PATCH to the existing product. ADD sends a new one.
      // Note: the API ignores an empty SKU or description on edit, so clearing
      // those two boxes does not remove them (known limit, see issue #6).
      if (isEdit) {
        await api.updateProduct(product.id, body);
      } else {
        await api.createProduct(body);
      }

      // STEP 4a: success. Go to the list and re-read it so the new product shows
      router.push('/products');
      router.refresh();
    } catch (err) {
      // STEP 4b: the API said no
      // 409 = this shop already has that SKU
      if (err.status === 409) {
        setFieldErrors({ sku: 'You already have a product with this SKU. Use a different one.' });
        failSubmit('Please fix the highlighted fields.');
        return;
      }
      // 400 with details = the API says which box is wrong
      if (err.status === 400 && err.details) {
        const found = {};
        if (err.details.name) found.name = 'Enter the product name.';
        if (err.details.priceCents) found.price = 'Enter a price like 350 or 350.50.';
        if (err.details.status) found.status = 'Choose a status from the list.';
        if (err.details.categoryId) found.categoryId = 'Choose a category from the list.';
        if (err.details.imageUrl) {
          setPhotoError('That photo could not be used. Please choose it again.');
          failSubmit('Please fix the highlighted fields.');
          return;
        }
        if (Object.keys(found).length > 0) {
          setFieldErrors(found);
          failSubmit('Please fix the highlighted fields.');
          return;
        }
      }
      // Everything else already has a friendly message from lib/api.js
      failSubmit(err.message || 'Could not save the product. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-xl">
      <FormError message={error} />

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Product name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={product?.name ?? ''}
          disabled={loading}
          aria-invalid={fieldErrors.name ? 'true' : 'false'}
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          className={inputClass(fieldErrors.name)}
          placeholder="Cement 50kg"
        />
        <FieldError id="name-error" message={fieldErrors.name} />
      </div>

      {/* Price in shillings (we convert to cents) */}
      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
          Price (KES)
        </label>
        <input
          id="price"
          name="price"
          type="text"
          inputMode="decimal"
          defaultValue={isEdit ? centsToKes(product.price_cents) : ''}
          required
          disabled={loading}
          aria-invalid={fieldErrors.price ? 'true' : 'false'}
          aria-describedby={fieldErrors.price ? 'price-error' : undefined}
          className={inputClass(fieldErrors.price)}
          placeholder="750 or 750.50"
        />
        <FieldError id="price-error" message={fieldErrors.price} />
      </div>

      {/* SKU: optional */}
      <div>
        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
          SKU (optional)
        </label>
        <input
          id="sku"
          name="sku"
          type="text"
          maxLength={60}
          defaultValue={product?.sku ?? ''}
          disabled={loading}
          aria-invalid={fieldErrors.sku ? 'true' : 'false'}
          aria-describedby={fieldErrors.sku ? 'sku-error' : undefined}
          className={inputClass(fieldErrors.sku)}
          placeholder="CEM-50"
        />
        <p className="mt-1 text-xs text-gray-400">
          Your own product code. Each code can be used once in your shop.
        </p>
        <FieldError id="sku-error" message={fieldErrors.sku} />
      </div>

      {/* Description: optional */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={product?.description ?? ''}
          disabled={loading}
          className={inputClass(false)}
          placeholder="A short note customers will read"
        />
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={product?.status ?? 'active'}
          disabled={loading}
          aria-invalid={fieldErrors.status ? 'true' : 'false'}
          aria-describedby={fieldErrors.status ? 'status-error' : undefined}
          className={inputClass(fieldErrors.status)}
        >
          <option value="active">Active (on sale)</option>
          <option value="draft">Draft (not on sale yet)</option>
          <option value="archived">Archived (hidden)</option>
        </select>
        <FieldError id="status-error" message={fieldErrors.status} />
      </div>

      {/* Category: optional. One aisle per product (Batch 4a-2) */}
      <CategorySelect
        value={categoryId}
        onChange={setCategoryId}
        disabled={loading}
        error={fieldErrors.categoryId}
      />

      {/* Photo: optional. Uploaded at once; Save only keeps its address */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</p>
        {imageUrl && (
          // Plain <img>: the picture lives on Cloudinary, not in our app
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Product photo preview"
            className="mb-2 h-40 w-40 rounded-lg border border-gray-200 object-cover"
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="photo"
            className={`inline-block cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${uploading || loading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {uploading ? 'Uploading...' : imageUrl ? 'Change photo' : 'Choose photo'}
          </label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChosen}
            disabled={uploading || loading}
            className="sr-only"
          />
          {imageUrl && !uploading && (
            <button
              type="button"
              onClick={() => { setImageUrl(null); setPhotoError(''); }}
              disabled={loading}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">JPG, PNG or WebP, up to 5 MB.</p>
        <FieldError id="photo-error" message={photoError} />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-44">
          <SubmitButton loading={loading || uploading} loadingText={uploading ? 'Uploading photo...' : 'Saving...'}>
            {isEdit ? 'Save changes' : 'Add product'}
          </SubmitButton>
        </div>
        <Link href="/products" className="text-sm font-medium text-gray-600 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// MAX_PRICE_CENTS     : the biggest number the database column can hold. Real
//                       life: a till that only shows 8 digits cannot ring up
//                       a nine-digit sale, so we stop it at the counter
// inputClass          : one style for every box, red outline when there is a
//                       problem. Real life: the same printed form for everyone
// FieldError          : the red note under a box. Draws nothing when empty
// useFormState        : the shared "error + loading" memory used by all forms
// fieldErrors         : which boxes have a problem and what to tell the owner
// FormData(e.target)  : reads every box by its name=
// kesToCents(...)     : "1,500" becomes 150000 with whole-number maths
// body (optional keys): sku and description are added only when typed. An empty
//                       SKU sent as "" would count as a real code and clash
// api.createProduct   : the one place that talks to the API
// 409 branch          : "you already use this SKU", shown under the SKU box
// 400 + details       : the API says which box is wrong, we point at it
// router.push + refresh: go back to the list and re-read it so the new product
//                       appears. Real life: after adding stock, walk back to
//                       the shelf and see it there
// noValidate          : our messages replace the browser's pop-up bubbles
//
// Week 30 photo additions
// originalImageUrl    : the photo the product had when the form opened (null if
//                       none). We compare against it to know if the photo changed
// imageUrl (state)    : the photo address the form is holding right now. Real
//                       life: the photo pinned on the notice board, which the
//                       owner can swap or take down before pressing Save
// uploading           : true while a photo is travelling to Cloudinary. Save is
//                       blocked, so a half-sent photo cannot be saved
// photoError          : the red note under the photo area
// handlePhotoChosen   : runs the moment a file is picked. e.target.files[0] is
//                       the chosen file; e.target.value = '' lets the SAME file
//                       be picked again after a mistake. It checks the file,
//                       uploads it (uploadProductPhoto), keeps the address,
//                       and always switches `uploading` off (finally)
// <img src={imageUrl}>: the preview. A plain img, because the picture is hosted
//                       at Cloudinary. Real life: the shop window picture
// label htmlFor=photo : the pretty "Choose photo" button. The real file box is
//                       hidden (sr-only = hidden to eyes, still there for screen
//                       readers) because browsers' own file buttons look rough
// accept=...          : the phone's gallery only offers JPG, PNG, WebP
// Remove photo        : sets imageUrl to null. On Save that sends imageUrl: null
//                       and the API removes the photo
// body.imageUrl       : added only when imageUrl !== originalImageUrl, so a
//                       plain price edit never touches the photo
// 400 imageUrl branch : the API refused the address (not this shop's photo);
//                       we ask the owner to choose the photo again
//
// Batch 4a-2 additions (Week 30 Day 3): CATEGORY
// <CategorySelect>    : the dropdown is its own file; it fetches the aisle list
//                       itself (useCategories, remembered for the tab)
// categoryId state    : '' = no category. Kept in state, not read from the box,
//                       so the right aisle stays selected when the list arrives
//                       a moment after the page opens
// body.categoryId     : added only when it changed. An id sets it, null removes
//                       it; a price-only edit never touches the aisle
// 400 categoryId      : the API refused the id (unknown or switched off);
//                       we show "Choose a category from the list." under the box
// list fails to load  : the dropdown only offers "No category"; saving still
//                       works because the aisle is optional
//
// Week 30 additions
// product = null      : a form that can be handed an existing product, like a
//                       pre-printed order slip with the customer's details
//                       already written in
// isEdit              : a yes-or-no label: "are we correcting an old one, or
//                       writing a new one?". The rest of the form asks only this
// defaultValue        : what a box shows when the page opens. Empty when adding,
//                       the old value when editing. The owner types over it
// centsToKes(...)     : the database holds 35000, the owner must see 350.
//                       Without it, saving would turn KES 350 into KES 35,000
// api.updateProduct   : tells the API "change product number so-and-so". The
//                       same friendly checks run first, so a bad price is
//                       stopped before it is sent
// empty SKU on edit   : the API leaves a field alone when it is not sent, so
//                       blanking the SKU box does not remove the SKU (known limit)
// =============================================================================