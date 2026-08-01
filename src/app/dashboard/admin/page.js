"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, LogOut, MessageSquare, Pencil, Smartphone, Sparkles, Trash2, Trophy, Users, Video } from "lucide-react";
import { useAdminAttendance } from "@/hooks/useAdminAttendance";
import { useAdminAnnouncements } from "@/hooks/useAdminAnnouncements";
import { useAdminDrills } from "@/hooks/useAdminDrills";
import { useAdminEvaluations } from "@/hooks/useAdminEvaluations";
import { useAdminEvents } from "@/hooks/useAdminEvents";
import { useAdminPayments } from "@/hooks/useAdminPayments";
import { useAdminPhones } from "@/hooks/useAdminPhones";
import { useAdminStudents } from "@/hooks/useAdminStudents";
import { useTrainingSchedules } from "@/hooks/useTrainingSchedules";
import LevelBadge from "@/components/LevelBadge";
import { LEVEL_OPTIONS, getLevelLabel, parseLegacyCategoryAndLevel, resolveStudentCategoryAndLevel } from "@/lib/levelModel";
import { WEEKDAY_OPTIONS, getWeekdayLabel } from "@/lib/trainingScheduleModel";
import { calculateLeaderboard, categoryNameToId, normalizeStudentName } from "@/lib/studentModel";
import { normalizeAndValidatePhone } from "@/lib/phone";

const baseCategoryOptions = [
  "Sub-6", "Sub-7", "Sub-8", "Sub-9", "Sub-10", "Sub-11", "Sub-12", "Sub-13", "Sub-14",
  "Sub-15", "Sub-16", "Sub-17", "Sub-18", "Sub-19", "Sub-20", "Sub-21", "Sub-22"
];

const tabs = [
  { id: "students", label: "Control de Alumnos y Excepciones", title: "Control de Alumnos" },
  { id: "billing", label: "Mora y Validaciones", title: "Mora y Validaciones" },
  { id: "evaluations", label: "Evaluaciones Técnicas", title: "Evaluaciones Técnicas" },
  { id: "parent-link", label: "Vincular Padre", title: "Vincular Padre" },
  { id: "schedules", label: "Planificación de Microciclos", title: "Planificación" },
  { id: "drills", label: "Biblioteca de Ejercicios", title: "Biblioteca de Ejercicios" },
  { id: "leaderboard", label: "Tabla de Honor (Leaderboard)", title: "Tabla de Honor" },
  { id: "notifications", label: "Notificaciones Omnicanal", title: "Notificaciones" }
];

const lifecycleActions = {
  reactivate: {
    label: "Reactivar Alumno",
    status: "active",
    tone: "emerald",
    description: "El alumno volverá a estar activo sin modificar historial, pagos, asistencias, evaluaciones, padre ni categoría."
  },
  suspend: {
    label: "Suspender Alumno",
    status: "suspended",
    tone: "amber",
    description: "El acceso del alumno será restringido por una razón administrativa. Toda la información histórica se conserva."
  },
  inactive: {
    label: "Dar de Baja",
    status: "inactive",
    tone: "slate",
    description: "El alumno dejará de formar parte de los alumnos activos, pero toda su información permanecerá almacenada."
  },
  delete: {
    label: "Eliminar Definitivamente",
    status: "",
    tone: "red",
    description: "Acción reservada para registros duplicados, pruebas o errores de captura. El borrado físico está bloqueado por seguridad."
  }
};

