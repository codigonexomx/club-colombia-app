// src/services/coach.js

import { isDemoActive } from "./resolver";
import * as DemoCoach from "@/demo/coach";
import * as FirebaseCoach from "./firebase/coach";

export const CoachService = {
  getStudentsList: () => {
    return isDemoActive() 
      ? DemoCoach.getStudentsList() 
      : FirebaseCoach.getStudentsList();
  },

  subscribeStudentsList: (callback, onError) => {
    return isDemoActive()
      ? DemoCoach.subscribeStudentsList(callback, onError)
      : FirebaseCoach.subscribeStudentsList(callback, onError);
  },

  saveAttendanceReport: (records) => {
    return isDemoActive()
      ? DemoCoach.saveAttendanceReport(records)
      : FirebaseCoach.saveAttendanceReport(records);
  },

  saveTechnicalEvaluation: (evaluationData) => {
    return isDemoActive()
      ? DemoCoach.saveTechnicalEvaluation(evaluationData)
      : FirebaseCoach.saveTechnicalEvaluation(evaluationData);
  },

  getLatestEvaluationByStudentId: (studentId) => {
    return isDemoActive()
      ? DemoCoach.getLatestEvaluationByStudentId(studentId)
      : FirebaseCoach.getLatestEvaluationByStudentId(studentId);
  },

  updateStudentLevel: (studentId, level) => {
    return isDemoActive()
      ? DemoCoach.updateStudentLevel(studentId, level)
      : FirebaseCoach.updateStudentLevel(studentId, level);
  },

  markAttendance: (studentId, status) => {
    return isDemoActive() 
      ? DemoCoach.markAttendance(studentId, status) 
      : FirebaseCoach.markAttendance(studentId, status);
  }
};
export default CoachService;
