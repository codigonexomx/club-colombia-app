"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ShieldCheck, LogOut, Check, X, AlertCircle, Dumbbell, ClipboardList, TrendingUp, Send, Star, Volume2 } from "lucide-react";
import { useCoach, useCalendar } from "@/hooks";
import { useTrainingSchedules } from "@/hooks/useTrainingSchedules";
import RadarPerformance from "@/components/RadarPerformance";
import LevelBadge from "@/components/LevelBadge";
import { LEVEL_OPTIONS, resolveStudentCategoryAndLevel } from "@/lib/levelModel";
import { getWeekdayLabel, sortTrainingSchedules } from "@/lib/trainingScheduleModel";

const DEFAULT_EVALUATION_VALUES = {
  speed: 7,
  passing: 8,
  dribbling: 6,
  shooting: 7,
  physical: 8,
  discipline: 9,
  healthStatus: "optimal",
  tacticalNotes: ""
};

export default function CoachDashboard() {
  const [attendance, setAttendance] = useState([]);
  const [activeTab, setActiveTab] = useState("attendance"); // 'attendance' | 'evaluation'
  const [attendanceSaved, setAttendanceSaved] = useState(false);

  // Estados para evaluación técnica y salud
  const [selectedStudent, setSelectedStudent] = useState("");
  const [speed, setSpeed] = useState(DEFAULT_EVALUATION_VALUES.speed);
  const [passing, setPassing] = useState(DEFAULT_EVALUATION_VALUES.passing);
  const [dribbling, setDribbling] = useState(DEFAULT_EVALUATION_VALUES.dribbling);
  const [shooting, setShooting] = useState(DEFAULT_EVALUATION_VALUES.shooting);
  const [physical, setPhysical] = useState(DEFAULT_EVALUATION_VALUES.physical);
  const [discipline, setDiscipline] = useState(DEFAULT_EVALUATION_VALUES.discipline);
  const [healthStatus, setHealthStatus] = useState(DEFAULT_EVALUATION_VALUES.healthStatus); // 'optimal' | 'fatigue' | 'injured'
  const [tacticalNotes, setTacticalNotes] = useState(DEFAULT_EVALUATION_VALUES.tacticalNotes);
  const [evaluationSaved, setEvaluationSaved] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [levelMessage, setLevelMessage] = useState("");
  const [levelMessageType, setLevelMessageType] = useState("status");
  const [updatingLevelStudentIds, setUpdatingLevelStudentIds] = useState({});
  const updatingLevelStudentIdsRef = useRef({});

  // Invocar custom hooks para el Demo Mode / Firebase
  const { data: coachStudents, saveAttendance: reportAttendance, saveEvaluation: reportEvaluation, getLatestEvaluation, updateStudentLevel } = useCoach();
  const { data: calendarEvents } = useCalendar();
  const { schedules: allTrainingSchedules } = useTrainingSchedules({ includeCoaches: false });

  // DECLARACIÓN DE CONSTANTES DERIVADAS DE LOS HOOKS (REEMPLAZANDO USESTATES REDUNDANTES)
  const students = useMemo(() => coachStudents || [], [coachStudents]);
  const operationalStudents = useMemo(
    () => students.filter(student => student.status !== "inactive"),
    [students]
  );
  const activeEvaluationStudents = useMemo(
    () => students.filter(student => student.status === "active"),
    [students]
  );
  const nowStr = new Date().toISOString().split("T")[0];
  const nextEvent = (calendarEvents || [])
    .filter(e => e.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] || null;
  const weeklySchedules = (allTrainingSchedules || [])
    .filter(schedule => schedule.active)
    .sort(sortTrainingSchedules);

  const resetEvaluationFormToDefaults = useCallback(() => {
    setSpeed(DEFAULT_EVALUATION_VALUES.speed);
    setPassing(DEFAULT_EVALUATION_VALUES.passing);
    setDribbling(DEFAULT_EVALUATION_VALUES.dribbling);
    setShooting(DEFAULT_EVALUATION_VALUES.shooting);
    setPhysical(DEFAULT_EVALUATION_VALUES.physical);
    setDiscipline(DEFAULT_EVALUATION_VALUES.discipline);
    setHealthStatus(DEFAULT_EVALUATION_VALUES.healthStatus);
    setTacticalNotes(DEFAULT_EVALUATION_VALUES.tacticalNotes);
  }, []);

  const handleLevelChange = async (studentId, level) => {
    if (updatingLevelStudentIdsRef.current[studentId]) return;

    try {
      setLevelMessage("");
      setLevelMessageType("status");
      updatingLevelStudentIdsRef.current = {
        ...updatingLevelStudentIdsRef.current,
        [studentId]: true
      };
      setUpdatingLevelStudentIds(prev => ({ ...prev, [studentId]: true }));
      const result = await updateStudentLevel(studentId, level);
      setAttendance(prev => prev.map(athlete => {
        const currentId = athlete.studentId || athlete.id;
        return currentId === studentId ? { ...athlete, level: result.level || null } : athlete;
      }));
      setLevelMessage("Nivel actualizado correctamente.");
      setTimeout(() => setLevelMessage(""), 2500);
    } catch (err) {
      console.error("Error al cambiar nivel del alumno:", err);
      setLevelMessageType("alert");
      setLevelMessage("No fue posible cambiar el nivel. Inténtalo nuevamente.");
    } finally {
      const nextUpdating = { ...updatingLevelStudentIdsRef.current };
      delete nextUpdating[studentId];
      updatingLevelStudentIdsRef.current = nextUpdating;
      setUpdatingLevelStudentIds(nextUpdating);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (coachStudents) {
      // Inicializar estado de asistencia si aún no se ha modificado manualmente
      setAttendance(prev => {
        return operationalStudents.map(s => {
          const existing = prev.find(a => a.id === s.id);
          return {
            id: s.id,
            studentId: s.studentId || s.id,
            name: s.name,
            status: existing ? existing.status : null,
            category: s.category || "",
            level: s.level || null,
            healthStatus: s.healthStatus || "optimal"
          };
        });
      });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [coachStudents, operationalStudents]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (selectedStudent && !activeEvaluationStudents.some(s => (s.studentId || s.id) === selectedStudent)) {
      setSelectedStudent("");
      setEvaluationSaved(false);
      setEvaluationError("Este alumno no está activo y no puede recibir una evaluación.");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedStudent, activeEvaluationStudents]);

  // Pre-cargar la última evaluación técnica cuando se selecciona un alumno
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedStudent) {
      resetEvaluationFormToDefaults();
      return;
    }

    let isCurrentSelection = true;
    const targetStudentId = selectedStudent;

    async function preloadLatestEvaluation() {
      try {
        const latestEvaluation = await getLatestEvaluation(targetStudentId);
        if (!isCurrentSelection) return;

        if (!latestEvaluation) {
          resetEvaluationFormToDefaults();
          return;
        }

        const metrics = latestEvaluation.metrics || {};
        setSpeed(Number.isFinite(metrics.speed) ? metrics.speed : DEFAULT_EVALUATION_VALUES.speed);
        setPassing(Number.isFinite(metrics.passing) ? metrics.passing : DEFAULT_EVALUATION_VALUES.passing);
        setDribbling(Number.isFinite(metrics.dribbling) ? metrics.dribbling : DEFAULT_EVALUATION_VALUES.dribbling);
        setShooting(Number.isFinite(metrics.shooting) ? metrics.shooting : DEFAULT_EVALUATION_VALUES.shooting);
        setPhysical(Number.isFinite(metrics.physical) ? metrics.physical : DEFAULT_EVALUATION_VALUES.physical);
        setDiscipline(Number.isFinite(metrics.discipline) ? metrics.discipline : DEFAULT_EVALUATION_VALUES.discipline);
        setHealthStatus(latestEvaluation.healthStatus || DEFAULT_EVALUATION_VALUES.healthStatus);
        setTacticalNotes(typeof latestEvaluation.tacticalNotes === "string" ? latestEvaluation.tacticalNotes : DEFAULT_EVALUATION_VALUES.tacticalNotes);
      } catch (err) {
        if (!isCurrentSelection) return;
        console.error("Error al cargar la última evaluación del alumno:", err);
        resetEvaluationFormToDefaults();
      }
    }

    preloadLatestEvaluation();

    return () => {
      isCurrentSelection = false;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedStudent, getLatestEvaluation, resetEvaluationFormToDefaults]);

  // Manejar el click de asistencia con alertas de salud para lesionados
  const handleAttendanceClick = (athlete, newStatus) => {
    if (newStatus === "P" && athlete.healthStatus === "injured") {
      const confirmBypass = window.confirm(`ALERTA MÉDICA: ${athlete.name} está registrado como LESIONADO. ¿Deseas autorizar su participación bajo tu supervisión en esta sesión?`);
      if (!confirmBypass) return;
    }
    setAttendance(prev => prev.map(a => a.id === athlete.id ? { ...a, status: newStatus } : a));
  };

  // Guardar reporte de asistencia
  const saveAttendance = async () => {
    try {
      await reportAttendance(attendance);
      setAttendanceSaved(true);
      setTimeout(() => setAttendanceSaved(false), 3000);
    } catch (err) {
      console.error("Error al guardar asistencia:", err);
    }
  };

  // Guardar reporte de evaluación técnica en histórico
  const saveEvaluation = async (e) => {
    e.preventDefault();
    console.log("[CLIENT] SAVE_STARTED", {
      selectedStudent,
      isSavingEvaluation
    });
    if (isSavingEvaluation) {
      console.log("[CLIENT] FINALLY", {
        reason: "already_saving_return"
      });
      return;
    }

    setEvaluationSaved(false);
    setEvaluationError("");

    if (!selectedStudent) {
      console.log("[CLIENT] ERROR", {
        reason: "missing_selectedStudent"
      });
      console.log("[CLIENT] FINALLY", {
        reason: "missing_selectedStudent"
      });
      setEvaluationError("Selecciona un alumno antes de guardar la evaluación.");
      return;
    }

    try {
      setIsSavingEvaluation(true);
      const selectedStudentDoc = activeEvaluationStudents.find(s => (s.studentId || s.id) === selectedStudent);
      if (!selectedStudentDoc || selectedStudentDoc.status !== "active") {
        console.log("[CLIENT] ERROR", {
          reason: "inactive_or_missing_student",
          selectedStudent
        });
        setSelectedStudent("");
        setEvaluationError("Este alumno no está activo y no puede recibir una evaluación.");
        return;
      }
      const targetStudentId = selectedStudentDoc.studentId || selectedStudentDoc.id;
      const targetName = selectedStudentDoc.name;
      const metricsObj = { speed, passing, dribbling, shooting, physical, discipline };
      
      await reportEvaluation({
        studentId: targetStudentId,
        studentName: targetName,
        metrics: metricsObj,
        tacticalNotes: tacticalNotes,
        healthStatus: healthStatus
      });

      setEvaluationSaved(true);
      console.log("[CLIENT] SUCCESS", {
        studentId: targetStudentId,
        studentName: targetName
      });
      setTimeout(() => {
        setEvaluationSaved(false);
        // Resetear sliders
        setSpeed(7); setPassing(8); setDribbling(6); setShooting(7); setPhysical(8); setDiscipline(9);
        setTacticalNotes("");
      }, 3000);
    } catch (err) {
      console.log("[CLIENT] ERROR", {
        message: err?.message || String(err),
        status: err?.status || "",
        statusText: err?.statusText || ""
      });
      setEvaluationError("No fue posible guardar la evaluación. Verifica tu conexión e inténtalo nuevamente.");
    } finally {
      console.log("[CLIENT] FINALLY", {
        willSetIsSavingEvaluationFalse: true
      });
      setIsSavingEvaluation(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col max-w-md mx-auto border-x border-slate-900 shadow-2xl">
      {/* Header optimizado para celular */}
      <header className="glass-panel border-b border-slate-900 px-5 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="font-display font-black text-xs uppercase text-slate-200">Portal del Entrenador</h1>
            <p className="text-[9px] text-[#10b981] font-bold uppercase tracking-wider">Sin información disponible</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="text-slate-400 hover:text-[#10b981] font-display font-semibold text-xs transition-all"
          >
            Inicio
          </Link>
          <Link href="/login" className="text-slate-500 hover:text-slate-300">
            <LogOut className="w-4.5 h-4.5" />
          </Link>
        </div>
      </header>

      {/* Portal Welcome Section Premium */}
      <div className="px-4 pt-8 pb-6 text-center flex flex-col items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/10 to-transparent pointer-events-none" />
        <img 
          src="/logo.png" 
          alt="Escudo Club Colombia" 
          className="w-20 h-20 object-contain mb-3 filter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-float" 
        />
        <h2 className="font-display font-black text-lg text-slate-100 uppercase tracking-wider text-glow-emerald">
          Portal del Entrenador
        </h2>
        <p className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-widest mt-1">
          Control Deportivo y Estadístico
        </p>
      </div>

      {/* Selector de módulos en cabecera */}
      <div className="px-4 pt-2 pb-4 grid grid-cols-2 gap-3 relative z-10">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`py-3 rounded-2xl text-xs font-bold font-display transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "attendance" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 box-glow-emerald" : "bg-[#0e121e]/80 backdrop-blur-md text-slate-400 border border-slate-800"
          }`}
        >
          <ClipboardList className={`w-4 h-4 ${activeTab === "attendance" ? "animate-pulse" : ""}`} />
          Asistencia
        </button>
        <button
          onClick={() => setActiveTab("evaluation")}
          className={`py-3 rounded-2xl text-xs font-bold font-display transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "evaluation" ? "bg-amber-500/20 text-amber-500 border border-amber-500/50 box-glow-amber" : "bg-[#0e121e]/80 backdrop-blur-md text-slate-400 border border-slate-800"
          }`}
        >
          <TrendingUp className={`w-4 h-4 ${activeTab === "evaluation" ? "animate-pulse" : ""}`} />
          Evaluación 3D
        </button>
      </div>

      {/* Cuerpo principal */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">

        {/* TAB 1: ASISTENCIA TÁCTIL RÁPIDA PREMIUM */}
        {activeTab === "attendance" && (
          <div className="glass-card-premium p-5 rounded-3xl space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-black text-sm uppercase tracking-widest text-emerald-400">Control de Accesos</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">{new Date().toLocaleDateString("es-CO", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>

            {/* Siguiente Evento y RSVP Premium */}
            {nextEvent && (
              <div className="glass-item-premium p-4 rounded-2xl flex items-center justify-between text-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <div className="min-w-0 flex-1 pr-4 relative z-10">
                  <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest block mb-1">Próximo Evento (RSVP)</span>
                  <span className="font-bold text-slate-100 block truncate text-base">{nextEvent.title}</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">{nextEvent.date} • {nextEvent.time}</span>
                </div>
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold px-4 py-2 rounded-2xl text-center shrink-0 relative z-10 box-glow-emerald">
                  <span className="block text-xl font-black leading-none drop-shadow-md">
                    {nextEvent.rsvps ? Object.values(nextEvent.rsvps).filter(v => v === "confirmed").length : 0}
                  </span>
                  <span className="text-[6px] uppercase tracking-wider block mt-0.5 leading-none">Confirmados</span>
                </div>
              </div>
            )}

            {attendanceSaved && (
              <div className="bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] p-3 rounded-xl text-[10px] flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4" />
                Asistencia guardada y sincronizada en tiempo real.
              </div>
            )}

            {levelMessage && (
              <div role={levelMessageType} className="bg-sky-500/10 border border-sky-500/20 text-sky-300 p-3 rounded-xl text-[10px] animate-fade-in">
                {levelMessage}
              </div>
            )}

            {weeklySchedules.length > 0 && (
              <div className="glass-item-premium p-4 rounded-2xl space-y-3">
                <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest block">
                  Horarios oficiales
                </span>
                <div className="space-y-2">
                  {weeklySchedules.map((schedule) => (
                    <div key={schedule.id} className="border border-slate-800/70 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">{schedule.title}</span>
                        <LevelBadge level={schedule.level} emptyLabel="Todos" />
                      </div>
                      <p className="text-[9px] text-slate-500 font-mono mt-1">
                        {getWeekdayLabel(schedule.dayOfWeek)} • {schedule.startTime}{schedule.endTime ? ` - ${schedule.endTime}` : ""} • {schedule.category}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">{schedule.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mt-2">
              {attendance.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-sans glass-item-premium rounded-2xl">
                  Aún no hay registros
                </div>
              ) : attendance.map((athlete) => (
                <div key={athlete.id} className="p-3 flex items-center justify-between gap-4 glass-item-premium rounded-2xl transition-all hover:bg-slate-800/40">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-bold text-slate-200 truncate">{athlete.name}</span>
                    <div className="flex items-center gap-1.5">
                      <LevelBadge level={resolveStudentCategoryAndLevel(athlete).level} />
                      {athlete.healthStatus === "injured" && (
                        <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse box-glow-emerald" style={{boxShadow: '0 0 8px red'}} /> Lesionado
                        </span>
                      )}
                      {athlete.healthStatus === "fatigue" && (
                        <span className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full box-glow-amber" /> Fatiga
                        </span>
                      )}
                      {athlete.healthStatus === "optimal" && (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full box-glow-emerald" /> Óptimo
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Selector Táctil Premium */}
                  <div className="flex items-center gap-1.5 bg-[#07090e]/50 p-1.5 rounded-xl border border-slate-800/50 shrink-0">
                    <select
                      value={resolveStudentCategoryAndLevel(athlete).level}
                      onChange={(event) => handleLevelChange(athlete.studentId || athlete.id, event.target.value)}
                      disabled={!!updatingLevelStudentIds[athlete.studentId || athlete.id]}
                      className="bg-[#07090e] border border-slate-800 rounded-lg px-2 py-2 text-[9px] text-slate-300 focus:outline-none focus:border-emerald-500"
                      aria-label={`Nivel de ${athlete.name}`}
                    >
                      <option value="">Sin nivel</option>
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAttendanceClick(athlete, "P")}
                      className={`w-9 h-9 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        athlete.status === "P" ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110" : "text-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                      }`}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttendanceClick(athlete, "A")}
                      className={`w-9 h-9 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        athlete.status === "A" ? "bg-red-500 text-slate-950 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110" : "text-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttendanceClick(athlete, "J")}
                      className={`w-9 h-9 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        athlete.status === "J" ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110" : "text-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
                      }`}
                    >
                      J
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveAttendance}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-slate-950 font-display font-black text-sm py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer mt-4"
            >
              Guardar Reporte de Asistencia
            </button>
          </div>
        )}

        {/* TAB 2: EVALUACIÓN TÉCNICA 3D PREMIUM */}
        {activeTab === "evaluation" && (
          <form onSubmit={saveEvaluation} className="glass-card-premium p-5 rounded-3xl space-y-5">
            <div>
              <h3 className="font-display font-black text-sm uppercase tracking-widest text-amber-500">Evaluación de Rendimiento</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Métricas Trimestrales</p>
            </div>

            {evaluationSaved && (
              <div role="status" className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded-2xl text-xs flex items-center gap-2 animate-fade-in box-glow-amber">
                <Check className="w-5 h-5" />
                Informe técnico enviado al sistema central.
              </div>
            )}

            {evaluationError && (
              <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-5 h-5" />
                {evaluationError}
              </div>
            )}

            {/* Selector de alumno Premium */}
            <div className="glass-item-premium p-4 rounded-2xl">
              <label className="text-[9px] text-amber-500 font-black block mb-2 uppercase tracking-widest text-glow-amber">ATLETA A EVALUAR</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full bg-[#07090e]/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 appearance-none transition-all"
              >
                <option value="">-- Seleccionar Atleta --</option>
                {activeEvaluationStudents.length === 0 && (
                  <option value="" disabled>No hay alumnos activos disponibles</option>
                )}
                {activeEvaluationStudents.map((s) => (
                  <option key={s.id} value={s.studentId || s.id}>{s.name} - {resolveStudentCategoryAndLevel(s).level ? LEVEL_OPTIONS.find(level => level.value === resolveStudentCategoryAndLevel(s).level)?.label : "Sin nivel"}</option>
                ))}
              </select>
            </div>

            {/* Selector de Estado Físico Premium */}
            {selectedStudent && (
              <div className="animate-fade-in glass-item-premium p-4 rounded-2xl">
                <label className="text-[9px] text-amber-500 font-black block mb-2 uppercase tracking-widest text-glow-amber">ESTADO FÍSICO / SALUD</label>
                <select
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value)}
                  className="w-full bg-[#07090e]/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 appearance-none transition-all"
                >
                  <option value="optimal">🟢 Óptimo (Listo para entrenar)</option>
                  <option value="fatigue">🟡 Fatiga / Carga moderada (Precaución)</option>
                  <option value="injured">🔴 Lesionado (Protocolo de descanso activo)</option>
                </select>
              </div>
            )}

            {/* Sliders de Habilidades Premium */}
            <div className="space-y-4 pt-4">
              {/* Velocidad */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Velocidad</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{speed}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>

              {/* Pase */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Pase</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{passing}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={passing} onChange={(e) => setPassing(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>

              {/* Regate */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Regate</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{dribbling}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={dribbling} onChange={(e) => setDribbling(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>

              {/* Tiro */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Tiro</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{shooting}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={shooting} onChange={(e) => setShooting(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>

              {/* Fisico */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Físico</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{physical}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={physical} onChange={(e) => setPhysical(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>

              {/* Disciplina */}
              <div className="glass-item-premium p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 px-1">
                  <span>Disciplina</span>
                  <span className="text-amber-400 font-mono text-glow-amber text-xs">{discipline}/10</span>
                </div>
                <input
                  type="range" min="1" max="10" value={discipline} onChange={(e) => setDiscipline(Number(e.target.value))}
                  className="premium-slider"
                />
              </div>
            </div>

            {/* Preview del Radar 3D (Se muestra en tiempo real) */}
            <div className="flex flex-col items-center justify-center pt-2">
              <span className="text-[10px] text-amber-500/70 font-mono uppercase tracking-widest mb-2">Vista Previa del Rendimiento</span>
              <RadarPerformance 
                metrics={{
                  speed, passing, dribbling, shooting, physical, discipline
                }}
              />
            </div>
            
            {/* Notas tácticas Premium */}
            <div className="space-y-2 pt-2">
              <label className="text-[9px] text-amber-500 font-black uppercase tracking-widest text-glow-amber block">OBSERVACIONES TÁCTICAS</label>
              <textarea
                rows={3}
                placeholder="Escribe comentarios sobre posicionamiento, disciplina..."
                value={tacticalNotes}
                onChange={(e) => setTacticalNotes(e.target.value)}
                className="w-full bg-[#07090e]/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 resize-none leading-relaxed transition-all"
              />
            </div>

            <button
              type="submit"
              onClick={() => {
                console.log("[CLIENT] CLICK");
              }}
              disabled={isSavingEvaluation}
              aria-busy={isSavingEvaluation}
              className={`w-full bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-slate-950 font-display font-black text-sm py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] mt-4 ${
                isSavingEvaluation ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              {isSavingEvaluation ? "Guardando evaluación..." : "Guardar evaluación"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
