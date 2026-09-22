// api.js: a small Fetch helper used by app.js.
// Change API_BASE_URL or the paths below if your Express routes differ.

export const API_BASE_URL = "http://localhost:3000";

/** Error type that always carries a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function messageForStatus(status) {
  if (status === 400 || status === 422) {
    return "The server did not accept these details. Check the form and try again.";
  }
  if (status === 404) {
    return "The registration service was not found. Check the API address.";
  }
  if (status === 409) {
    return "This student is already registered for that course.";
  }
  if (status >= 500) {
    return "The server had a problem. Try again in a moment.";
  }
  return `The request failed (status ${status}).`;
}

/**
 * Send a request and return the parsed JSON body (or null when there is none).
 * Rejects with an ApiError for network failures, timeouts and non-2xx responses.
 */
export async function fetchJson(path, { method = "GET", body, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      const hasBody = body !== undefined;
      response = await fetch(new URL(path, API_BASE_URL), {
        method,
        headers: {
          Accept: "application/json",
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ApiError("The server took too long to respond. Try again in a moment.");
      }
      // fetch() rejects with a TypeError for network and CORS failures.
      throw new ApiError("Could not reach the server. Check that the API is running on port 3000.");
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const serverMessage = [payload?.message, payload?.error].find(
        (value) => typeof value === "string" && value.trim() !== ""
      );
      throw new ApiError(serverMessage ?? messageForStatus(response.status), {
        status: response.status,
        details: payload,
      });
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

/** POST the registration form values to the API. */
export function registerStudent(details) {
  return fetchJson("/api/registrations", { method: "POST", body: details });
}
