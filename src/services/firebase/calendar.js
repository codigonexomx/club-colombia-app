// src/services/firebase/calendar.js

import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { adminListenerStarted, adminListenerStopped, adminStep } from "@/lib/adminDiagnostics";

const GENERAL_EVENT_CATEGORY = "Todas";

function shouldIncludeEvent(event, options = {}) {
  return options.includeUnpublished === true || event.published !== false;
}

function sortEventsByDateAndTime(events) {
  return events.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    const timeA = a.time || "";
    const timeB = b.time || "";
    return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
  });
}

/**
 * Obtiene los eventos del calendario real.
 */
export async function getCalendarEvents(categoryName = "all", options = {}) {
  const categories = categoryName && categoryName !== "all"
    ? Array.from(new Set([categoryName, GENERAL_EVENT_CATEGORY]))
    : [];
  const ref = categories.length > 0
    ? query(collection(db, "events"), where("category", "in", categories))
    : collection(db, "events");
  const querySnapshot = await getDocs(ref);
  const events = [];
  querySnapshot.forEach((doc) => {
    const event = { id: doc.id, ...doc.data() };
    if (shouldIncludeEvent(event, options)) {
      events.push(event);
    }
  });
  return sortEventsByDateAndTime(events);
}

/**
 * Suscribe en tiempo real a los eventos del calendario, opcionalmente filtrados por categoría.
 */
export function subscribeCalendarEvents(categoryName, callback, options = {}) {
  const categories = categoryName && categoryName !== "all"
    ? Array.from(new Set([categoryName, GENERAL_EVENT_CATEGORY]))
    : [];
  const ref = categories.length > 0
    ? query(collection(db, "events"), where("category", "in", categories))
    : collection(db, "events");

  adminListenerStarted("ADMIN_STEP_82_FIRESTORE_LISTENER_EVENTS_CREATED", { collection: "events", categoryName });
  const unsubscribe = onSnapshot(ref, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      const event = { id: doc.id, ...doc.data() };
      if (shouldIncludeEvent(event, options)) {
        list.push(event);
      }
    });
    sortEventsByDateAndTime(list);
    adminStep("ADMIN_STEP_83_FIRESTORE_LISTENER_EVENTS_SNAPSHOT", {
      docsCount: snapshot.size,
      mappedCount: list.length
    });
    callback(list);
  }, (error) => {
    if (typeof options.onError === "function") {
      options.onError(error);
    }
  });
  return () => {
    adminListenerStopped("ADMIN_STEP_84_FIRESTORE_LISTENER_EVENTS_UNSUBSCRIBE", { collection: "events", categoryName });
    unsubscribe();
  };
}

/**
 * Actualiza la confirmación RSVP de un evento real.
 */
export async function updateRSVP(eventId, studentName, response) {
  if (!eventId || !studentName) return { success: false };
  const docRef = doc(db, "events", eventId);
  await updateDoc(docRef, {
    [`rsvps.${studentName}`]: response
  });
  return { success: true };
}
