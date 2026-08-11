import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { categoryNameToId, normalizeStudentName } from "@/lib/studentModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REUSABLE_STATUSES = new Set(["pending_payment", "pending_validation", "active"]);

async function getOptionalParentSession(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    return session?.role === "parent" ? session : null;
  } catch {
    return null;
  }
}

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function pickReusableStudent(candidates, parentUid) {
  const scored = candidates.map((candidate) => {
    const data = candidate.data();
    const hasParentMatch = Boolean(parentUid && data.parentUid === parentUid);
    const hasReusableStatus = REUSABLE_STATUSES.has(data.status);
    const hasPendingPayment = candidate.pendingPayments > 0;
    const hasNoOwner = !data.parentUid;

    let score = 0;
    if (hasParentMatch) score += 100;
    if (hasReusableStatus) score += 50;
    if (hasPendingPayment) score += 30;
    if (hasNoOwner) score += 10;
    if (data.status === "active") score += 8;
    if (data.status === "pending_validation") score += 6;
    if (data.status === "pending_payment") score += 4;

    return {
      candidate,
      score,
      updatedAt: getTimestampMillis(data.updatedAt),
      createdAt: getTimestampMillis(data.createdAt)
    };
  });

  scored.sort((a, b) =>
    b.score - a.score ||
    b.updatedAt - a.updatedAt ||
    b.createdAt - a.createdAt
  );

  const reusable = scored.find(({ candidate, score }) => {
    const data = candidate.data();
    if (data.parentUid && parentUid && data.parentUid !== parentUid) return false;
    return score > 0;
  });

  return reusable?.candidate || null;
}

export async function POST(request) {
  try {
    const session = await getOptionalParentSession(request);
    const body = await request.json();

    const studentName = typeof body.studentName === "string" ? body.studentName.trim() : "";
    const parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
    const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : "";
    let normalizedParentPhone;
    try {
      normalizedParentPhone = normalizeAndValidatePhone(body.parentPhone);
    } catch {
      return NextResponse.json({
        success: false,
        error: "El teléfono del acudiente no es válido."
      }, { status: 400 });
    }
    const normalizedName = normalizeStudentName(studentName);

    if (!studentName || !normalizedName || !parentName || !birthDate || !categoryName) {
      return NextResponse.json({
        success: false,
        error: "Los datos de inscripción están incompletos."
      }, { status: 400 });
    }

    const db = getAdminDb();
    const studentsSnap = await db
      .collection("students")
      .where("parentPhone", "==", normalizedParentPhone)
      .get();

    const candidates = [];
    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      if (student.normalizedName !== normalizedName) continue;
      if (student.parentUid && session?.uid && student.parentUid !== session.uid) continue;

      const paymentsSnap = await db
        .collection("payments")
        .where("studentId", "==", student.studentId || studentDoc.id)
        .get();
      const pendingPayments = paymentsSnap.docs.filter((paymentDoc) => paymentDoc.data().status === "pending");

      candidates.push({
        ref: studentDoc.ref,
        id: studentDoc.id,
        data: () => student,
        pendingPayments: pendingPayments.length
      });
    }

    const reusable = pickReusableStudent(candidates, session?.uid || "");
    if (reusable) {
      const reusableData = reusable.data();
      return NextResponse.json({
        success: true,
        created: false,
        studentId: reusableData.studentId || reusable.id,
        status: reusableData.status || "",
        billingStatus: reusableData.billingStatus || "",
        category: reusableData.category || "",
        categoryId: reusableData.categoryId || ""
      });
    }

    const studentRef = db.collection("students").doc();
    const studentId = studentRef.id;
    const categoryId = categoryNameToId(categoryName);
    const birthYear = new Date(birthDate).getFullYear();
    const ageNum = 2026 - birthYear;
    const now = FieldValue.serverTimestamp();

    await studentRef.set({
      studentId,
      name: studentName,
      normalizedName,
      age: ageNum || 9,
      parentName,
      parentPhone: normalizedParentPhone,
      parentEmail: session?.email || "",
      parentUid: session?.uid || "",
      categoryId,
      category: categoryName,
      assignedCoachUid: "",
      assignment: "automatic",
      status: "suspended",
      billingStatus: "pending_payment",
      healthStatus: "optimal",
      dueDays: 7,
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({
      success: true,
      created: true,
      studentId,
      status: "suspended",
      billingStatus: "pending_payment",
      category: categoryName,
      categoryId
    });
  } catch (error) {
    console.error("Error al crear o recuperar inscripción:", error);
    return NextResponse.json({
      success: false,
      error: "No fue posible iniciar la inscripción."
    }, { status: 500 });
  }
}
