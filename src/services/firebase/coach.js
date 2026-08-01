// src/services/firebase/coach.js

import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, getDocs, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";

/**
 * Obtiene la lista de deportistas asignados de la base de datos real.
 * @returns {Promise<array>}
 */
export async function getStudentsList() {
  const querySnapshot = await getDocs(collection(db, "students"));
  const students = [];
  querySnapshot.forEach((doc) => {
    students.push({ id: doc.id, ...doc.data() });
  });
  return students;
}

/**
 * Suscribe en tiempo real a la lista de estudiantes.
 */
export function subscribeStudentsList(callback, onError) {
  return onSnapshot(collection(db, "students"), (snapshot) => {
    const studs = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      studs.push({ id: doc.id, studentId: data.studentId || doc.id, ...data });
    });
    callback(studs);
  }, (err) => {
    if (onError) onError(err);
  });
}

/**
 * Registra la planilla consolidada diaria de asistencia.
 */
export async function saveAttendanceReport(records) {
  const dateStr = new Date().toLocaleDateString("es-CO");
  const docRef = doc(db, "attendance", `attendance-${dateStr.replace(/\//g, "-")}`);
  await setDoc(docRef, {
    date: dateStr,
    category: "Sin información disponible",
    records: records.map(a => ({ name: a.name, status: a.status || "P" })),
    timestamp: new Date().toISOString()
  });
  return { success: true };
}

/**
 * Registra la evaluación técnica y actualiza el estatus de salud del estudiante.
 */
export async function saveTechnicalEvaluation(evaluationData) {
  const { studentId, studentName, metrics, tacticalNotes, healthStatus } = evaluationData;
  const batch = writeBatch(db);
  const evaluationRef = doc(collection(db, "evaluations"));
  const studentRef = doc(db, "students", studentId);

  batch.set(evaluationRef, {
    studentId,
    studentName,
    metrics,
    tacticalNotes,
    healthStatus,
    date: new Date().toLocaleDateString("es-CO"),
    timestamp: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.update(studentRef, {
    healthStatus,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  return { success: true };
}

export async function updateStudentLevel(studentId, level) {
  if (!studentId) throw new Error("studentId requerido");

  const response = await fetch("/api/students/level", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, level: level || "" })
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { error: "Respuesta no JSON del endpoint" };
  }

  if (!response.ok || !data.success) {
    const error = new Error(data?.error || "No fue posible actualizar el nivel.");
    error.status = response.status;
    error.statusText = response.statusText;
    error.endpointResponse = data;
    console.error("Error HTTP al actualizar nivel del alumno:", {
      studentId,
      requestedLevel: level || "",
      status: response.status,
      statusText: response.statusText,
      endpointResponse: data,
      error
    });
    throw error;
  }

  return data;
}

/**
 * Registra la asistencia en cancha individual (compatibilidad legacy).
 */
export async function markAttendance(studentId, status) {
  const today = new Date().toISOString().split("T")[0];
  const docRef = doc(db, "attendance", `${studentId}_${today}`);
  await setDoc(docRef, {
    studentId,
    status,
    date: today,
    timestamp: new Date().toISOString()
  });
  return { success: true };
}
