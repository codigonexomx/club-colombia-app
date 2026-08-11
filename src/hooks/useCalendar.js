import { useState, useEffect, useCallback } from "react";
import { CalendarService } from "@/services/calendar";

/**
 * Custom Hook para gestionar los eventos del microciclo semanal en tiempo real.
 * @param {string} [categoryName] - Nombre opcional de la categoría. Si no se especifica o es "all", retorna todos los eventos.
 * @returns {{ data: array, loading: boolean, error: any, refresh: function, updateRSVP: function }}
 */
export function useCalendar(categoryName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await CalendarService.getCalendarEvents(categoryName || "all");
      setData(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [categoryName]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = CalendarService.subscribeCalendarEvents(
      categoryName || "all",
      (list) => {
        setData(list);
        setLoading(false);
      },
      {
        onError: (err) => {
          setError(err);
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [categoryName]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateRSVP = useCallback(async (eventId, studentName, response) => {
    setError(null);
    try {
      return await CalendarService.updateRSVP(eventId, studentName, response);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  return {
    data,
    loading,
    error,
    refresh: fetchEvents,
    updateRSVP
  };
}
export default useCalendar;
