// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/services/shopProfile.service.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A shop has a small "business card": the town, one line about the shop, a
//   WhatsApp number, delivery areas, and the owner's yes or no to the marketplace. This file reads and saves that card in the table brand_profiles.
//
// WHY IMPORTANT
//   The owner's Shop profile page and the public shop page both use it, and the
//   marketplace (Batch 6) will read the same facts. One place that knows how the
//   card is stored means a change is made once.
//
// DANGER
//   1. Always pass req.db (the shop-locked connection from withTenant). Then the
//      database itself refuses to show or change another shop's card. Never pass the
//      plain pool.
//   2. A shop that has never saved its card has NO row yet. readProfile then returns
//      an "empty card" (all empty, marketplace OFF) instead of an error, and
//      saveProfile creates the row on the first save.
//   3. The WhatsApp number is private. readPublicCard never returns it. It is kept for
//      later, when the platform sends messages and shows contact through its own
//      channel.
//
// WHAT IT SOLVES
//   - readProfile: the owner's whole card, for the form.
//   - saveProfile: create or update the card (only the fields you send change).
//   - readPublicCard: only the two facts a stranger may see: town and description.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: the controller checks the form and answers HTTP; this
//   file only talks to the database. "Upsert": one row per shop, created on first
//   save, changed after that (brand_profiles.tenant_id is UNIQUE).
//
// RULES
//   1. tenantId comes from the login (req.tenantId), never from the request body.
//   2. Empty text is stored as NULL, never as "".
//   3. list_in_marketplace is only ever true when the owner sent true.
//
// PRACTICAL EXAMPLE
//   Mama Njeri opens Shop profile for the first time: readProfile gives an empty card.
//   She types "Kitengela" and saves: saveProfile creates her row. Later she changes only
//   her delivery areas: the other fields stay exactly as they were.
//
// DECISIONS
//   - Merge in code, then write the whole row: simple to read, and one owner edits
//     one shop, so two saves at the same instant are not a real risk.
//   - Responses use snake_case (town, short_description...), like the rest of the API.
//   - No opening hours: an online shop takes orders 24/7. (The older column working_hours
//     is left alone and unused.)
//
// WHERE USED
//   shopProfile.controller.js, storefront.controller.js (readPublicCard)
//
// TRADEOFFS
//   + Very readable. - One extra read before a save.
//
// HOW TO USE
//   const card = await readProfile(req.db);
//   const saved = await saveProfile(req.db, req.tenantId, { town: 'Kitengela' });
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// FIELDS             = THE LIST OF BOXES ON THE CARD, with the column each one lives in.
// emptyCard()        = A BLANK CARD for a shop that has not filled one in yet.
// readProfile(db)    = TAKE THE CARD OUT OF THE DRAWER (or hand over a blank one).
// saveProfile(...)   = WRITE ONLY THE BOXES THAT CHANGED, then file the card back.
//                      ON CONFLICT (tenant_id) = "if this shop already has a card, update it".
// readPublicCard(db) = THE SHOP WINDOW VERSION: town and description only.
// ═══════════════════════════════════════════════════════════

// The boxes on the card, as "API name : database column". They are the same today; keeping
// the list in one place means adding a box later is a one-line change here.
const FIELDS = {
  town: 'town',
  short_description: 'short_description',
  whatsapp_number: 'whatsapp_number',
  delivery_areas: 'delivery_areas',
  list_in_marketplace: 'list_in_marketplace',
};

// emptyCard: a BLANK card for a shop that has never saved one (it has no row yet).
// Real life: a new blank form. Note list_in_marketplace is false: not listed until
// the owner says yes.
function emptyCard() {
  return {
    town: null,
    short_description: null,
    whatsapp_number: null,
    delivery_areas: null,
    list_in_marketplace: false,
  };
}

// toCard: copy ONLY the five card fields out of a database row. Anything else the row
// holds (ids, logo, colours...) stays behind, so it can never leak out by accident.
function toCard(row) {
  const card = {};
  for (const key of Object.keys(FIELDS)) card[key] = row[FIELDS[key]];
  return card;
}

// readProfile: the owner's whole card.
//   db = the shop-locked connection (req.db). Row level security in the database means
//        the query below can only ever see THIS shop's row, even without a WHERE.
export async function readProfile(db) {
  const { rows } = await db.query(
    `SELECT town, short_description, whatsapp_number, delivery_areas,
            list_in_marketplace
       FROM brand_profiles`
  );
  // No row yet? Hand back a blank card instead of an error.
  return rows[0] ? toCard(rows[0]) : emptyCard();
}

// saveProfile: create or update the card.
//   changes = ONLY the boxes to change (API names). Boxes not mentioned keep their
//             value; a box set to null is cleared.
export async function saveProfile(db, tenantId, changes) {
  // 1. Start from what is saved now (or a blank card) and lay the changes on top.
  //    Real life: take the card out of the drawer, correct the boxes that changed.
  const merged = { ...(await readProfile(db)), ...changes };

  // 2. Write the whole card back in ONE statement.
  //    INSERT ... ON CONFLICT (tenant_id) DO UPDATE = "if this shop has no card yet,
  //    create it; if it already has one, update it". tenant_id is UNIQUE, so there is
  //    only ever one card per shop.
  const { rows } = await db.query(
    `INSERT INTO brand_profiles
       (tenant_id, town, short_description, whatsapp_number,
        delivery_areas, list_in_marketplace)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id) DO UPDATE SET
       town = EXCLUDED.town,
       short_description = EXCLUDED.short_description,
       whatsapp_number = EXCLUDED.whatsapp_number,
       delivery_areas = EXCLUDED.delivery_areas,
       list_in_marketplace = EXCLUDED.list_in_marketplace,
       updated_at = NOW()
     RETURNING town, short_description, whatsapp_number,
               delivery_areas, list_in_marketplace`,
    [
      tenantId,                               // $1: from the login, never from the form
      merged.town,                            // $2
      merged.short_description,               // $3
      merged.whatsapp_number,                 // $4
      merged.delivery_areas,                  // $5
      // $6: only a real `true` lists the shop. Anything else (a string, undefined)
      // means "not listed". Listing is the owner's clear yes, never a guess.
      merged.list_in_marketplace === true,
    ]
  );

  // 3. Give back the card exactly as it is now saved.
  return toCard(rows[0]);
}

// readPublicCard: what a STRANGER may see on the shop page: town and description only.
// It never selects the WhatsApp number, so the number cannot leak from here.
export async function readPublicCard(db) {
  const { rows } = await db.query(
    'SELECT town, short_description FROM brand_profiles'
  );
  return {
    town: rows[0]?.town ?? null,                       // ?. and ?? = "if there is no row, use null"
    description: rows[0]?.short_description ?? null,   // the public name for short_description
  };
}
