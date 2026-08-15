"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut, ChartBar, CreditCard, Image as ImageIcon, Sparkles, Trophy, Calendar, CheckCircle2, Clock, AlertTriangle, Play, Pause, Activity, X, Users } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { signOut } from "firebase/auth";
import QRGenerator from "@/components/QRGenerator";
import RadarPerformance from "@/components/RadarPerformance";
import PaymentSimulator from "@/components/PaymentSimulator";
import { useParent, useAttendance, usePayments, useCalendar, useQR, useParentStudents } from "@/hooks";
import { useTrainingSchedules } from "@/hooks/useTrainingSchedules";
import LevelBadge from "@/components/LevelBadge";
import { calculateAttendanceSummary, getAttendanceStatusLabel, sortAttendanceNewestFirst } from "@/lib/attendanceModel";
import { getWeekdayLabel, trainingScheduleMatchesStudent } from "@/lib/trainingScheduleModel";
import { isEventPublished } from "@/lib/eventModel";
import { auth } from "@/lib/firebase";

const EMPTY_ARRAY = [];
const EVENT_TYPE_LABELS = {
  match: "Partido",
  training: "Entrenamiento",
  practice: "Entrenamiento",
  meeting: "Reunión",
  other: "Evento"
};

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

const getEventTypeLabel = (type) => EVENT_TYPE_LABELS[type] || "Evento";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const isUpcomingEvent = (event, todayKey) => !event.date || event.date >= todayKey;

const compareEventsAsc = (a, b) => {
  const dateA = a.date || "";
  const dateB = b.date || "";
  const timeA = a.time || "";
  const timeB = b.time || "";
  return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
};

const compareEventsDesc = (a, b) => compareEventsAsc(b, a);

