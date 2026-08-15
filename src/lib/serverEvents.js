import { getAdminDb } from "@/lib/firebaseAdmin";
import { eventMatchesStudentAudience, isEventPublished } from "@/lib/eventModel";

const PUBLIC_EVENT_FIELDS = [
  "id",
  "title",
  "type",
  "date",
  "time",
  "location",
  "category",
  "description",
  "published",
  "audience",
  "startsAt",
  "endsAt",
  "timezone",
  "rsvps"
];

export class EventRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function serializeValue(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }

  return value;
}

function sortEvents(events) {
  return events.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    const timeA = a.time || "";
    const timeB = b.time || "";
    return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
  });
}

export function serializeEvent(snapshot, options = {}) {
  const data = snapshot.data();
  const event = {
    id: snapshot.id,
    ...serializeValue(data)
  };

  if (options.includeRsvps === false) {
    delete event.rsvps;
  } else if (Object.prototype.hasOwnProperty.call(options, "rsvpStudentName")) {
    const response = data.rsvps?.[options.rsvpStudentName];
    event.rsvps = response && options.rsvpStudentName
      ? { [options.rsvpStudentName]: response }
      : {};
  }

  if (options.publicOnly) {
    return Object.fromEntries(PUBLIC_EVENT_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(event, field))
      .map((field) => [field, event[field]]));
  }

  return event;
}

export async function getParentStudent(session, studentId) {
  if (session?.role !== "parent") {
    throw new EventRequestError("No autorizado", 403);
  }

  if (!studentId || !Array.isArray(session.studentIds) || !session.studentIds.includes(studentId)) {
    throw new EventRequestError("El alumno no pertenece a esta cuenta", 403);
  }

  const studentSnapshot = await getAdminDb().collection("students").doc(studentId).get();
  if (!studentSnapshot.exists || studentSnapshot.data()?.parentUid !== session.uid) {
    throw new EventRequestError("El alumno no pertenece a esta cuenta", 403);
  }

  return studentSnapshot;
}

export async function getEventsForParent(session, studentId) {
  const studentSnapshot = await getParentStudent(session, studentId);
  const student = studentSnapshot.data();
  const snapshots = await getAdminDb().collection("events").get();

  return sortEvents(snapshots.docs
    .map((snapshot) => ({ snapshot, data: snapshot.data() }))
    .filter(({ data }) => isEventPublished(data) && eventMatchesStudentAudience(data, student))
    .map(({ snapshot }) => serializeEvent(snapshot, {
      publicOnly: true,
      includeRsvps: true,
      rsvpStudentName: student.name || ""
    })));
}

export async function getPublishedEvents() {
  const snapshots = await getAdminDb().collection("events").get();
  return sortEvents(snapshots.docs
    .filter((snapshot) => isEventPublished(snapshot.data()))
    .map((snapshot) => serializeEvent(snapshot, { publicOnly: true, includeRsvps: false })));
}

export async function getAllEvents() {
  const snapshots = await getAdminDb().collection("events").get();
  return sortEvents(snapshots.docs.map((snapshot) => serializeEvent(snapshot)));
}

export async function assertParentEventAccess(session, eventId, studentId) {
  const studentSnapshot = await getParentStudent(session, studentId);
  const eventRef = getAdminDb().collection("events").doc(eventId);
  const eventSnapshot = await eventRef.get();

  if (!eventSnapshot.exists) {
    throw new EventRequestError("El evento no existe", 404);
  }

  const event = eventSnapshot.data();
  if (!isEventPublished(event) || !eventMatchesStudentAudience(event, studentSnapshot.data())) {
    throw new EventRequestError("El evento no está disponible para este alumno", 403);
  }

  return {
    eventRef,
    eventSnapshot,
    student: studentSnapshot.data()
  };
}