const lifecycleReasonOptions = {
  suspend: ["Adeudo administrativo", "Disciplina", "Documentación pendiente", "Solicitud del acudiente", "Otro"],
  inactive: ["Retiro temporal", "Cambio de club", "Cambio de ciudad", "Pausa familiar", "Otro"]
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("students");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentSort, setPaymentSort] = useState("newest");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");
  const [attendanceSort, setAttendanceSort] = useState("newest");
  const [evaluationSearch, setEvaluationSearch] = useState("");
  const [evaluationHealthFilter, setEvaluationHealthFilter] = useState("all");
  const [evaluationSort, setEvaluationSort] = useState("newest");
  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventSort, setEventSort] = useState("date-asc");
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("training");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCategory, setEventCategory] = useState("Todas");
  const [eventDescription, setEventDescription] = useState("");
  const [editingEventId, setEditingEventId] = useState(null);
  const [drillSearch, setDrillSearch] = useState("");
  const [drillCategoryFilter, setDrillCategoryFilter] = useState("all");
  const [drillSort, setDrillSort] = useState("title-asc");
  const [drillTitle, setDrillTitle] = useState("");
  const [drillDescription, setDrillDescription] = useState("");
  const [drillCategory, setDrillCategory] = useState("técnica");
  const [drillVideoUrl, setDrillVideoUrl] = useState("");
  const [editingDrillId, setEditingDrillId] = useState(null);
  const [notificationText, setNotificationText] = useState("");
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState("all");
  const [announcementSort, setAnnouncementSort] = useState("newest");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [approvingPaymentId, setApprovingPaymentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualStudentName, setManualStudentName] = useState("");
  const [manualStudentAge, setManualStudentAge] = useState("");
  const [manualLevel, setManualLevel] = useState("initiation");
  const [manualParentName, setManualParentName] = useState("");
  const [manualParentPhone, setManualParentPhone] = useState("");
  const [manualPaidCash, setManualPaidCash] = useState(false);
  const [manualPaymentConcept, setManualPaymentConcept] = useState("monthly");
  const [studentActionLoading, setStudentActionLoading] = useState(false);
  const [studentSuccessMessage, setStudentSuccessMessage] = useState("");
  const [studentErrorMessage, setStudentErrorMessage] = useState("");
  const [managedStudent, setManagedStudent] = useState(null);
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState(null);
  const [lifecycleDeleteText, setLifecycleDeleteText] = useState("");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleOtherReason, setLifecycleOtherReason] = useState("");
  const [lifecycleHistory, setLifecycleHistory] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [parentLinkIdentifierType, setParentLinkIdentifierType] = useState("phone");
  const [parentLinkIdentifier, setParentLinkIdentifier] = useState("");
  const [parentLinkLoading, setParentLinkLoading] = useState(false);
  const [parentLinkSaving, setParentLinkSaving] = useState(false);
  const [parentLinkResult, setParentLinkResult] = useState(null);
  const [parentLinkSelectedIds, setParentLinkSelectedIds] = useState([]);
  const [parentLinkMessage, setParentLinkMessage] = useState("");
  const [parentLinkError, setParentLinkError] = useState("");
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [selectedParentStudent, setSelectedParentStudent] = useState(null);
  const [newParentPhone, setNewParentPhone] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleStartTime, setScheduleStartTime] = useState("");
  const [scheduleEndTime, setScheduleEndTime] = useState("");
  const [scheduleCategory, setScheduleCategory] = useState("Sub-8");
  const [scheduleLevel, setScheduleLevel] = useState("");
  const [scheduleCoachUid, setScheduleCoachUid] = useState("");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    manualRegisterStudent,
    applyCategoryOverride,
    confirmManualPayment,
    updateStudentLifecycleStatus,
    getStudentLifecycleHistory,
    deleteEmptyStudent
  } = useAdminStudents();
  const { data: attendance, loading: attendanceLoading, error: attendanceError } = useAdminAttendance();
  const {
    announcements,
    loading: announcementsLoading,
    actionLoading: announcementsActionLoading,
    error: announcementsError,
    successMessage: announcementsSuccessMessage,
    sendAnnouncement,
    deleteAnnouncement,
    clearMessages: clearAnnouncementMessages
  } = useAdminAnnouncements();
  const {
    drills,
    loading: drillsLoading,
    error: drillsError,
    actionLoading: drillsActionLoading,
    successMessage: drillsSuccessMessage,
    saveDrill,
    deleteDrill,
    clearMessages: clearDrillMessages
  } = useAdminDrills();
  const { data: evaluations, loading: evaluationsLoading, error: evaluationsError } = useAdminEvaluations();
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    actionLoading: eventsActionLoading,
    successMessage: eventsSuccessMessage,
    saveEvent,
    deleteEvent,
    clearMessages: clearEventMessages
  } = useAdminEvents();
  const {
    updatePhone,
    loading: phoneUpdating,
    error: phoneError,
    successMessage: phoneSuccess,
    clearState: clearPhoneState
  } = useAdminPhones();
  const {
    pendingPayments,
    loading: paymentsLoading,
    error: paymentsError,
    successMessage: paymentSuccessMessage,
    actionLoading: paymentActionLoading,
    approvePayment,
    holdPayment,
    processSuspensions,
    clearError: clearPaymentError,
    clearSuccessMessage: clearPaymentSuccessMessage
  } = useAdminPayments();
  const {
    schedules: trainingSchedules,
    coaches: scheduleCoaches,
    loading: schedulesLoading,
    error: schedulesError,
    actionLoading: schedulesActionLoading,
    successMessage: schedulesSuccessMessage,
    saveSchedule,
    toggleScheduleStatus,
    deleteSchedule
  } = useTrainingSchedules();
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const allAttendance = attendance;
  const getTimeValue = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    return Date.parse(value) || 0;
  };

  const filteredPayments = useMemo(() => {
    const normalizedSearch = paymentSearch.trim().toLowerCase();

    return [...pendingPayments]
      .filter((payment) => {
        const status = payment.status || "pending";
        if (paymentStatusFilter !== "all" && status !== paymentStatusFilter) return false;

        if (!normalizedSearch) return true;

        return [
          payment.studentName,
          payment.categoryName,
          payment.paymentType,
          payment.studentId,
          payment.id,
          payment.date
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (paymentSort === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0);
        if (paymentSort === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0);

        const aTime = getTimeValue(a.date) || getTimeValue(a.createdAt);
        const bTime = getTimeValue(b.date) || getTimeValue(b.createdAt);
        return paymentSort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [paymentSearch, paymentSort, paymentStatusFilter, pendingPayments]);

  const filteredAttendance = useMemo(() => {
    const normalizedSearch = attendanceSearch.trim().toLowerCase();

    return [...attendance]
      .filter((entry) => {
        const records = Array.isArray(entry.records) ? entry.records : [];
        const hasStatus = (status) => records.some((record) => (record.status || "").toLowerCase() === status);

        if (attendanceStatusFilter === "present" && !hasStatus("p")) return false;
        if (attendanceStatusFilter === "absent" && !hasStatus("a")) return false;

        if (!normalizedSearch) return true;

        return [
          entry.id,
          entry.date,
          entry.category,
          entry.studentId,
          entry.studentName,
          ...records.flatMap((record) => [record.studentId, record.studentName, record.name, record.status])
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const aTime = getTimeValue(a.date) || getTimeValue(a.timestamp);
        const bTime = getTimeValue(b.date) || getTimeValue(b.timestamp);
        if (attendanceSort === "records-desc") {
          return (b.records?.length || 0) - (a.records?.length || 0);
        }
        if (attendanceSort === "records-asc") {
          return (a.records?.length || 0) - (b.records?.length || 0);
        }
        return attendanceSort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [attendance, attendanceSearch, attendanceSort, attendanceStatusFilter]);

  const getEvaluationAverage = (evaluation) => {
    const metrics = evaluation.metrics || {};
    const values = ["speed", "passing", "dribbling", "shooting", "physical", "discipline"]
      .map((key) => Number(metrics[key] || 0))
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  };

  const filteredEvaluations = useMemo(() => {
    const normalizedSearch = evaluationSearch.trim().toLowerCase();

    return [...evaluations]
      .filter((evaluation) => {
        const healthStatus = evaluation.healthStatus || "optimal";
        if (evaluationHealthFilter !== "all" && healthStatus !== evaluationHealthFilter) return false;

        if (!normalizedSearch) return true;

        return [
          evaluation.id,
          evaluation.studentId,
          evaluation.studentName,
          evaluation.date,
          evaluation.healthStatus,
          evaluation.tacticalNotes
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (evaluationSort === "average-desc") return getEvaluationAverage(b) - getEvaluationAverage(a);
        if (evaluationSort === "average-asc") return getEvaluationAverage(a) - getEvaluationAverage(b);

        const aTime = getTimeValue(a.date) || getTimeValue(a.timestamp) || getTimeValue(a.createdAt);
        const bTime = getTimeValue(b.date) || getTimeValue(b.timestamp) || getTimeValue(b.createdAt);
        return evaluationSort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [evaluationHealthFilter, evaluationSearch, evaluationSort, evaluations]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = eventSearch.trim().toLowerCase();

    return [...events]
      .filter((event) => {
        const eventType = event.type || "training";
        if (eventTypeFilter !== "all" && eventType !== eventTypeFilter) return false;

        if (!normalizedSearch) return true;

        return [
          event.id,
          event.title,
          event.type,
          event.date,
          event.time,
          event.location,
          event.category,
          event.description
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (eventSort === "title-asc") return String(a.title || "").localeCompare(String(b.title || ""));
        if (eventSort === "title-desc") return String(b.title || "").localeCompare(String(a.title || ""));

        const aTime = getTimeValue(a.date);
        const bTime = getTimeValue(b.date);
        if (aTime !== bTime) return eventSort === "date-desc" ? bTime - aTime : aTime - bTime;

        return eventSort === "date-desc"
          ? String(b.time || "").localeCompare(String(a.time || ""))
          : String(a.time || "").localeCompare(String(b.time || ""));
      });
  }, [eventSearch, eventSort, eventTypeFilter, events]);

  const categoryOptions = useMemo(() => {
    const names = new Set(baseCategoryOptions);
    students.forEach((student) => {
      const parsed = parseLegacyCategoryAndLevel(student.category);
      if (parsed.category) names.add(parsed.category);
    });
    return [...names].sort((a, b) => {
      const aNumber = Number(String(a).match(/\d+/)?.[0] || 999);
      const bNumber = Number(String(b).match(/\d+/)?.[0] || 999);
      return aNumber - bNumber || a.localeCompare(b);
    });
  }, [students]);

  const parseVideoUrl = (url) => {
    if (!url) return { type: "unknown", embedUrl: "" };
    const trimmed = url.trim();
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytMatch = trimmed.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
      };
    }
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
    const vimeoMatch = trimmed.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        type: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
      };
    }
    return {
      type: "mp4",
      embedUrl: trimmed
    };
  };

  const filteredDrills = useMemo(() => {
    const normalizedSearch = drillSearch.trim().toLowerCase();

    return [...drills]
      .filter((drill) => {
        const category = drill.category || "sin categoría";
        if (drillCategoryFilter !== "all" && category !== drillCategoryFilter) return false;

        if (!normalizedSearch) return true;

        return [
          drill.id,
          drill.title,
          drill.description,
          drill.category,
          drill.videoUrl,
          drill.date
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (drillSort === "title-desc") return String(b.title || "").localeCompare(String(a.title || ""));
        if (drillSort === "category-asc") return String(a.category || "").localeCompare(String(b.category || ""));
        if (drillSort === "category-desc") return String(b.category || "").localeCompare(String(a.category || ""));

        return String(a.title || "").localeCompare(String(b.title || ""));
      });
  }, [drillCategoryFilter, drillSearch, drillSort, drills]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedSearch = announcementSearch.trim().toLowerCase();

    return [...announcements]
      .filter((announcement) => {
        const hasText = Boolean((announcement.text || "").trim());
        if (announcementStatusFilter === "active" && !hasText) return false;
        if (announcementStatusFilter === "empty" && hasText) return false;

        if (!normalizedSearch) return true;

        return [
          announcement.id,
          announcement.date,
          announcement.text
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (announcementSort === "text-asc") return String(a.text || "").localeCompare(String(b.text || ""));
        if (announcementSort === "text-desc") return String(b.text || "").localeCompare(String(a.text || ""));

        const aTime = getTimeValue(a.date);
        const bTime = getTimeValue(b.date);
        return announcementSort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [announcementSearch, announcementSort, announcementStatusFilter, announcements]);

  const memoizedLeaderboard = React.useMemo(
    () => calculateLeaderboard(
      students,
      evaluations,
      allAttendance
    ),
    [students, evaluations, allAttendance]
  );

  console.log(
    "leaderboard size:",
    memoizedLeaderboard.length
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  };

  const handleApprovePayment = async (paymentId) => {
    if (paymentActionLoading || !paymentId) return;
    const confirmed = window.confirm("¿Confirmas que este pago fue validado correctamente?");
    if (!confirmed) return;

    setApprovingPaymentId(paymentId);
    clearPaymentError();
    clearPaymentSuccessMessage();

    try {
      await approvePayment(paymentId);
    } catch (err) {
      // El hook expone el error para la UI.
    } finally {
      setApprovingPaymentId("");
    }
  };

  const handleHoldPayment = async (paymentId, studentIdOrName) => {
    if (paymentActionLoading || !paymentId) return;
    const confirmed = window.confirm("¿Deseas poner este pago en espera?");
    if (!confirmed) return;

    clearPaymentError();
    clearPaymentSuccessMessage();

    try {
      await holdPayment(paymentId, studentIdOrName);
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const handleProcessSuspensions = async () => {
    if (paymentActionLoading) return;
    const confirmed = window.confirm("¿Procesar suspensiones por mora para alumnos activos con más de 5 días de deuda?");
    if (!confirmed) return;

    clearPaymentError();
    clearPaymentSuccessMessage();

    try {
      await processSuspensions();
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const resetManualStudentForm = () => {
    setManualStudentName("");
    setManualStudentAge("");
    setManualLevel("initiation");
    setManualParentName("");
    setManualParentPhone("");
    setManualPaidCash(false);
    setManualPaymentConcept("monthly");
  };

  const handleManualRegister = async (event) => {
    event.preventDefault();
    if (studentActionLoading) return;

    setStudentActionLoading(true);
    setStudentSuccessMessage("");
    setStudentErrorMessage("");

    try {
      const ageNum = Number(manualStudentAge);
      let category = "Sub-8";
      if (ageNum > 8 && ageNum <= 10) {
        category = "Sub-10";
      } else if (ageNum > 10 && ageNum <= 12) {
        category = "Sub-12";
      } else if (ageNum > 12) {
        category = "Sub-15";
      }

      const studentData = {
        name: manualStudentName.trim(),
        normalizedName: normalizeStudentName(manualStudentName),
        age: ageNum,
        parentName: manualParentName.trim(),
        parentPhone: normalizeAndValidatePhone(manualParentPhone),
        parentEmail: "",
        parentUid: "",
        categoryId: categoryNameToId(category),
        category,
        level: manualLevel || null,
        assignedCoachUid: "",
        assignment: "automatic",
        status: manualPaidCash ? "active" : "suspended",
        billingStatus: manualPaidCash ? "paid" : "pending_payment",
        healthStatus: "optimal",
        dueDays: manualPaidCash ? 0 : 7
      };

      await manualRegisterStudent(studentData, manualPaidCash, manualPaymentConcept);
      setStudentSuccessMessage("Alumno registrado correctamente.");
      resetManualStudentForm();
      setShowAddForm(false);
    } catch (err) {
      setStudentErrorMessage(err.message || "No fue posible registrar al alumno.");
    } finally {
      setStudentActionLoading(false);
    }
  };

  const handleApplyOverride = async (event) => {
    event.preventDefault();
    if (!selectedStudent || studentActionLoading) return;

    setStudentActionLoading(true);
    setStudentSuccessMessage("");
    setStudentErrorMessage("");

    try {
      await applyCategoryOverride(selectedStudent.studentId || selectedStudent.id, {
        category: newCategory,
        categoryId: categoryNameToId(newCategory),
        level: newLevel || null,
        assignment: "manual_override",
        overrideReason: overrideReason.trim()
      });
      setStudentSuccessMessage("Excepción de categoría y nivel guardada correctamente.");
      setSelectedStudent(null);
      setNewCategory("");
      setNewLevel("");
      setOverrideReason("");
    } catch (err) {
      setStudentErrorMessage(err.message || "No fue posible guardar la excepción.");
    } finally {
      setStudentActionLoading(false);
    }
  };

  const openCategoryOverride = (student) => {
    const resolved = resolveStudentCategoryAndLevel(student);
    setSelectedStudent(student);
    setNewCategory(resolved.category || "");
    setNewLevel(resolved.level || "");
    setOverrideReason("");
  };

  const resetScheduleForm = () => {
    setScheduleTitle("");
    setScheduleDayOfWeek(1);
    setScheduleStartTime("");
    setScheduleEndTime("");
    setScheduleCategory(categoryOptions[0] || "Sub-8");
    setScheduleLevel("");
    setScheduleCoachUid("");
    setScheduleLocation("");
    setScheduleDescription("");
    setEditingScheduleId(null);
  };

  const handleSaveSchedule = async (event) => {
    event.preventDefault();
    const coach = scheduleCoaches.find((item) => item.uid === scheduleCoachUid);

    try {
      await saveSchedule({
        title: scheduleTitle,
        dayOfWeek: Number(scheduleDayOfWeek),
        startTime: scheduleStartTime,
        endTime: scheduleEndTime || null,
        category: scheduleCategory,
        level: scheduleLevel || null,
        coachUid: coach?.uid || null,
        coachName: coach?.name || null,
        location: scheduleLocation,
        description: scheduleDescription,
        active: true
      }, editingScheduleId);
      resetScheduleForm();
    } catch (err) {
      // El hook muestra el error en la interfaz.
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleTitle(schedule.title || "");
    setScheduleDayOfWeek(Number(schedule.dayOfWeek ?? 1));
    setScheduleStartTime(schedule.startTime || "");
    setScheduleEndTime(schedule.endTime || "");
    setScheduleCategory(schedule.category || "Sub-8");
    setScheduleLevel(schedule.level || "");
    setScheduleCoachUid(schedule.coachUid || "");
    setScheduleLocation(schedule.location || "");
    setScheduleDescription(schedule.description || "");
  };

  const handleDeleteSchedule = async (scheduleId) => {
    const confirmed = window.confirm("¿Eliminar este horario semanal?");
    if (!confirmed) return;
    try {
      await deleteSchedule(scheduleId);
    } catch (err) {
      // El hook muestra el error en la interfaz.
    }
  };

  const handleConfirmManualPayment = async (studentIdOrName) => {
    if (studentActionLoading || !studentIdOrName) return;
    const confirmed = window.confirm("¿Confirmas el pago manual de este alumno?");
    if (!confirmed) return;

    setStudentActionLoading(true);
    setStudentSuccessMessage("");
    setStudentErrorMessage("");

    try {
      await confirmManualPayment(studentIdOrName);
      setStudentSuccessMessage("Pago manual confirmado correctamente.");
    } catch (err) {
      setStudentErrorMessage(err.message || "No fue posible confirmar el pago manual.");
    } finally {
      setStudentActionLoading(false);
    }
  };

  const openLifecycleModal = (student) => {
    setManagedStudent(student);
    setPendingLifecycleAction(null);
    setLifecycleDeleteText("");
    setLifecycleReason("");
    setLifecycleOtherReason("");
    setLifecycleHistory(null);
    setLifecycleMessage("");
    setLifecycleError("");
  };

  const closeLifecycleModal = () => {
    setManagedStudent(null);
    setPendingLifecycleAction(null);
    setLifecycleDeleteText("");
    setLifecycleReason("");
    setLifecycleOtherReason("");
    setLifecycleHistory(null);
    setLifecycleMessage("");
    setLifecycleError("");
  };

  const prepareLifecycleAction = async (actionKey) => {
    setPendingLifecycleAction(actionKey);
    setLifecycleDeleteText("");
    setLifecycleReason("");
    setLifecycleOtherReason("");
    setLifecycleMessage("");
    setLifecycleError("");
    setLifecycleHistory(null);

    if (actionKey === "delete" && managedStudent) {
      setLifecycleLoading(true);
      try {
        const history = await getStudentLifecycleHistory(managedStudent);
        setLifecycleHistory(history);
      } catch (err) {
        setLifecycleError(err.message || "No fue posible revisar el historial del alumno.");
      } finally {
        setLifecycleLoading(false);
      }
    }
  };

  const executeLifecycleStatusAction = async () => {
    if (!managedStudent || !pendingLifecycleAction) return;
    const action = lifecycleActions[pendingLifecycleAction];
    if (!action?.status) return;

    const confirmed = window.confirm(`¿Confirmas la acción "${action.label}" para ${managedStudent.name}?`);
    if (!confirmed) return;

    setLifecycleLoading(true);
    setLifecycleError("");
    setLifecycleMessage("");

    try {
      const reasonDetail = lifecycleReason === "Otro" ? lifecycleOtherReason.trim() : "";
      await updateStudentLifecycleStatus(managedStudent.studentId || managedStudent.id, action.status, {
        reason: lifecycleReason,
        reasonDetail
      });
      setLifecycleMessage(`${action.label} aplicado correctamente. No se modificó historial ni relaciones.`);
    } catch (err) {
      setLifecycleError(err.message || "No fue posible actualizar el estado del alumno.");
    } finally {
      setLifecycleLoading(false);
    }
  };

  const executeProtectedDelete = async () => {
    if (!managedStudent || lifecycleDeleteText !== "ELIMINAR") return;
    setLifecycleLoading(true);
    setLifecycleError("");
    setLifecycleMessage("");

    try {
      const result = await deleteEmptyStudent(managedStudent);
      setLifecycleHistory(result.history || null);
      setLifecycleError("El borrado físico está bloqueado por seguridad. Utilice la opción Dar de Baja.");
    } catch (err) {
      setLifecycleError(err.message || "No fue posible validar la eliminación del alumno.");
    } finally {
      setLifecycleLoading(false);
    }
  };

  const closePhoneModal = () => {
    setPhoneModalOpen(false);
    setSelectedParentStudent(null);
    setNewParentPhone("");
    clearPhoneState();
  };

  const handleOpenPhoneModal = (student) => {
    setSelectedParentStudent(student);
    setNewParentPhone(student.parentPhone || "");
    clearPhoneState();
    setPhoneModalOpen(true);
  };

  const handleUpdatePhoneSubmit = async (event) => {
    event.preventDefault();
    if (!selectedParentStudent || phoneUpdating) return;

    try {
      await updatePhone(
        selectedParentStudent.parentUid || "",
        selectedParentStudent.parentPhone || "",
        newParentPhone
      );

      setTimeout(() => {
        setPhoneModalOpen(false);
        setSelectedParentStudent(null);
        setNewParentPhone("");
        clearPhoneState();
      }, 2000);
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const handleParentLinkSearch = async (event) => {
    event.preventDefault();
    setParentLinkLoading(true);
    setParentLinkError("");
    setParentLinkMessage("");
    setParentLinkResult(null);
    setParentLinkSelectedIds([]);

    try {
      const response = await fetch("/api/admin/link-parent-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifierType: parentLinkIdentifierType,
          identifier: parentLinkIdentifier
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible diagnosticar la cuenta padre.");
      }
      setParentLinkResult(data);
    } catch (err) {
      setParentLinkError(err.message || "No fue posible diagnosticar la cuenta padre.");
    } finally {
      setParentLinkLoading(false);
    }
  };

  const toggleParentLinkStudent = (studentId) => {
    setParentLinkSelectedIds((prev) => (
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const handleParentLinkSubmit = async () => {
    if (!parentLinkResult?.parent?.uid || parentLinkSelectedIds.length === 0) return;
    const selectedStudents = parentLinkResult.students.filter((student) => parentLinkSelectedIds.includes(student.studentId));
    const relatedPaymentCount = parentLinkResult.payments.filter((payment) => (
      parentLinkSelectedIds.includes(payment.studentId) && !payment.parentUid
    )).length;
    const confirmed = window.confirm(
      [
        "Confirma la vinculación administrativa:",
        "",
        `Cuenta padre: ${parentLinkResult.parent.uid}`,
        `Alumnos seleccionados: ${selectedStudents.map((student) => `${student.name || "Sin nombre"} (${student.studentId})`).join(", ")}`,
        "",
        "Se escribirá:",
        "- users/{parentUid}: role=parent, status=active, studentIds, updatedAt",
        "- students/{studentId}: parentUid, updatedAt",
        `- payments relacionados sin parentUid: parentUid, updatedAt (${relatedPaymentCount})`,
        "",
        "No se cambiará el status de alumnos ni pagos."
      ].join("\n")
    );
    if (!confirmed) return;

    setParentLinkSaving(true);
    setParentLinkError("");
    setParentLinkMessage("");

    try {
      const response = await fetch("/api/admin/link-parent-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentUid: parentLinkResult.parent.uid,
          studentIds: parentLinkSelectedIds
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible vincular la cuenta padre.");
      }
      setParentLinkMessage(`Vinculación exitosa. Alumnos vinculados: ${data.linkedStudentIds.length}. Pagos históricos actualizados: ${data.updatedPayments}.`);
      setParentLinkSelectedIds([]);
      setParentLinkResult((prev) => prev ? {
        ...prev,
        parent: {
          ...prev.parent,
          studentIds: data.finalStudentIds || prev.parent.studentIds
        },
        students: prev.students.map((student) => (
          (data.linkedStudentIds || []).includes(student.studentId)
            ? { ...student, parentUid: data.parentUid, canLink: true, conflict: false }
            : student
        )),
        payments: prev.payments.map((payment) => (
          (data.linkedStudentIds || []).includes(payment.studentId) && !payment.parentUid
            ? { ...payment, parentUid: data.parentUid }
            : payment
        ))
      } : prev);
    } catch (err) {
      setParentLinkError(err.message || "No fue posible vincular la cuenta padre.");
    } finally {
      setParentLinkSaving(false);
    }
  };

  const handleSendNotification = async (event) => {
    event.preventDefault();
    if (announcementsActionLoading) return;

    clearAnnouncementMessages();
    try {
      await sendAnnouncement(notificationText.trim());
      setNotificationText("");
      setEditingAnnouncementId(null);
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncementId(announcement.id);
    setNotificationText(announcement.text || "");
    clearAnnouncementMessages();
  };

  const handleCancelAnnouncementEdit = () => {
    setEditingAnnouncementId(null);
    setNotificationText("");
    clearAnnouncementMessages();
  };

  const handleDeleteAnnouncement = async () => {
    if (announcementsActionLoading) return;
    const confirmed = window.confirm("¿Eliminar el comunicado activo?");
    if (!confirmed) return;

    clearAnnouncementMessages();
    try {
      await deleteAnnouncement();
      setEditingAnnouncementId(null);
      setNotificationText("");
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const resetEventForm = () => {
    setEventTitle("");
    setEventType("training");
    setEventDate("");
    setEventTime("");
    setEventLocation("");
    setEventCategory("Todas");
    setEventDescription("");
    setEditingEventId(null);
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    if (eventsActionLoading) return;

    try {
      await saveEvent({
        title: eventTitle.trim(),
        type: eventType,
        date: eventDate,
        time: eventTime,
        location: eventLocation.trim(),
        category: eventCategory,
        description: eventDescription.trim()
      }, editingEventId);
      resetEventForm();
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const handleEditEvent = (event) => {
    setEditingEventId(event.id);
    setEventTitle(event.title || "");
    setEventType(event.type || "training");
    setEventDate(event.date || "");
    setEventTime(event.time || "");
    setEventLocation(event.location || "");
    setEventCategory(event.category || "Todas");
    setEventDescription(event.description || "");
    clearEventMessages();
  };

  const handleCancelEventEdit = () => {
    resetEventForm();
    clearEventMessages();
  };

  const handleDeleteEvent = async (eventId) => {
    if (eventsActionLoading || !eventId) return;
    const confirmed = window.confirm("¿Eliminar este evento del calendario?");
    if (!confirmed) return;

    try {
      await deleteEvent(eventId);
      if (editingEventId === eventId) resetEventForm();
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const resetDrillForm = () => {
    setDrillTitle("");
    setDrillDescription("");
    setDrillCategory("técnica");
    setDrillVideoUrl("");
    setEditingDrillId(null);
  };

  const handleSaveDrill = async (event) => {
    event.preventDefault();
    if (drillsActionLoading) return;

    try {
      await saveDrill({
        title: drillTitle.trim(),
        description: drillDescription.trim(),
        category: drillCategory,
        videoUrl: drillVideoUrl.trim(),
        date: new Date().toISOString().slice(0, 10)
      }, editingDrillId);
      resetDrillForm();
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  const handleEditDrill = (drill) => {
    setEditingDrillId(drill.id);
    setDrillTitle(drill.title || "");
    setDrillDescription(drill.description || "");
    setDrillCategory(drill.category || "técnica");
    setDrillVideoUrl(drill.videoUrl || "");
    clearDrillMessages();
  };

  const handleCancelDrillEdit = () => {
    resetDrillForm();
    clearDrillMessages();
  };

  const handleDeleteDrill = async (drillId) => {
    if (drillsActionLoading || !drillId) return;
    const confirmed = window.confirm("¿Eliminar este ejercicio de la biblioteca?");
    if (!confirmed) return;

    try {
      await deleteDrill(drillId);
      if (editingDrillId === drillId) resetDrillForm();
    } catch (err) {
      // El hook expone el error para la UI.
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col">
      <header className="glass-panel border-b border-slate-900 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-all">
          <span className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
            Admin Consola <span className="text-[#10b981]">Club Colombia</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-200 font-display font-semibold text-xs transition-all"
          >
            Inicio
          </Link>
          <Link
            href="/login"
            className="text-slate-400 hover:text-[#10b981] font-display font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </Link>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 pt-6 text-center flex flex-col items-center">
        <img
          src="/logo.png"
          alt="Escudo Club Colombia"
          className="w-20 h-20 object-contain mb-3 filter drop-shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse-subtle"
        />
        <h2 className="font-display font-black text-xl text-slate-100 uppercase tracking-wider">
          Consola de Administración
        </h2>
        <p className="text-[9px] font-mono text-[#10b981] font-bold uppercase tracking-widest mt-1">
          Escuela de Fútbol Club Colombia
        </p>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <nav className="bg-[#0e121e] border border-slate-900 rounded-2xl p-2.5 flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-4 py-2.5 rounded-xl text-xs font-bold font-display transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-slate-200 border-l-2 border-[#10b981]"
                    : "text-slate-400 hover:bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="lg:col-span-3">
          <section className="bg-[#0e121e] border border-slate-900 rounded-3xl p-5 min-h-[360px]">
            <div className="border-b border-slate-800 pb-3">
              <h1 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                {currentTab.title}
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Diagnóstico temporal: layout y navegación cargados correctamente.
              </p>
            </div>
            {activeTab === "students" ? (
              <div className="pt-4 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                      Expediente General de Alumnos
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Gestión de deportistas, categorías, pagos manuales y ciclo de vida administrativo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-[#10b981] hover:bg-[#059669] text-slate-950 font-display font-black text-[10px] px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider font-sans shrink-0"
                  >
                    {showAddForm ? "Cerrar Registro" : "+ Inscribir Alumno Manual"}
                  </button>
                </div>

                {(studentSuccessMessage || studentErrorMessage || studentsError) && (
                  <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    studentErrorMessage || studentsError
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  }`}>
                    {studentErrorMessage || studentsError ? (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{studentErrorMessage || studentsError?.message || studentSuccessMessage}</span>
                  </div>
                )}

                {showAddForm && (
                  <form onSubmit={handleManualRegister} className="bg-[#07090e] border border-slate-800 p-5 rounded-2xl animate-fade-in space-y-4 font-sans text-left">
                    <div className="flex items-center gap-1.5 text-[#10b981] font-display font-bold text-xs uppercase tracking-wider">
                      <Users className="w-4 h-4" />
                      Inscripción Manual de Alumno
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-1">Nombre completo del alumno</label>
                        <input
                          type="text"
                          required
                          value={manualStudentName}
                          onChange={(event) => setManualStudentName(event.target.value)}
                          placeholder="Ej. Carlos López Jr."
                          className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981] font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-1">Edad del alumno</label>
                        <input
                          type="number"
                          required
                          min="5"
                          max="17"
                          value={manualStudentAge}
                          onChange={(event) => setManualStudentAge(event.target.value)}
                          placeholder="Ej. 9"
                          className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-1">Nivel deportivo</label>
                        <select
                          value={manualLevel}
                          onChange={(event) => setManualLevel(event.target.value)}
                          className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]"
                        >
                          {LEVEL_OPTIONS.map((level) => (
                            <option key={level.value} value={level.value}>{level.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-1">Nombre del representante</label>
                        <input
                          type="text"
                          required
                          value={manualParentName}
                          onChange={(event) => setManualParentName(event.target.value)}
                          placeholder="Ej. Carlos López Padre"
                          className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-1">Teléfono de contacto</label>
                        <input
                          type="tel"
                          required
                          value={manualParentPhone}
                          onChange={(event) => setManualParentPhone(event.target.value)}
                          placeholder="+57 300 123 4567"
                          className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 bg-[#0e121e]/80 p-3.5 rounded-xl border border-slate-800/80">
                      <label className="flex items-center gap-3 text-xs text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={manualPaidCash}
                          onChange={(event) => setManualPaidCash(event.target.checked)}
                          className="w-4 h-4 accent-[#10b981] rounded cursor-pointer"
                        />
                        Registrar pago inicial recibido
                      </label>
                      {manualPaidCash && (
                        <div className="pl-7 space-y-2">
                          <label className="text-[8px] text-slate-400 font-bold block uppercase">Concepto de pago inicial</label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setManualPaymentConcept("monthly")}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                manualPaymentConcept === "monthly"
                                  ? "bg-slate-800 text-[#10b981] border border-slate-700/50"
                                  : "bg-[#07090e] text-slate-400 border border-slate-800"
                              }`}
                            >
                              Mensualidad ($300 MXN)
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualPaymentConcept("class")}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                manualPaymentConcept === "class"
                                  ? "bg-slate-800 text-sky-400 border border-slate-700/50"
                                  : "bg-[#07090e] text-slate-400 border border-slate-800"
                              }`}
                            >
                              Por Clase ($50 MXN)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-display font-bold text-[10px] px-5 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={studentActionLoading}
                        className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-6 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                      >
                        {studentActionLoading ? "Guardando..." : "Dar de Alta Estudiante"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="block md:hidden space-y-3 font-sans">
                  {studentsLoading ? (
                    <div className="py-8 text-center text-xs text-slate-500 bg-[#07090e]/50 border border-slate-850 rounded-2xl">
                      Cargando alumnos...
                    </div>
                  ) : students.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 bg-[#07090e]/50 border border-slate-850 rounded-2xl">
                      Aún no hay registros
                    </div>
                  ) : students.map((student) => (
                    <div key={student.id} className="bg-[#07090e] border border-slate-850 p-4 rounded-2xl space-y-3 text-left">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h4 className="font-bold text-slate-200 text-xs">{student.name}</h4>
                          <span className="text-[10px] text-slate-450 block mt-0.5">{student.age || "-"} años</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">Estado: {student.status || "sin estado"}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-[#0e121e] px-2 py-0.5 rounded border border-slate-800 text-[9px] text-slate-350 font-medium">
                            {resolveStudentCategoryAndLevel(student).category || "Sin categoría"}
                          </span>
                          <LevelBadge level={resolveStudentCategoryAndLevel(student).level} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-850/50">
                        <button type="button" onClick={() => openCategoryOverride(student)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-[9px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer">
                          Excepción
                        </button>
                        <button type="button" onClick={() => handleOpenPhoneModal(student)} className="bg-slate-900 border border-slate-800 text-[#10b981] hover:text-[#34d399] text-[9px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer">
                          Teléfono
                        </button>
                        <button type="button" onClick={() => openLifecycleModal(student)} className="bg-slate-900 border border-slate-800 text-sky-400 hover:text-sky-300 text-[9px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer">
                          Administrar
                        </button>
                        {(student.status === "suspended" || student.billingStatus === "pending_payment" || student.status === "on_hold") && (
                          <button type="button" onClick={() => handleConfirmManualPayment(student.studentId || student.id)} className="bg-amber-500 text-slate-950 hover:bg-amber-600 font-display font-black text-[9px] px-3 py-2 rounded-lg transition-all cursor-pointer">
                            Pago Manual
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3">Nombre</th>
                        <th className="pb-3">Edad</th>
                        <th className="pb-3">Categoría</th>
                        <th className="pb-3">Nivel</th>
                        <th className="pb-3">Estado</th>
                        <th className="pb-3">Asignación</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {studentsLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">Cargando alumnos...</td>
                        </tr>
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">Aún no hay registros</td>
                        </tr>
                      ) : students.map((student) => (
                        <tr key={student.id} className="text-xs">
                          <td className="py-3 font-bold text-slate-200">{student.name}</td>
                          <td className="py-3 text-slate-400">{student.age || "-"} años</td>
                          <td className="py-3 text-slate-400">{resolveStudentCategoryAndLevel(student).category || "Sin categoría"}</td>
                          <td className="py-3"><LevelBadge level={resolveStudentCategoryAndLevel(student).level} /></td>
                          <td className="py-3 text-slate-400">{student.status || "sin estado"}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              student.assignment === "automatic"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-500"
                            }`}>
                              {student.assignment === "automatic" ? "Automática" : "Excepción Manual"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => openCategoryOverride(student)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer">
                                Excepción
                              </button>
                              <button type="button" onClick={() => handleOpenPhoneModal(student)} className="bg-slate-900 border border-slate-800 text-[#10b981] hover:text-[#34d399] text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer" title="Editar teléfono del acudiente">
                                Teléfono
                              </button>
                              {(student.status === "suspended" || student.billingStatus === "pending_payment" || student.status === "on_hold") && (
                                <button type="button" onClick={() => handleConfirmManualPayment(student.studentId || student.id)} className="bg-amber-500 text-slate-950 hover:bg-amber-600 font-display font-black text-[9px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer">
                                  Pago Manual
                                </button>
                              )}
                              <button type="button" onClick={() => openLifecycleModal(student)} className="bg-slate-900 border border-slate-800 text-sky-400 hover:text-sky-300 text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer">
                                Administrar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedStudent && (
                  <div className="bg-[#07090e] border border-slate-800 p-5 rounded-2xl animate-fade-in space-y-4">
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <Sparkles className="w-4 h-4" />
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider">Forzar Categoría/Nivel: {selectedStudent.name}</h3>
                      </div>
                      <button type="button" onClick={() => setSelectedStudent(null)} className="text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase">
                        Cancelar
                      </button>
                    </div>
                    <form onSubmit={handleApplyOverride} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold block mb-1">Nueva categoría</label>
                        <select required value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]">
                          <option value="">-- Seleccionar --</option>
                          {categoryOptions.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-400 font-bold block mb-1">Nivel</label>
                        <select value={newLevel} onChange={(event) => setNewLevel(event.target.value)} className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]">
                          <option value="">Sin nivel específico</option>
                          {LEVEL_OPTIONS.map((level) => (
                            <option key={level.value} value={level.value}>{level.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[8px] text-slate-400 font-bold block mb-1">Justificación técnica</label>
                        <input required value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Ej. Nivel superior o solicitud familiar" className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]" />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="submit" disabled={studentActionLoading} className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-6 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed">
                          {studentActionLoading ? "Guardando..." : "Guardar Excepción"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {managedStudent && (
                  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#0e121e]/95 border border-slate-800 rounded-3xl shadow-2xl animate-fade-in">
                      <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[9px] font-mono text-sky-400 font-black uppercase tracking-widest block">Ciclo de vida del alumno</span>
                          <h3 className="font-display font-black text-lg text-slate-100 uppercase tracking-wide mt-1">{managedStudent.name}</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Estado actual: <span className="text-slate-300 font-bold">{managedStudent.status || "Sin estado"}</span></p>
                        </div>
                        <button type="button" onClick={closeLifecycleModal} className="self-start sm:self-center bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold px-4 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider">
                          Cerrar
                        </button>
                      </div>
                      <div className="p-5 sm:p-6 space-y-5">
                        {lifecycleMessage && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            <span>{lifecycleMessage}</span>
                          </div>
                        )}
                        {lifecycleError && (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{lifecycleError}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(lifecycleActions).map(([key, action]) => {
                            const toneClasses = {
                              emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:border-emerald-500/50",
                              amber: "border-amber-500/25 bg-amber-500/5 text-amber-500 hover:border-amber-500/50",
                              slate: "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500",
                              red: "border-red-500/25 bg-red-500/5 text-red-400 hover:border-red-500/50"
                            };
                            return (
                              <button key={key} type="button" onClick={() => prepareLifecycleAction(key)} className={`text-left border rounded-2xl p-4 transition-all cursor-pointer ${toneClasses[action.tone]} ${pendingLifecycleAction === key ? "ring-1 ring-current" : ""}`}>
                                <span className="font-display font-black text-xs uppercase tracking-wider block">{action.label}</span>
                                <span className="text-[10px] text-slate-400 leading-relaxed block mt-2">{action.description}</span>
                              </button>
                            );
                          })}
                        </div>
                        {pendingLifecycleAction && pendingLifecycleAction !== "delete" && (
                          <div className="bg-[#07090e]/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                            <div>
                              <h4 className="font-display font-black text-xs uppercase tracking-wider text-slate-200">Confirmar: {lifecycleActions[pendingLifecycleAction].label}</h4>
                              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Esta acción actualizará el estado administrativo y conservará historial, pagos, asistencias, evaluaciones, padre y categoría.</p>
                            </div>
                            {(pendingLifecycleAction === "suspend" || pendingLifecycleAction === "inactive") && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <select value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} className="bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]">
                                  <option value="">Motivo administrativo opcional</option>
                                  {lifecycleReasonOptions[pendingLifecycleAction].map((reason) => (
                                    <option key={reason} value={reason}>{reason}</option>
                                  ))}
                                </select>
                                {lifecycleReason === "Otro" && (
                                  <input value={lifecycleOtherReason} onChange={(event) => setLifecycleOtherReason(event.target.value)} placeholder="Detalle del motivo" className="bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]" />
                                )}
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setPendingLifecycleAction(null)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold px-4 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider">Cancelar</button>
                              <button type="button" onClick={executeLifecycleStatusAction} disabled={lifecycleLoading} className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-5 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider">
                                {lifecycleLoading ? "Aplicando..." : "Confirmar acción"}
                              </button>
                            </div>
                          </div>
                        )}
                        {pendingLifecycleAction === "delete" && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-4">
                            <div>
                              <h4 className="font-display font-black text-xs uppercase tracking-wider text-red-400">Eliminación protegida</h4>
                              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">El borrado físico está bloqueado si existe cualquier historial o relación. Escriba ELIMINAR para validar la protección.</p>
                            </div>
                            {lifecycleHistory && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                <div className="bg-[#07090e] border border-slate-800 rounded-xl p-3"><b className="text-slate-200">{lifecycleHistory.payments || 0}</b><br />pagos</div>
                                <div className="bg-[#07090e] border border-slate-800 rounded-xl p-3"><b className="text-slate-200">{lifecycleHistory.attendance || 0}</b><br />asistencias</div>
                                <div className="bg-[#07090e] border border-slate-800 rounded-xl p-3"><b className="text-slate-200">{lifecycleHistory.evaluations || 0}</b><br />evaluaciones</div>
                                <div className="bg-[#07090e] border border-slate-800 rounded-xl p-3"><b className="text-slate-200">{lifecycleHistory.total || 0}</b><br />total</div>
                              </div>
                            )}
                            <input value={lifecycleDeleteText} onChange={(event) => setLifecycleDeleteText(event.target.value)} className="w-full bg-[#0e121e] border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-300 focus:outline-none focus:border-red-500 font-mono" placeholder="ELIMINAR" />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setPendingLifecycleAction(null)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-bold px-4 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider">Cancelar</button>
                              <button type="button" onClick={executeProtectedDelete} disabled={lifecycleLoading || lifecycleDeleteText !== "ELIMINAR"} className="bg-red-500 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-5 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider">
                                {lifecycleLoading ? "Validando..." : "Validar eliminación"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {phoneModalOpen && selectedParentStudent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-sans">
                    <div className="bg-[#07090e] border border-slate-800 p-6 rounded-2xl w-full max-w-md space-y-4 text-left shadow-2xl relative">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-1.5 text-[#10b981]">
                          <Smartphone className="w-4 h-4" />
                          <h3 className="font-display font-bold text-xs uppercase tracking-wider">Editar Teléfono del Acudiente</h3>
                        </div>
                        <button
                          type="button"
                          onClick={closePhoneModal}
                          className="text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 bg-slate-900/50 p-3.5 rounded-xl border border-slate-850 space-y-1.5">
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Deportista:</span>
                          <span className="font-bold text-slate-200 text-right">{selectedParentStudent.name}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Nombre Acudiente:</span>
                          <span className="font-bold text-slate-200 text-right">{selectedParentStudent.parentName || "Sin nombre registrado"}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Teléfono Actual:</span>
                          <span className="font-bold text-slate-200 font-mono text-right">{selectedParentStudent.parentPhone || "No asignado"}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-800 text-[9px] text-slate-500 italic">
                          {selectedParentStudent.parentUid ? (
                            <span className="text-emerald-400 font-medium">El acudiente ya está registrado. Se actualizará su cuenta de autenticación SMS en Firebase Auth y su perfil.</span>
                          ) : (
                            <span className="text-amber-400 font-medium">El acudiente no se ha registrado aún. Se corregirá el teléfono de enlace en la ficha del alumno.</span>
                          )}
                        </div>
                      </div>

                      {phoneError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-[10px] font-medium">
                          {phoneError}
                        </div>
                      )}

                      {phoneSuccess && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-[10px] font-medium animate-pulse">
                          {phoneSuccess}
                        </div>
                      )}

                      <form onSubmit={handleUpdatePhoneSubmit} className="space-y-4">
                        <div>
                          <label className="text-[8px] text-slate-400 font-bold block mb-1">NUEVO NÚMERO DE TELÉFONO (E.164)</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. +521234567890 o 10 dígitos"
                            value={newParentPhone}
                            onChange={(event) => setNewParentPhone(event.target.value)}
                            className="w-full bg-[#0e121e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#10b981] font-mono"
                            disabled={phoneUpdating}
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={closePhoneModal}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-350 font-display font-bold text-[10px] px-5 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                            disabled={phoneUpdating}
                          >
                            Cerrar
                          </button>
                          <button
                            type="submit"
                            className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-6 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                            disabled={phoneUpdating}
                          >
                            {phoneUpdating ? "Guardando..." : "Guardar Cambios"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "parent-link" ? (
              <div className="pt-4 space-y-5 font-sans">
                <div>
                  <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                    Vincular Cuenta Padre
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Diagnóstico y vinculación explícita de una cuenta Auth con alumnos concretos.
                  </p>
                </div>

                <form
                  onSubmit={handleParentLinkSearch}
                  className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-[150px_1fr_auto] gap-3"
                >
                  <select
                    value={parentLinkIdentifierType}
                    onChange={(event) => setParentLinkIdentifierType(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#10b981]"
                  >
                    <option value="phone">Teléfono</option>
                    <option value="uid">UID</option>
                    <option value="email">Correo</option>
                  </select>
                  <input
                    value={parentLinkIdentifier}
                    onChange={(event) => setParentLinkIdentifier(event.target.value)}
                    placeholder="Identificador de la cuenta padre"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#10b981]"
                  />
                  <button
                    type="submit"
                    disabled={parentLinkLoading || !parentLinkIdentifier.trim()}
                    className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-4 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {parentLinkLoading ? "Buscando..." : "Diagnosticar"}
                  </button>
                </form>

                {parentLinkError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{parentLinkError}</span>
                  </div>
                )}

                {parentLinkMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{parentLinkMessage}</span>
                  </div>
                )}

                {parentLinkResult && (
                  <div className="space-y-4">
                    <div className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-2">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Usuario localizado</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <span className="min-w-0">UID: <b className="text-slate-200 font-mono break-all">{parentLinkResult.parent.uid}</b></span>
                        <span>Auth: <b className="text-slate-200">{parentLinkResult.parent.authExists ? "Existe" : "No existe"}</b></span>
                        <span className="min-w-0">Teléfono: <b className="text-slate-200 font-mono break-all">{parentLinkResult.parent.phone || "Sin registro"}</b></span>
                        <span className="min-w-0">Correo: <b className="text-slate-200 break-all">{parentLinkResult.parent.email || "Sin registro"}</b></span>
                        <span>Estado: <b className="text-slate-200">{parentLinkResult.parent.status || "Sin users/{uid}"}</b></span>
                        <span>Alumno(s) actuales: <b className="text-slate-200">{parentLinkResult.parent.studentIds?.length || 0}</b></span>
                      </div>
                    </div>

                    {parentLinkResult.warnings?.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3.5 rounded-xl text-xs space-y-1">
                        {parentLinkResult.warnings.map((warning) => (
                          <div key={warning} className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Alumnos candidatos</h3>
                      {parentLinkResult.students.length === 0 ? (
                        <div className="text-xs text-slate-500">No hay alumnos candidatos.</div>
                      ) : parentLinkResult.students.map((student) => (
                        <label
                          key={student.studentId}
                          className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border ${
                            student.conflict ? "border-red-500/30 bg-red-500/5" : "border-slate-800 bg-[#0e121e]/70"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={parentLinkSelectedIds.includes(student.studentId)}
                                onChange={() => toggleParentLinkStudent(student.studentId)}
                                disabled={!student.canLink}
                                className="accent-[#10b981]"
                              />
                              <span className="text-xs font-bold text-slate-200">{student.name || student.studentId}</span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                student.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500"
                              }`}>
                                {student.status || "sin status"}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono break-all">ID: {student.studentId}</div>
                          </div>
                          <div className="text-[9px] text-slate-500 md:text-right">
                            <div>billingStatus: <b className="text-slate-300">{student.billingStatus || "sin dato"}</b></div>
                            <div className="break-all">parentUid: <b className={student.conflict ? "text-red-400" : "text-slate-300"}>{student.parentUid || "vacío"}</b></div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Pagos relacionados</h3>
                      {parentLinkResult.payments.length === 0 ? (
                        <div className="text-xs text-slate-500">No hay pagos relacionados.</div>
                      ) : parentLinkResult.payments.map((payment) => (
                        <div key={payment.paymentId} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px] text-slate-400 border border-slate-850 rounded-xl p-3 min-w-0">
                          <span className="font-mono text-slate-300 break-all">{payment.paymentId}</span>
                          <span className="break-all">studentId: {payment.studentId || "vacío"}</span>
                          <span>status: {payment.status || "vacío"}</span>
                          <span className="break-all">parentUid: {payment.parentUid || "vacío"}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl">
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        La vinculación no cambia estados de alumnos ni pagos. Solo conecta la cuenta padre con los alumnos seleccionados y completa parentUid en pagos históricos exactos.
                      </p>
                      <button
                        type="button"
                        onClick={handleParentLinkSubmit}
                        disabled={parentLinkSaving || parentLinkSelectedIds.length === 0}
                        className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        {parentLinkSaving ? "Vinculando..." : `Vincular (${parentLinkSelectedIds.length})`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === "billing" ? (
              <div className="pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                      Control de Mora y Recaudos
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                      Valida pagos reportados y procesa suspensiones por mora cuando corresponda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleProcessSuspensions}
                    disabled={paymentActionLoading}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-display font-bold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {paymentActionLoading ? (
                      "Procesando..."
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        Procesar Suspensión por Mora
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Pendientes</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{pendingPayments.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Mostrados</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{filteredPayments.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado</p>
                    <p className="text-xs font-bold text-[#10b981] mt-2">
                      {paymentsLoading ? "Cargando" : "Sincronizado"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="search"
                    value={paymentSearch}
                    onChange={(event) => setPaymentSearch(event.target.value)}
                    placeholder="Buscar pago"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                  />
                  <select
                    value={paymentStatusFilter}
                    onChange={(event) => setPaymentStatusFilter(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="on_hold">En espera</option>
                  </select>
                  <select
                    value={paymentSort}
                    onChange={(event) => setPaymentSort(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="amount-desc">Monto mayor</option>
                    <option value="amount-asc">Monto menor</option>
                  </select>
                </div>

                {paymentsError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs">
                    {paymentsError}
                  </div>
                )}

                {paymentSuccessMessage && (
                  <div className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{paymentSuccessMessage}</span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3">Alumno</th>
                        <th className="pb-3">Categoría</th>
                        <th className="pb-3">Monto</th>
                        <th className="pb-3">Tipo</th>
                        <th className="pb-3">Fecha</th>
                        <th className="pb-3">Estado</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {paymentsLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            Cargando pagos pendientes...
                          </td>
                        </tr>
                      ) : filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            No hay pagos pendientes para mostrar.
                          </td>
                        </tr>
                      ) : filteredPayments.map((payment) => (
                        <tr key={payment.id} className="text-xs">
                          <td className="py-3 font-bold text-slate-200">{payment.studentName || "Sin nombre"}</td>
                          <td className="py-3 text-slate-400">{payment.categoryName || "Sin categoría"}</td>
                          <td className="py-3 text-red-400 font-bold">{formatCurrency(payment.amount)}</td>
                          <td className="py-3 text-slate-400">{payment.paymentType || "Mensualidad"}</td>
                          <td className="py-3 text-slate-500 font-mono text-[10px]">{payment.date || "Sin fecha"}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase">
                              {payment.status || "pending"}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApprovePayment(payment.id)}
                                disabled={approvingPaymentId === payment.id || paymentActionLoading}
                                className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-3 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                              >
                                {approvingPaymentId === payment.id ? "Aprobando..." : "OK"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHoldPayment(payment.id, payment.studentId || payment.studentName)}
                                disabled={paymentActionLoading}
                                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-3 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                              >
                                En Espera
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "evaluations" ? (
              <div className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Evaluaciones</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{evaluations.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Mostradas</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{filteredEvaluations.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado</p>
                    <p className="text-xs font-bold text-[#10b981] mt-2">
                      {evaluationsLoading ? "Cargando" : "Sincronizado"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="search"
                    value={evaluationSearch}
                    onChange={(event) => setEvaluationSearch(event.target.value)}
                    placeholder="Buscar evaluación"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                  />
                  <select
                    value={evaluationHealthFilter}
                    onChange={(event) => setEvaluationHealthFilter(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="all">Todos los estados físicos</option>
                    <option value="optimal">Óptimo</option>
                    <option value="fatigue">Fatiga</option>
                    <option value="injured">Lesión</option>
                  </select>
                  <select
                    value={evaluationSort}
                    onChange={(event) => setEvaluationSort(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguas</option>
                    <option value="average-desc">Promedio mayor</option>
                    <option value="average-asc">Promedio menor</option>
                  </select>
                </div>

                {evaluationsError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs">
                    {evaluationsError}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3">Alumno</th>
                        <th className="pb-3">Fecha</th>
                        <th className="pb-3">Promedio</th>
                        <th className="pb-3">Vel.</th>
                        <th className="pb-3">Pase</th>
                        <th className="pb-3">Físico</th>
                        <th className="pb-3">Estado físico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {evaluationsLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            Cargando evaluaciones...
                          </td>
                        </tr>
                      ) : filteredEvaluations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            No hay evaluaciones para mostrar.
                          </td>
                        </tr>
                      ) : filteredEvaluations.map((evaluation) => {
                        const metrics = evaluation.metrics || {};
                        const healthStatus = evaluation.healthStatus || "optimal";

                        return (
                          <tr key={evaluation.id} className="text-xs">
                            <td className="py-3 font-bold text-slate-200">{evaluation.studentName || "Sin nombre"}</td>
                            <td className="py-3 text-slate-500 font-mono text-[10px]">{evaluation.date || "Sin fecha"}</td>
                            <td className="py-3 text-[#10b981] font-bold">{getEvaluationAverage(evaluation)}</td>
                            <td className="py-3 text-slate-400">{metrics.speed ?? "-"}</td>
                            <td className="py-3 text-slate-400">{metrics.passing ?? "-"}</td>
                            <td className="py-3 text-slate-400">{metrics.physical ?? "-"}</td>
                            <td className="py-3">
                              <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[9px] font-black uppercase">
                                {healthStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "schedules" ? (
              <div className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Horarios semanales</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{trainingSchedules.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Eventos únicos</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{events.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado</p>
                    <p className="text-xs font-bold text-[#10b981] mt-2">
                      {eventsLoading || schedulesLoading ? "Cargando" : "Sincronizado"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSchedule} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                        {editingScheduleId ? "Editar horario semanal" : "Crear horario semanal"}
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Los horarios se filtran por categoría y nivel sin afectar eventos, partidos ni RSVP.
                      </p>
                    </div>
                    {editingScheduleId && (
                      <button
                        type="button"
                        onClick={resetScheduleForm}
                        className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 text-[10px] font-black uppercase hover:text-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={scheduleTitle}
                      onChange={(event) => setScheduleTitle(event.target.value)}
                      placeholder="Título del entrenamiento"
                      required
                      className="md:col-span-2 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <select
                      value={scheduleDayOfWeek}
                      onChange={(event) => setScheduleDayOfWeek(Number(event.target.value))}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <option key={day.value} value={day.value}>{day.label}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={scheduleStartTime}
                      onChange={(event) => setScheduleStartTime(event.target.value)}
                      required
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    />
                    <input
                      type="time"
                      value={scheduleEndTime}
                      onChange={(event) => setScheduleEndTime(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    />
                    <select
                      value={scheduleCategory}
                      onChange={(event) => setScheduleCategory(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleLevel}
                      onChange={(event) => setScheduleLevel(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      <option value="">Todos los niveles</option>
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                    <select
                      value={scheduleCoachUid}
                      onChange={(event) => setScheduleCoachUid(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      <option value="">Sin entrenador asignado</option>
                      {scheduleCoaches.map((coach) => (
                        <option key={coach.uid} value={coach.uid}>{coach.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={scheduleLocation}
                      onChange={(event) => setScheduleLocation(event.target.value)}
                      placeholder="Sede o cancha"
                      required
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <textarea
                      value={scheduleDescription}
                      onChange={(event) => setScheduleDescription(event.target.value)}
                      placeholder="Descripción del entrenamiento"
                      rows={3}
                      className="md:col-span-4 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981] resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={schedulesActionLoading}
                    className="px-4 py-2 rounded-xl bg-[#10b981] text-slate-950 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {schedulesActionLoading ? "Guardando..." : editingScheduleId ? "Guardar Horario" : "Crear Horario"}
                  </button>
                </form>

                {(schedulesError || schedulesSuccessMessage) && (
                  <div className={`p-3.5 rounded-xl text-xs ${
                    schedulesError
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  }`}>
                    {schedulesError || schedulesSuccessMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {schedulesLoading ? (
                    <div className="md:col-span-2 py-8 text-center text-xs text-slate-500">
                      Cargando horarios semanales...
                    </div>
                  ) : trainingSchedules.length === 0 ? (
                    <div className="md:col-span-2 py-8 text-center text-xs text-slate-500">
                      Aún no hay horarios semanales registrados.
                    </div>
                  ) : trainingSchedules.map((schedule) => (
                    <article key={schedule.id} className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-100">{schedule.title || "Horario sin título"}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{schedule.description || "Sin descripción"}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase shrink-0 ${
                          schedule.active ? "bg-emerald-500/10 text-[#10b981]" : "bg-slate-800 text-slate-400"
                        }`}>
                          {schedule.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4 text-[10px]">
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Día</p>
                          <p className="text-slate-300 mt-1">{getWeekdayLabel(schedule.dayOfWeek)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Hora</p>
                          <p className="text-slate-300 font-mono mt-1">{schedule.startTime || "--:--"}{schedule.endTime ? ` - ${schedule.endTime}` : ""}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Categoría</p>
                          <p className="text-slate-300 mt-1">{schedule.category || "Sin categoría"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Nivel</p>
                          <p className="text-slate-300 mt-1">{schedule.level ? getLevelLabel(schedule.level) : "Todos"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Entrenador</p>
                          <p className="text-slate-300 mt-1">{schedule.coachName || "Sin asignar"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Sede</p>
                          <p className="text-slate-300 mt-1">{schedule.location || "Sin sede"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button type="button" onClick={() => handleEditSchedule(schedule)} disabled={schedulesActionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase hover:text-white transition-all disabled:opacity-50">
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                        <button type="button" onClick={() => toggleScheduleStatus(schedule.id, !schedule.active)} disabled={schedulesActionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase hover:text-white transition-all disabled:opacity-50">
                          {schedule.active ? "Desactivar" : "Activar"}
                        </button>
                        <button type="button" onClick={() => handleDeleteSchedule(schedule.id)} disabled={schedulesActionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-black uppercase hover:bg-red-500/20 transition-all disabled:opacity-50">
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <form onSubmit={handleSaveEvent} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                        {editingEventId ? "Editar evento" : "Crear evento"}
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        El calendario se actualiza automáticamente mediante el listener existente.
                      </p>
                    </div>
                    {editingEventId && (
                      <button
                        type="button"
                        onClick={handleCancelEventEdit}
                        className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 text-[10px] font-black uppercase hover:text-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                      placeholder="Título del evento"
                      required
                      className="md:col-span-2 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <select
                      value={eventType}
                      onChange={(event) => setEventType(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      <option value="training">Entrenamiento</option>
                      <option value="match">Partido</option>
                      <option value="meeting">Reunión</option>
                      <option value="other">Otro</option>
                    </select>
                    <select
                      value={eventCategory}
                      onChange={(event) => setEventCategory(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      <option value="Todas">Todas</option>
                      <option value="Sub-8 Iniciación">Sub-8 Iniciación</option>
                      <option value="Sub-10 Competitivo">Sub-10 Competitivo</option>
                      <option value="Sub-12 Elite">Sub-12 Elite</option>
                      <option value="Sub-15 Avanzado">Sub-15 Avanzado</option>
                    </select>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(event) => setEventDate(event.target.value)}
                      required
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    />
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(event) => setEventTime(event.target.value)}
                      required
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    />
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(event) => setEventLocation(event.target.value)}
                      placeholder="Lugar"
                      className="md:col-span-2 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <textarea
                      value={eventDescription}
                      onChange={(event) => setEventDescription(event.target.value)}
                      placeholder="Descripción"
                      rows={3}
                      className="md:col-span-4 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981] resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={eventsActionLoading}
                    className="px-4 py-2 rounded-xl bg-[#10b981] text-slate-950 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {eventsActionLoading ? "Guardando..." : editingEventId ? "Guardar Cambios" : "Crear Evento"}
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="search"
                    value={eventSearch}
                    onChange={(event) => setEventSearch(event.target.value)}
                    placeholder="Buscar evento"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                  />
                  <select
                    value={eventTypeFilter}
                    onChange={(event) => setEventTypeFilter(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="all">Todos los tipos</option>
                    <option value="training">Entrenamiento</option>
                    <option value="match">Partido</option>
                    <option value="meeting">Reunión</option>
                    <option value="other">Otro</option>
                  </select>
                  <select
                    value={eventSort}
                    onChange={(event) => setEventSort(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="date-asc">Fecha ascendente</option>
                    <option value="date-desc">Fecha descendente</option>
                    <option value="title-asc">Título A-Z</option>
                    <option value="title-desc">Título Z-A</option>
                  </select>
                </div>

                {eventsError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs">
                    {eventsError}
                  </div>
                )}

                {eventsSuccessMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs">
                    {eventsSuccessMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {eventsLoading ? (
                    <div className="md:col-span-2 py-8 text-center text-xs text-slate-500">
                      Cargando eventos...
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="md:col-span-2 py-8 text-center text-xs text-slate-500">
                      No hay eventos para mostrar.
                    </div>
                  ) : filteredEvents.map((event) => (
                    <article key={event.id} className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-100">{event.title || "Evento sin título"}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{event.description || "Sin descripción"}</p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[9px] font-black uppercase shrink-0">
                          {event.type || "training"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4 text-[10px]">
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Fecha</p>
                          <p className="text-slate-300 font-mono mt-1">{event.date || "Sin fecha"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Hora</p>
                          <p className="text-slate-300 font-mono mt-1">{event.time || "Sin hora"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Categoría</p>
                          <p className="text-slate-300 mt-1">{event.category || "Todas"}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 uppercase font-bold tracking-wider">Lugar</p>
                          <p className="text-slate-300 mt-1">{event.location || "Sin sede"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => handleEditEvent(event)}
                          disabled={eventsActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase hover:text-white transition-all disabled:opacity-50"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={eventsActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-black uppercase hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3">Fecha</th>
                        <th className="pb-3">Hora</th>
                        <th className="pb-3">Evento</th>
                        <th className="pb-3">Tipo</th>
                        <th className="pb-3">Categoría</th>
                        <th className="pb-3">Lugar</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {eventsLoading ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            Cargando calendario...
                          </td>
                        </tr>
                      ) : filteredEvents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                            No hay eventos para mostrar.
                          </td>
                        </tr>
                      ) : filteredEvents.map((event) => (
                        <tr key={event.id} className="text-xs">
                          <td className="py-3 text-slate-500 font-mono text-[10px]">{event.date || "Sin fecha"}</td>
                          <td className="py-3 text-slate-500 font-mono text-[10px]">{event.time || "Sin hora"}</td>
                          <td className="py-3 font-bold text-slate-200">{event.title || "Evento sin título"}</td>
                          <td className="py-3 text-slate-400">{event.type || "training"}</td>
                          <td className="py-3 text-slate-400">{event.category || "Todas"}</td>
                          <td className="py-3 text-slate-400">{event.location || "Sin sede"}</td>
                          <td className="py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditEvent(event)}
                                disabled={eventsActionLoading}
                                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-all disabled:opacity-50"
                                aria-label="Editar evento"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(event.id)}
                                disabled={eventsActionLoading}
                                className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                aria-label="Eliminar evento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "drills" ? (
              <div className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Ejercicios</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{drills.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Mostrados</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{filteredDrills.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado</p>
                    <p className="text-xs font-bold text-[#10b981] mt-2">
                      {drillsLoading ? "Cargando" : "Sincronizado"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveDrill} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                        {editingDrillId ? "Editar ejercicio" : "Crear ejercicio"}
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        La biblioteca se actualiza automáticamente mediante el listener existente.
                      </p>
                    </div>
                    {editingDrillId && (
                      <button
                        type="button"
                        onClick={handleCancelDrillEdit}
                        className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 text-[10px] font-black uppercase hover:text-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={drillTitle}
                      onChange={(event) => setDrillTitle(event.target.value)}
                      placeholder="Título del ejercicio"
                      required
                      className="md:col-span-2 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <select
                      value={drillCategory}
                      onChange={(event) => setDrillCategory(event.target.value)}
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                    >
                      <option value="técnica">Técnica individual</option>
                      <option value="físico">Físico y coordinación</option>
                      <option value="táctica">Táctica de juego</option>
                    </select>
                    <input
                      type="url"
                      value={drillVideoUrl}
                      onChange={(event) => setDrillVideoUrl(event.target.value)}
                      placeholder="URL del video"
                      className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                    />
                    <textarea
                      value={drillDescription}
                      onChange={(event) => setDrillDescription(event.target.value)}
                      placeholder="Descripción"
                      rows={3}
                      className="md:col-span-4 bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981] resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={drillsActionLoading}
                    className="px-4 py-2 rounded-xl bg-[#10b981] text-slate-950 text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {drillsActionLoading ? "Guardando..." : editingDrillId ? "Guardar Cambios" : "Crear Ejercicio"}
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="search"
                    value={drillSearch}
                    onChange={(event) => setDrillSearch(event.target.value)}
                    placeholder="Buscar ejercicio"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                  />
                  <select
                    value={drillCategoryFilter}
                    onChange={(event) => setDrillCategoryFilter(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="all">Todas las categorías</option>
                    <option value="técnica">Técnica individual</option>
                    <option value="físico">Físico y coordinación</option>
                    <option value="táctica">Táctica de juego</option>
                  </select>
                  <select
                    value={drillSort}
                    onChange={(event) => setDrillSort(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="title-asc">Título A-Z</option>
                    <option value="title-desc">Título Z-A</option>
                    <option value="category-asc">Categoría A-Z</option>
                    <option value="category-desc">Categoría Z-A</option>
                  </select>
                </div>

                {drillsError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs">
                    {drillsError}
                  </div>
                )}

                {drillsSuccessMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs">
                    {drillsSuccessMessage}
                  </div>
                )}

                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Video className="w-4 h-4 text-[#10b981]" />
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                      Videos de la Biblioteca
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Ejercicios y recursos multimedia disponibles para seguimiento deportivo.
                    </p>
                  </div>
                </div>

                {drillsLoading ? (
                  <div className="text-center text-xs text-slate-500 bg-[#07090e]/40 p-6 rounded-xl font-sans">
                    Cargando biblioteca de ejercicios...
                  </div>
                ) : filteredDrills.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 bg-[#07090e]/40 p-6 rounded-xl font-sans">
                    No hay videos en la biblioteca.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredDrills.map((drill) => (
                      <div
                        key={drill.id}
                        className="bg-[#07090e]/60 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between gap-3 text-left animate-fade-in"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[8px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-slate-400 uppercase tracking-wider">
                              {drill.category || "Sin categoría"}
                            </span>
                            <span className="text-[8px] font-mono text-slate-600">
                              {drill.date || ""}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-200 text-xs mt-1.5">
                            {drill.title || "Ejercicio sin título"}
                          </h4>
                          <p className="text-[10px] text-slate-450 mt-1 line-clamp-2 leading-relaxed font-sans">
                            {drill.description || "Sin descripción"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditDrill(drill)}
                            disabled={drillsActionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase hover:text-white transition-all disabled:opacity-50"
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDrill(drill.id)}
                            disabled={drillsActionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-black uppercase hover:bg-red-500/20 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>
                        {(() => {
                          const videoInfo = parseVideoUrl(drill.videoUrl);
                          if (videoInfo.type === "youtube" || videoInfo.type === "vimeo") {
                            return (
                              <iframe
                                src={videoInfo.embedUrl}
                                title={drill.title || "Video de entrenamiento"}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full rounded-xl bg-slate-950 border border-slate-900 aspect-video"
                              />
                            );
                          }

                          if (videoInfo.embedUrl) {
                            return (
                              <video
                                src={videoInfo.embedUrl}
                                className="w-full rounded-lg bg-slate-950 aspect-video object-cover"
                                controls
                              />
                            );
                          }

                          return (
                            <div className="w-full rounded-xl bg-slate-950 border border-slate-900 aspect-video flex items-center justify-center text-[10px] text-slate-600">
                              Video no disponible
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "leaderboard" ? (
              <div className="pt-4 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {memoizedLeaderboard.slice(0, 3).map((item, index) => {
                    const podiumStyles = [
                      "border-amber-500/30 bg-amber-500/10 text-amber-300",
                      "border-slate-500/30 bg-slate-500/10 text-slate-300",
                      "border-orange-700/30 bg-orange-700/10 text-orange-300"
                    ];
                    const podiumLabels = ["1er Lugar", "2do Lugar", "3er Lugar"];

                    return (
                      <div key={item.id} className={`border rounded-2xl p-4 ${podiumStyles[index]}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[9px] font-black uppercase tracking-wider">{podiumLabels[index]}</span>
                          <Trophy className="w-4 h-4" />
                        </div>
                        <p className="mt-3 text-sm font-black text-slate-100">{item.name}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{item.category || "Sin categoría"}</p>
                        <p className="mt-3 text-xs font-mono font-black">
                          {item.overallPoints !== null ? `${item.overallPoints} pts` : "Sin información"}
                        </p>
                      </div>
                    );
                  })}
                  {memoizedLeaderboard.length === 0 && (
                    <div className="md:col-span-3 bg-[#07090e]/60 border border-slate-800 rounded-2xl p-6 text-center">
                      <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">Aún no hay registros para la tabla de honor.</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
                    <div>
                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                        Tabla de Honor
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Ranking mensual basado en asistencia (40%) y promedio técnico (60%).
                      </p>
                    </div>
                    <Trophy className="w-5 h-5 text-[#10b981]" />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-slate-850 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="pb-3 text-center w-12">Rango</th>
                          <th className="pb-3">Deportista</th>
                          <th className="pb-3">Categoría</th>
                          <th className="pb-3 text-center">Ficha Técnica</th>
                          <th className="pb-3 text-center">Asistencia</th>
                          <th className="pb-3 text-right pr-4">Puntaje Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {memoizedLeaderboard.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                              Aún no hay registros
                            </td>
                          </tr>
                        ) : memoizedLeaderboard.map((item, index) => {
                          const isTop3 = index < 3;
                          const placeColors = [
                            "text-amber-400 bg-amber-500/10 border border-amber-500/20",
                            "text-slate-300 bg-slate-500/10 border border-slate-500/20",
                            "text-orange-300 bg-orange-700/10 border border-orange-700/20"
                          ];

                          return (
                            <tr key={item.id} className="text-xs">
                              <td className="py-3 text-center font-black">
                                {isTop3 ? (
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-[10px] ${placeColors[index]}`}>
                                    {index + 1}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono">#{index + 1}</span>
                                )}
                              </td>
                              <td className="py-3 font-bold text-slate-200">{item.name}</td>
                              <td className="py-3 text-slate-400">
                                <span className="bg-[#07090e] px-2 py-0.5 rounded border border-slate-850 text-[8px] uppercase tracking-wider font-mono">
                                  {item.category || "Sin categoría"}
                                </span>
                              </td>
                              <td className="py-3 text-center font-mono font-bold text-slate-300">
                                {item.avgScore !== null ? `${item.avgScore}/10` : "Sin información"}
                              </td>
                              <td className="py-3 text-center font-mono font-bold text-[#10b981]">
                                {item.attendanceRate !== null ? `${item.attendanceRate}%` : "Sin información"}
                              </td>
                              <td className="py-3 text-right font-mono font-black text-[#10b981] pr-4">
                                {item.overallPoints !== null ? (
                                  <>
                                    <span className="text-[13px]">{item.overallPoints}</span> pts
                                  </>
                                ) : (
                                  "Sin información"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === "notifications" ? (
              <div className="pt-4 space-y-5">
                <div>
                  <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">
                    Canal de Comunicados de Urgencia
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Envía y administra comunicados visibles para las familias del club.
                  </p>
                </div>

                {(announcementsError || announcementsSuccessMessage) && (
                  <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    announcementsError
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981]"
                  }`}>
                    {announcementsError ? (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{announcementsError || announcementsSuccessMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSendNotification} className="space-y-4 bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl">
                  <div>
                    <label className="text-[8px] text-slate-400 font-bold block mb-1">MENSAJE A TRANSMITIR</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Ej. Atención padres de familia: Debido a fuertes lluvias, los entrenamientos de la tarde quedan cancelados."
                      value={notificationText}
                      onChange={(event) => setNotificationText(event.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#10b981] resize-none"
                      disabled={announcementsActionLoading}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    {editingAnnouncementId && (
                      <button
                        type="button"
                        onClick={handleCancelAnnouncementEdit}
                        disabled={announcementsActionLoading}
                        className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 font-display font-bold text-[10px] px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                      >
                        Cancelar Edición
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={announcementsActionLoading || !notificationText.trim()}
                      className="bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-[10px] px-6 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {announcementsActionLoading
                        ? "Guardando..."
                        : editingAnnouncementId
                          ? "Guardar Cambios"
                          : "Enviar Comunicado Masivo"}
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Comunicados</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{announcements.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Mostrados</p>
                    <p className="text-2xl font-black text-slate-100 mt-1">{filteredAnnouncements.length}</p>
                  </div>
                  <div className="bg-[#07090e]/60 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Estado</p>
                    <p className="text-xs font-bold text-[#10b981] mt-2">
                      {announcementsLoading ? "Cargando" : "Sincronizado"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="search"
                    value={announcementSearch}
                    onChange={(event) => setAnnouncementSearch(event.target.value)}
                    placeholder="Buscar comunicado"
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#10b981]"
                  />
                  <select
                    value={announcementStatusFilter}
                    onChange={(event) => setAnnouncementStatusFilter(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Con mensaje</option>
                    <option value="empty">Vacíos</option>
                  </select>
                  <select
                    value={announcementSort}
                    onChange={(event) => setAnnouncementSort(event.target.value)}
                    className="bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#10b981]"
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="text-asc">Texto A-Z</option>
                    <option value="text-desc">Texto Z-A</option>
                  </select>
                </div>

                <div className="space-y-3">
                  {announcementsLoading ? (
                    <div className="text-center text-xs text-slate-500 bg-[#07090e]/40 p-6 rounded-xl">
                      Cargando comunicados...
                    </div>
                  ) : filteredAnnouncements.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 bg-[#07090e]/40 p-6 rounded-xl">
                      No hay comunicados para mostrar.
                    </div>
                  ) : filteredAnnouncements.map((announcement) => (
                    <article key={announcement.id} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                            {announcement.date || "Sin fecha"}
                          </p>
                          <p className="text-xs text-slate-200 leading-relaxed mt-2">
                            {announcement.text || "Sin comunicado activo"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditAnnouncement(announcement)}
                            className="bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 text-[9px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteAnnouncement}
                            disabled={announcementsActionLoading}
                            className="bg-slate-900 border border-slate-800 text-red-400 hover:text-red-300 disabled:text-slate-600 text-[9px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-center">
                <p className="text-xs text-slate-500 max-w-sm">
                  El contenido administrativo de esta pestaña permanece desactivado durante esta etapa.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
