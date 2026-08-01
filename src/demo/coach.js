// src/demo/coach.js

import { getActiveDemoData } from "./demoData";
import { demoConfig } from "./demoConfig";

export async function getStudentsList() {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  const data = getActiveDemoData();
  return data.students;
}

export function subscribeStudentsList(callback) {
  const data = getActiveDemoData();
  callback(data.students);
  return () => {};
}

export async function saveAttendanceReport(records) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  console.log("[DEMO MODE] Planilla de asistencia guardada:", records);
  return { success: true };
}

export async function saveTechnicalEvaluation(evaluationData) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  console.log("[DEMO MODE] Evaluación técnica guardada:", evaluationData);
  return { success: true };
}

export async function getLatestEvaluationByStudentId() {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  return null;
}

export async function updateStudentLevel(studentId, level) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  console.log(`[DEMO MODE] Nivel actualizado para ${studentId}: ${level || "sin nivel"}`);
  return { success: true };
}

export async function markAttendance(studentId, status) {
  await new Promise((resolve) => setTimeout(resolve, demoConfig.behavior.simulatedLatency));
  console.log(`[DEMO MODE] Asistencia individual registrada para ${studentId}: ${status}`);
  return { success: true };
}
