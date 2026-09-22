// server.js
// ICT461 Course Registration API
//
// Deliberately built on Node's built-in http module (no Express) so every
// piece of HTTP handling -- routing, body parsing, status codes, headers --
// is explicit. This is the "server-side validation" companion to the
// index.html / app.js / api.js front end already in this folder.
//
// Run:   node server.js
// Port:  3000  (http://localhost:3000)

const http = require("http");
const { URL } = require("url");

const PORT = 3000;

/* ------------------------------------------------------------------ */
/*  "Database": in-memory only. Resets every time the process restarts. */
/* ------------------------------------------------------------------ */

let nextId = 1;
const registrations = []; // { id, name, studentId, programme, course, registeredAt, updatedAt }

// Course codes match the <select id="course"> options in index.html.
const COURSES = [
  { code: "ICT461", title: "Web standards and HTTP fundamentals" },
  { code: "ICT452", title: "Database systems" },
  { code: "ICT463", title: "Systems analysis and design" },
];
const COURSE_CODES = COURSES.map((c) => c.code);

// Programme values match the <select id="programme"> options in index.html.
const PROGRAMMES = [
  "bsc-computer-science",
  "bsc-information-technology",
  "bsc-software-engineering",
  "diploma-ict",
];

const STUDENT_ID_PATTERN = /^[A-Za-z0-9-]{5,15}$/;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function send(res, status, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  let payload = null;

  if (body !== undefined && body !== null) {
    payload = JSON.stringify(body);
    headers["Content-Type"] = "application/json; charset=utf-8";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  res.writeHead(status, headers);
  // 204 (and any body-less response) must not be given a body at all --
  // writeHead + end(payload) would still attach one, so guard explicitly.
  if (payload !== null && status !== 204 && status !== 304) {
    res.end(payload);
  } else {
    res.end();
  }
}

function notFound(res, message = "Resource not found.") {
  send(res, 404, { error: "Not Found", message });
}

function badRequest(res, message, details) {
  send(res, 400, { error: "Bad Request", message, ...(details ? { details } : {}) });
}

function conflict(res, message) {
  send(res, 409, { error: "Conflict", message });
}

/** Reads the full request body and returns it as a UTF-8 string. */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const LIMIT = 1e6; // 1 MB is plenty for this prototype

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        reject(Object.assign(new Error("Payload too large"), { code: "TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Reads and parses a request body according to its Content-Type, the way
 * express.json()/express.urlencoded() would. Returns:
 *   { raw, contentType, data, parseError }
 * data is `undefined` when the body is empty or the type is unsupported;
 * parseError is set when a JSON body could not be parsed.
 */
async function parseBody(req) {
  const raw = await readRawBody(req);
  const contentType = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();

  if (raw === "") {
    return { raw, contentType, data: undefined, parseError: null };
  }

  if (contentType === "application/json") {
    try {
      return { raw, contentType, data: JSON.parse(raw), parseError: null };
    } catch (err) {
      return { raw, contentType, data: undefined, parseError: "Malformed JSON body." };
    }
  }

  if (contentType === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(raw);
    return { raw, contentType, data: Object.fromEntries(params.entries()), parseError: null };
  }

  // Unrecognised/unsupported content type: hand back the raw text untouched.
  return { raw, contentType, data: raw, parseError: null };
}

/** Validates a full registration payload. Returns an array of error strings (empty = valid). */
function validateRegistration({ name, studentId, programme, course } = {}) {
  const errors = [];

  if (typeof name !== "string" || name.trim().length < 2) {
    errors.push("name must be a string of at least 2 characters.");
  }
  if (typeof studentId !== "string" || !STUDENT_ID_PATTERN.test(studentId)) {
    errors.push("studentId must be 5-15 letters, numbers or hyphens.");
  }
  if (typeof programme !== "string" || !PROGRAMMES.includes(programme)) {
    errors.push(`programme must be one of: ${PROGRAMMES.join(", ")}.`);
  }
  if (typeof course !== "string" || !COURSE_CODES.includes(course)) {
    errors.push(`course must be one of: ${COURSE_CODES.join(", ")}.`);
  }
  return errors;
}

function findDuplicate(studentId, course, ignoreId = null) {
  return registrations.find(
    (r) => r.id !== ignoreId && r.studentId === studentId && r.course === course
  );
}

function toPublic(record) {
  // Currently every field is public; kept as a seam in case internal-only
  // fields (audit flags, etc.) get added later.
  return { ...record };
}

/* ------------------------------------------------------------------ */
/*  CORS                                                               */
/*  The front end is served separately (e.g. Live Server on :5500),    */
/*  so the browser treats every request to :3000 as cross-origin.      */
/* ------------------------------------------------------------------ */

function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Max-Age", "600");
}

/* ------------------------------------------------------------------ */
/*  Route table                                                        */
/*  Path params are matched with a tiny regex-based router so the      */
/*  whole thing works without any framework.                           */
/* ------------------------------------------------------------------ */

const ID_ROUTE = /^\/api\/registrations\/([^/]+)$/;

function parseIdParam(raw, res) {
  // Student-facing ids are positive integers assigned by this server.
  // Anything else is a malformed identifier, not an "unknown" one.
  if (!/^\d+$/.test(raw)) {
    badRequest(res, `Invalid id "${raw}". Registration ids are positive integers.`);
    return null;
  }
  return Number(raw);
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  // Preflight requests never carry a body and always expect 204/2xx with
  // just the CORS headers above already set.
  if (req.method === "OPTIONS") {
    return send(res, 204, null);
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return badRequest(res, "Malformed request URL.");
  }
  const { pathname } = url;

  console.log(`${new Date().toISOString()} ${req.method} ${pathname}${url.search}`);

  try {
    /* ---- /inspect: diagnostic echo route (see README section 3) ---- */
    if (pathname === "/inspect") {
      const { raw, contentType, data, parseError } = await parseBody(req);
      return send(res, 200, {
        method: req.method,
        path: pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        accept: req.headers["accept"] || null,
        contentType: req.headers["content-type"] || null,
        acceptMatchesContentType:
          !!req.headers["accept"] &&
          !!req.headers["content-type"] &&
          req.headers["accept"].includes(contentType),
        bodyRaw: raw,
        body: parseError ? null : data,
        bodyParseError: parseError,
      });
    }

    /* ---- GET /api/courses ---- */
    if (pathname === "/api/courses") {
      if (req.method === "GET") {
        return send(res, 200, COURSES);
      }
      // Real, implemented failure: wrong verb on a read-only resource.
      res.setHeader("Allow", "GET, OPTIONS");
      return send(res, 405, { error: "Method Not Allowed", message: "Use GET for /api/courses." });
    }

    /* ---- /api/registrations (collection: POST) ---- */
    if (pathname === "/api/registrations") {
      if (req.method === "POST") {
        const { data, parseError } = await parseBody(req);
        if (parseError) return badRequest(res, parseError);
        if (data === undefined || typeof data !== "object") {
          return badRequest(res, "Request body must be a JSON object.");
        }

        const errors = validateRegistration(data);
        if (errors.length > 0) return badRequest(res, "Validation failed.", errors);

        const studentId = data.studentId;
        const course = data.course;
        if (findDuplicate(studentId, course)) {
          return conflict(res, "This student is already registered for that course.");
        }

        const record = {
          id: nextId++,
          name: data.name.trim(),
          studentId,
          programme: data.programme,
          course,
          registeredAt: new Date().toISOString(),
        };
        registrations.push(record);

        return send(res, 201, toPublic(record), { Location: `/api/registrations/${record.id}` });
      }

      res.setHeader("Allow", "POST, OPTIONS");
      return send(res, 405, { error: "Method Not Allowed", message: "Use POST for /api/registrations." });
    }

    /* ---- /api/registrations/:id (item: GET, PUT, PATCH, DELETE) ---- */
    const idMatch = pathname.match(ID_ROUTE);
    if (idMatch) {
      const id = parseIdParam(idMatch[1], res);
      if (id === null) return; // 400 already sent

      if (req.method === "GET") {
        const record = registrations.find((r) => r.id === id);
        if (!record) return notFound(res, `No registration with id ${id}.`);
        return send(res, 200, toPublic(record));
      }

      if (req.method === "PUT") {
        const record = registrations.find((r) => r.id === id);
        if (!record) return notFound(res, `No registration with id ${id}.`);

        const { data, parseError } = await parseBody(req);
        if (parseError) return badRequest(res, parseError);
        if (data === undefined || typeof data !== "object") {
          return badRequest(res, "Request body must be a JSON object.");
        }

        const errors = validateRegistration(data);
        if (errors.length > 0) return badRequest(res, "Validation failed.", errors);

        const dup = findDuplicate(data.studentId, data.course, id);
        if (dup) return conflict(res, "Another registration already uses that student ID and course.");

        record.name = data.name.trim();
        record.studentId = data.studentId;
        record.programme = data.programme;
        record.course = data.course;
        record.updatedAt = new Date().toISOString();

        return send(res, 200, toPublic(record));
      }

      if (req.method === "PATCH") {
        const record = registrations.find((r) => r.id === id);
        if (!record) return notFound(res, `No registration with id ${id}.`);

        const { data, parseError } = await parseBody(req);
        if (parseError) return badRequest(res, parseError);
        if (data === undefined || typeof data !== "object") {
          return badRequest(res, "Request body must be a JSON object.");
        }

        const keys = Object.keys(data);
        if (keys.length !== 1 || keys[0] !== "programme") {
          return badRequest(res, "PATCH only accepts a single \"programme\" field.");
        }
        if (typeof data.programme !== "string" || !PROGRAMMES.includes(data.programme)) {
          return badRequest(res, `programme must be one of: ${PROGRAMMES.join(", ")}.`);
        }

        record.programme = data.programme;
        record.updatedAt = new Date().toISOString();

        return send(res, 200, toPublic(record));
      }

      if (req.method === "DELETE") {
        const index = registrations.findIndex((r) => r.id === id);
        if (index === -1) return notFound(res, `No registration with id ${id}.`);

        registrations.splice(index, 1);
        return send(res, 204, null);
      }

      res.setHeader("Allow", "GET, PUT, PATCH, DELETE, OPTIONS");
      return send(res, 405, {
        error: "Method Not Allowed",
        message: "Use GET, PUT, PATCH or DELETE for /api/registrations/:id.",
      });
    }

    /* ---- Nothing matched ---- */
    return notFound(res, `No route for ${req.method} ${pathname}.`);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Internal Server Error", message: "Unexpected server error." });
  }
});

server.listen(PORT, () => {
  console.log(`ICT461 Course Registration API listening on http://localhost:${PORT}`);
});