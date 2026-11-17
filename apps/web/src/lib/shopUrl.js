// =============================================================================
// FILE: apps/web/src/lib/shopUrl.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Every shop has an address word (its slug), for example "amina". Customers
//   reach the shop at amina.rahisishabiashara.com. This file builds that full
//   address in ONE place, so the dashboard, the share button and any future
//   page always show the same link
//
// WHY IMPORTANT:
// - A wrong link is a shop owner sharing a dead address with real customers
//
// DANGER (if this file does not exist):
// - Each page builds the link by hand, with its own mistakes: a forgotten
//   port on a laptop, http where https is needed, a typo in the domain
//
// WHAT IT SOLVES:
// - Laptop:     amina + localhost:3001            -> http://amina.localhost:3001
// - Online:     amina + rahisishabiashara.com     -> https://amina.rahisishabiashara.com
//
// SYSTEM DESIGN PRINCIPLE: One pure function, easy to test
// - It takes plain text in and returns plain text out. It reads no cookies,
//   calls no API and touches no database
//
// RULES:
// - The address word (slug) comes from the logged-in shop (the session), never
//   from anything a visitor types
// - The slug is checked again here: only lowercase letters, digits and dashes
//   are allowed. Anything else returns null, so a strange value can never turn
//   into a link
// - Nothing secret goes into the link. It is a public address
//
// DECISIONS:
// 1. The port is copied from the address the owner is using right now, because
//    a laptop needs ":3001" and a live site needs none
// 2. https online, http only for "localhost"
//
// PRACTICAL EXAMPLE:
//   buildShopUrl({ slug: 'amina', host: 'localhost:3001', rootDomain: 'localhost' })
//   -> 'http://amina.localhost:3001'
//
// WHERE USED:
// - (authed)/dashboard/page.js, which hands the result to ShopLinkCard
//
// TRADEOFFS:
// + Tiny and predictable
// - A shop on its own custom domain (shop.com) is not supported yet
//
// HOW TO USE:
//   import { buildShopUrl } from '../../../lib/shopUrl';
// =============================================================================

// Only these characters may appear in a shop word
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildShopUrl({ slug, host, rootDomain }) {
  // Not a clean shop word: refuse, so we never build a strange link
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;

  // Which main domain are we on? Laptop default: "localhost"
  const root = (rootDomain || 'localhost').toLowerCase();

  // Copy the port from the owner's current address ("localhost:3001" -> ":3001")
  const portMatch = typeof host === 'string' ? host.match(/:(\d{2,5})$/) : null;
  const port = portMatch ? `:${portMatch[1]}` : '';

  // http only on a laptop, https everywhere else
  const scheme = root === 'localhost' ? 'http' : 'https';

  return `${scheme}://${slug}.${root}${port}`;
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// SLUG_PATTERN      : the allowed shape of a shop word. Real life: a shop sign
//                     may only use letters, numbers and dashes, no spaces
// slug check        : returns null for anything else, so the page can hide the
//                     card instead of showing a broken link
// root              : the main domain. On a laptop "localhost", online
//                     "rahisishabiashara.com"
// portMatch / port  : pulls ":3001" off the end of the current address, if any
// scheme            : "http" for a laptop, "https" online (the padlock)
// return `...`      : glues scheme + shop word + domain + port together
// =============================================================================