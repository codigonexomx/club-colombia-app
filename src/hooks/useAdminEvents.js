import { useState, useEffect, useCallback } from "react";
import { AdminService } from "@/services/admin";
import { CalendarService } from "@/services/calendar";
import { adminStep } from "@/lib/adminDiagnostics";

/**
 * Custom Hook para gestionar los eventos desde el panel de administración.
 * Permite leer todos los eventos en tiempo real.
 * @returns {{ events: array, loading: boolean, error: any }}
 */
export function useAdminEvents() {
  adminStep("ADMIN_STEP_58_USE_ADMIN_EVENTS_RENDER");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  adminStep("ADMIN_STEP_59_USE_ADMIN_EVENTS_BEFORE_EFFECT");
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    adminStep("ADMIN_STEP_60_USE_ADMIN_EVENTS_EFFECT_ENTER");
    setLoading(true);
    setError(null);

    try {
      // Reutilizamos el listener de CalendarService que ya lee la colección "events" entera.
      adminStep("ADMIN_STEP_61_USE_ADMIN_EVENTS_BEFORE_LISTENER");
      const unsubscribe = CalendarService.subscribeCalendarEvents(
        "all",
        (list) => {
          adminStep("ADMIN_STEP_62_USE_ADMIN_EVENTS_DATA_RECEIVED", {
            eventsCount: Array.isArray(list) ? list.length : "not-array"
          });
          setEvents(Array.isArray(list) ? list : []);
          setLoading(false);
        },
        {
          includeUnpublished: true,
          onError: (err) => {
            setError(err.message || "Error al cargar eventos");
            setLoading(false);
          }
        }
      );

      return () => {
        adminStep("ADMIN_STEP_63_USE_ADMIN_EVENTS_CLEANUP");
        unsubscribe();
      };
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los eventos.");
      setLoading(false);
      return () => {};
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage("");
  }, []);

  const saveEvent = useCallback(async (eventData, eventId = null) => {
    setActionLoading(true);
    clearMessages();

    try {
      const result = await AdminService.saveEvent(eventData, eventId);
      setSuccessMessage(eventId ? "Evento actualizado correctamente." : "Evento creado correctamente.");
      return result;
    } catch (err) {
      const message = err?.message || "No fue posible guardar el evento.";
      setError(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [clearMessages]);

  const deleteEvent = useCallback(async (eventId) => {
    setActionLoading(true);
    clearMessages();

    try {
      const result = await AdminService.deleteEvent(eventId);
      setSuccessMessage("Evento eliminado correctamente.");
      return result;
    } catch (err) {
      const message = err?.message || "No fue posible eliminar el evento.";
      setError(message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [clearMessages]);

  return {
    events,
    loading,
    error,
    actionLoading,
    successMessage,
    saveEvent,
    deleteEvent,
    clearMessages
  };
}
export default useAdminEvents;
