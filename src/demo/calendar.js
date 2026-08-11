// src/demo/calendar.js

import { demoConfig } from "./demoConfig";

const demoEvents = [
  {
    id: "evt-1",
    title: "Entrenamiento Táctico",
    date: "2026-07-15",
    time: "16:00 - 17:30",
    location: "Cancha 3 - Principal",
    type: "practice",
    category: "Todas",
    published: true,
    rsvps: { "Carlos Gomez": "confirmed", "Juan Perez": "confirmed" }
  },
  {
    id: "evt-2",
    title: "Partido vs Héroes FC",
    date: "2026-07-18",
    time: "09:00",
    location: "Sede Norte",
    type: "match",
    category: "Todas",
    published: true,
    rsvps: { "Carlos Gomez": "confirmed" }
  }
];

function filterEvents(categoryName, options = {}) {
  return demoEvents.filter((event) => {
    const categoryMatches = !categoryName || categoryName === "all" || event.category === categoryName || event.category === "Todas";
    const publishedMatches = options.includeUnpublished === true || event.published !== false;
    return categoryMatches && publishedMatches;
  });
}

export async function getCalendarEvents(categoryName = "all", options = {}) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  return filterEvents(categoryName, options);
}

export function subscribeCalendarEvents(categoryName, callback, options = {}) {
  callback(filterEvents(categoryName, options));
  return () => {};
}

export async function updateRSVP(eventId, studentName, response) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  console.log(`[DEMO MODE] RSVP del estudiante ${studentName} para evento ${eventId}: ${response}`);
  return { success: true };
}
