import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOptionalParentSession(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    return session?.role === "parent" ? session : null;
  } catch {
    return null;
  }
}

function formatPaymentDate() {
  const now = new Date();
  return now.toLocaleDateString("es-MX") + " " + now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export async function POST(request) {
  try {
    const session = await getOptionalParentSession(request);
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const studentName = typeof body.studentName === "string" ? body.studentName.trim() : "";
    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const paymentType = typeof body.paymentType === "string" ? body.paymentType.trim() : "";
    const parentEmail = typeof body.parentEmail === "string" ? body.parentEmail.trim().toLowerCase() : "";
    const amount = Number(body.amount || 0);

    if (!studentId || !studentName || !categoryName || !paymentType || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Los datos del pago están incompletos."
      }, { status: 400 });
    }

    const db = getAdminDb();
    const studentRef = db.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      return NextResponse.json({
        success: false,
        error: "Alumno no encontrado."
      }, { status: 404 });
    }

    const student = studentSnap.data();
    if (student.parentUid && session?.uid && student.parentUid !== session.uid) {
      return NextResponse.json({
        success: false,
        error: "El alumno pertenece a otra cuenta de acudiente."
      }, { status: 403 });
    }

    const paymentsSnap = await db.collection("payments").where("studentId", "==", studentId).get();
    const existingPending = paymentsSnap.docs.find((paymentDoc) => {
      const payment = paymentDoc.data();
      return payment.status === "pending" &&
        Number(payment.amount || 0) === amount &&
        (payment.paymentType || "") === paymentType;
    });

    if (existingPending) {
      const payment = existingPending.data();
      return NextResponse.json({
        success: true,
        created: false,
        paymentId: existingPending.id,
        studentId,
        status: payment.status || "pending"
      });
    }

    const now = FieldValue.serverTimestamp();
    const paymentRef = await db.collection("payments").add({
      studentName,
      studentId,
      parentUid: session?.uid || "",
      categoryId,
      categoryName,
      amount,
      paymentType,
      date: formatPaymentDate(),
      status: "pending",
      parentEmail,
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({
      success: true,
      created: true,
      paymentId: paymentRef.id,
      studentId,
      status: "pending"
    });
  } catch (error) {
    console.error("Error al registrar pago de inscripción:", error);
    return NextResponse.json({
      success: false,
      error: "No fue posible registrar el pago."
    }, { status: 500 });
  }
}
