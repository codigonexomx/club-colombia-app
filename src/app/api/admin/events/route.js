import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { EventRequestError, getAllEvents } from "@/lib/serverEvents";
import { buildAudienceFromCategory, DEFAULT_EVENT_TIMEZONE, normalizeEventAudience } from "@/lib/eventModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEventInput(body) {
  let audience;
  try {
    audience = normalizeEventAudience(body.audience);
  } catch (error) {
    throw new EventRequestError(error.message, 400);
  }

  return {
    title: typeof body.title === "string" ? body.title.trim() : "",
    type: typeof body.type === "string" && body.type.trim() ? body.type.trim() : "training",
    date: typeof body.date === "string" ? body.date.trim() : "",
    time: typeof body.time === "string" ? body.time.trim() : "",
    location: typeof body.location === "string" ? body.location.trim() : "",
    category: typeof body.category === "string" ? body.category.trim() : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    published: typeof body.published === "boolean" ? body.published : undefined,
    audience,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    timezone: typeof body.timezone === "string" ? body.timezone.trim() : undefined
  };
}

function validateEventInput(event) {
  if (!event.title || !event.date || !event.time) {
    throw new EventRequestError("Título, fecha y hora son obligatorios", 400);
  }
}

export async function GET(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({ success: true, events: await getAllEvents() });
  } catch (error) {
    console.error("Error al leer eventos administrativos:", error);
    return NextResponse.json({ success: false, error: "No fue posible cargar los eventos" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const event = getEventInput(body);
    validateEventInput(event);

    const db = getAdminDb();
    const eventRef = eventId ? db.collection("events").doc(eventId) : db.collection("events").doc();
    const existingSnapshot = eventId ? await eventRef.get() : null;

    if (eventId && !existingSnapshot.exists) {
      throw new EventRequestError("El evento no existe", 404);
    }

    const existingEvent = existingSnapshot?.data() || {};
    const published = event.published ?? (eventId ? existingEvent.published !== false : true);
    const audience = event.audience || buildAudienceFromCategory(event.category);
    const payload = {
      title: event.title,
      type: event.type,
      date: event.date,
      time: event.time,
      location: event.location || "Club Colombia Cancha Principal",
      category: event.category,
      description: event.description,
      published,
      audience,
      timezone: event.timezone || existingEvent.timezone || DEFAULT_EVENT_TIMEZONE,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid
    };

    if (event.startsAt !== undefined) payload.startsAt = event.startsAt;
    if (event.endsAt !== undefined) payload.endsAt = event.endsAt;

    if (!eventId) {
      payload.createdAt = FieldValue.serverTimestamp();
      payload.createdBy = session.uid;
      payload.rsvps = {};
    }

    const wasPublished = existingEvent.published !== false;
    if (published && (!eventId || !wasPublished)) {
      payload.publishedAt = FieldValue.serverTimestamp();
      payload.publishedBy = session.uid;
    }

    await eventRef.set(payload, { merge: true });
    return NextResponse.json({ success: true, eventId: eventRef.id });
  } catch (error) {
    if (error instanceof EventRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("Error al guardar evento administrativo:", error);
    return NextResponse.json({ success: false, error: "No fue posible guardar el evento" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const eventId = request.nextUrl.searchParams.get("eventId")?.trim() || "";
    if (!eventId) {
      return NextResponse.json({ success: false, error: "eventId es obligatorio" }, { status: 400 });
    }

    const eventRef = getAdminDb().collection("events").doc(eventId);
    const eventSnapshot = await eventRef.get();
    if (!eventSnapshot.exists) {
      return NextResponse.json({ success: false, error: "El evento no existe" }, { status: 404 });
    }

    await eventRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar evento administrativo:", error);
    return NextResponse.json({ success: false, error: "No fue posible eliminar el evento" }, { status: 500 });
  }
}
