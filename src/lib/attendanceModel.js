export function getAttendanceTime(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  return Date.parse(value) || 0;
}

export function getAttendanceEntryTime(entry) {
  return getAttendanceTime(entry?.timestamp) || getAttendanceTime(entry?.date);
}

export function getAttendanceStatusKey(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "p" || normalized === "presente" || normalized === "present") return "present";
  if (normalized === "a" || normalized === "ausente" || normalized === "absent") return "absent";
  if (normalized === "j" || normalized === "justificado" || normalized === "justified") return "justified";
  return "unknown";
}

export function getAttendanceStatusLabel(status) {
  const key = getAttendanceStatusKey(status);
  if (key === "present") return "Presente";
  if (key === "absent") return "Ausente";
  if (key === "justified") return "Justificado";
  return "Sin estado";
}

export function calculateAttendanceSummary(entries = []) {
  const summary = entries.reduce((acc, entry) => {
    const key = getAttendanceStatusKey(entry?.status);
    acc.total += 1;
    if (key === "present") acc.present += 1;
    if (key === "absent") acc.absent += 1;
    if (key === "justified") acc.justified += 1;
    return acc;
  }, {
    total: 0,
    present: 0,
    absent: 0,
    justified: 0
  });

  return {
    ...summary,
    percentage: summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0
  };
}

export function sortAttendanceNewestFirst(entries = []) {
  return [...entries].sort((a, b) => getAttendanceEntryTime(b) - getAttendanceEntryTime(a));
}

function attendanceRecordMatchesStudent(record, student) {
  const studentId = student?.studentId || student?.id || "";
  const studentName = student?.name || "";
  if (record?.studentId) return record.studentId === studentId;
  return !!studentName && (record?.studentName === studentName || record?.name === studentName);
}

function legacyAttendanceMatchesStudent(entry, student) {
  const studentId = student?.studentId || student?.id || "";
  const studentName = student?.name || "";
  if (entry?.studentId) return entry.studentId === studentId;
  return !!studentName && entry?.studentName === studentName;
}

export function getAttendanceEntriesForStudent(attendanceDocs = [], student = {}) {
  return (attendanceDocs || []).flatMap((entry) => {
    const records = Array.isArray(entry.records) ? entry.records : null;

    if (!records) {
      return legacyAttendanceMatchesStudent(entry, student) ? [entry] : [];
    }

    return records
      .filter((record) => attendanceRecordMatchesStudent(record, student))
      .map((record, index) => ({
        id: `${entry.id || "attendance"}-${record.studentId || record.name || index}`,
        attendanceId: entry.id || "",
        date: entry.date,
        timestamp: entry.timestamp,
        coachId: entry.coachId || "",
        coachName: entry.coachName || "",
        category: entry.category || "",
        studentId: record.studentId || student.studentId || student.id || "",
        studentName: record.studentName || record.name || student.name || "",
        name: record.name || record.studentName || student.name || "",
        status: record.status || "",
        level: record.level || null,
        healthStatus: record.healthStatus || "",
        record
      }));
  });
}

export function buildStudentAttendanceMetrics(students = [], attendanceDocs = []) {
  return (students || []).map((student) => {
    const entries = getAttendanceEntriesForStudent(attendanceDocs, student);
    const summary = calculateAttendanceSummary(entries);

    return {
      id: student.studentId || student.id,
      studentId: student.studentId || student.id || "",
      studentName: student.name || "",
      category: student.category || "",
      ...summary
    };
  });
}
