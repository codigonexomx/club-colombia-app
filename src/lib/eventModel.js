/**
 * Contrato común del módulo de eventos.
 *
 * Esta capa define invariantes compatibles con los documentos actuales y
 * prepara los campos aditivos de la Fase 1.
 */
export const GENERAL_EVENT_CATEGORY = "Todas";
export const DEFAULT_EVENT_TIMEZONE = "America/Mexico_City";

export const EVENT_AUDIENCE_SCOPES = Object.freeze({
  ALL: "all",
  CATEGORIES: "categories"
});

/**
 * Eventos legacy sin published siguen siendo visibles.
 */
export function isEventPublished(event) {
  return event?.published !== false;
}

export function isGeneralEvent(event) {
  return event?.category === GENERAL_EVENT_CATEGORY;
}

export function eventCategoryToId(categoryName) {
  return String(categoryName || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-categoria";
}

export function normalizeEventAudience(audience) {
  if (!audience || typeof audience !== "object") return undefined;

  if (audience.scope === EVENT_AUDIENCE_SCOPES.ALL) {
    return { scope: EVENT_AUDIENCE_SCOPES.ALL, categoryIds: [] };
  }

  if (audience.scope === EVENT_AUDIENCE_SCOPES.CATEGORIES && Array.isArray(audience.categoryIds)) {
    const categoryIds = [...new Set(audience.categoryIds
      .filter((categoryId) => typeof categoryId === "string")
      .map((categoryId) => categoryId.trim())
      .filter(Boolean))];

    if (categoryIds.length > 0) {
      return { scope: EVENT_AUDIENCE_SCOPES.CATEGORIES, categoryIds };
    }
  }

  throw new Error("La audiencia del evento no es válida");
}

export function buildAudienceFromCategory(categoryName) {
  const normalizedCategory = String(categoryName || "").trim();
  if (!normalizedCategory || normalizedCategory === GENERAL_EVENT_CATEGORY) {
    return { scope: EVENT_AUDIENCE_SCOPES.ALL, categoryIds: [] };
  }

  return {
    scope: EVENT_AUDIENCE_SCOPES.CATEGORIES,
    categoryIds: [eventCategoryToId(normalizedCategory)]
  };
}

export function eventMatchesStudentAudience(event, student) {
  const categoryName = String(student?.category || "").trim();
  const categoryId = String(student?.categoryId || "").trim();
  const audience = event?.audience;

  if (audience?.scope === EVENT_AUDIENCE_SCOPES.ALL) return true;

  if (audience?.scope === EVENT_AUDIENCE_SCOPES.CATEGORIES && Array.isArray(audience.categoryIds)) {
    const studentCategoryId = categoryId || eventCategoryToId(categoryName);
    return audience.categoryIds.includes(studentCategoryId) || audience.categoryIds.includes(categoryName);
  }

  return event?.category === GENERAL_EVENT_CATEGORY || event?.category === categoryName;
}

export function sortEventsByDateAndTime(events) {
  return [...events].sort((a, b) => {
    const dateA = a?.date || "";
    const dateB = b?.date || "";
    const timeA = a?.time || "";
    const timeB = b?.time || "";
    return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
  });
}
