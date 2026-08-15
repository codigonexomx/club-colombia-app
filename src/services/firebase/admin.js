// src/services/firebase/admin.js

import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { adminListenerStarted, adminListenerStopped, adminStep } from "@/lib/adminDiagnostics";
import { isFinancialPayment } from "@/lib/paymentsModel";

/**
 * Obtiene todos los estudiantes de la base de datos real.
 * @returns {Promise<array>}
 */
export async function getStudents() {
  const querySnapshot = await getDocs(collection(db, "students"));
  const students = [];
  querySnapshot.forEach((doc) => {
    students.push({ id: doc.id, ...doc.data() });
  });
  return students;
}

/**
 * Suscribe en tiempo real a la lista de estudiantes.
 */
export function subscribeStudentsList(callback) {
  adminListenerStarted("ADMIN_STEP_70_FIRESTORE_LISTENER_STUDENTS_CREATED", { collection: "students" });
  const unsubscribe = onSnapshot(collection(db, "students"), (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({ id: doc.id, studentId: data.studentId || doc.id, ...data });
    });
    adminStep("ADMIN_STEP_71_FIRESTORE_LISTENER_STUDENTS_SNAPSHOT", {
      docsCount: snapshot.size,
      mappedCount: list.length
    });
    callback(list);
  });
  return () => {
    adminListenerStopped("ADMIN_STEP_72_FIRESTORE_LISTENER_STUDENTS_UNSUBSCRIBE", { collection: "students" });
    unsubscribe();
  };
}

/**
 * Suscribe en tiempo real a todas las evaluaciones técnicas.
 */
export function subscribeAllEvaluations(callback, onError) {
  const unsubscribe = onSnapshot(collection(db, "evaluations"), (snapshot) => {
    const list = [];

    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });

    callback(list);
  }, (err) => {
    if (onError) onError(err);
  });

  return unsubscribe;
}

/**
 * Suscribe en tiempo real a todas las hojas de asistencia consolidadas.
 */
export function subscribeAllAttendance(callback, onError) {
  const unsubscribe = onSnapshot(collection(db, "attendance"), (snapshot) => {
    const list = [];

    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });

    callback(list);
  }, (err) => {
    if (onError) onError(err);
  });

  return unsubscribe;
}

/**
 * Actualiza la categoría del estudiante real.
 * @param {string} studentId
 * @param {string} category
 * @returns {Promise<{ success: boolean }>}
 */
export async function updateStudentCategory(studentId, category) {
  const docRef = doc(db, "students", studentId);
  await updateDoc(docRef, { category });
  return { success: true };
}

/**
 * Actualiza únicamente el estado administrativo del alumno.
 */
export async function updateStudentLifecycleStatus(studentId, status, context = {}) {
  const docRef = doc(db, "students", studentId);
  const patch = {
    status,
    updatedAt: serverTimestamp()
  };

  if (context.reason || context.reasonDetail) {
    patch.lifecycleReason = context.reason || "";
    patch.lifecycleReasonDetail = context.reasonDetail || "";
    patch.lifecycleUpdatedAt = serverTimestamp();
  }

  await updateDoc(docRef, patch);
  return { success: true };
}

async function countQuery(collectionName, field, value) {
  const q = query(collection(db, collectionName), where(field, "==", value));
  const snap = await getDocs(q);
  return snap.size;
}

async function countFinancialPaymentsForStudent(studentId) {
  const q = query(collection(db, "payments"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return snap.docs.filter((docSnapshot) => isFinancialPayment(docSnapshot.data())).length;
}

function attendanceRecordMatchesStudent(record, studentId, studentName) {
  if (record?.studentId) return record.studentId === studentId;
  return !!studentName && (record?.studentName === studentName || record?.name === studentName);
}

async function countAttendanceForStudent(studentId, studentName) {
  const snap = await getDocs(collection(db, "attendance"));
  let count = 0;

  snap.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const records = Array.isArray(data.records) ? data.records : null;

    if (records) {
      count += records.filter((record) => attendanceRecordMatchesStudent(record, studentId, studentName)).length;
      return;
    }

    if (data.studentId === studentId || (!data.studentId && studentName && data.studentName === studentName)) {
      count += 1;
    }
  });

  return count;
}

/**
 * Revisa si un alumno tiene historial que impide su eliminación definitiva.
 */
export async function getStudentLifecycleHistory(student) {
  const studentId = student?.studentId || student?.id || "";
  const studentName = student?.name || "";
  if (!studentId) return { payments: 0, attendance: 0, evaluations: 0, total: 0 };

  const payments = await countFinancialPaymentsForStudent(studentId);
  const attendance = await countAttendanceForStudent(studentId, studentName);
  const evaluationsById = await countQuery("evaluations", "studentId", studentId);
  const evaluationsByName = studentName ? await countQuery("evaluations", "studentName", studentName) : 0;
  const evaluations = Math.max(evaluationsById, evaluationsByName);

  return {
    payments,
    attendance,
    evaluations,
    total: payments + attendance + evaluations
  };
}