export default function ParentDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("performance"); // 'performance' | 'events' | 'billing' | 'gallery'
  const [activeSubTab, setActiveSubTab] = useState("stats"); // 'stats' | 'calendar' | 'drills'
  const [userEmail, setUserEmail] = useState("");
  const [parentUid, setParentUid] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [chartMetric, setChartMetric] = useState("average"); // 'average' | 'speed' | 'passing' | ...
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const videoRefs = useRef({});
  const [mounted, setMounted] = useState(false);
  const [activePlaybackRates, setActivePlaybackRates] = useState({});
  const [rsvpFeedback, setRsvpFeedback] = useState({});

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSetSpeed = (drillId, speed) => {
    const vid = videoRefs.current[drillId];
    if (vid) {
      vid.playbackRate = speed;
      setActivePlaybackRates(prev => ({ ...prev, [drillId]: speed }));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión en Firebase Auth:", err);
    }

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (err) {
      console.error("Error al eliminar la sesión segura:", err);
    }

    router.push("/login");
  };

  // Invocar custom hooks para el Demo Mode / Firebase
  const { data: parentData, updateStatus: updateParentStatus } = useParent(parentUid);
  
  const studentIds = parentData?.studentIds || EMPTY_ARRAY;
  const { data: parentStudents } = useParentStudents(studentIds);
  const initialStudentId = selectedStudentId || studentIds[0] || parentData?.studentId || "";
  const initialStudentName = parentData?.studentName || "";
  
  const { data: studentData, updateStatus: updateStudentStatus } = useQR(initialStudentId, initialStudentName);
  
  const resolvedStudentId = studentData?.id || initialStudentId;
  const resolvedStudentName = studentData?.name || initialStudentName;
  const resolvedCategoryName = studentData?.category || parentData?.categoryName || "";
  
  const { data: attendanceData } = useAttendance(resolvedStudentId, resolvedStudentName);
  const { data: paymentsData, reportPayment } = usePayments(resolvedStudentId, parentUid, userEmail);
  const {
    data: calendarData,
    loading: eventsLoading,
    error: eventsError,
    updateRSVP
  } = useCalendar(resolvedCategoryName, {
    enabled: Boolean(resolvedStudentId),
    studentId: resolvedStudentId
  });
  const { schedules: allTrainingSchedules } = useTrainingSchedules({ includeCoaches: false });

  // DECLARACIÓN DE CONSTANTES DERIVADAS DE LOS HOOKS (REEMPLAZANDO LOS USESTATE Y USEEFFECTS)
  const representativeName = parentData?.displayName || parentData?.name || "";
  const isPendingAssignment = !parentData?.studentId && !parentData?.studentIds?.length;
  const studentName = studentData?.name || parentData?.studentName || "";
  const studentId = studentData?.id || initialStudentId;
  const categoryName = studentData?.category || parentData?.categoryName || "";
  const studentStatus = studentData?.status || parentData?.status || "";
  const studentHealth = studentData?.healthStatus || "optimal";

  const evalHistory = attendanceData?.evalHistory || [];
  const attendanceHistory = attendanceData?.attendanceHistory || EMPTY_ARRAY;
  const metrics = attendanceData?.metrics || null;
  const coachNotes = attendanceData?.coachNotes || "";
  const drills = attendanceData?.drills || [];
  const myPayments = paymentsData || [];
  const events = calendarData || EMPTY_ARRAY;
  const weeklySchedules = (allTrainingSchedules || []).filter((schedule) => trainingScheduleMatchesStudent(schedule, studentData));
  const todayKey = useMemo(() => getTodayKey(), []);
  const publishedEvents = useMemo(() => (
    events.filter(isEventPublished)
  ), [events]);
  const upcomingEvents = useMemo(() => (
    publishedEvents.filter((event) => isUpcomingEvent(event, todayKey)).sort(compareEventsAsc)
  ), [publishedEvents, todayKey]);
  const pastEvents = useMemo(() => (
    publishedEvents.filter((event) => !isUpcomingEvent(event, todayKey)).sort(compareEventsDesc)
  ), [publishedEvents, todayKey]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!parentUid || studentIds.length === 0) return;
    const storageKey = `parent:selectedStudent:${parentUid}`;
    const storedStudentId = typeof window !== "undefined" ? window.sessionStorage.getItem(storageKey) : "";
    const nextStudentId = storedStudentId && studentIds.includes(storedStudentId)
      ? storedStudentId
      : studentIds[0];
    setSelectedStudentId(prev => (prev && studentIds.includes(prev) ? prev : nextStudentId));
  }, [parentUid, studentIds]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleStudentSelection = (studentId) => {
    setSelectedStudentId(studentId);
    if (typeof window !== "undefined" && parentUid) {
      window.sessionStorage.setItem(`parent:selectedStudent:${parentUid}`, studentId);
    }
  };

  const getTrendData = () => {
    return evalHistory.map(ev => {
      const m = ev.metrics || {};
      const avg = ((m.speed || 0) + (m.passing || 0) + (m.dribbling || 0) + (m.shooting || 0) + (m.physical || 0) + (m.discipline || 0)) / 6;
      return {
        date: ev.date || "",
        speed: m.speed || 0,
        passing: m.passing || 0,
        dribbling: m.dribbling || 0,
        shooting: m.shooting || 0,
        physical: m.physical || 0,
        discipline: m.discipline || 0,
        average: Math.round(avg * 10) / 10
      };
    });
  };

  const sortedAttendanceHistory = React.useMemo(
    () => sortAttendanceNewestFirst(attendanceHistory),
    [attendanceHistory]
  );
  const attendanceSummary = React.useMemo(
    () => calculateAttendanceSummary(attendanceHistory),
    [attendanceHistory]
  );

  const getMetricColor = (metric) => {
    switch (metric) {
      case "speed": return "#0ea5e9";
      case "passing": return "#6366f1";
      case "dribbling": return "#f59e0b";
      case "shooting": return "#f43f5e";
      case "physical": return "#f97316";
      case "discipline": return "#d946ef";
      case "average":
      default:
        return "#10b981";
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) return;
        const session = await response.json();
        if (cancelled || !session.uid) return;
        const email = session.email ? session.email.toLowerCase() : "";
        setUserEmail(email);
        setParentUid(session.uid || "");
        setParentPhone(session.phone || "");
      } catch (err) {
        console.error("Error al cargar sesión segura:", err);
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Manejar respuesta de RSVP
  const handleRSVP = async (eventId, response) => {
    try {
      await updateRSVP(eventId, studentName, response, studentId);
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50); // Vibración física ligera de confirmación
      }
    } catch (err) {
      console.error("Error al actualizar RSVP:", err);
    }
  };

  const handlePaymentSuccess = async (amount, paymentLabel) => {
    if ((!parentUid && !userEmail) || !studentName || !resolvedStudentId) return;

    try {
      // 1. Guardar solicitud en la colección 'payments' mediante el hook usePayments
      await reportPayment({
        studentName: studentName,
        categoryName: categoryName,
        amount: amount,
        paymentType: paymentLabel,
        parentEmail: userEmail.toLowerCase(),
        parentUid: parentUid || ""
      });

      // 2. Cambiar estatus a 'pending_validation' en el perfil del usuario y del estudiante
      await updateParentStatus("pending_validation");
      await updateStudentStatus("pending_validation");

      localStorage.setItem("simulatedStatus", "pending_validation");
    } catch (err) {
      console.error("Error al reportar pago:", err);
    }
  };

  const renderClubEventCard = (event) => {
    const userResponse = event.rsvps?.[studentName] || null;
    const eventIsUpcoming = isUpcomingEvent(event, todayKey);
    const eventTypeLabel = getEventTypeLabel(event.type);

    return (
      <div key={event.id} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                event.type === "match" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-[#10b981]"
              }`}>
                {eventTypeLabel}
              </span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                eventIsUpcoming ? "bg-sky-500/10 text-sky-300" : "bg-slate-800 text-slate-400"
              }`}>
                {eventIsUpcoming ? "Próximo" : "Finalizado"}
              </span>
              <span className="text-[9px] text-slate-500 font-mono">{event.date || "Sin fecha"} • {event.time || "Sin hora"}</span>
            </div>
            <h4 className="font-bold text-slate-200 text-xs mt-1.5 truncate">{event.title || "Evento del club"}</h4>
            <p className="text-[10px] text-slate-450 mt-1 leading-normal">{event.description || "Sin descripción"}</p>
            <div className="text-[9px] text-slate-500 font-mono mt-1">{event.location || "Sin sede"}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-900/60 pt-2.5">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await handleRSVP(event.id, "confirmed");
                setRsvpFeedback(prev => ({ ...prev, [event.id]: "confirmed" }));
                setTimeout(() => {
                  setRsvpFeedback(prev => ({ ...prev, [event.id]: null }));
                }, 2500);
              }}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold font-display transition-all cursor-pointer flex items-center justify-center gap-1 ${
                userResponse === "confirmed"
                  ? "bg-[#10b981] text-slate-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Asistiré
            </button>
            <button
              onClick={async () => {
                await handleRSVP(event.id, "declined");
                setRsvpFeedback(prev => ({ ...prev, [event.id]: "declined" }));
                setTimeout(() => {
                  setRsvpFeedback(prev => ({ ...prev, [event.id]: null }));
                }, 2500);
              }}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold font-display transition-all cursor-pointer flex items-center justify-center gap-1 ${
                userResponse === "declined"
                  ? "bg-red-500 text-slate-950 font-black shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <X className="w-3.5 h-3.5" />
              No asistiré
            </button>
          </div>

          {rsvpFeedback[event.id] && (
            <div className={`text-[9px] font-bold text-center py-1 rounded-lg animate-fade-in ${
              rsvpFeedback[event.id] === "confirmed"
                ? "text-[#10b981] bg-emerald-500/10 border border-emerald-500/20"
                : "text-red-400 bg-red-500/10 border border-red-500/20"
            }`}>
              {rsvpFeedback[event.id] === "confirmed" ? "Asistencia confirmada con éxito" : "Inasistencia registrada"}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col">
      {/* Header */}
      <header className="glass-panel border-b border-slate-900 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-all">
          <div>
            <span className="font-display font-black text-xs uppercase tracking-wider text-slate-200 block">
              Portal Deportista <span className="text-[#10b981]">Club Colombia</span>
            </span>
            <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
              Representante: {representativeName || "Sin información disponible"}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="text-slate-400 hover:text-slate-200 font-display font-semibold text-xs transition-all"
          >
            Inicio
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="text-slate-400 hover:text-[#10b981] font-display font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      {/* Portal Welcome Section */}
      <div className="max-w-5xl w-full mx-auto px-4 pt-6 text-center flex flex-col items-center">
        <img 
          src="/logo.png" 
          alt="Escudo Club Colombia" 
          className="w-20 h-20 object-contain mb-3 filter drop-shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse-subtle" 
        />
        <h2 className="font-display font-black text-xl text-slate-100 uppercase tracking-wider">
          Portal del Deportista
        </h2>
        <p className="text-[9px] font-mono text-[#10b981] font-bold uppercase tracking-widest mt-1">
          Escuela de Fútbol Club Colombia
        </p>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: QR Card & Payment Simulator if Suspended */}
        <div className="md:col-span-1 flex flex-col items-center gap-6">
          {!isPendingAssignment && studentIds.length > 1 && (
            <div className="w-full bg-[#0e121e] border border-slate-900 rounded-2xl p-4 space-y-2 font-sans">
              <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black block">
                Deportista
              </label>
              <select
                value={initialStudentId}
                onChange={(e) => handleStudentSelection(e.target.value)}
                className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#10b981]"
              >
                {studentIds.map((id) => {
                  const optionStudent = parentStudents.find((student) => (student.studentId || student.id) === id);
                  const optionStatus = optionStudent?.status || "";
                  return (
                    <option key={id} value={id}>
                      {optionStudent?.name || id} {optionStatus ? `- ${optionStatus}` : ""}
                    </option>
                  );
                })}
              </select>
              <p className="text-[9px] text-slate-500 leading-relaxed">
                Cada deportista conserva su propio QR, estado, pagos, calendario y asistencia.
              </p>
            </div>
          )}

          <div className="text-center w-full">
            <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-black mb-3">Ficha de Cancha</h3>
            {isPendingAssignment ? (
              <QRGenerator 
                studentName="Pendiente de Asignación" 
                status="pending_validation" 
                token="CC-PENDIENTE" 
              />
            ) : studentName ? (
              <QRGenerator 
                studentName={studentName} 
                status={studentStatus || "suspended"} 
                token="Sin información disponible" 
              />
            ) : (
              <div className="bg-[#0e121e] border border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-500">
                Sin información disponible
              </div>
            )}
          </div>

          {/* Semáforo de Salud */}
          {!isPendingAssignment && studentStatus === "active" && (
            <div className={`w-full border rounded-2xl p-4 flex flex-col gap-2 font-sans transition-all ${
              studentHealth === "injured" 
                ? "bg-red-950/20 border-red-500/30 text-red-250" 
                : studentHealth === "fatigue"
                  ? "bg-amber-950/20 border-amber-500/30 text-amber-250"
                  : "bg-emerald-950/20 border-emerald-500/30 text-emerald-250"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider block">Semáforo de Salud</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    studentHealth === "injured" 
                      ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" 
                      : studentHealth === "fatigue"
                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                        : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  }`} />
                  <span className="text-[10px] font-bold font-mono">
                    {studentHealth === "injured" ? "LESIONADO" : studentHealth === "fatigue" ? "FATIGA" : "ÓPTIMO"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                {studentHealth === "injured" && "🔴 Reposo deportivo total. Evitar actividades de impacto. Protocolo de terapia activa bajo supervisión médica."}
                {studentHealth === "fatigue" && "🟡 Carga muscular moderada. Se aconseja estiramiento preventivo de 15 minutos y descanso activo."}
                {studentHealth === "optimal" && "🟢 Jugador en condiciones óptimas. Listo al 100% para la acción y la planificación táctica de la semana."}
              </p>
            </div>
          )}


          {/* Tarjetas de Alerta de Estado del Alumno */}
          {!isPendingAssignment && studentStatus === "suspended" && (
            <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-2xl w-full text-center font-sans">
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block">Mora Registrada</span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Has superado el periodo de gracia de 5 días hábiles. Realiza tu pago para habilitar el acceso.
              </p>
            </div>
          )}

          {!isPendingAssignment && studentStatus === "pending_validation" && (
            <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-2xl w-full text-center font-sans animate-pulse-subtle">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Verificación Pendiente</span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Reporte de transferencia recibido. En proceso de validación bancaria.
              </p>
            </div>
          )}

          {!isPendingAssignment && studentStatus === "on_hold" && (
            <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-2xl w-full text-center font-sans">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Pago bajo Aclaración</span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Tu pago fue catalogado En Espera. Revisa los datos reportados o contacta al club.
              </p>
            </div>
          )}

          {!isPendingAssignment && studentStatus === "inactive" && (
            <div className="bg-slate-500/5 border border-slate-500/15 p-4 rounded-2xl w-full text-center font-sans">
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider block">Baja Administrativa</span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Este alumno no forma parte de la lista activa del club actualmente.
              </p>
            </div>
          )}

          {/* Menú de pestañas para móviles */}
          {!isPendingAssignment && (
	            <div className="bg-[#0e121e] border border-slate-900 rounded-2xl p-2 w-full grid grid-cols-4 gap-1">
	              <button
	                onClick={() => setActiveTab("performance")}
                className={`py-2 rounded-xl text-[10px] font-bold font-display transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  activeTab === "performance" ? "bg-slate-800 text-[#10b981] border border-slate-700/50" : "text-slate-400"
                }`}
              >
	                <ChartBar className="w-3.5 h-3.5" />
	                Rendimiento
	              </button>
	              <button
	                onClick={() => setActiveTab("events")}
	                className={`py-2 rounded-xl text-[10px] font-bold font-display transition-all flex flex-col items-center gap-1 cursor-pointer ${
	                  activeTab === "events" ? "bg-slate-800 text-[#10b981] border border-slate-700/50" : "text-slate-400"
	                }`}
	              >
	                <Calendar className="w-3.5 h-3.5" />
	                Eventos
	              </button>
	              <button
	                onClick={() => setActiveTab("billing")}
                className={`py-2 rounded-xl text-[10px] font-bold font-display transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  activeTab === "billing" ? "bg-slate-800 text-sky-400 border border-slate-700/50" : "text-slate-400"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Pagos
              </button>
              <button
                onClick={() => setActiveTab("gallery")}
                className={`py-2 rounded-xl text-[10px] font-bold font-display transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  activeTab === "gallery" ? "bg-slate-800 text-amber-500 border border-slate-700/50" : "text-slate-400"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Galería
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Content Tab or Lock Overlay */}
        <div className="md:col-span-2 relative">
          {isPendingAssignment ? (
            <div className="bg-[#0e121e]/80 border border-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden backdrop-blur-md font-sans">
              <div className="absolute -right-10 -bottom-10 opacity-[0.02] pointer-events-none">
                <Users className="w-64 h-64 text-amber-500" />
              </div>
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
                <Users className="w-6 h-6" />
              </div>
              <div className="max-w-md space-y-2">
                <span className="text-[9px] font-mono text-amber-500 font-black uppercase tracking-widest block">
                  Asignación de Alumno Pendiente
                </span>
                <h2 className="font-display font-black text-lg sm:text-xl text-slate-100 uppercase tracking-wide">
                  Sin alumnos vinculados
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tu cuenta ha sido creada exitosamente con el teléfono <span className="text-slate-250 font-bold">{parentPhone}</span>.
                  Actualmente no tienes ningún deportista asociado en la base de datos.
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Comunícate con el Profe Luis López para que registre la ficha de tu hijo en el club utilizando este mismo número telefónico. Una vez realizado el registro, tus datos se vincularán automáticamente al volver a ingresar.
                </p>
              </div>
            </div>
          ) : !studentName ? (
            <div className="bg-[#0e121e] border border-slate-900 rounded-3xl p-8 text-center text-xs text-slate-500 font-sans">
              Sin información disponible
            </div>
          ) : studentStatus === "active" ? (
            <>
              {/* TAB 1: RENDIMIENTO */}
              {activeTab === "performance" && (
                <div className="bg-[#0e121e] border border-slate-900 rounded-3xl p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">Rendimiento Técnico y Físico</h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">Gestión de habilidades, entrenamientos y material deportivo.</p>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-bold text-[#10b981]">
                      <Trophy className="w-3 h-3" />
                      {categoryName || "Sin información disponible"}
                    </div>
                  </div>

                  {/* Sub-tabs menu */}
                  <div className="border-b border-slate-850 flex gap-4 pt-1">
                    <button
                      onClick={() => setActiveSubTab("stats")}
                      className={`pb-2.5 text-xs font-bold font-display transition-all border-b-2 cursor-pointer ${
                        activeSubTab === "stats" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Habilidades y Historial
                    </button>
                    <button
                      onClick={() => setActiveSubTab("calendar")}
                      className={`pb-2.5 text-xs font-bold font-display transition-all border-b-2 cursor-pointer ${
                        activeSubTab === "calendar" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Microciclo Semanal ({weeklySchedules.length + events.length})
                    </button>
                    <button
                      onClick={() => setActiveSubTab("drills")}
                      className={`pb-2.5 text-xs font-bold font-display transition-all border-b-2 cursor-pointer ${
                        activeSubTab === "drills" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Biblioteca ({drills.length})
                    </button>
                  </div>

                  {/* Sub-tab 1: stats (Radar + Comentarios + Recharts LineChart) */}
                  {activeSubTab === "stats" && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        {metrics ? (
                          <RadarPerformance metrics={metrics} />
                        ) : (
                          <div className="bg-[#07090e]/60 border border-slate-800/80 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
                            No existen evaluaciones
                          </div>
                        )}
                        
                        <div className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                          <div className="flex items-center gap-1 text-[#10b981]">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Reporte Técnico Trimestral</span>
                          </div>
                          <h4 className="text-[10px] font-mono text-slate-500 uppercase">Observaciones del entrenador</h4>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            {coachNotes || "Sin información disponible"}
                          </p>
                        </div>
                      </div>

                      {/* Recharts Historial Gráfico */}
	                      <div className="bg-[#07090e]/40 border border-slate-800/70 p-4 rounded-2xl space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Historial de Calificaciones</h3>
                            <p className="text-[9px] text-slate-500">Evolución de habilidades técnicas a lo largo de los microciclos.</p>
                          </div>
                          <select
                            value={chartMetric}
                            onChange={(e) => setChartMetric(e.target.value)}
                            className="bg-[#07090e] border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-brand-green font-sans"
                          >
                            <option value="average">Promedio General</option>
                            <option value="speed">Velocidad</option>
                            <option value="passing">Pase</option>
                            <option value="dribbling">Regate</option>
                            <option value="shooting">Tiro</option>
                            <option value="physical">Físico</option>
                            <option value="discipline">Disciplina</option>
                          </select>
                        </div>

                        <div className="h-48 w-full">
                          {mounted && evalHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={getTrendData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#151b2d" />
                                <XAxis dataKey="date" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis domain={[0, 10]} stroke="#475569" fontSize={8} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#0e121e", borderColor: "#1e293b", borderRadius: "10px" }}
                                  labelStyle={{ color: "#94a3b8", fontSize: "9px", fontFamily: "monospace" }}
                                  itemStyle={{ fontSize: "10px", fontWeight: "bold" }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey={chartMetric}
                                  stroke={getMetricColor(chartMetric)}
                                  strokeWidth={3}
                                  dot={{ fill: getMetricColor(chartMetric), strokeWidth: 1, r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900 animate-pulse text-[9px] text-slate-600 font-mono">
                              No existen evaluaciones
                            </div>
	                          )}
	                        </div>
	                      </div>

	                      <div className="bg-[#07090e]/40 border border-slate-800/70 p-4 rounded-2xl space-y-4">
	                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
	                          <div>
	                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Historial de Asistencia</h3>
	                            <p className="text-[9px] text-slate-500">Registro de entrenamientos ordenado del más reciente al más antiguo.</p>
	                          </div>
	                          <div className="text-right">
	                            <div className="text-lg font-black font-mono text-[#10b981]">{attendanceSummary.percentage}%</div>
	                            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Asistencia</div>
	                          </div>
	                        </div>

	                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
	                          <div className="bg-[#07090e]/70 border border-slate-850 rounded-xl p-3">
	                            <div className="text-sm font-black text-slate-200 font-mono">{attendanceSummary.total}</div>
	                            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Entrenamientos</div>
	                          </div>
	                          <div className="bg-[#07090e]/70 border border-emerald-500/20 rounded-xl p-3">
	                            <div className="text-sm font-black text-[#10b981] font-mono">{attendanceSummary.present}</div>
	                            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Presentes</div>
	                          </div>
	                          <div className="bg-[#07090e]/70 border border-red-500/20 rounded-xl p-3">
	                            <div className="text-sm font-black text-red-400 font-mono">{attendanceSummary.absent}</div>
	                            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Ausentes</div>
	                          </div>
	                          <div className="bg-[#07090e]/70 border border-amber-500/20 rounded-xl p-3">
	                            <div className="text-sm font-black text-amber-400 font-mono">{attendanceSummary.justified}</div>
	                            <div className="text-[8px] text-slate-500 uppercase tracking-wider">Justificados</div>
	                          </div>
	                        </div>

	                        {sortedAttendanceHistory.length === 0 ? (
	                          <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-5 text-center text-[10px] text-slate-600 font-mono">
	                            No hay asistencias registradas
	                          </div>
	                        ) : (
	                          <div className="divide-y divide-slate-850 rounded-xl border border-slate-850 overflow-hidden">
	                            {sortedAttendanceHistory.map((entry) => (
	                              <div key={entry.id} className="flex items-center justify-between gap-3 bg-[#07090e]/60 px-3 py-2.5">
	                                <div className="min-w-0">
	                                  <div className="text-[10px] font-bold text-slate-250">{entry.date || "Sin fecha"}</div>
	                                  {entry.coachName && (
	                                    <div className="text-[8px] text-slate-500 truncate">Entrenador: {entry.coachName}</div>
	                                  )}
	                                </div>
	                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-200">
	                                  {getAttendanceStatusLabel(entry.status)}
	                                </span>
	                              </div>
	                            ))}
	                          </div>
	                        )}
	                      </div>
	                    </div>
	                  )}

                  {/* Sub-tab 2: calendar (Microciclos semanales con RSVP) */}
                  {activeSubTab === "calendar" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Cronograma del Microciclo</h3>
                          <p className="text-[9px] text-slate-500">Confirma la asistencia de tu hijo a las sesiones y partidos semanales.</p>
                        </div>
                      </div>

                      {weeklySchedules.length === 0 && events.length === 0 ? (
                        <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
                          No hay eventos activos programados en este microciclo para la categoría.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {weeklySchedules.map((schedule) => (
                            <div key={`schedule-${schedule.id}`} className="bg-[#07090e]/60 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
                              <div className="flex justify-between items-start gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-[#10b981]">
                                      Entrenamiento semanal
                                    </span>
                                    <LevelBadge level={schedule.level} emptyLabel="Todos los niveles" />
                                  </div>
                                  <h4 className="font-bold text-slate-200 text-xs mt-1.5 truncate">{schedule.title}</h4>
                                  <p className="text-[10px] text-slate-450 mt-1 leading-normal">{schedule.description || "Sesión oficial del club."}</p>
                                  <div className="text-[9px] text-slate-500 font-mono mt-1">
                                    {getWeekdayLabel(schedule.dayOfWeek)} • {schedule.startTime}{schedule.endTime ? ` - ${schedule.endTime}` : ""} • {schedule.location}
                                  </div>
                                  {schedule.coachName && (
                                    <div className="text-[9px] text-slate-500 mt-1">Entrenador: {schedule.coachName}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
	                          {events.map((event) => renderClubEventCard(event))}
	                        </div>
	                      )}
	                    </div>
	                  )}

                  {/* Sub-tab 3: drills (Biblioteca con reproductor en cámara lenta) */}
                  {activeSubTab === "drills" && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Biblioteca de Entrenamiento</h3>
                        <p className="text-[9px] text-slate-500">Videos didácticos asignados para repasar gestos técnicos en casa.</p>
                      </div>

                      {drills.length === 0 ? (
                        <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
                          No hay videos cargados actualmente en la biblioteca.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {drills.map((drill) => (
                            <div key={drill.id} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[8px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono text-slate-400 uppercase tracking-wider">{drill.category || "técnica"}</span>
                                  <span className="text-[8px] text-slate-500 font-mono">{drill.date || ""}</span>
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-200 text-xs">{drill.title}</h4>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mt-1 font-sans">{drill.description}</p>
                                </div>
                              </div>
                              
                              {(() => {
                                const videoInfo = parseVideoUrl(drill.videoUrl);
                                if (videoInfo.type === "youtube" || videoInfo.type === "vimeo") {
                                  return (
                                    <iframe
                                      src={videoInfo.embedUrl}
                                      title={drill.title}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full rounded-xl bg-slate-950 border border-slate-900 aspect-video"
                                    />
                                  );
                                } else {
                                  return (
                                    <div className="space-y-2">
                                      <video
                                        ref={(el) => { videoRefs.current[drill.id] = el; }}
                                        src={drill.videoUrl}
                                        controls
                                        playsInline
                                        className="w-full rounded-xl bg-slate-950 border border-slate-900 aspect-video object-cover"
                                      />

                                      {/* Playback speed controls */}
                                      <div className="flex items-center justify-between bg-[#07090e]/90 border border-slate-900 p-2.5 rounded-xl text-[10px]">
                                        <span className="text-slate-450 font-bold uppercase tracking-wider font-sans">Velocidad</span>
                                        <div className="flex gap-1.5">
                                          {[0.5, 0.75, 1.0].map((speed) => {
                                            const isSelected = activePlaybackRates[drill.id] === speed || (!activePlaybackRates[drill.id] && speed === 1.0);
                                            return (
                                              <button
                                                key={speed}
                                                onClick={() => handleSetSpeed(drill.id, speed)}
                                                className={`px-2 py-1 rounded-md font-mono font-bold transition-all cursor-pointer ${
                                                  isSelected 
                                                    ? "bg-[#10b981] text-slate-950 font-black shadow" 
                                                    : "bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200"
                                                }`}
                                              >
                                                {speed}x
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
	                </div>
	              )}

	              {/* TAB 2: EVENTOS DEL CLUB */}
	              {activeTab === "events" && (
	                <div className="bg-[#0e121e] border border-slate-900 rounded-3xl p-5 space-y-5">
	                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
	                    <div>
	                      <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">Eventos del Club</h2>
	                      <p className="text-[10px] text-slate-500 mt-0.5">Actividades, partidos y reuniones publicadas para tu categoría.</p>
	                    </div>
	                    <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-bold text-[#10b981]">
	                      <Calendar className="w-3 h-3" />
	                      {categoryName || "Todas"}
	                    </div>
	                  </div>

	                  {eventsLoading ? (
	                    <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
	                      Cargando eventos del club...
	                    </div>
	                  ) : eventsError ? (
	                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-sans">
	                      No fue posible cargar los eventos del club.
	                    </div>
	                  ) : upcomingEvents.length === 0 && pastEvents.length === 0 ? (
	                    <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
	                      No hay eventos próximos por el momento.
	                    </div>
	                  ) : (
	                    <div className="space-y-5">
	                      {upcomingEvents.length > 0 && (
	                        <section className="space-y-3">
	                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Próximos</h3>
	                          <div className="space-y-3">
	                            {upcomingEvents.map((event) => renderClubEventCard(event))}
	                          </div>
	                        </section>
	                      )}

	                      {pastEvents.length > 0 && (
	                        <section className="space-y-3">
	                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-350">Finalizados</h3>
	                          <div className="space-y-3">
	                            {pastEvents.map((event) => renderClubEventCard(event))}
	                          </div>
	                        </section>
	                      )}
	                    </div>
	                  )}
	                </div>
	              )}


	              {/* TAB 3: ESTADO DE CUENTA & PAGOS */}
	              {activeTab === "billing" && (
                <div className="bg-[#0e121e] border border-slate-900 rounded-3xl p-5 space-y-4 font-sans">
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">Estado de Facturación</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Control de matrículas y mensualidades del deportista.</p>
                  </div>

                  <div className="space-y-3">
                    {myPayments.length === 0 ? (
                      <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
                        No hay pagos registrados
                      </div>
                    ) : myPayments.map((payment) => (
                      <div key={payment.id} className="bg-[#07090e]/60 border border-slate-800/80 p-4 rounded-2xl flex justify-between items-center animate-pulse-subtle">
                        <div>
                          <span className="font-bold text-xs text-slate-200 block">{payment.paymentType} (${payment.amount} MXN)</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">Reportado el: {payment.date} | Transferencia Directa</span>
                        </div>
                        {payment.status === "approved" ? (
                           <div className="flex items-center gap-1.5 text-[#10b981] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                             Validado
                           </div>
                        ) : payment.status === "on_hold" ? (
                           <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                             <Clock className="w-3.5 h-3.5 animate-spin-slow" />
                             En Espera
                           </div>
                        ) : (
                           <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase animate-pulse">
                             <Clock className="w-3.5 h-3.5" />
                             Por Validar
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

	              {/* TAB 4: GALERÍA DE FOTOS */}
              {activeTab === "gallery" && (
                <div className="bg-[#0e121e] border border-slate-900 rounded-3xl p-5 space-y-4">
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-slate-200">Galería de {categoryName || "Sin información disponible"}</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Imágenes recientes de los entrenamientos y partidos de la categoría.</p>
                  </div>

                  <div className="bg-[#07090e]/40 border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500 font-sans">
                    Aún no hay registros
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Pantalla de bloqueo premium (Paywall) con Simulator */
            <div className="bg-[#0e121e]/80 border border-red-500/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden backdrop-blur-md font-sans">
              {/* Faint lock icon in background */}
              <div className="absolute -right-10 -bottom-10 opacity-[0.02] pointer-events-none">
                <ShieldCheck className="w-64 h-64 text-red-500" />
              </div>

              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="max-w-md space-y-2">
                <span className="text-[9px] font-mono text-red-500 font-black uppercase tracking-widest block">
                  {studentStatus === "suspended" ? "Acceso Suspendido por Falta de Pago" : studentStatus === "on_hold" ? "Pago Marcado En Espera" : studentStatus === "inactive" ? "Alumno dado de baja" : "Validación de Depósito Requerida"}
                </span>
                <h2 className="font-display font-black text-lg sm:text-xl text-slate-100 uppercase tracking-wide">
                  {studentStatus === "suspended" ? "Reactiva tu Credencial QR" : studentStatus === "on_hold" ? "Depósito bajo Aclaración" : studentStatus === "inactive" ? "Baja Administrativa" : "Verificando Depósito Bancario"}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {studentStatus === "suspended" && (
                    "Para ver las evaluaciones tácticas, consultar el cronograma de entrenamientos y ver la galería de fotos, es necesario realizar tu pago mensual o pago por clase y reportar la transferencia abajo."
                  )}
                  {studentStatus === "pending_validation" && (
                    "Tu transferencia directa ha sido reportada. La administración está validando el dinero en la cuenta. El portal y tu credencial QR se desbloquearán de forma automática en cuanto se confirme."
                  )}
                  {studentStatus === "on_hold" && (
                    "La administración no ha podido identificar tu transferencia o requiere aclaraciones. A continuación puedes volver a subir los detalles o reportar otro depósito."
                  )}
                  {studentStatus === "inactive" && (
                    "Este alumno fue dado de baja administrativamente. Su historial permanece almacenado, pero el acceso deportivo está restringido."
                  )}
                </p>
              </div>

              {/* Simulador integrado dentro del bloqueo si no está validado */}
              {studentStatus !== "pending_validation" && studentStatus !== "inactive" ? (
                <div className="w-full max-w-sm pt-2">
                  <PaymentSimulator 
                    amount={300} 
                    onPaymentSuccess={handlePaymentSuccess} 
                  />
                </div>
              ) : studentStatus === "pending_validation" ? (
                <div className="w-full max-w-sm bg-[#07090e] border border-slate-800 p-5 rounded-2xl space-y-3 text-left">
                  <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4 animate-spin-slow" />
                    Estado: Depositado (Por Validar)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                    Tu reporte se envió exitosamente. La administración verificará tu depósito. Puedes mantener abierta esta ventana; el portal se desbloqueará de forma automática.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-sm bg-[#07090e] border border-slate-800 p-5 rounded-2xl space-y-3 text-left">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    Estado: Baja Administrativa
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                    Comunícate con la administración del club para revisar la reincorporación del alumno.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
