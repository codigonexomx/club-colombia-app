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

function logServerError({ studentId = "", coachId = "", status, error = null, message = "" }) {
  console.log("[SERVER] ERROR", {
    studentId,
    coachId,
    status,
    code: error?.code || "",
    message: error?.message || message,
    stack: error?.stack || ""
  });
}

function jsonError(message, status, context = {}) {
  logServerError({
    studentId: context.studentId || "",
    coachId: context.coachId || "",
    status,
    error: context.error || null,
    message
  });
  console.log("[SERVER] Respuesta enviada", {
    success: false,
    status,
    message
  });
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
  let studentId = "";
  let coachId = "";

  try {
    console.log("[SERVER] Request recibida");
    const session = await getVerifiedSessionFromRequest(request);
    if (!session) {
      return jsonError("No autenticado", 401);
    }
    coachId = session.uid || "";
    console.log("[SERVER] Sesión validada", {
      coachId
    });

    if (!isAllowedRole(session.role)) {
      return jsonError("No autorizado", 403, { coachId });
    }
    console.log("[SERVER] Rol validado", {
      role: session.role
    });

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonError("Payload JSON inválido", 400, { coachId, error });
    }
    console.log("[SERVER] Payload recibido", {
      studentId: typeof body?.studentId === "string" ? body.studentId : "",
      studentName: typeof body?.studentName === "string" ? body.studentName : "",
      metrics: body?.metrics || null,
      healthStatus: typeof body?.healthStatus === "string" ? body.healthStatus : "",
      tacticalNotesLength: typeof body?.tacticalNotes === "string" ? body.tacticalNotes.length : null
    });

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Payload inválido", 400, { coachId });
    }

    studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const tacticalNotes = typeof body.tacticalNotes === "string" ? body.tacticalNotes : null;
    const healthStatus = typeof body.healthStatus === "string" ? body.healthStatus.trim() : "";
    const metricsResult = validateMetrics(body.metrics);

    if (!studentId) {
      return jsonError("studentId es obligatorio", 400, { studentId, coachId });
    }

    if (typeof body.studentName !== "string") {
      return jsonError("studentName debe ser texto", 400, { studentId, coachId });
    }

    if (!metricsResult.ok) {
      return jsonError(metricsResult.message, 400, { studentId, coachId });
    }

    if (tacticalNotes === null) {
      return jsonError("tacticalNotes debe ser texto", 400, { studentId, coachId });
    }

    if (!HEALTH_STATUSES.has(healthStatus)) {
      return jsonError("healthStatus no válido", 400, { studentId, coachId });
    }
    console.log("[SERVER] Payload validado", {
      studentId,
      metricKeys: Object.keys(metricsResult.metrics),
      healthStatus
    });

    const db = getAdminDb();
    const studentRef = db.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return jsonError("Alumno no encontrado", 404, { studentId, coachId });
    }
    console.log("[SERVER] Alumno encontrado", {
      studentId
    });

    const student = studentSnap.data();
    if (student.status !== "active") {
      return jsonError("El alumno no está activo y no puede recibir una evaluación.", 409, { studentId, coachId });
    }
    console.log("[SERVER] Alumno activo", {
      studentId
    });

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
    console.log("[SERVER] Batch creado", {
      evaluationId: evaluationRef.id,
      studentId
    });
    batch.set(evaluationRef, evaluationData);
    batch.update(studentRef, {
      healthStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log("[SERVER] Batch commit iniciado", {
      evaluationId: evaluationRef.id,
      studentId
    });
    await batch.commit();
    console.log("[SERVER] Batch commit exitoso", {
      evaluationId: evaluationRef.id,
      studentId
    });

    console.log("[SERVER] Respuesta enviada", {
      success: true,
      evaluationId: evaluationRef.id,
      studentId,
      healthStatus
    });
    return NextResponse.json({
      success: true,
      evaluationId: evaluationRef.id,
      studentId,
      healthStatus
    });
  } catch (error) {
    return jsonError("No fue posible guardar la evaluación", 500, { studentId, coachId, error });
  }
}
