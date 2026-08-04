"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCheck, Users, Dumbbell, ArrowRight, UserPlus, LogIn, Calendar, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";
import PaymentSimulator from "@/components/PaymentSimulator";
import QRGenerator from "@/components/QRGenerator";
import { auth, db } from "@/lib/firebase";
import { categoryNameToId, normalizeStudentName } from "@/lib/studentModel";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { RecaptchaVerifier, signInWithEmailAndPassword, signInWithPhoneNumber, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";

export default function Login() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("tab") === "register" ? "register" : "login";
  }); // 'login' | 'register'
  const resetRequestInFlightRef = useRef(false);
  
  // Estados de Autenticación
  const [loginUserType, setLoginUserType] = useState("parent");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  // Requisitos de seguridad para reCAPTCHA y carga
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const loginRequestInFlightRef = useRef(false);
  const recaptchaVerifierRef = useRef(null);

  // Estados para Recuperación de Contraseña
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Estados para simulación de Inscripción
  const [registerStep, setRegisterStep] = useState(1); // 1: Datos, 2: Horarios/Pago, 3: Credencial QR
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [parentUid, setParentUid] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studentCategory, setStudentCategory] = useState(null);
  const [registerError, setRegisterError] = useState("");
  const [registeredStudentLinked, setRegisteredStudentLinked] = useState(false);
  const [registrationToken, setRegistrationToken] = useState("");
  const [registeredStudentStatus, setRegisteredStudentStatus] = useState("");
  const [registeredStudentStatusLoading, setRegisteredStudentStatusLoading] = useState(false);
  const [registeredStudentStatusError, setRegisteredStudentStatusError] = useState("");

  // Limpiar cookies de sesión para asegurar que al estar en /login el usuario está deslogueado
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "register") return;
      fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const getAvailableRoles = (user) => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      return user.roles;
    }

    return user?.role ? [user.role] : [];
  };

  const createSessionFromAuthUser = async (authUser, selectedRole) => {
    const idToken = await authUser.getIdToken();
    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, selectedRole })
    });

    if (!sessionResponse.ok) {
      throw new Error("No se pudo crear una sesión segura.");
    }

    return sessionResponse.json();
  };

  const cleanupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (err) {
        console.warn("Error cleaning up RecaptchaVerifier ref:", err);
      }
      recaptchaVerifierRef.current = null;
    }
    if (typeof window !== "undefined" && window.ccRecaptchaVerifier) {
      try {
        window.ccRecaptchaVerifier.clear();
      } catch (err) {
        console.warn("Error cleaning up global ccRecaptchaVerifier:", err);
      }
      delete window.ccRecaptchaVerifier;
    }
  };

  const initRecaptchaVerifier = () => {
    if (typeof window === "undefined") return null;

    const container = document.getElementById("recaptcha-container");
    if (!container) {
      console.error("recaptcha-container element not found in DOM.");
      return null;
    }

    cleanupRecaptcha();

    try {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        "expired-callback": () => {
          cleanupRecaptcha();
        }
      });
      recaptchaVerifierRef.current = verifier;
      window.ccRecaptchaVerifier = verifier;
      return verifier;
    } catch (err) {
      console.error("Error creating RecaptchaVerifier:", err);
      return null;
    }
  };

  // Limpiar reCAPTCHA al desmontar el componente
  React.useEffect(() => {
    return () => {
      cleanupRecaptcha();
    };
  }, []);

  // Limpiar reCAPTCHA al cambiar de pestañas, tipo de usuario o formulario de recuperación
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    cleanupRecaptcha();
    setPhoneCodeSent(false);
    setConfirmationResult(null);
    setSmsCode("");
    setLoginError("");
  }, [activeTab, loginUserType, showForgotPassword]);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (activeTab !== "register") return;

    let cancelled = false;
    const loadParentSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) return;
        const session = await response.json();
        if (cancelled || session.role !== "parent" || !session.uid) return;
        setParentUid(session.uid);
        if (session.phone) {
          setParentPhone(prev => prev || session.phone);
          setLoginPhone(session.phone);
        }
      } catch (err) {
        console.warn("No se encontró sesión activa de acudiente para inscripción:", err);
      }
    };

    loadParentSession();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (registerStep !== 3 || !studentId) {
      setRegisteredStudentStatusLoading(false);
      setRegisteredStudentStatusError("");
      return;
    }

    setRegisteredStudentStatusLoading(true);
    setRegisteredStudentStatusError("");

    const unsubscribe = onSnapshot(doc(db, "students", studentId), (studentSnap) => {
      if (!studentSnap.exists()) {
        setRegisteredStudentStatus("");
        setRegisteredStudentStatusError("No fue posible encontrar el alumno registrado.");
        setRegisteredStudentStatusLoading(false);
        return;
      }

      const data = studentSnap.data();
      setRegisteredStudentStatus(data.status || "pending_validation");
      setRegisteredStudentStatusLoading(false);
    }, (err) => {
      console.error("Error al escuchar el estado del alumno registrado:", err);
      setRegisteredStudentStatusError("No fue posible actualizar el estado del pago en tiempo real. Intenta recargar la página.");
      setRegisteredStudentStatusLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [registerStep, studentId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calcular categoría recomendada
  const handleBirthDateChange = (e) => {
    const dateStr = e.target.value;
    setBirthDate(dateStr);
    if (!dateStr) return;

    const birthYear = new Date(dateStr).getFullYear();
    const currentYear = 2026; // Local Time/Context Year
    const age = currentYear - birthYear;

    let cat = { name: "Sub-8 Iniciación", schedules: "Lunes y Miércoles 3:30 PM - 5:00 PM", cost: 300 };
    if (age > 8 && age <= 10) {
      cat = { name: "Sub-10 Competitivo", schedules: "Martes y Jueves 4:00 PM - 6:00 PM", cost: 300 };
    } else if (age > 10 && age <= 12) {
      cat = { name: "Sub-12 Elite", schedules: "Lunes, Miércoles y Viernes 4:00 PM - 6:00 PM", cost: 300 };
    } else if (age > 12) {
      cat = { name: "Sub-15 Avanzado", schedules: "Martes, Jueves y Sábado 5:00 PM - 7:00 PM", cost: 300 };
    }
    setStudentCategory(cat);
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setRegisterError("");
    
    if (registerStep === 1 && studentCategory) {
      try {
        const normalizedParentPhone = normalizeAndValidatePhone(parentPhone);
        const studentDocRef = doc(collection(db, "students"));
        const newStudentId = studentDocRef.id;
        const normalizedName = normalizeStudentName(studentName);
        const categoryId = categoryNameToId(studentCategory.name);

        // Registrar deportista en la colección 'students'
        const birthYear = new Date(birthDate).getFullYear();
        const ageNum = 2026 - birthYear;
        await setDoc(studentDocRef, {
          studentId: newStudentId,
          name: studentName,
          normalizedName,
          age: ageNum || 9,
          parentName,
          parentPhone: normalizedParentPhone,
          parentEmail: "",
          parentUid: "",
          categoryId,
          category: studentCategory.name,
          assignedCoachUid: "",
          assignment: "automatic",
          status: "suspended",
          billingStatus: "pending_payment",
          healthStatus: "optimal",
          dueDays: 7,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setStudentId(newStudentId);
        setRegisteredStudentLinked(false);
        setRegisteredStudentStatus("suspended");
        setRegisteredStudentStatusError("");
        setRegistrationToken(`CC-2026-${Math.floor(1000 + Math.random() * 9000)}`);
        
        localStorage.setItem("simulatedStatus", "suspended");
        
        setRegisterStep(2);
      } catch (err) {
        console.error("Error en registro:", err);
        setRegisterError("Ocurrió un error al registrar al alumno: " + err.message);
      }
    }
  };

  const linkRegisteredStudentToParent = async (targetStudentId) => {
    const response = await fetch("/api/parent/link-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: targetStudentId })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "No fue posible vincular el alumno con la cuenta del acudiente.");
    }
    setParentUid(data.parentUid || "");
    setRegisteredStudentLinked(true);
    return data;
  };

  const handlePaymentCompleted = async (amount, paymentLabel) => {
    try {
      if (!studentId) {
        throw new Error("No se encontró el identificador del alumno registrado.");
      }

      // 1. Guardar solicitud en pendingPayments en Firestore
      await addDoc(collection(db, "payments"), {
        studentName: studentName,
        studentId,
        parentUid: parentUid || "",
        categoryId: categoryNameToId(studentCategory.name),
        categoryName: studentCategory.name,
        amount: amount,
        paymentType: paymentLabel,
        date: new Date().toLocaleDateString("es-MX") + " " + new Date().toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' }),
        status: "pending",
        parentEmail: parentEmail.toLowerCase(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Cambiar su estado a 'pending_validation' tanto en Firestore como en localStorage.
      const studentRef = doc(db, "students", studentId || studentName);
      await updateDoc(studentRef, {
        status: "pending_validation",
        billingStatus: "pending_validation",
        dueDays: 0,
        updatedAt: serverTimestamp()
      });

      if (parentUid && !registeredStudentLinked) {
        await linkRegisteredStudentToParent(studentId);
      }

      localStorage.setItem("simulatedStatus", "pending_validation");
      setRegisteredStudentStatus("pending_validation");
      setRegisteredStudentStatusError("");

      setRegisterStep(3);
    } catch (err) {
      console.error("Error al reportar pago:", err);
      setRegisterError("Error al reportar el pago en la base de datos: " + err.message);
    }
  };

  const handleGoToParentPortal = async () => {
    setRegisterError("");

    if (parentUid && studentId) {
      try {
        if (!registeredStudentLinked) {
          await linkRegisteredStudentToParent(studentId);
        }
        router.push("/dashboard/parent");
        return;
      } catch (err) {
        setRegisterError(err.message || "No fue posible vincular tu cuenta con el alumno registrado.");
        return;
      }
    }

    setActiveTab("login");
    setLoginUserType("parent");
    setLoginPhone(parentPhone);
    setPhoneCodeSent(false);
    setConfirmationResult(null);
    setSmsCode("");
    setLoginError("");
    setRegisterStep(1);
  };

  const registeredStudentQrStatus = registeredStudentStatus || "pending_validation";
  const registeredStudentIsActive = registeredStudentQrStatus === "active";

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (resetRequestInFlightRef.current) return;
    setResetError("");
    setResetSuccessMessage("");

    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setResetError("Por favor ingresa tu correo electrónico.");
      return;
    }

    resetRequestInFlightRef.current = true;
    setIsResetting(true);
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResetSuccessMessage(data.message);
        setResetEmail("");
      } else {
        setResetError(data.error || "Ocurrió un error al intentar enviar el correo. Por favor intenta de nuevo.");
      }
    } catch (err) {
      console.error("Error al enviar correo de recuperación:", err);
      setResetError("Ocurrió un error de red al intentar enviar el correo. Por favor intenta de nuevo.");
    } finally {
      setIsResetting(false);
      resetRequestInFlightRef.current = false;
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");

    if (loginRequestInFlightRef.current) return;

    if (loginUserType === "parent") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(loginPhone)) {
        setLoginError("Los padres deben iniciar sesión con su número de teléfono celular, no con correo.");
        return;
      }

      let normalizedPhone;
      try {
        normalizedPhone = normalizeAndValidatePhone(loginPhone);
      } catch (err) {
        setLoginError("Formato de teléfono celular inválido. Debe incluir código de país (ej. +573001234567 o +521234567890).");
        return;
      }

      if (!phoneCodeSent) {
        loginRequestInFlightRef.current = true;
        setIsLoggingIn(true);
        try {
          const verifier = initRecaptchaVerifier();
          if (!verifier) {
            throw new Error("RECAPTCHA_INIT_FAILED");
          }
          const result = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
          setConfirmationResult(result);
          setPhoneCodeSent(true);
        } catch (err) {
          console.error("Error al solicitar código SMS:", err);
          cleanupRecaptcha();
          if (err.message === "RECAPTCHA_INIT_FAILED" || err.message?.includes("reCAPTCHA")) {
            setLoginError("No fue posible iniciar la verificación de seguridad. Intenta nuevamente.");
          } else if (err.code === "auth/too-many-requests") {
            setLoginError("Has realizado demasiados intentos. Por favor espera unos minutos antes de volver a solicitar un código.");
          } else if (err.code === "auth/invalid-phone-number") {
            setLoginError("El número de teléfono ingresado no es válido.");
          } else {
            setLoginError("No fue posible iniciar la verificación de seguridad. Intenta nuevamente.");
          }
        } finally {
          setIsLoggingIn(false);
          loginRequestInFlightRef.current = false;
        }
        return;
      }

      if (!confirmationResult) {
        setLoginError("Primero solicita el código SMS.");
        return;
      }

      loginRequestInFlightRef.current = true;
      setIsLoggingIn(true);
      try {
        const userCredential = await confirmationResult.confirm(smsCode);
        await createSessionFromAuthUser(userCredential.user, "parent");
        router.push("/dashboard/parent");
      } catch (err) {
        console.error("Error al confirmar código SMS:", err);
        if (err.code === "auth/invalid-verification-code") {
          setLoginError("Código de verificación incorrecto. Intenta nuevamente.");
        } else {
          setLoginError("Ocurrió un error al verificar el código SMS. Intenta nuevamente.");
        }
      } finally {
        setIsLoggingIn(false);
        loginRequestInFlightRef.current = false;
      }
      return;
    }

    // Iniciar sesión con email/password (admin/coach)
    loginRequestInFlightRef.current = true;
    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail.toLowerCase(), loginPassword);
      const authUser = userCredential.user;

      let userDocSnap = await getDoc(doc(db, "users", authUser.uid));
      if (!userDocSnap.exists()) {
        userDocSnap = await getDoc(doc(db, "users", loginEmail.toLowerCase()));
      }

      if (!userDocSnap.exists()) {
        setLoginError("No se encontró el perfil de usuario en la base de datos.");
        return;
      }

      const user = userDocSnap.data();
      const availableRoles = getAvailableRoles(user);
      if (!availableRoles.includes(loginUserType) || !["admin", "coach"].includes(loginUserType)) {
        setLoginError("El tipo de usuario seleccionado no corresponde a esta cuenta.");
        return;
      }

      await createSessionFromAuthUser(authUser, loginUserType);

      if (loginUserType === "admin") {
        router.push("/dashboard/admin");
      } else if (loginUserType === "coach") {
        router.push("/dashboard/coach");
      }
    } catch (err) {
      console.error("Error en login email/password:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email") {
        setLoginError("Correo electrónico o contraseña incorrectos.");
      } else {
        setLoginError("Ocurrió un error al intentar iniciar sesión. Por favor intenta de nuevo.");
      }
    } finally {
      setIsLoggingIn(false);
      loginRequestInFlightRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#07090e] px-4 py-8 relative overflow-hidden select-none">
      {/* Background glow lines */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/5 filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto z-10">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Link href="/" className="flex flex-col items-center gap-3.5 mb-2 hover:opacity-80 transition-all text-center">
            <img 
              src="/logo.png" 
              alt="Logo Club Colombia" 
              className="w-24 h-24 object-contain filter drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
            />
            <span className="font-display font-black text-2xl tracking-wider uppercase">
              Club <span className="text-[#10b981]">Colombia</span>
            </span>
          </Link>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Plataforma de Gestión Integrada</p>
          <Link href="/" className="text-[10px] text-slate-400 hover:text-[#10b981] mt-2 underline transition-all font-semibold">
            ← Volver a Inicio
          </Link>
        </div>

        {/* Tabs */}
        {registerStep < 3 && (
          <div className="grid grid-cols-2 bg-[#0e121e] border border-slate-900 rounded-xl p-1 mb-6">
            <button
              onClick={() => {
                setActiveTab("login");
                setRegisterStep(1);
              }}
              className={`py-2 text-xs font-bold font-display rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "login"
                  ? "bg-slate-800 text-slate-100 border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Ingresar
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`py-2 text-xs font-bold font-display rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "register"
                  ? "bg-slate-800 text-slate-100 border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Inscripción
            </button>
          </div>
        )}

        {/* Tab Content: LOGIN */}
        {activeTab === "login" && !showForgotPassword && (
          <form onSubmit={handleLoginSubmit} className="bg-[#0e121e]/80 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-5 font-sans">
            <div className="text-center">
              <h2 className="font-display font-bold text-sm text-slate-200 uppercase tracking-wider">Ingreso de Usuarios</h2>
              <p className="text-[11px] text-slate-500 mt-1">Selecciona tu tipo de usuario para acceder al portal.</p>
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center space-y-2">
                <div>{loginError}</div>
                {loginUserType === "parent" && (
                  <button
                    type="button"
                    onClick={() => {
                      cleanupRecaptcha();
                      setLoginError("");
                      setPhoneCodeSent(false);
                      setConfirmationResult(null);
                      setSmsCode("");
                    }}
                    className="text-[9px] text-[#10b981] hover:underline block mx-auto font-bold uppercase cursor-pointer"
                  >
                    🔄 Reiniciar Verificación
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1.5 bg-[#07090e] border border-slate-800 rounded-xl p-1">
                {[
                  ["parent", "Padre"],
                  ["coach", "Entrenador"],
                  ["admin", "Administrador"]
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setLoginUserType(type);
                      setLoginError("");
                    }}
                    className={`py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${
                      loginUserType === type ? "bg-[#10b981] text-slate-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loginUserType === "parent" ? (
                <>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">TELÉFONO CELULAR</label>
                    <input
                      type="tel"
                      required
                      placeholder="+57 300 123 4567"
                      value={loginPhone}
                      onChange={(e) => {
                        setLoginPhone(e.target.value);
                        setPhoneCodeSent(false);
                        setConfirmationResult(null);
                      }}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                    />
                  </div>

                  {phoneCodeSent && (
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold block mb-1">CÓDIGO SMS</label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        placeholder="Código recibido"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">CORREO ELECTRÓNICO</label>
                    <input
                      type="email"
                      required
                      placeholder="ejemplo@correo.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">CONTRASEÑA</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                    />
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setResetEmail(loginEmail);
                          setResetError("");
                          setResetSuccessMessage("");
                        }}
                        className="text-[10px] text-slate-500 hover:text-[#10b981] transition-all font-semibold cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div id="recaptcha-container" className="my-1" />

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer uppercase tracking-wider"
            >
              {isLoggingIn ? "Procesando..." : (loginUserType === "parent" && !phoneCodeSent ? "Enviar Código" : "Iniciar Sesión")}
              {!isLoggingIn && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        )}

        {/* Formulario de Recuperación de Contraseña */}
        {activeTab === "login" && showForgotPassword && (
          <form onSubmit={handlePasswordResetSubmit} className="bg-[#0e121e]/80 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-5 font-sans">
            <div className="text-center">
              <h2 className="font-display font-bold text-sm text-slate-200 uppercase tracking-wider">Recuperar Contraseña</h2>
              <p className="text-[11px] text-slate-500 mt-1">Ingresa tu correo electrónico y te enviaremos un enlace de restablecimiento.</p>
            </div>

            {resetError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center">
                {resetError}
              </div>
            )}

            {resetSuccessMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-[11px] text-center">
                {resetSuccessMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-slate-400 font-bold block mb-1">CORREO ELECTRÓNICO</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isResetting}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-slate-950 font-display font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider disabled:opacity-50"
              >
                {isResetting ? "Enviando..." : "Enviar Correo"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setLoginError("");
                }}
                className="w-full bg-[#0e121e] border border-slate-800 text-slate-400 hover:text-slate-200 font-display font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                Volver al ingreso
              </button>
            </div>
          </form>
        )}

        {/* Tab Content: REGISTER / USER JOURNEY SIMULATOR */}
        {activeTab === "register" && (
          <div className="space-y-4">
            {registerStep === 1 && (
              <form onSubmit={handleNextStep} className="bg-[#0e121e]/80 border border-slate-900 p-6 rounded-3xl shadow-xl space-y-4 font-sans">
                <div className="text-center mb-2">
                  <h2 className="font-display font-bold text-sm text-slate-200 uppercase tracking-wider">Paso 1: Ficha del Atleta</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Completa los datos del alumno y acudiente para calcular la categoría deportiva.</p>
                </div>

                {registerError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center">
                    {registerError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">NOMBRE COMPLETO DEL PADRE / ACUDIENTE</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre completo"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">TELÉFONO DE CONTACTO</label>
                    <input
                      type="tel"
                      required
                      placeholder="+57 300 123 4567"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green"
                    />
                  </div>

                  <hr className="border-slate-800/80 my-2" />

                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">NOMBRE COMPLETO DEL ALUMNO (ATLETA)</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre completo del atleta"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-brand-green font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">FECHA DE NACIMIENTO DEL ATLETA</label>
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={handleBirthDateChange}
                      className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-green"
                    />
                  </div>
                </div>

                {/* Categoría Recomendada Result */}
                {studentCategory && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-1.5 animate-fade-in mt-4">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Categoría Asignada Automáticamente</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-0.5">
                      <span className="font-display font-black text-slate-200">{studentCategory.name}</span>
                      <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#10b981]" />
                        {studentCategory.schedules}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!studentCategory}
                  className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-display font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
                >
                  Continuar al Pago
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Paso 2: Checkout de Suscripción */}
            {registerStep === 2 && studentCategory && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="text-center w-full max-w-sm">
                  <span className="text-[9px] font-mono text-[#10b981] uppercase tracking-widest font-bold">Paso 2 de 3</span>
                  <h2 className="font-display font-black text-sm text-slate-200 uppercase tracking-wider mt-1">Checkout de Suscripción</h2>
                </div>
                <PaymentSimulator 
                  amount={studentCategory.cost} 
                  onPaymentSuccess={handlePaymentCompleted} 
                />
              </div>
            )}

            {/* Paso 3: Credencial QR y Activación Exitosa (Pendiente de aprobación) */}
            {registerStep === 3 && (
              <div className="flex flex-col items-center justify-center space-y-5 animate-fade-in font-sans">
                <div className="text-center max-w-xs">
                  <div className={`${registeredStudentIsActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"} px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1 mb-2`}>
                    <QrCode className="w-3.5 h-3.5" />
                    {registeredStudentIsActive ? "Pago Aprobado" : "Pago por Confirmar"}
                  </div>
                  <h2 className="font-display font-black text-base text-slate-100 uppercase tracking-wide">
                    {registeredStudentIsActive ? "Inscripción Activada" : "Inscripción Recibida"}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {registeredStudentIsActive
                      ? "Pago aprobado. Tu inscripción fue activada. Ya puedes continuar con el acceso seguro al Portal del Padre."
                      : "Tus datos y reporte de pago han sido guardados. Una vez que el Profe Luis López valide tu depósito en la cuenta de Banorte, tu portal y credencial QR se activarán automáticamente."}
                  </p>
                </div>

                {registerError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center">
                    {registerError}
                  </div>
                )}

                {registeredStudentStatusLoading && (
                  <div className="bg-slate-800/50 border border-slate-700 text-slate-400 p-3 rounded-xl text-[11px] text-center">
                    Actualizando estado de inscripción...
                  </div>
                )}

                {registeredStudentStatusError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-[11px] text-center">
                    {registeredStudentStatusError}
                  </div>
                )}

                <QRGenerator
                  studentName={studentName}
                  status={registeredStudentQrStatus}
                  token={registrationToken || "CC-2026-PENDIENTE"}
                />

                <button
                  onClick={handleGoToParentPortal}
                  disabled={!registeredStudentIsActive || registeredStudentStatusLoading}
                  className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-display font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xl shadow-emerald-500/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  {registeredStudentIsActive
                    ? (parentUid ? "Ir a Mi Portal" : "Autenticar Teléfono para Entrar")
                    : "Esperando aprobación del pago"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
