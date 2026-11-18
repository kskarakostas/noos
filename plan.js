/* Η σχολική μας γωνιά: class plan v2 (fallback defaults for the per-subject schedule)
   Published UNENCRYPTED next to engine/ (tools/build_secure.py copies it as is): page ids, subject keys and dates only,
   never titles, labels, names or school content.
   Per kid key, then per subject key (both as in catalog.js):
     current  optional: the unit id the class is on now in that subject (a unit is the id of its base chapter page,
              the `unit` field in catalog.js); units before it are done, the next one upcoming, the rest hidden
     pages    optional: {pageId: {test}}, test = the default test date as 'YYYY-MM-DD'
   The teaching order is the catalog's unit order; this file does not repeat it. A schedule set from the hub (the cloud
   or its cached copy) wins over `current` here. A subject with no `current` is dormant and shown as without a plan.
   The old format (per kid `order`, `current`, `pages` with `from`/`test`) still loads; the per-subject schedule reads
   only its test dates and treats it as dormant. */
window.PLAN = {
 "kids": {
  "tot5": {
   "subjects": {
    "fysiki": {},
    "mathimatika": {},
    "istoria": {}
   }
  },
  "tot3": {
   "subjects": {
    "mathimatika": {}
   }
  }
 }
};
