#!/usr/bin/env node
// Give catalogue items the identity a purchase order needs to leave the platform.
//
// Measured against the cXML OrderRequest a downstream system expects, a
// catalogue order could supply description, quantity, price and currency and
// none of SupplierPartID, UnitOfMeasure as a code, or a UNSPSC classification —
// so it could not have produced a valid order. These are properties of the item
// rather than questions for a requester, which is why they live here.
//
// The values are synthetic and deliberately marked so: part numbers carry the
// supplier's own prefix and the item id, which is what a real catalogue feed
// would look like without pretending to be one. The UNSPSC codes are genuine
// segment codes from the public taxonomy, mapped by catalogue rather than
// invented, so a classification that reaches a downstream system is at least
// pointing at the right family of goods.
//
//   npm run backfill:catalogue-identity   (add --dry-run to report only)

import { neon } from '@neondatabase/serverless';
import { requireConnectionOrFail } from '../../tests/lib/live.mjs';

const DRY = process.argv.includes('--dry-run');
const sql = neon(requireConnectionOrFail('catalogue procurement identity'));

// Display word → UN/CEFACT Recommendation 20 code. `unit` stays the word,
// because "bag" reads better on screen than "BG"; the code is what ships.
const UOM = {
  bag: 'BG', box: 'BX', each: 'EA', pack: 'PK', pair: 'PR', set: 'SET',
  unit: 'EA', licence: 'EA', license: 'EA', case: 'CS', roll: 'RO',
  ream: 'RM', bottle: 'BO', carton: 'CT', kg: 'KGM', litre: 'LTR',
  month: 'MON', year: 'ANN', day: 'DAY', hour: 'HUR',
};

// Catalogue → UNSPSC segment/family. Real codes from the public taxonomy.
// Catalogue → UNSPSC segment/family. Real codes from the public taxonomy,
// matched to the six catalogues that actually exist. Guessing at a catalogue id
// and letting it fall through to "office supplies" would classify safety
// equipment as stationery, which is worse than no code at all.
const UNSPSC_BY_CATALOGUE = {
  'catering-pantry': '50000000',  // Food, Beverage and Tobacco Products
  furniture: '56100000',          // Furniture: accommodation, office, institution
  'it-equipment': '43210000',     // Computer Equipment and Accessories
  'office-supplies': '44120000',  // Office supplies
  'print-stationery': '14110000', // Paper products
  'safety-ppe': '46180000',       // Personal safety and protection
};


const items = await sql.query(
  'SELECT id, name, unit, catalogue_id, supplier_id, commodity_code, supplier_part_id, unit_of_measure_code FROM catalogue_items ORDER BY id');

if (items.length === 0) { console.log('No catalogue items.'); process.exit(0); }

const unmappedUnits = new Set();
const unmappedCatalogues = new Set();
const updates = [];

for (const item of items) {
  const unitWord = String(item.unit ?? 'each').trim().toLowerCase();
  const uom = UOM[unitWord];
  if (!uom) unmappedUnits.add(unitWord);

  const unspsc = UNSPSC_BY_CATALOGUE[String(item.catalogue_id ?? '')];
  // A catalogue with no mapping is left uncoded on purpose. A wrong
  // classification travels downstream and is acted on; a missing one is caught
  // by the readiness check before the order goes anywhere.
  if (!unspsc) unmappedCatalogues.add(String(item.catalogue_id ?? '(none)'));

  // Supplier prefix + item id: the shape a real catalogue feed uses, without
  // pretending to be a real part number.
  const partId = `${String(item.supplier_id ?? 'SUP').replace(/[^A-Z0-9]/gi, '')}-${item.id}`;

  updates.push({
    id: item.id,
    supplier_part_id: item.supplier_part_id ?? partId,
    unit_of_measure_code: item.unit_of_measure_code ?? uom ?? 'EA',
    commodity_code: item.commodity_code ?? unspsc ?? null,
  });
}

for (const unit of unmappedUnits) console.log(`  note: unit "${unit}" has no UN/CEFACT mapping — defaulting to EA`);
for (const cat of unmappedCatalogues) console.log(`  WARNING: catalogue "${cat}" has no UNSPSC mapping — its items are left uncoded rather than misclassified`);
console.log(`\n${updates.length} catalogue item(s) to complete.`);

if (DRY) {
  for (const u of updates.slice(0, 8)) console.log(`  ${u.id}: part ${u.supplier_part_id} · uom ${u.unit_of_measure_code} · unspsc ${u.commodity_code}`);
  if (updates.length > 8) console.log(`  … and ${updates.length - 8} more`);
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

await sql.transaction(updates.map((u) => sql.query(
  `UPDATE catalogue_items
   SET supplier_part_id = $2, unit_of_measure_code = $3, commodity_code = $4
   WHERE id = $1`,
  [u.id, u.supplier_part_id, u.unit_of_measure_code, u.commodity_code])));

const [remaining] = await sql.query(`
  SELECT count(*) FILTER (WHERE supplier_part_id IS NULL)::int      AS no_part,
         count(*) FILTER (WHERE unit_of_measure_code IS NULL)::int  AS no_uom,
         count(*) FILTER (WHERE commodity_code IS NULL)::int        AS no_code
  FROM catalogue_items`);
console.log(`\nDone. Missing after: part ${remaining.no_part}, uom ${remaining.no_uom}, commodity ${remaining.no_code}.`);
