#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const CANONICAL_STUDENT_ID = "CzMU6tV6oXy0l10MHKqt";
const TARGET_NORMALIZED_NAME = "diego alberto basilio cruz";
const TARGET_PARENT_UID = "kWkYyNk6HzXIscw3BODRbyctIG52";
const TARGET_PARENT_PHONE = "+525583577248";
const FINAL_CATEGORY = "Sub-15 Avanzado";
const FINAL_CATEGORY_ID = "sub-15-avanzado";
const ATTENDANCE_WITH_DUPLICATES_ID = "attendance-10-8-2026";
const LEGACY_ATTENDANCE_IDS_TO_REPORT = [
  "attendance-17-7-2026",
  "attendance-31-7-2026",
  "attendance-1-8-2026"
];

const TEST_PAYMENT_IDS = new Set([
  "2Mzo22fcHRr9AXy8WAOR",
  "3AoSqL0Ou9lXKdHrWFRh",
  "KMiyCJpJuuZTzp6k2MHK",
  "Msfvvf5CubHYYAQfOF2s",
  "OmS0rftUyYJeua6Yd2MP",
  "pkvFbyt6LDV1VaykHRaE",
  "SwVQVc2mNOzdFJMNPBvG",
  "T9OKtmXorvNNPTCI9YKF",
  "TKxUi6JImN3IJ6zvyyU6",
  "UFLDq05IJaNct2fYR5yT",
  "VluNz2ZxmMwo6NHlaiAm",
  "ZOLryWC9rHcZDdRHlEWa"
]);

const DUPLICATE_STUDENT_IDS = [
  "rbB8m9wrsDK5c6o0zSmw",
  "DD1he4GmlHUT4p8bhHBB",
  "nbtAwbwDnG77e1GQ68ae",
  "BktgblTDkyYI2mGeV5Xr",
  "xEzD3yg9qZp1dydLkpXe",
  "id80xO8SvQq1p5QDbaOD",
  "2r4ni79qkDjelrTKHPpZ",
  "7G21cnNJqHCfbuMXOMyX",
  "ACW13OnVx1dIhqiFHaoZ",
  "Myntlywr51nq1xkvxwGh",
  "VblVbK1D0S0IsMfLdVvz",
  "jc5QXXeVsMcpOib1AdDf",
  "hnz0PjWqaotnsfkUbebq"
];

const ALL_STUDENT_IDS = [CANONICAL_STUDENT_ID, ...DUPLICATE_STUDENT_IDS];
const ALL_STUDENT_ID_SET = new Set(ALL_STUDENT_IDS);
const DUPLICATE_STUDENT_ID_SET = new Set(DUPLICATE_STUDENT_IDS);

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply")
  };
}

function initializeFirebaseAdmin() {
  if (admin.getApps().length > 0) return;

  const localServiceAccountPath = path.join(
    process.cwd(),
    "club-colombia-futbol-firebase-adminsdk-fbsvc-2aa1a9a36c.json"
  );

  if (fs.existsSync(localServiceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(localServiceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    return;
  }

  admin.initializeApp();
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function timestampToIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  return String(value);
}

function serializeFirestoreValue(value) {
  if (!value) return value;
  if (typeof value.toDate === "function") {
    return {
      __type: "timestamp",
      iso: value.toDate().toISOString(),
      seconds: value.seconds,
      nanoseconds: value.nanoseconds
    };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, serializeFirestoreValue(entryValue)])
    );
  }
  return value;
}

