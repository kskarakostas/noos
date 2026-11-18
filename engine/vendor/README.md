# engine/vendor

Third-party code served from this site, never from a CDN (a children's site: no third-party requests).

## supabase.js

| Item | Value |
|---|---|
| Package | `@supabase/supabase-js` (npm) |
| Version | `2.119.0` (exact; published 4 Nov 2026) |
| Source file in the tarball | `package/dist/umd/supabase.js` (the browser UMD build; defines `window.supabase`) |
| Tarball integrity (npm registry `dist.integrity`) | `sha512-MKP49G6bJbPhvsZDegZ/IXS/ITApPgplDCF5+F65KZ5kIArS5Y90WFxwvWYALx2bsxdrSuHvkCiXHYr3dU8+sw==` |
| sha256 of the file as shipped in the tarball | `a867edbcfb029370aeec7223dd6180b560b621fbe3bc64c6584fb0369d1b7bce` |
| sha256 of `engine/vendor/supabase.js` as committed | `bb00c638c42dc404d072230d3875268f98d312812298094b57e5ede7d6ba99af` |
| The one change made to it | The single em dash character (U+2014) in a debug message of the library is written as its JavaScript escape (a backslash followed by `u2014`), because this repo allows no em dash in any file. The string sits in a template literal, so the running code is identical. Reproduce: `python3 -c "import sys;p=sys.argv[1];d=open(p,encoding='utf-8').read();open(p,'w',encoding='utf-8',newline='').write(d.replace(chr(0x2014),chr(92)+'u2014'))" engine/vendor/supabase.js` |
| Size | 219859 bytes as committed (219856 as shipped) |
| Licence | MIT, Copyright (c) 2020 Supabase: `LICENSE-supabase-js` (copied from `package/LICENSE`) |

Used only by `engine/sync.js`, which loads it at run time when a Supabase session exists on the device or the parent
signs in from the hub parent area, and only when `sync-config.js` holds a project URL and key. No page has a script tag
for it. Client options in use: `db.schema`, `auth.persistSession`, `auth.autoRefreshToken`, `auth.detectSessionInUrl`,
`auth.storageKey`, `auth.signInWithPassword`, `auth.getSession`, `auth.onAuthStateChange`, `auth.signOut({ scope: 'local' })`,
`from().select().eq().gt().in().limit()`, `from().insert(rows).select()` and `from().update(values).eq().select()` (the
conditional push: an `updated_at` filter, zero rows back meaning a conflict). Check them against the release
notes before an update.

## Updating

Run in a scratch directory (never in the repo), from the npm registry only:

```sh
cd "$(mktemp -d)"
npm pack @supabase/supabase-js@<exact version>            # writes supabase-supabase-js-<version>.tgz
npm view @supabase/supabase-js@<exact version> dist.integrity
openssl dgst -sha512 -binary supabase-supabase-js-<version>.tgz | base64 -w0   # must equal dist.integrity after "sha512-"
mkdir x && tar -xzf supabase-supabase-js-<version>.tgz -C x
cp x/package/dist/umd/supabase.js <repo>/engine/vendor/supabase.js
cp x/package/LICENSE <repo>/engine/vendor/LICENSE-supabase-js
sha256sum <repo>/engine/vendor/supabase.js
```

Then update the table above (version, date, integrity, sha256, size), run `node --test tests/*.test.js` and
`npm run smoke` (the smoke run serves a stub in place of this file; it checks the loading, not the library), sign in on one
device against the real project and check one pull and one push, and commit the file, the licence and this README together.
