import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "");
}

export async function POST(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (session.role !== "parent") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    if (!studentId) {
      return NextResponse.json({ success: false, error: "studentId es obligatorio" }, { status: 400 });
    }

    const db = getAdminDb();
    const studentRef = db.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      return NextResponse.json({ success: false, error: "Alumno no encontrado" }, { status: 404 });
    }

    const student = studentSnap.data();
    const sessionPhone = normalizePhone(session.phone);
    const studentPhone = normalizePhone(student.parentPhone);
    if (!sessionPhone || !studentPhone || sessionPhone !== studentPhone) {
      return NextResponse.json({
        success: false,
        error: "El teléfono autenticado no coincide con el alumno registrado"
      }, { status: 403 });
    }

    if (student.parentUid && student.parentUid !== session.uid) {
      return NextResponse.json({
        success: false,
        error: "El alumno ya está vinculado a otra cuenta de acudiente"
      }, { status: 409 });
    }

    const userRef = db.collection("users").doc(session.uid);
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(studentRef, {
      studentId,
      parentUid: session.uid,
      parentEmail: session.email || student.parentEmail || "",
      updatedAt: now
    }, { merge: true });

    batch.set(userRef, {
      uid: session.uid,
      phone: session.phone || student.parentPhone || "",
      role: "parent",
      studentIds: FieldValue.arrayUnion(studentId),
      updatedAt: now
    }, { merge: true });

    const paymentsSnap = await db.collection("payments").where("studentId", "==", studentId).get();
    paymentsSnap.forEach((paymentDoc) => {
      const payment = paymentDoc.data();
      if (!payment.parentUid) {
        batch.set(paymentDoc.ref, {
          parentUid: session.uid,
          updatedAt: now
        }, { merge: true });
      }
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      studentId,
      parentUid: session.uid
    });
  } catch (error) {
    console.error("Error al vincular padre y alumno:", error);
    return NextResponse.json({
      success: false,
      error: "No fue posible vincular el alumno con la cuenta del acudiente"
    }, { status: 500 });
  }
}