function compactStudent(docSnap) {
  if (!docSnap.exists) {
    return {
      id: docSnap.id,
      exists: false
    };
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    exists: true,
    studentId: data.studentId || docSnap.id,
    name: data.name || "",
    normalizedName: data.normalizedName || "",
    parentPhone: data.parentPhone || "",
    parentUid: data.parentUid || "",
    status: data.status || "",
    billingStatus: data.billingStatus || "",
    category: data.category || "",
    categoryId: data.categoryId || "",
    level: data.level || "",
    healthStatus: data.healthStatus || "",
    dueDays: data.dueDays ?? "",
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function compactPayment(docSnap) {
  const data = docSnap.data();
  return {
    paymentId: docSnap.id,
    studentId: data.studentId || "",
    resolvedStudentId: data.resolvedStudentId || "",
    status: data.status || "",
    amount: data.amount ?? "",
    paymentType: data.paymentType || "",
    createdAt: timestampToIso(data.createdAt),
    approvedAt: timestampToIso(data.approvedAt),
    isTest: data.isTest === true,
    excludedFromFinancialHistory: data.excludedFromFinancialHistory === true,
    willBeMarkedAsTest: TEST_PAYMENT_IDS.has(docSnap.id)
  };
}

function compactEvaluation(docSnap) {
  const data = docSnap.data();
  return {
    evaluationId: docSnap.id,
    studentId: data.studentId || "",
    studentName: data.studentName || "",
    timestamp: timestampToIso(data.timestamp || data.createdAt || data.date),
    healthStatus: data.healthStatus || "",
    tacticalNotes: data.tacticalNotes || ""
  };
}

function compactAttendanceRecord(record, index) {
  return {
    index,
    studentId: record.studentId || "",
    name: record.name || record.studentName || "",
    status: record.status || "",
    level: record.level || "",
    healthStatus: record.healthStatus || ""
  };
}

function isDiegoRecord(record) {
  const studentId = record?.studentId || "";
  return ALL_STUDENT_ID_SET.has(studentId) ||
    normalizeName(record?.name || record?.studentName || record?.student) === TARGET_NORMALIZED_NAME;
}

async function readStudentSnaps(db) {
  const result = [];
  for (const studentId of ALL_STUDENT_IDS) {
    result.push(await db.collection("students").doc(studentId).get());
  }
  return result;
}

async function readPayments(db) {
  const map = new Map();

  for (const studentId of ALL_STUDENT_IDS) {
    const byStudentId = await db.collection("payments").where("studentId", "==", studentId).get();
    byStudentId.forEach((docSnap) => map.set(docSnap.id, docSnap));

    const byResolvedStudentId = await db.collection("payments").where("resolvedStudentId", "==", studentId).get();
    byResolvedStudentId.forEach((docSnap) => map.set(docSnap.id, docSnap));
  }

  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function readEvaluations(db) {
  const map = new Map();

  for (const studentId of ALL_STUDENT_IDS) {
    const snap = await db.collection("evaluations").where("studentId", "==", studentId).get();
    snap.forEach((docSnap) => map.set(docSnap.id, docSnap));
  }

  return [...map.values()].sort((a, b) => {
    const aTime = timestampToIso(a.data().timestamp || a.data().createdAt || a.data().date);
    const bTime = timestampToIso(b.data().timestamp || b.data().createdAt || b.data().date);
    return aTime.localeCompare(bTime) || a.id.localeCompare(b.id);
  });
}

async function readAttendanceDocs(db) {
  const ids = [ATTENDANCE_WITH_DUPLICATES_ID, ...LEGACY_ATTENDANCE_IDS_TO_REPORT];
  const docs = [];

  for (const attendanceId of ids) {
    docs.push(await db.collection("attendance").doc(attendanceId).get());
  }

  return docs;
}

async function readUserSnap(db) {
  return db.collection("users").doc(TARGET_PARENT_UID).get();
}

async function validateProtections(studentSnaps, userSnap) {
  const errors = [];
  const canonicalSnap = studentSnaps.find((snap) => snap.id === CANONICAL_STUDENT_ID);

  if (!canonicalSnap?.exists) {
    errors.push(`El alumno canonico ${CANONICAL_STUDENT_ID} no existe.`);
  } else {
    const canonical = canonicalSnap.data();
    const canonicalStudentId = canonical.studentId || canonicalSnap.id;

    if (canonicalStudentId !== CANONICAL_STUDENT_ID) {
      errors.push(`El studentId interno del canonico es ${canonicalStudentId}, no ${CANONICAL_STUDENT_ID}.`);
    }
    if (normalizeName(canonical.normalizedName || canonical.name) !== TARGET_NORMALIZED_NAME) {
      errors.push(`El nombre normalizado del canonico no es ${TARGET_NORMALIZED_NAME}.`);
    }
    if (canonical.parentUid !== TARGET_PARENT_UID) {
      errors.push(`El parentUid del canonico no es ${TARGET_PARENT_UID}.`);
    }
    if (canonical.parentPhone !== TARGET_PARENT_PHONE) {
      errors.push(`El parentPhone del canonico no es ${TARGET_PARENT_PHONE}.`);
    }
  }

  for (const snap of studentSnaps) {
    if (!ALL_STUDENT_ID_SET.has(snap.id)) {
      errors.push(`Se intento cargar un alumno fuera de la lista hardcodeada: ${snap.id}.`);
    }
  }

  if (!userSnap.exists) {
    errors.push(`No existe users/${TARGET_PARENT_UID}.`);
  }

  return errors;
}

function buildCategoryDiscrepancies(students) {
  const seen = new Map();
  for (const student of students.filter((item) => item.exists)) {
    const key = `${student.category || "(vacio)"} / ${student.categoryId || "(vacio)"}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(student.id);
  }

  return [...seen.entries()].map(([category, ids]) => ({ category, ids }));
}

function buildAttendancePlan(attendanceSnap) {
  if (!attendanceSnap.exists) {
    return {
      exists: false,
      matchingRecords: [],
      statusConflict: false,
      statusValues: [],
      canAutoConsolidate: false,
      reason: `No existe attendance/${ATTENDANCE_WITH_DUPLICATES_ID}.`
    };
  }

  const data = attendanceSnap.data();
  const records = Array.isArray(data.records) ? data.records : [];
  const matchingRecords = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => ALL_STUDENT_ID_SET.has(record?.studentId || ""))
    .map(({ record, index }) => compactAttendanceRecord(record, index));

  const statusValues = [...new Set(matchingRecords.map((record) => record.status || "").filter(Boolean))].sort();
  const statusConflict = statusValues.length > 1;

  return {
    exists: true,
    matchingRecords,
    statusConflict,
    statusValues,
    canAutoConsolidate: matchingRecords.length > 1 && !statusConflict,
    reason: statusConflict
      ? "CONFLICTO: existen estados distintos; no se debe consolidar automaticamente."
      : "Sin conflicto de estado detectado."
  };
}

function buildLegacyAttendanceReport(attendanceSnaps) {
  return attendanceSnaps.map((docSnap) => {
    if (!docSnap.exists) {
      return {
        attendanceId: docSnap.id,
        exists: false,
        matchingRecords: []
      };
    }

    const records = Array.isArray(docSnap.data().records) ? docSnap.data().records : [];
    return {
      attendanceId: docSnap.id,
      exists: true,
      matchingRecords: records
        .map((record, index) => ({ record, index }))
        .filter(({ record }) => isDiegoRecord(record))
        .map(({ record, index }) => compactAttendanceRecord(record, index))
    };
  });
}

function buildPlannedChanges({ payments, evaluations, attendancePlan, userSnap }) {
  const paymentUpdates = payments.filter((docSnap) => {
    const data = docSnap.data();
    return TEST_PAYMENT_IDS.has(docSnap.id) ||
      DUPLICATE_STUDENT_ID_SET.has(data.studentId) ||
      DUPLICATE_STUDENT_ID_SET.has(data.resolvedStudentId);
  });
  const evaluationUpdates = evaluations.filter((docSnap) => DUPLICATE_STUDENT_ID_SET.has(docSnap.data().studentId));
  const userData = userSnap.exists ? userSnap.data() : {};
  const currentUserStudentIds = Array.isArray(userData.studentIds) ? userData.studentIds : [];
  const nextUserStudentIds = currentUserStudentIds.filter((studentId, index, list) => {
    if (DUPLICATE_STUDENT_ID_SET.has(studentId)) return false;
    return list.indexOf(studentId) === index;
  });
  if (!nextUserStudentIds.includes(CANONICAL_STUDENT_ID)) {
    nextUserStudentIds.push(CANONICAL_STUDENT_ID);
  }

  return {
    paymentUpdates,
    evaluationUpdates,
    attendanceUpdates: attendancePlan.canAutoConsolidate ? 1 : 0,
    userNeedsUpdate: JSON.stringify(currentUserStudentIds) !== JSON.stringify(nextUserStudentIds),
    currentUserStudentIds,
    nextUserStudentIds,
    duplicateStudentDeletes: DUPLICATE_STUDENT_IDS.length
  };
}

function buildCanonicalCategoryPlan(studentSnaps) {
  const canonicalSnap = studentSnaps.find((snap) => snap.id === CANONICAL_STUDENT_ID);
  const canonical = canonicalSnap?.exists ? canonicalSnap.data() : {};

  return {
    current: {
      category: canonical.category || "",
      categoryId: canonical.categoryId || ""
    },
    final: {
      category: FINAL_CATEGORY,
      categoryId: FINAL_CATEGORY_ID
    },
    needsUpdate: canonical.category !== FINAL_CATEGORY || canonical.categoryId !== FINAL_CATEGORY_ID
  };
}

async function findUnexpectedReferences(db) {
  const references = [];
  const collections = await db.listCollections();

  for (const collectionRef of collections) {
    const snap = await collectionRef.get();
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const pathId = `${collectionRef.id}/${docSnap.id}`;

      const scan = (value, fieldPath = "") => {
        if (value == null) return;
        if (typeof value !== "object") {
          if (DUPLICATE_STUDENT_ID_SET.has(value)) {
            references.push({ document: pathId, field: fieldPath, studentId: value });
          }
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => scan(item, `${fieldPath}[${index}]`));
          return;
        }
        for (const [key, entryValue] of Object.entries(value)) {
          scan(entryValue, fieldPath ? `${fieldPath}.${key}` : key);
        }
      };

      scan(data);
    }
  }

  return references.sort((a, b) =>
    a.document.localeCompare(b.document) ||
    a.field.localeCompare(b.field) ||
    a.studentId.localeCompare(b.studentId)
  );
}

function ensureOnlyExpectedApplyTargets(unexpectedReferences) {
  const allowedPrefixes = [
    "attendance/",
    "evaluations/",
    "payments/",
    "students/",
    "users/"
  ];

  return unexpectedReferences.filter((reference) =>
    !allowedPrefixes.some((prefix) => reference.document.startsWith(prefix))
  );
}

function buildBackupPayload({ studentSnaps, payments, evaluations, attendanceSnaps, userSnap }) {
  const toEntry = (docSnap) => ({
    path: `${docSnap.ref.parent.id}/${docSnap.id}`,
    exists: docSnap.exists,
    data: docSnap.exists ? serializeFirestoreValue(docSnap.data()) : null
  });

  return {
    createdAt: new Date().toISOString(),
    migration: "diego-duplicates",
    canonicalStudentId: CANONICAL_STUDENT_ID,
    duplicateStudentIds: DUPLICATE_STUDENT_IDS,
    students: studentSnaps.map(toEntry),
    payments: payments.map(toEntry),
    evaluations: evaluations.map(toEntry),
    attendance: attendanceSnaps.map(toEntry),
    user: toEntry(userSnap)
  };
}

function writeBackup(payload) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const backupDir = path.join(process.cwd(), "backups", "migrations", `diego-duplicates-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "backup.json");
  fs.writeFileSync(backupPath, `${JSON.stringify(payload, null, 2)}\n`);
  return backupPath;
}

function buildConsolidatedAttendanceRecords(attendanceSnap) {
  const data = attendanceSnap.data();
  const records = Array.isArray(data.records) ? data.records : [];
  const canonicalRecord = records.find((record) => record?.studentId === CANONICAL_STUDENT_ID);
  const firstDiegoRecord = records.find((record) => ALL_STUDENT_ID_SET.has(record?.studentId || ""));
  const baseRecord = canonicalRecord || firstDiegoRecord;

  if (!baseRecord) return records;

  const consolidatedRecord = {
    ...baseRecord,
    studentId: CANONICAL_STUDENT_ID,
    studentName: "Diego Alberto Basilio Cruz",
    name: "Diego Alberto Basilio Cruz"
  };

  return [
    ...records.filter((record) => !ALL_STUDENT_ID_SET.has(record?.studentId || "")),
    consolidatedRecord
  ];
}

async function applyMigration(db, context) {
  const { payments, evaluations, attendanceSnaps, userSnap, plannedChanges, categoryPlan } = context;
  const backupPath = writeBackup(buildBackupPayload(context));
  console.log(`Backup logico creado en: ${backupPath}`);

  const batch = db.batch();
  let writes = 0;

  if (categoryPlan.needsUpdate) {
    batch.set(db.collection("students").doc(CANONICAL_STUDENT_ID), {
      category: FINAL_CATEGORY,
      categoryId: FINAL_CATEGORY_ID,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writes += 1;
  }

  for (const paymentSnap of plannedChanges.paymentUpdates) {
    const data = paymentSnap.data();
    const patch = {
      isTest: TEST_PAYMENT_IDS.has(paymentSnap.id) || data.isTest === true,
      excludedFromFinancialHistory: TEST_PAYMENT_IDS.has(paymentSnap.id) || data.excludedFromFinancialHistory === true,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (TEST_PAYMENT_IDS.has(paymentSnap.id)) {
      patch.testReason = "diego-duplicate-cleanup-confirmed-test-payment";
      patch.originalStudentId = data.originalStudentId || data.studentId || "";
      patch.originalResolvedStudentId = data.originalResolvedStudentId || data.resolvedStudentId || "";
    }
    if (DUPLICATE_STUDENT_ID_SET.has(data.studentId)) patch.studentId = CANONICAL_STUDENT_ID;
    if (DUPLICATE_STUDENT_ID_SET.has(data.resolvedStudentId)) patch.resolvedStudentId = CANONICAL_STUDENT_ID;
    batch.set(paymentSnap.ref, patch, { merge: true });
    writes += 1;
  }

  for (const evaluationSnap of plannedChanges.evaluationUpdates) {
    batch.set(evaluationSnap.ref, {
      studentId: CANONICAL_STUDENT_ID,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writes += 1;
  }

  const primaryAttendanceSnap = attendanceSnaps.find((snap) => snap.id === ATTENDANCE_WITH_DUPLICATES_ID);
  if (plannedChanges.attendanceUpdates && primaryAttendanceSnap?.exists) {
    batch.set(primaryAttendanceSnap.ref, {
      records: buildConsolidatedAttendanceRecords(primaryAttendanceSnap),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writes += 1;
  }

  if (plannedChanges.userNeedsUpdate) {
    batch.set(userSnap.ref, {
      studentIds: plannedChanges.nextUserStudentIds,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writes += 1;
  }

  await batch.commit();
  console.log(`Migracion aplicada. Writes ejecutados: ${writes}`);
  console.log("Students duplicados NO eliminados. Deben borrarse solo en una fase posterior tras validar 0 referencias.");
}

function printReport(report) {
  console.log("========== DIEGO DUPLICATES MIGRATION DRY-RUN ==========");
  console.log(`Modo: ${report.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Canonico: ${CANONICAL_STUDENT_ID}`);
  console.log(`Duplicados hardcodeados: ${DUPLICATE_STUDENT_IDS.length}`);
  console.log("");

  console.log("Protecciones:");
  if (report.protectionErrors.length === 0) {
    console.log("- OK: protecciones basicas satisfechas.");
  } else {
    report.protectionErrors.forEach((error) => console.log(`- ABORT: ${error}`));
  }
  console.log("");

  console.log("Students:");
  console.table(report.students);
  console.log("");

  console.log("Discrepancias de categoria:");
  console.table(report.categoryDiscrepancies);
  console.log("");

  console.log("Categoria canonica:");
  console.table([
    {
      campo: "category",
      actual: report.categoryPlan.current.category,
      finalPropuesto: report.categoryPlan.final.category
    },
    {
      campo: "categoryId",
      actual: report.categoryPlan.current.categoryId,
      finalPropuesto: report.categoryPlan.final.categoryId
    }
  ]);
  console.log("");

  console.log("users/{parentUid}.studentIds:");
  console.log(JSON.stringify(report.userStudentIds, null, 2));
  console.log("users/{parentUid}.studentIds despues de futura migracion:");
  console.log(JSON.stringify(report.nextUserStudentIds, null, 2));
  console.log("");

  console.log("Payments relacionados identificados como prueba:");
  console.table(report.payments);
  console.log("Campos propuestos para identificarlos: isTest=true, excludedFromFinancialHistory=true, testReason, originalStudentId, originalResolvedStudentId.");
  console.log("Nota: si reportes actuales consultan payments approved sin filtrar isTest, podrian seguir contandolos hasta ajustar esas lecturas.");
  console.log("");

  console.log("Evaluations no canonicas que cambiarian studentId:");
  console.table(report.nonCanonicalEvaluations);
  console.log("");

  console.log(`Attendance ${ATTENDANCE_WITH_DUPLICATES_ID}:`);
  console.table(report.attendance.primary.matchingRecords);
  console.log(`Estados encontrados: ${report.attendance.primary.statusValues.join(", ") || "(ninguno)"}`);
  console.log(report.attendance.primary.reason);
  console.log("");

  console.log("Attendance legacy por nombre, solo reporte:");
  for (const legacy of report.attendance.legacy) {
    console.log(`- ${legacy.attendanceId}: ${legacy.matchingRecords.length} coincidencia(s)`);
    if (legacy.matchingRecords.length > 0) console.table(legacy.matchingRecords);
  }
  console.log("");

  console.log("Referencias a IDs duplicados encontradas:");
  console.table(report.duplicateReferences);
  console.log("");

  console.log("Resumen de futura ejecucion --apply:");
  console.log(`- Student canonico a actualizar categoria: ${report.counts.canonicalStudentCategoryUpdates}`);
  console.log(`- Payments a actualizar: ${report.counts.paymentUpdates}`);
  console.log(`- Evaluations a actualizar: ${report.counts.evaluationUpdates}`);
  console.log(`- Attendance docs a actualizar automaticamente: ${report.counts.attendanceUpdates}`);
  console.log(`- User docs a actualizar: ${report.counts.userUpdates}`);
  console.log(`- Total writes previstos por --apply: ${report.counts.totalApplyWrites}`);
  console.log(`- Students duplicados que eventualmente podrian eliminarse despues de validar 0 referencias: ${report.counts.eventualDuplicateStudentDeletes}`);
  console.log("");

  console.log("Firestore modificado:");
  console.log(report.apply ? "- SI, solo si no hubo abortos." : "- NO. Este dry-run solo leyo y reporto.");
  console.log("========================================================");
}

async function main() {
  const args = parseArgs(process.argv);
  initializeFirebaseAdmin();
  const db = getFirestore();

  const studentSnaps = await readStudentSnaps(db);
  const payments = await readPayments(db);
  const evaluations = await readEvaluations(db);
  const attendanceSnaps = await readAttendanceDocs(db);
  const userSnap = await readUserSnap(db);
  const duplicateReferences = await findUnexpectedReferences(db);

  const protectionErrors = await validateProtections(studentSnaps, userSnap);
  const missingTestPaymentIds = [...TEST_PAYMENT_IDS].filter((paymentId) =>
    !payments.some((paymentSnap) => paymentSnap.id === paymentId)
  );
  if (missingTestPaymentIds.length > 0) {
    protectionErrors.push(`No se localizaron todos los payments de prueba confirmados: ${missingTestPaymentIds.join(", ")}.`);
  }
  const unexpectedExternalReferences = ensureOnlyExpectedApplyTargets(duplicateReferences);
  if (unexpectedExternalReferences.length > 0) {
    protectionErrors.push("Existen referencias en colecciones fuera del alcance permitido.");
  }

  const students = studentSnaps.map(compactStudent);
  const categoryPlan = buildCanonicalCategoryPlan(studentSnaps);
  const categoryDiscrepancies = buildCategoryDiscrepancies(students);
  const primaryAttendanceSnap = attendanceSnaps.find((snap) => snap.id === ATTENDANCE_WITH_DUPLICATES_ID);
  const attendancePlan = buildAttendancePlan(primaryAttendanceSnap);
  const legacyAttendance = buildLegacyAttendanceReport(
    attendanceSnaps.filter((snap) => snap.id !== ATTENDANCE_WITH_DUPLICATES_ID)
  );
  const plannedChanges = buildPlannedChanges({ payments, evaluations, attendancePlan, userSnap });
  const userData = userSnap.exists ? userSnap.data() : {};

  const report = {
    apply: args.apply,
    protectionErrors,
    students,
    categoryPlan,
    categoryDiscrepancies,
    userStudentIds: Array.isArray(userData.studentIds) ? userData.studentIds : [],
    nextUserStudentIds: plannedChanges.nextUserStudentIds,
    payments: payments.map(compactPayment),
    nonCanonicalEvaluations: evaluations
      .filter((docSnap) => DUPLICATE_STUDENT_ID_SET.has(docSnap.data().studentId))
      .map(compactEvaluation),
    attendance: {
      primary: attendancePlan,
      legacy: legacyAttendance
    },
    duplicateReferences,
    counts: {
      canonicalStudentCategoryUpdates: categoryPlan.needsUpdate ? 1 : 0,
      paymentUpdates: plannedChanges.paymentUpdates.length,
      evaluationUpdates: plannedChanges.evaluationUpdates.length,
      attendanceUpdates: plannedChanges.attendanceUpdates,
      userUpdates: plannedChanges.userNeedsUpdate ? 1 : 0,
      totalApplyWrites:
        (categoryPlan.needsUpdate ? 1 : 0) +
        plannedChanges.paymentUpdates.length +
        plannedChanges.evaluationUpdates.length +
        plannedChanges.attendanceUpdates +
        (plannedChanges.userNeedsUpdate ? 1 : 0),
      eventualDuplicateStudentDeletes: plannedChanges.duplicateStudentDeletes
    }
  };

  printReport(report);

  if (!args.apply) return;

  if (protectionErrors.length > 0) {
    throw new Error("Migracion abortada por protecciones fallidas.");
  }

  if (!attendancePlan.canAutoConsolidate) {
    throw new Error("Migracion abortada: attendance no puede consolidarse automaticamente.");
  }

  await applyMigration(db, {
    studentSnaps,
    payments,
    evaluations,
    attendanceSnaps,
    userSnap,
    plannedChanges,
    categoryPlan
  });
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
});
