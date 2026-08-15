import { useState, useEffect, useCallback } from "react";
import { CalendarService } from "@/services/calendar";

/**
 * Custom Hook para gestionar los eventos del microciclo semanal en tiempo real.
 * @param {string} [categoryName] - Nombre opcional de la categoría. Si no se especifica o es "all", retorna todos los eventos.
 * @returns {{ data: array, loading: boolean, error: any, refresh: function, updateRSVP: function }}
 */
export function useCalendar(categoryName, options = {}) {
  const studentId = options.studentId || "";
  const enabled = options.enabled !== false;
  const includeUnpublished = options.includeUnpublished === true;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await CalendarService.getCalendarEvents(categoryName || "all", {
        studentId,
        includeUnpublished
      });
      setData(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [categoryName, includeUnpublished, studentId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!enabled) {
      setData([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = CalendarService.subscribeCalendarEvents(
      categoryName || "all",
      (list) => {
        setData(list);
        setLoading(false);
      },
      {
        studentId,
        includeUnpublished,
        onError: (err) => {
          setError(err);
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [categoryName, enabled, includeUnpublished, studentId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateRSVP = useCallback(async (eventId, studentName, response, rsvpStudentId) => {
    setError(null);
    try {
      const result = await CalendarService.updateRSVP(eventId, studentName, response, rsvpStudentId || studentId);
      setData((currentEvents) => currentEvents.map((event) => (
        event.id === eventId
          ? {
              ...event,
              rsvps: {
                ...(event.rsvps || {}),
                [studentName]: response
              }
            }
          : event
      )));
      return result;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [studentId]);

  return {
    data,
    loading,
    error,
    refresh: fetchEvents,
    updateRSVP
  };
}
export default useCalendar;
