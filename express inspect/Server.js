const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow the front end (served separately, e.g. Live Server on :5500) to call this API.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Debug helper kept from the original scaffold.
app.all("/inspect", (req, res) => {
  res.json({
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
  });
});

// In-memory store is enough for coursework; swap for a real DB later if needed.
const registrations = [];

app.post("/api/registrations", (req, res) => {
  const { name, studentId, programme, course } = req.body ?? {};

  const missing = ["name", "studentId", "programme", "course"].filter(
    (field) => !req.body?.[field]
  );
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(", ")}` });
  }

  const alreadyRegistered = registrations.some(
    (r) => r.studentId === studentId && r.course === course
  );
  if (alreadyRegistered) {
    return res.status(409).json({ message: "This student is already registered for that course." });
  }

  const registration = { name, studentId, programme, course, registeredAt: new Date().toISOString() };
  registrations.push(registration);

  res.status(201).json({ message: "Registration received.", registration });
});

app.get("/api/registrations", (req, res) => {
  res.json(registrations);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});