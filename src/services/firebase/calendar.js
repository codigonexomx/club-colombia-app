// Acceso protegido al módulo de eventos real.

async function parseResponse(response) {
  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "No fue posible completar la operación de eventos");
  }

  return payload;
}

function getEventsUrl(options = {}) {
  if (options.includeUnpublished === true) {
    return "/api/admin/events";
  }

  const params = new URLSearchParams();
  if (options.studentId) {
    params.set("studentId", options.studentId);
  }

  const queryString = params.toString();
  return queryString ? `/api/events?${queryString}` : "/api/events";
}

async function fetchEvents(options = {}) {
  const response = await fetch(getEventsUrl(options), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin"
  });
  const payload = await parseResponse(response);
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function getCalendarEvents(categoryName = "all", options = {}) {
  void categoryName;
  return fetchEvents(options);
}

/**
 * Mantiene la API del hook actual con una sincronización periódica protegida.
 * El navegador ya no abre un listener directo sobre la colección events.
 */
export function subscribeCalendarEvents(categoryName, callback, options = {}) {
  void categoryName;
  let disposed = false;
  const pollIntervalMs = options.pollIntervalMs || 30000;

  const load = async () => {
    try {
      const list = await fetchEvents(options);
      if (!disposed) callback(list);
    } catch (error) {
      if (!disposed && typeof options.onError === "function") {
        options.onError(error);
      }
    }
  };

  load();
  const intervalId = setInterval(load, pollIntervalMs);

  return () => {
    disposed = true;
    clearInterval(intervalId);
  };
}

export async function updateRSVP(eventId, studentName, response, studentId = "") {
  if (!eventId || !studentId || !response) {
    return { success: false };
  }

  const httpResponse = await fetch("/api/events/rsvp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      eventId,
      studentId,
      studentName,
      response
    })
  });

  return parseResponse(httpResponse);
}
