import { NextResponse } from "next/server";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";
import { EventRequestError, getEventsForParent, getPublishedEvents } from "@/lib/serverEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const studentId = request.nextUrl.searchParams.get("studentId") || "";
    const events = session.role === "parent"
      ? await getEventsForParent(session, studentId)
      : await getPublishedEvents();

    return NextResponse.json({ success: true, events });
  } catch (error) {
    if (error instanceof EventRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }

    console.error("Error al leer eventos publicados:", error);
    return NextResponse.json({ success: false, error: "No fue posible cargar los eventos" }, { status: 500 });
  }
}
