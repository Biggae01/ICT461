import { registerStudent, ApiError, API_BASE_URL } from "./api.js";

const PROGRAMME_KEY = "ict461.programmePreference";
const SUBMIT_LABEL = "Submit registration";

const form = document.querySelector("#registration-form");
const submitButton = document.querySelector("#submit-button");
const statusRegion = document.querySelector("#status");
const errorRegion = document.querySelector("#error");
const programmeSelect = document.querySelector("#programme");
const courseSelect = document.querySelector("#course");
const fields = [...form.querySelectorAll("input, select")];

let isSubmitting = false;

/* ---------- Validation messages (keyed by field name, then by validity flag) ---------- */
const messages = {
  name: {
    valueMissing: "Enter your full name.",
    tooShort: "Your name needs at least 2 characters.",
  },
  studentId: {
    valueMissing: "Enter your student ID.",
    patternMismatch: "Use 5 to 15 letters, numbers or hyphens.",
  },
  programme: { valueMissing: "Choose your programme." },
  course: { valueMissing: "Choose a course." },
};

function validateField(field) {
  if (field.type === "text") {
    field.value = field.value.trim();
  }

  let message = "";
  if (!field.checkValidity()) {
    const flag = Object.keys(messages[field.name] ?? {}).find((key) => field.validity[key]);
    message = messages[field.name]?.[flag] ?? field.validationMessage;
  }

  const errorEl = document.getElementById(`${field.id}-error`);
  errorEl.textContent = message;          // textContent: never interpreted as HTML
  errorEl.hidden = message === "";
  field.setAttribute("aria-invalid", String(message !== ""));
  return message === "";
}

// Clear an error as soon as the person fixes the field.
for (const field of fields) {
  field.addEventListener("input", () => {
    if (field.getAttribute("aria-invalid") === "true") validateField(field);
  });
  field.addEventListener("change", () => {
    if (field.getAttribute("aria-invalid") === "true") validateField(field);
  });
}

/* ---------- Feedback helpers ---------- */
function clearFeedback() {
  statusRegion.replaceChildren();
  errorRegion.replaceChildren();
}

function showError(text) {
  statusRegion.replaceChildren();
  errorRegion.textContent = text;
}

function showConfirmation(values) {
  const heading = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = "Registration received.";
  heading.append(strong);

  const list = document.createElement("dl");
  list.className = "summary";
  for (const [term, detail] of values) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = detail;              // user input goes in as text, not markup
    list.append(dt, dd);
  }

  errorRegion.replaceChildren();
  statusRegion.replaceChildren(heading, list);
}

function setLoading(loading) {
  isSubmitting = loading;
  form.setAttribute("aria-busy", String(loading));
  // aria-disabled (not the disabled attribute) keeps keyboard focus on the button.
  submitButton.setAttribute("aria-disabled", String(loading));
  submitButton.classList.toggle("is-loading", loading);
  submitButton.textContent = loading ? "Submitting…" : SUBMIT_LABEL;
}

/* ---------- localStorage: programme preference only ---------- */
function readProgrammePreference() {
  try {
    return localStorage.getItem(PROGRAMME_KEY);
  } catch {
    return null;                          // storage blocked (private mode, policy)
  }
}

function writeProgrammePreference(value) {
  try {
    if (value) {
      localStorage.setItem(PROGRAMME_KEY, value);
    } else {
      localStorage.removeItem(PROGRAMME_KEY);
    }
  } catch {
    /* the form still works without storage */
  }
}

function restoreProgrammePreference() {
  const saved = readProgrammePreference();
  // Only apply a value that matches a real option.
  const isKnown = [...programmeSelect.options].some((o) => o.value !== "" && o.value === saved);
  if (isKnown) programmeSelect.value = saved;
}

programmeSelect.addEventListener("change", () => {
  writeProgrammePreference(programmeSelect.value);
});

/* ---------- Submit ---------- */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting) return;               // ignore repeat Enter presses while loading

  clearFeedback();

  const invalid = fields.filter((field) => !validateField(field));
  if (invalid.length > 0) {
    invalid[0].focus();
    showError(
      invalid.length === 1
        ? "Fix 1 field before submitting."
        : `Fix ${invalid.length} fields before submitting.`
    );
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const summary = [
    ["Name", data.name],
    ["Student ID", data.studentId],
    ["Programme", programmeSelect.selectedOptions[0].textContent],
    ["Course", courseSelect.selectedOptions[0].textContent],
  ];

  setLoading(true);
  statusRegion.textContent = "Submitting your registration…";

  try {
    await registerStudent(data);
    showConfirmation(summary);
    form.reset();
    restoreProgrammePreference();         // reset() clears the select; bring the preference back
  } catch (error) {
    showError(
      error instanceof ApiError
        ? error.message
        : "Something went wrong. Check your connection and try again."
    );
  } finally {
    setLoading(false);
  }
});

restoreProgrammePreference();

/* ---------- Task 4: cookie demonstration ---------- */
// Separate from the registration Fetch helper: this one needs credentials: "include"
// so the browser sends/stores the cookie, and the server allows one exact origin
// (not "*") plus Access-Control-Allow-Credentials: true to permit that.
const cookieSetButton = document.querySelector("#cookie-set-button");
const cookieCheckButton = document.querySelector("#cookie-check-button");
const cookieResult = document.querySelector("#cookie-result");

cookieSetButton?.addEventListener("click", async () => {
  try {
    const response = await fetch(new URL("/api/demo-cookie", API_BASE_URL), {
      credentials: "include",
    });
    const data = await response.json();
    cookieResult.textContent = data.message ?? "Cookie set.";
  } catch {
    cookieResult.textContent = "Could not reach the server.";
  }
});

cookieCheckButton?.addEventListener("click", async () => {
  try {
    const response = await fetch(new URL("/api/demo-cookie/check", API_BASE_URL), {
      credentials: "include",
    });
    const data = await response.json();
    cookieResult.textContent = data.receivedCookie
      ? `Server read the cookie back: ${data.receivedCookie}`
      : "No cookie was sent — click \"Set demo cookie\" first.";
  } catch {
    cookieResult.textContent = "Could not reach the server.";
  }
});
