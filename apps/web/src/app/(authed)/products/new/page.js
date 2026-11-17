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
//
// WHY IMPORTANT:
// - Without it the only way to add products is by hand in the database. A shop
//   cannot run on that
//
// DANGER (if this file does not exist):
// - Products can only come from seed scripts, and the Products page stays empty
//
// WHAT IT SOLVES:
// - A friendly form with the problems shown next to the right box
// - Converts the typed price (shillings) into whole cents before sending
//
// SYSTEM DESIGN PRINCIPLE: Check twice, trust once
// - The form checks first, only to give a fast, friendly answer. The API checks
//   again and is the one that decides. Never rely on the form alone
//
// RULES:
// - Money is sent as whole cents (priceCents), made by kesToCents. Never
//   multiply a decimal by 100 here
// - All API calls go through lib/api.js (api.createProduct), never fetch()
// - Empty optional boxes are LEFT OUT of the request. Sending "" for the SKU
//   would clash with the "one SKU per shop" rule in the database
// - The price must fit the database column (a 32-bit whole number of cents,
//   so a little under KES 21,474,836). Bigger prices are refused here
// - Never show a raw technical error. Messages come from lib/api.js
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
//
// PRACTICAL EXAMPLE:
// - Amina types "Red dress", "1,500" and presses Add product. The API gets
//   { name: "Red dress", priceCents: 150000, status: "active" } and she lands
//   on the list with her new dress at the top
//
// WHERE USED:
// - (authed)/products/new/page.js
//
// TRADEOFFS:
// + No libraries, small, reuses FormError, SubmitButton and useFormState
// - No image upload yet, and no edit or delete (later steps)
//
// HOW TO USE:
//   import ProductForm from '../../../../components/ProductForm';
//   <ProductForm />
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api } from '../lib/api';
import { kesToCents } from '../lib/kesToCents';
import { useFormState } from '../hooks/useFormState';
import FormError from './FormError';
import SubmitButton from './SubmitButton';

// The biggest price the database column can hold (a 32-bit whole number)
const MAX_PRICE_CENTS = 2147483647;

// Same look for every box (red outline when that box has a problem)
function inputClass(hasError) {
  return `w-full border ${hasError ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`;
}

// FieldError: the small red message under a box. Draws nothing when empty
function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

export default function ProductForm() {
  const router = useRouter();
  const { error, loading, startSubmit, failSubmit } = useFormState();

  // Messages under each box, for example { price: 'Enter a price like 350' }
  const [fieldErrors, setFieldErrors] = useState({});

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

    try {
      await api.createProduct(body);

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
          defaultValue="active"
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

      {/* Buttons */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-44">
          <SubmitButton loading={loading} loadingText="Saving...">
            Add product
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
// =============================================================================