// src/demo/attendance.js

import { getActiveDemoData } from "./demoData";
import { demoConfig } from "./demoConfig";

export async function getAttendanceHistory(studentId, studentName) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  const data = getActiveDemoData();
  return data.attendance;
}

export function subscribeAttendanceHistory(studentId, studentName, callback) {
  const data = getActiveDemoData();
  callback(data.attendance);
  return () => {};
}

export function subscribeEvaluations(studentId, studentName, callback) {
  const data = getActiveDemoData();
  // Retornar un historial ficticio con la última evaluación
  callback([
    {
      id: "demo-eval-1",
      studentId: studentId || data.student.studentId || data.student.id,
      studentName: studentName || data.student.name,
      timestamp: "2026-07-10T16:00:00Z",
      metrics: data.performance,
      tacticalNotes: data.performance.coachNotes
    }
  ]);
  return () => {};
}

export function subscribeDrills(callback) {
  callback([
    {
      id: "drill-1",
      title: "Control y Pase Corto",
      description: "Ejercicio dinámico de control orientado y pase de primera intención.",
      videoUrl: ""
    },
    {
      id: "drill-2",
      title: "Resistencia Interválica",
      description: "Entrenamiento cardiovascular de alta intensidad enfocado en arranques explosivos.",
      videoUrl: ""
    }
  ]);
  return () => {};
}
