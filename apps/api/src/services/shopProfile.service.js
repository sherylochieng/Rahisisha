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

// The boxes on the card: the name used by the API (left) and the database column (right).
const FIELDS = {
  town: 'town',
  short_description: 'short_description',
  whatsapp_number: 'whatsapp_number',
  delivery_areas: 'delivery_areas',
  list_in_marketplace: 'list_in_marketplace',
};

// A blank card: nothing filled in, and NOT listed in the marketplace.
function emptyCard() {
  return {
    town: null,
    short_description: null,
    whatsapp_number: null,
    delivery_areas: null,
    list_in_marketplace: false,
  };
}

// Keep only the six card fields from a database row.
function toCard(row) {
  const card = {};
  for (const key of Object.keys(FIELDS)) card[key] = row[FIELDS[key]];
  return card;
}

// readProfile: the owner's whole card. `db` must be the shop-locked connection.
export async function readProfile(db) {
  const { rows } = await db.query(
    `SELECT town, short_description, whatsapp_number, delivery_areas,
            list_in_marketplace
       FROM brand_profiles`
  );
  return rows[0] ? toCard(rows[0]) : emptyCard();
}

// saveProfile: `changes` holds ONLY the boxes to change (snake_case names).
// Missing boxes keep their value; a null clears a box.
export async function saveProfile(db, tenantId, changes) {
  const merged = { ...(await readProfile(db)), ...changes };
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
      tenantId,
      merged.town,
      merged.short_description,
      merged.whatsapp_number,
      merged.delivery_areas,
      merged.list_in_marketplace === true,
    ]
  );
  return toCard(rows[0]);
}

// readPublicCard: what a stranger may see on the shop page. NEVER the WhatsApp number.
export async function readPublicCard(db) {
  const { rows } = await db.query(
    'SELECT town, short_description FROM brand_profiles'
  );
  return {
    town: rows[0]?.town ?? null,
    description: rows[0]?.short_description ?? null,
  };
}
