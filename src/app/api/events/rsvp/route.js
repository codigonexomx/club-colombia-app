import { NextResponse } from "next/server";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { assertParentEventAccess, EventRequestError } from "@/lib/serverEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_RESPONSES = new Set(["confirmed", "declined"]);

export async function POST(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session || session.role !== "parent") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const response = typeof body.response === "string" ? body.response.trim() : "";

    if (!eventId || !studentId || !ALLOWED_RESPONSES.has(response)) {
      return NextResponse.json({ success: false, error: "Datos de RSVP inválidos" }, { status: 400 });
    }

    const { eventRef, student } = await assertParentEventAccess(session, eventId, studentId);
    const db = getAdminDb();

    await db.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(eventRef);
      if (!latestSnapshot.exists) {
        throw new EventRequestError("El evento no existe", 404);
      }

      const latestEvent = latestSnapshot.data();
      const rsvps = {
        ...(latestEvent.rsvps || {}),
        [student.name]: response
      };

      transaction.update(eventRef, { rsvps });
    });

    return NextResponse.json({ success: true, response });
  } catch (error) {
    if (error instanceof EventRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("Error al actualizar RSVP:", error);
    return NextResponse.json({ success: false, error: "No fue posible registrar la respuesta" }, { status: 500 });
  }
}
