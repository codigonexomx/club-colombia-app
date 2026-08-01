import { useState, useEffect, useCallback } from "react";
import { CoachService } from "@/services/coach";

/**
 * Custom Hook para gestionar las acciones del portal del entrenador en tiempo real.
 * @returns {{ data: array, loading: boolean, error: any, refresh: function, saveAttendance: function, saveEvaluation: function }}
 */
export function useCoach() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await CoachService.getStudentsList();
      setData(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = CoachService.subscribeStudentsList(
      (list) => {
        setData(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const saveAttendance = useCallback(async (records) => {
    setError(null);
    try {
      return await CoachService.saveAttendanceReport(records);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const saveEvaluation = useCallback(async (evaluationData) => {
    setError(null);
    try {
      return await CoachService.saveTechnicalEvaluation(evaluationData);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const updateStudentLevel = useCallback(async (studentId, level) => {
    setError(null);
    try {
      const result = await CoachService.updateStudentLevel(studentId, level);
      setData((prev) => prev.map((student) => {
        const currentId = student.studentId || student.id;
        return currentId === studentId ? { ...student, level: result.level || null } : student;
      }));
      return result;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  return {
    data,
    loading,
    error,
    refresh: fetchStudents,
    saveAttendance,
    saveEvaluation,
    updateStudentLevel
  };
}
export default useCoach;
