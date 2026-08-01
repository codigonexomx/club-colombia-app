// src/services/firebase/attendance.js

import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { adminListenerStarted, adminListenerStopped, adminStep } from "@/lib/adminDiagnostics";

function recordMatchesStudent(record, studentId, studentName) {
  if (record?.studentId) return record.studentId === studentId;
  return !!studentName && (record?.studentName === studentName || record?.name === studentName);
}

function attendanceDocMatchesStudent(data, studentId, studentName) {
  if (data?.studentId) return data.studentId === studentId;
  return !!studentName && data?.studentName === studentName;
}

function normalizeAttendanceForStudent(docSnapshot, studentId, studentName = "") {
  const data = docSnapshot.data();
  const records = Array.isArray(data.records) ? data.records : null;

  if (!records) {
    return attendanceDocMatchesStudent(data, studentId, studentName)
      ? [{ id: docSnapshot.id, ...data }]
      : [];
  }

  return records
    .filter((record) => recordMatchesStudent(record, studentId, studentName))
    .map((record, index) => ({
      id: `${docSnapshot.id}-${record.studentId || record.name || index}`,
      attendanceId: docSnapshot.id,
      date: data.date,
      timestamp: data.timestamp,
      coachId: data.coachId || "",
      coachName: data.coachName || "",
      category: data.category || "",
      studentId: record.studentId || studentId,
      studentName: record.studentName || record.name || studentName,
      name: record.name || record.studentName || studentName,
      status: record.status || "",
      level: record.level || null,
      healthStatus: record.healthStatus || "",
      record,
      records: [record]
    }));
}

/**
 * Obtiene el historial de asistencia real del estudiante.
 */
export async function getAttendanceHistory(studentId, studentName = "") {
  if (!studentId) return [];
  const querySnapshot = await getDocs(collection(db, "attendance"));
  const attendance = [];
  querySnapshot.forEach((doc) => {
    attendance.push(...normalizeAttendanceForStudent(doc, studentId, studentName));
  });
  return attendance;
}

/**
 * Suscribe en tiempo real al historial de asistencia.
 */
export function subscribeAttendanceHistory(studentId, studentName, callback) {
  if (!studentId) {
    callback([]);
    return () => {};
  }
  return onSnapshot(collection(db, "attendance"), (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(...normalizeAttendanceForStudent(doc, studentId, studentName));
    });
    callback(list);
  });
}

/**
 * Suscribe en tiempo real a las evaluaciones de rendimiento.
 */
export function subscribeEvaluations(studentName, callback) {
  if (!studentName) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, "evaluations"), where("studentName", "==", studentName));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    // Ordenar cronológicamente
    list.sort((a, b) => {
      const tA = a.timestamp || "";
      const tB = b.timestamp || "";
      return tA.localeCompare(tB);
    });
    callback(list);
  });
}

/**
 * Suscribe en tiempo real a la biblioteca de ejercicios (Drills).
 */
export function subscribeDrills(callback) {
  const ref = collection(db, "drills");
  adminListenerStarted("ADMIN_STEP_85_FIRESTORE_LISTENER_DRILLS_CREATED", { collection: "drills" });
  const unsubscribe = onSnapshot(ref, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    adminStep("ADMIN_STEP_86_FIRESTORE_LISTENER_DRILLS_SNAPSHOT", {
      docsCount: snapshot.size,
      mappedCount: list.length
    });
    callback(list);
  });
  return () => {
    adminListenerStopped("ADMIN_STEP_87_FIRESTORE_LISTENER_DRILLS_UNSUBSCRIBE", { collection: "drills" });
    unsubscribe();
  };
}
