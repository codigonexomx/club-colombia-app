import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";
import { normalizeAndValidatePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function compactUser(uid, userData, authUser = null, locatedBy = "") {
  return {
    uid,
    locatedBy,
    authExists: Boolean(authUser),
    phone: userData?.phone || authUser?.phoneNumber || "",
    email: userData?.email || authUser?.email || "",
    role: userData?.role || "",
    status: userData?.status || "",
    studentIds: Array.isArray(userData?.studentIds) ? userData.studentIds : []
  };
}

function compactStudent(docSnap, parentUid) {
  const data = docSnap.data();
  const existingParentUid = data.parentUid || "";
  return {
    documentId: docSnap.id,
    studentId: data.studentId || docSnap.id,
    name: data.name || "",
    status: data.status || "",
    billingStatus: data.billingStatus || "",
    parentUid: existingParentUid,
    parentPhone: data.parentPhone || "",
    parentEmail: data.parentEmail || "",
    canLink: !existingParentUid || existingParentUid === parentUid,
    conflict: Boolean(existingParentUid && existingParentUid !== parentUid)
  };
}

function compactPayment(docSnap) {
  const data = docSnap.data();
  return {
    paymentId: docSnap.id,
    studentId: data.studentId || "",
    resolvedStudentId: data.resolvedStudentId || "",
    studentName: data.studentName || "",
    parentUid: data.parentUid || "",
    parentEmail: data.parentEmail || "",
    status: data.status || "",
    isTest: data.isTest === true,
    excludedFromFinancialHistory: data.excludedFromFinancialHistory === true
  };
}

async function locateParent(identifierType, identifier) {
  const auth = getAdminAuth();
  const db = getAdminDb();

  if (identifierType === "uid") {
    const authUser = await auth.getUser(identifier);
    const userSnap = await db.collection("users").doc(identifier).get();
    return {
      uid: identifier,
      authUser,
      userSnap,
      normalizedPhone: authUser.phoneNumber || "",
      email: authUser.email || "",
      locatedBy: "uid"
    };
  }

  if (identifierType === "phone") {
    const normalizedPhone = normalizeAndValidatePhone(identifier);
    const authUser = await auth.getUserByPhoneNumber(normalizedPhone);
    const userSnap = await db.collection("users").doc(authUser.uid).get();
    return {
      uid: authUser.uid,
      authUser,
      userSnap,
      normalizedPhone,
      email: authUser.email || "",
      locatedBy: "phone"
    };
  }

  if (identifierType === "email") {
    const email = identifier.toLowerCase();
    const authUser = await auth.getUserByEmail(email);
    const userSnap = await db.collection("users").doc(authUser.uid).get();
    return {
      uid: authUser.uid,
      authUser,
      userSnap,
      normalizedPhone: authUser.phoneNumber || "",
      email,
      locatedBy: "email"
    };
  }

  throw new Error("INVALID_IDENTIFIER_TYPE");
}

async function addStudentSnap(map, snap) {
  if (snap.exists) map.set(snap.id, snap);
}

async function collectCandidateStudents(db, located) {
  const map = new Map();
  const userData = located.userSnap.exists ? located.userSnap.data() : {};
  const studentIds = Array.isArray(userData.studentIds) ? userData.studentIds : [];

  for (const studentId of studentIds) {
    await addStudentSnap(map, await db.collection("students").doc(studentId).get());
  }

  const byParentUid = await db.collection("students").where("parentUid", "==", located.uid).get();
  byParentUid.forEach((snap) => map.set(snap.id, snap));

  if (located.normalizedPhone) {
    const byPhone = await db.collection("students").where("parentPhone", "==", located.normalizedPhone).get();
    byPhone.forEach((snap) => map.set(snap.id, snap));
  }

  if (located.email) {
    const byEmail = await db.collection("students").where("parentEmail", "==", located.email).get();
    byEmail.forEach((snap) => map.set(snap.id, snap));
  }

  return [...map.values()];
}

async function collectPayments(db, located, students) {
  const map = new Map();
  for (const student of students) {
    const data = student.data();
    const studentId = data.studentId || student.id;
    const byStudent = await db.collection("payments").where("studentId", "==", studentId).get();
    byStudent.forEach((snap) => map.set(snap.id, snap));
  }

  const byParent = await db.collection("payments").where("parentUid", "==", located.uid).get();
  byParent.forEach((snap) => map.set(snap.id, snap));

  if (located.email) {
    const byEmail = await db.collection("payments").where("parentEmail", "==", located.email).get();
    byEmail.forEach((snap) => map.set(snap.id, snap));
  }

  return [...map.values()];
}

export async function POST(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { identifierType, identifier } = await request.json();
    if (!["uid", "phone", "email"].includes(identifierType) || !isNonEmptyString(identifier)) {
      return NextResponse.json({ success: false, error: "Identificador inválido" }, { status: 400 });
    }

    const db = getAdminDb();
    const located = await locateParent(identifierType, identifier.trim());
    const userData = located.userSnap.exists ? located.userSnap.data() : {};
    const candidateSnaps = await collectCandidateStudents(db, located);
    const students = candidateSnaps.map((snap) => compactStudent(snap, located.uid));
    const paymentSnaps = await collectPayments(db, located, candidateSnaps);
    const payments = paymentSnaps.map(compactPayment);

    const warnings = [];
    if (!located.userSnap.exists) warnings.push("Existe usuario Auth, pero no existe users/{uid}; la vinculación lo creará.");
    if (students.length > 1) warnings.push("Hay varios alumnos candidatos; selecciona explícitamente los correctos.");
    if (students.some((student) => student.status === "pending_validation")) warnings.push("Uno o más alumnos están pending_validation; la vinculación no cambiará su status.");
    if (students.some((student) => student.conflict)) warnings.push("Uno o más alumnos ya tienen otro parentUid; no se pueden vincular sin revisión.");
    if (payments.some((payment) => !payment.parentUid)) warnings.push("Hay pagos históricos sin parentUid que podrían completarse si seleccionas el alumno exacto.");

    return NextResponse.json({
      success: true,
      parent: compactUser(located.uid, userData, located.authUser, located.locatedBy),
      students,
      payments,
      warnings
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return NextResponse.json({ success: false, error: "Usuario Auth no encontrado" }, { status: 404 });
    }

    console.error("Error en diagnóstico de vinculación:", error.message);
    return NextResponse.json({ success: false, error: "No se pudo diagnosticar la cuenta padre" }, { status: 500 });
  }
}
