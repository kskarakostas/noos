/* Η σχολική μας γωνιά: class plan (timed release)
   Published UNENCRYPTED next to engine/ (tools/build_secure.py copies it as is): page ids and dates only,
   never titles, labels, names or school content.
   Per kid key (as in catalog.js):
     order    page ids in teaching order; every page of the kid, each once
     current  optional: the id, or list of ids, the class is on now (wins over `from`)
     pages    optional: {pageId: {from, test}}, dates as 'YYYY-MM-DD', both optional
              from  the day the page becomes current when `current` is not set
              test  the default test date
   With `order` only, the plan is dormant and the hub behaves as without it. */
window.PLAN = {
 "kids": {
  "tot5": {
   "order": [
    "dim5_fysiki_ch01",
    "dim5_fysiki_ch02",
    "dim5_fysiki_ch03",
    "dim5_mathimatika_ch10",
    "dim5_mathimatika_ch10b",
    "dim5_istoria_ch13"
   ]
  },
  "tot3": {
   "order": [
    "dim3_mathimatika_en01",
    "dim3_mathimatika_en01b",
    "dim3_mathimatika_en01c"
   ]
  }
 }
};
