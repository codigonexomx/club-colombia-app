import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getVerifiedSessionFromRequest } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METRIC_KEYS = ["speed", "passing", "dribbling", "shooting", "physical", "discipline"];
const HEALTH_STATUSES = new Set(["optimal", "fatigue", "injured"]);

function isAllowedRole(role) {
  return role === "admin" || role === "coach";
}

function jsonError(message, status) {
  return NextResponse.json({ success: false, message }, { status });
}

function validateMetrics(metrics) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return { ok: false, message: "Las métricas de evaluación son obligatorias." };
  }

  const keys = Object.keys(metrics);
  const hasUnexpectedKey = keys.some((key) => !METRIC_KEYS.includes(key));
  if (hasUnexpectedKey || keys.length !== METRIC_KEYS.length) {
    return { ok: false, message: "Las métricas de evaluación no tienen el formato esperado." };
  }

  const normalized = {};
  for (const key of METRIC_KEYS) {
    const value = metrics[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 10) {
      return { ok: false, message: "Cada métrica debe ser un número entre 1 y 10." };
    }
    normalized[key] = value;
  }

  return { ok: true, metrics: normalized };
}

export async function POST(request) {
  try {
    const session = await getVerifiedSessionFromRequest(request);
    if (!session) {
      return jsonError("No autenticado", 401);
    }

    if (!isAllowedRole(session.role)) {
      return jsonError("No autorizado", 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("Payload JSON inválido", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Payload inválido", 400);
    }

    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const tacticalNotes = typeof body.tacticalNotes === "string" ? body.tacticalNotes : null;
    const healthStatus = typeof body.healthStatus === "string" ? body.healthStatus.trim() : "";
    const metricsResult = validateMetrics(body.metrics);

    if (!studentId) {
      return jsonError("studentId es obligatorio", 400);
    }

    if (typeof body.studentName !== "string") {
      return jsonError("studentName debe ser texto", 400);
    }

    if (!metricsResult.ok) {
      return jsonError(metricsResult.message, 400);
    }

    if (tacticalNotes === null) {
      return jsonError("tacticalNotes debe ser texto", 400);
    }

    if (!HEALTH_STATUSES.has(healthStatus)) {
      return jsonError("healthStatus no válido", 400);
    }

    const db = getAdminDb();
    const studentRef = db.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return jsonError("Alumno no encontrado", 404);
    }

    const student = studentSnap.data();
    if (student.status !== "active") {
      return jsonError("El alumno no está activo y no puede recibir una evaluación.", 409);
    }

    const evaluationRef = db.collection("evaluations").doc();
    const now = new Date();
    const timestamp = now.toISOString();
    const evaluationData = {
      studentId,
      studentName: student.name || body.studentName.trim(),
      metrics: metricsResult.metrics,
      tacticalNotes,
      healthStatus,
      date: now.toLocaleDateString("es-CO"),
      timestamp,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      coachId: session.uid
    };

    const batch = db.batch();
    batch.set(evaluationRef, evaluationData);
    batch.update(studentRef, {
      healthStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
    await batch.commit();

    return NextResponse.json({
      success: true,
      evaluationId: evaluationRef.id,
      studentId,
      healthStatus
    });
  } catch (error) {
    console.error("Error al guardar evaluación del entrenador:", error);
    return jsonError("No fue posible guardar la evaluación", 500);
  }
}
