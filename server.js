// server.js
const express = require("express");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();

const INTERFACE_ORIGIN = "http://localhost:5500"; // the only browser origin allowed to call this API

/* ------------------------------------------------------------------ */
/* CORS — allow one exact origin, the methods and header we actually  */
/* use, and credentials (needed for the Task 4 cookie demo).          */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", INTERFACE_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204); // preflight response
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // lets /inspect accept form-encoded bodies too
app.use(cookieParser());

/* ------------------------------------------------------------------ */
/* In-memory data                                                      */
/* ------------------------------------------------------------------ */
let courses = [
  { code: "ICT461", name: "Web standards and HTTP fundamentals" },
  { code: "ICT452", name: "Database systems" },
  { code: "ICT463", name: "Systems analysis and design" },
];

const PROGRAMMES = [
  "bsc-computer-science",
  "bsc-information-technology",
  "bsc-software-engineering",
  "diploma-ict",
];
const COURSE_CODES = courses.map((c) => c.code);

const registrations = []; // { id, name, studentId, programme, course, registeredAt }
let nextId = 1;

function findRegistration(id) {
  return registrations.find((r) => r.id === Number(id));
}

function validateRegistrationBody(body, { partial = false } = {}) {
  const errors = [];
  const required = ["name", "studentId", "programme", "course"];

  for (const field of required) {
    if (!partial && !body?.[field]) errors.push(`${field} is required`);
  }
  if (body?.name !== undefined && typeof body.name === "string" && body.name.trim().length < 2) {
    errors.push("name must be at least 2 characters");
  }
  if (body?.studentId !== undefined && !/^[A-Za-z0-9-]{5,15}$/.test(String(body.studentId))) {
    errors.push("studentId must be 5-15 letters, numbers or hyphens");
  }
  if (body?.programme !== undefined && !PROGRAMMES.includes(body.programme)) {
    errors.push(`programme must be one of: ${PROGRAMMES.join(", ")}`);
  }
  if (body?.course !== undefined && !COURSE_CODES.includes(body.course)) {
    errors.push(`course must be one of: ${COURSE_CODES.join(", ")}`);
  }
  return errors;
}

function isDuplicate(studentId, course, ignoreId = null) {
  return registrations.some(
    (r) => r.studentId === studentId && r.course === course && r.id !== ignoreId
  );
}

/* ------------------------------------------------------------------ */
/* /inspect — diagnostic route (Task 2 step 3)                         */
/* ------------------------------------------------------------------ */
app.all("/inspect", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
});

/* ------------------------------------------------------------------ */
/* Task 3 — GET /api/courses with ETag + Cache-Control                 */
/* ------------------------------------------------------------------ */
function coursesEtag() {
  return `"${crypto.createHash("sha1").update(JSON.stringify(courses)).digest("hex")}"`;
}

app.get("/api/courses", (req, res) => {
  const etag = coursesEtag();
  res.set("Cache-Control", "public, max-age=60");
  res.set("ETag", etag);

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end(); // no body on 304
  }
  res.status(200).json(courses);
});

// Demo-only route to change course data so you can show the ETag change (Task 3 step 1).
// Design-only in a real system: renaming a course this way needs auth we don't have here.
app.patch("/api/courses/:code", (req, res) => {
  const course = courses.find((c) => c.code === req.params.code);
  if (!course) return res.status(404).json({ message: "Unknown course code" });
  if (!req.body?.name) return res.status(400).json({ message: "name is required" });
  course.name = req.body.name;
  res.set("Cache-Control", "no-store");
  res.status(200).json(course);
});

/* ------------------------------------------------------------------ */
/* Registrations — all responses are no-store (Task 3 step 1)          */
/* ------------------------------------------------------------------ */
app.use("/api/registrations", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// GET /api/registrations/:id -> 200 with the record, 404 if unknown
app.get("/api/registrations/:id", (req, res) => {
  const record = findRegistration(req.params.id);
  if (!record) return res.status(404).json({ message: "No registration with that ID" });
  res.status(200).json(record);
});

// POST /api/registrations -> 201 + Location, 400 invalid, 409 duplicate
app.post("/api/registrations", (req, res) => {
  const errors = validateRegistrationBody(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid registration data", errors });
  }

  const { name, studentId, programme, course } = req.body;
  if (isDuplicate(studentId, course)) {
    return res
      .status(409)
      .json({ message: "This student is already registered for that course." });
  }

  const record = {
    id: nextId++,
    name: name.trim(),
    studentId,
    programme,
    course,
    registeredAt: new Date().toISOString(),
  };
  registrations.push(record);

  res
    .status(201)
    .location(`/api/registrations/${record.id}`)
    .json({ message: "Registration received.", registration: record });
});

// PUT /api/registrations/:id -> 200, replaces every field; 400 invalid; 404 unknown; 409 duplicate
app.put("/api/registrations/:id", (req, res) => {
  const record = findRegistration(req.params.id);
  if (!record) return res.status(404).json({ message: "No registration with that ID" });

  const errors = validateRegistrationBody(req.body); // full replace: every field required
  if (errors.length > 0) {
    return res.status(400).json({ message: "Invalid registration data", errors });
  }

  const { name, studentId, programme, course } = req.body;
  if (isDuplicate(studentId, course, record.id)) {
    return res
      .status(409)
      .json({ message: "Another registration already uses that student ID and course." });
  }

  record.name = name.trim();
  record.studentId = studentId;
  record.programme = programme;
  record.course = course;
  record.updatedAt = new Date().toISOString();

  res.status(200).json(record);
});

// PATCH /api/registrations/:id -> 200, programme only; 400 invalid value; 404 unknown
app.patch("/api/registrations/:id", (req, res) => {
  const record = findRegistration(req.params.id);
  if (!record) return res.status(404).json({ message: "No registration with that ID" });

  if (!req.body || !("programme" in req.body)) {
    return res.status(400).json({ message: "Provide a programme to change." });
  }
  if (!PROGRAMMES.includes(req.body.programme)) {
    return res.status(400).json({ message: `programme must be one of: ${PROGRAMMES.join(", ")}` });
  }

  record.programme = req.body.programme;
  record.updatedAt = new Date().toISOString();
  res.status(200).json(record);
});

// DELETE /api/registrations/:id -> 204 no body; 404 unknown
app.delete("/api/registrations/:id", (req, res) => {
  const index = registrations.findIndex((r) => r.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ message: "No registration with that ID" });
  registrations.splice(index, 1);
  res.status(204).end(); // no body on 204
});

/* ------------------------------------------------------------------ */
/* Task 4 — cookie demonstration only, not a login system               */
/* ------------------------------------------------------------------ */
app.get("/api/demo-cookie", (req, res) => {
  res.cookie("demo_session", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // secure: true, // enable this once the site is served over HTTPS
  });
  res.set("Cache-Control", "no-store");
  res.json({ message: "Cookie set. Check Set-Cookie in Network, then call /api/demo-cookie/check." });
});

app.get("/api/demo-cookie/check", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ receivedCookie: req.cookies.demo_session ?? null });
});

/* ------------------------------------------------------------------ */
app.listen(3000, () => {
  console.log("API listening on http://localhost:3000");
});
