import { useState, useEffect, useCallback } from "react";
import { AttendanceService } from "@/services/attendance";

/**
 * Custom Hook para gestionar asistencias, evaluaciones y biblioteca multimedia (Drills).
 * @param {string} studentId
 * @param {string} studentName
 * @returns {{ data: { attendanceHistory: array, evalHistory: array, drills: array, metrics: object|null, coachNotes: string }, loading: boolean, error: any, refresh: function }}
 */
export function useAttendance(studentId, studentName) {
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [evalHistory, setEvalHistory] = useState([]);
  const [drills, setDrills] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [coachNotes, setCoachNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const history = await AttendanceService.getAttendanceHistory(studentId, studentName);
      setAttendanceHistory(history);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [studentId, studentName]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!studentId && !studentName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Suscribirse a historial de asistencias
    const unsubAttendance = AttendanceService.subscribeAttendanceHistory(studentId, studentName, (list) => {
      setAttendanceHistory(list);
    });

    // 2. Suscribirse a evaluaciones
    const unsubEval = AttendanceService.subscribeEvaluations(studentName, (list) => {
      setEvalHistory(list);
      if (list.length > 0) {
        const latest = list[list.length - 1];
        if (latest.metrics) setMetrics(latest.metrics);
        if (latest.tacticalNotes) setCoachNotes(latest.tacticalNotes);
      } else {
        setMetrics(null);
        setCoachNotes("");
      }
    });

    // 3. Suscribirse a Drills
    const unsubDrills = AttendanceService.subscribeDrills((list) => {
      setDrills(list);
      setLoading(false);
    });

    return () => {
      unsubAttendance();
      unsubEval();
      unsubDrills();
    };
  }, [studentId, studentName]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    data: {
      attendanceHistory,
      evalHistory,
      drills,
      metrics,
      coachNotes
    },
    loading,
    error,
    refresh: fetchAll
  };
}
export default useAttendance;
