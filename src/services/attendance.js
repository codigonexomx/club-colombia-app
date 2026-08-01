// src/services/attendance.js

import { isDemoActive } from "./resolver";
import * as DemoAttendance from "@/demo/attendance";
import * as FirebaseAttendance from "./firebase/attendance";

export const AttendanceService = {
  getAttendanceHistory: (studentId, studentName) => {
    return isDemoActive() 
      ? DemoAttendance.getAttendanceHistory(studentId, studentName)
      : FirebaseAttendance.getAttendanceHistory(studentId, studentName);
  },

  subscribeAttendanceHistory: (studentId, studentName, callback) => {
    return isDemoActive()
      ? DemoAttendance.subscribeAttendanceHistory(studentId, studentName, callback)
      : FirebaseAttendance.subscribeAttendanceHistory(studentId, studentName, callback);
  },

  subscribeEvaluations: (studentName, callback) => {
    return isDemoActive()
      ? DemoAttendance.subscribeEvaluations(studentName, callback)
      : FirebaseAttendance.subscribeEvaluations(studentName, callback);
  },

  subscribeDrills: (callback) => {
    return isDemoActive()
      ? DemoAttendance.subscribeDrills(callback)
      : FirebaseAttendance.subscribeDrills(callback);
  }
};
export default AttendanceService;
