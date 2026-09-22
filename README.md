# ICT461 — Course Registration Portal

Mulungushi University course registration portal built for the ICT461 Web
standards and HTTP fundamentals lab. A static interface (`index.html`,
`styles.css`, `app.js`, `api.js`) talks over Fetch to an Express API
(`server.js`). All data is in-memory; there is no database and no real
authentication.

## Run it

1. Install dependencies once:
   ```
   npm install
   ```
2. Start the API (serves `http://localhost:3000`):
   ```
   npm start
   ```
3. Serve the interface folder on `http://localhost:5500` — e.g. VS Code
   Live Server, or:
   ```
   npx serve -l 5500 .
   ```
4. Open `http://localhost:5500` in the browser. Do not open `index.html`
   with `file://` — the interface origin must be exactly
   `http://localhost:5500` for the API's CORS rule to allow it.

## Project layout

```
index.html         semantic markup, the registration form
styles.css          Flexbox/Grid layout + media query (360px / 1366px)
api.js              Fetch helper (fetchJson, registerStudent, ApiError)
app.js              form handling, validation, localStorage, cookie demo
server.js           Express API (all 6 routes + /inspect + cookie demo)
package.json
```

## API contract

Base URL: `http://localhost:3000`

| Method | Route | Body | Success | Failure (implemented) | Failure (design-only) |
|---|---|---|---|---|---|
| GET | `/api/courses` | — | 200 JSON array. `ETag` + `Cache-Control: public, max-age=60`; `If-None-Match` match → 304 | — | 500 if the data store failed to load |
| GET | `/api/registrations/:id` | — | 200 JSON record | 404 unknown id | 400 if `:id` were not a plausible shape (not enforced — any string is looked up) |
| POST | `/api/registrations` | `{name, studentId, programme, course}` | 201 + `Location: /api/registrations/:id` | 400 invalid data, 409 duplicate studentId+course | 401/403 if registration required a logged-in session |
| PUT | `/api/registrations/:id` | full record, every field required | 200 replaced record | 400 invalid/missing field, 404 unknown id | 409 if the edit would collide with someone else's studentId+course (implemented too, see code) |
| PATCH | `/api/registrations/:id` | `{programme}` only | 200 updated record | 400 invalid programme value, 404 unknown id | 403 if only an advisor role could change programme |
| DELETE | `/api/registrations/:id` | — | 204, no body | 404 unknown id | 409 if deletion were blocked by a business rule (e.g. after grading opens) |

Every registration response also carries `Cache-Control: no-store` — this
data changes per request and must never be served from a cache.

`GET/POST/PATCH /inspect` (or any method) echoes `method`, `path`, `query`,
`headers` and `body` — used to compare `Accept` vs `Content-Type` and to
send form-encoded vs JSON bodies.

`GET /api/demo-cookie` and `GET /api/demo-cookie/check` are a Task 4
cookie demonstration only — not a login system.

### Idempotency note

Repeating **POST** creates (or here, rejects as 409) a new record each
time — it is not idempotent. Repeating **PUT** with the same body leaves
the server in the same state after the second call as after the first —
it is idempotent, even though both calls return 200. Repeating **DELETE**
removes the record once; the second call returns 404, not the original
204 — the *status code differs* between calls, but the *intended server
effect* ("this record should not exist") is unchanged, which is what
idempotency actually describes.

## Decision notes

- **CORS**: the API allows only `http://localhost:5500` (not `*`),
  because the cookie demo in Task 4 needs
  `Access-Control-Allow-Credentials: true`, and browsers refuse to combine
  a wildcard origin with credentials.
- **Caching**: only `GET /api/courses` is cacheable — course data changes
  rarely. Every registration response is `no-store` because it is
  per-student, mutable data that must never be served stale.
- **Validation**: the server re-checks everything the form already
  validates (required fields, student ID pattern, known programme/course
  values) — client-side validation is a UX convenience, not a security
  boundary. `curl`/Postman can bypass the form entirely.
- **IDs**: registrations get a server-assigned numeric `id`, separate from
  `studentId`, so PUT/PATCH/DELETE target a specific record even if a
  student's other fields change.

## AI use

See `AI-use.md`.

## Evidence

<!-- Add screenshots/notes here per the lab brief: 360px + 1366px layouts,
     keyboard-only completion, Network tab captures (successful POST,
     invalid POST, duplicate POST, missing record, 304 vs 200 on
     /api/courses, CORS failure + preflight, Set-Cookie/Cookie headers,
     waterfall before/after, Protocol column). Do not submit invented
     screenshots or results — capture your own from DevTools. -->

## Reflection

<!-- Each student: 100-word reflection — your contribution, one mistake,
     and how you verified the fix. -->
