# AI use log

Format per entry: **Prompt** (what you asked) → **Suggestion** (used/rejected,
and why) → **Test** (what you ran to check it) → **Learned** (what you now
understand that you didn't before).

Log every session where you used AI, including this one. For Checkpoint A
and Checkpoint B, do your individual sketch/prediction first, on paper or
in your own notes, before opening any AI tool — that work isn't something
AI can do for you, and it isn't logged here.

---

### Entry 1

**Prompt:** Asked Claude to implement the six-route API contract (Task 2),
ETag/Cache-Control caching (Task 3), CORS restricted to the interface
origin, and the cookie demo (Task 4) in `server.js`, plus a README with
the API contract table.

**Suggestion used:** The route implementations, the ETag hashing approach
(SHA-1 of the courses array), and the `no-store` header on every
registration response.

**Suggestion rejected/changed:** _(fill in anything you changed after
testing — e.g. if you adjusted a status code, a validation rule, or a
field name to match your own front end)._

**Test:** Ran each route with `curl` (see commands below) and confirmed
the status codes and headers matched the brief. Re-ran POST/PUT/DELETE
to check idempotency by hand.

**Learned:** _(write this in your own words once you've gone through the
code — e.g. why 204 responses can't have a JSON body, why `Vary: Origin`
matters when the allowed origin isn't `*`, why idempotency is about
server-side effect, not the repeated status code)._

```
curl -i http://localhost:3000/api/courses
curl -i http://localhost:3000/api/courses -H "If-None-Match: <etag from above>"
curl -i -X POST http://localhost:3000/api/registrations -H "Content-Type: application/json" -d '{"name":"A B","studentId":"MU-00001","programme":"bsc-computer-science","course":"ICT461"}'
curl -i -X PATCH http://localhost:3000/api/registrations/1 -H "Content-Type: application/json" -d '{"programme":"diploma-ict"}'
curl -i -X DELETE http://localhost:3000/api/registrations/1
```

---

### Entry 2

**Prompt:**

**Suggestion used:**

**Suggestion rejected/changed:**

**Test:**

**Learned:**

---

_Add further entries as you continue working (Task 3 CORS/caching
investigation, Task 4 cookies/security headers/waterfall). If a task
segment used no AI help at all, write "No AI used" for that segment
instead of leaving it blank._