/**
 * Bloquea la eliminación física. La baja segura debe conservar el historial.
 */
export async function deleteEmptyStudent(student) {
  const studentId = student?.studentId || student?.id || "";
  if (!studentId) return { success: false, error: "studentId requerido" };

  const history = await getStudentLifecycleHistory(student);
  return {
    success: false,
    blocked: true,
    noPhysicalDelete: true,
    history
  };
}

/**
 * Crea un nuevo evento en el calendario de Firebase.
 */
export async function createEvent(eventData) {
  return saveEvent(eventData);
}

/**
 * Guarda o actualiza un evento en el calendario de Firebase.
 */
export async function saveEvent(eventData, eventId = null) {
  const response = await fetch("/api/admin/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({ ...eventData, eventId: eventId || "" })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "No fue posible guardar el evento");
  }

  return payload;
}

/**
 * Elimina un evento del calendario de Firebase.
 */
export async function deleteEvent(eventId) {
  if (!eventId) throw new Error("ID de evento requerido");
  const response = await fetch(`/api/admin/events?eventId=${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "No fue posible eliminar el evento");
  }

  return payload;
}

/**
 * Envia un comunicado global (Anuncio).
 */
export async function sendAnnouncement(text) {
  if (!text) throw new Error("Texto del comunicado requerido");
  
  const docRef = doc(db, "settings", "announcements");
  await import("firebase/firestore").then(({ setDoc }) => 
    setDoc(docRef, {
      notice: text,
      date: new Date().toISOString()
    })
  );
  
  if (typeof window !== "undefined") {
    localStorage.setItem("adminNotice", text);
  }
  
  return { success: true };
}

/**
 * Limpia el comunicado global activo.
 */
export async function deleteAnnouncement() {
  const docRef = doc(db, "settings", "announcements");
  await import("firebase/firestore").then(({ setDoc }) =>
    setDoc(docRef, {
      notice: "",
      date: new Date().toISOString()
    }, { merge: true })
  );

  if (typeof window !== "undefined") {
    localStorage.removeItem("adminNotice");
  }

  return { success: true };
}

/**
 * Guarda o actualiza un drill (Video de Entrenamiento).
 */
export async function saveDrill(drillData, drillId = null) {
  if (!drillData.title) throw new Error("Título del drill requerido");
  const finalId = drillId || drillData.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  
  const docRef = doc(db, "drills", finalId);
  await import("firebase/firestore").then(({ setDoc }) => 
    setDoc(docRef, {
      ...drillData,
      id: finalId // asegúrate de que lleve su id por si acaso
    })
  );
  return { success: true, drillId: finalId };
}

/**
 * Elimina un drill de la biblioteca.
 */
export async function deleteDrill(drillId) {
  if (!drillId) throw new Error("ID de drill requerido");
  const docRef = doc(db, "drills", drillId);
  await import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(docRef));
  return { success: true };
}

/**
 * Actualiza el teléfono de un acudiente haciendo la petición al servidor (Firebase Admin SDK).
 */
export async function updateParentPhone(parentUid, oldPhone, newPhone) {
  const response = await fetch("/api/admin/update-parent-phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentUid: parentUid || "",
      oldPhone: oldPhone || "",
      newPhone: newPhone
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Error al actualizar el teléfono.");
  }

  return data;
}

/**
 * Registra manualmente a un alumno (crea alumno y anexa pago si es efectivo).
 */
export async function manualRegisterStudent(studentData, manualPaidCash, manualPaymentConcept) {
  const { doc, collection, setDoc, addDoc, serverTimestamp } = await import("firebase/firestore");
  
  const studentDocRef = doc(collection(db, "students"));
  const newStudentId = studentDocRef.id;
  
  await setDoc(studentDocRef, {
    ...studentData,
    studentId: newStudentId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (manualPaidCash) {
    await addDoc(collection(db, "payments"), {
      studentId: newStudentId,
      studentName: studentData.name,
      categoryName: studentData.category,
      amount: manualPaymentConcept === "monthly" ? 300 : 50,
      paymentType: manualPaymentConcept === "monthly" ? "Mensualidad Completa" : "Clase Individual",
      date: new Date().toLocaleDateString("es-MX") + " " + new Date().toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' }),
      status: "approved",
      parentEmail: "",
      parentUid: studentData.parentUid || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return { success: true, studentId: newStudentId };
}

/**
 * Aplica una excepción de categoría de forma manual.
 */
export async function applyCategoryOverride(studentId, newCategoryData) {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const studentRef = doc(db, "students", studentId);
  await updateDoc(studentRef, {
    ...newCategoryData,
    updatedAt: serverTimestamp()
  });
  return { success: true };
}

/**
 * Levanta la suspensión confirmando el pago manualmente.
 */
export async function confirmManualPayment(studentIdOrName) {
  const { doc, collection, query, where, getDocs, updateDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
  
  // Buscar alumno
  let studentDocRef = doc(db, "students", studentIdOrName);
  let studentSnap = await getDoc(studentDocRef);

  if (!studentSnap.exists()) {
    const qName = query(collection(db, "students"), where("normalizedName", "==", studentIdOrName));
    const nameSnap = await getDocs(qName);
    if (!nameSnap.empty) {
      studentDocRef = nameSnap.docs[0].ref;
      studentSnap = nameSnap.docs[0];
    }
  }

  if (!studentSnap.exists()) {
    throw new Error(`No se encontró el alumno: ${studentIdOrName}`);
  }

  const studentData = studentSnap.data();
  const isInactiveStudent = studentData.status === "inactive";
  const studentPatch = {
    billingStatus: "paid",
    dueDays: 0,
    updatedAt: serverTimestamp()
  };

  if (!isInactiveStudent) {
    studentPatch.status = "active";
  }

  await updateDoc(studentDocRef, studentPatch);

  if (studentData.parentUid && !isInactiveStudent) {
    await updateDoc(doc(db, "users", studentData.parentUid), { status: "active" });
  } else if (studentData.parentEmail && !isInactiveStudent) {
    const parentRef = doc(db, "users", studentData.parentEmail.toLowerCase());
    await updateDoc(parentRef, { status: "active" });
  }
  
  return { success: true };
}

/**
 * Suscribe en tiempo real a los pagos en estado "pending".
 */
export function subscribePendingPayments(callback, onError) {
  const paymentsRef = collection(db, "payments");
  const q = query(
    paymentsRef,
    where("status", "==", "pending")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const pays = [];

    snapshot.forEach((doc) => {
      pays.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    callback(pays);
  }, (err) => {
    if (onError) onError(err);
  });

  return unsubscribe;
}

/**
 * Aprueba un pago llamando al endpoint seguro.
 */
export async function approvePayment(paymentId) {
  const response = await fetch("/api/admin/approve-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "No fue posible aprobar el pago. Revisa los datos.");
  }
  return data;
}

/**
 * Pone una solicitud de pago (y al alumno) en estado "on_hold".
 */
export async function holdPayment(paymentId, studentIdOrName) {
  const { doc, collection, query, where, getDocs, updateDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
  
  // 1. Marcar el pago como en espera
  const paymentRef = doc(db, "payments", paymentId);
  await updateDoc(paymentRef, { status: "on_hold", updatedAt: serverTimestamp() });

  // 2. Cambiar estado del alumno a en espera
  let studentDocRef = doc(db, "students", studentIdOrName);
  let studentSnap = await getDoc(studentDocRef);

  if (!studentSnap.exists()) {
    const qName = query(collection(db, "students"), where("normalizedName", "==", studentIdOrName));
    const nameSnap = await getDocs(qName);
    if (!nameSnap.empty) {
      studentDocRef = nameSnap.docs[0].ref;
      studentSnap = nameSnap.docs[0];
    }
  }

  if (studentSnap.exists()) {
    const studentData = studentSnap.data();
    await updateDoc(studentDocRef, { status: "on_hold", billingStatus: "on_hold", updatedAt: serverTimestamp() });

    if (studentData.parentUid) {
      await updateDoc(doc(db, "users", studentData.parentUid), { status: "on_hold" });
    } else if (studentData.parentEmail) {
      const parentRef = doc(db, "users", studentData.parentEmail.toLowerCase());
      await updateDoc(parentRef, { status: "on_hold" });
    }
  }
  return { success: true };
}

/**
 * Audita alumnos activos con más de 5 días de mora y los suspende junto con sus acudientes.
 */
export async function processSuspensions() {
  const { doc, collection, query, where, getDocs, updateDoc } = await import("firebase/firestore");
  
  let suspendedCount = 0;
  const q = query(collection(db, "students"), where("status", "==", "active"), where("dueDays", ">", 5));
  const querySnapshot = await getDocs(q);
  
  for (const d of querySnapshot.docs) {
    await updateDoc(doc(db, "students", d.id), { status: "suspended" });
    suspendedCount++;
    
    // También actualizar en user
    const studentData = d.data();
    if (studentData.parentUid) {
      await updateDoc(doc(db, "users", studentData.parentUid), { status: "suspended" });
    } else if (studentData.parentEmail) {
      // Legacy compatibility
      await updateDoc(doc(db, "users", studentData.parentEmail.toLowerCase()), { status: "suspended" });
    }
  }
  
  return { success: true, count: suspendedCount };
}
