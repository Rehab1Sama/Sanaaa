import { Router, type IRouter } from "express";
import { db, recordsTable, studentsTable, circlesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.get("/attendance/today", authenticate, async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const trackFilter = req.query.track as string | undefined;

  const records = await db.select().from(recordsTable).where(
    and(eq(recordsTable.date, today), eq(recordsTable.isAbsent, true))
  );

  const students = await db.select().from(studentsTable);
  const circles = await db.select().from(circlesTable);

  let absentStudents = records.map(r => {
    const student = students.find(s => s.id === r.studentId);
    const circle = circles.find(c => c.id === r.circleId);
    return {
      studentId: r.studentId,
      studentName: student?.fullName ?? "غير معروف",
      circleName: circle?.name ?? "غير معروف",
      track: circle?.track ?? "",
      phone: student?.phone ?? null,
    };
  });

  // الطالبة: ترجع غياباتها فقط
  if (req.userRole === "student") {
    const sId = req.userStudentId;
    if (!sId) { res.json({ date: today, totalAbsent: 0, absentStudents: [], circlesWithNoData: [] }); return; }
    const mine = absentStudents.filter(a => a.studentId === sId);
    res.json({ date: today, totalAbsent: mine.length, absentStudents: mine, circlesWithNoData: [] });
    return;
  }

  if (trackFilter) {
    absentStudents = absentStudents.filter(a => a.track.startsWith(trackFilter));
  }
  if (req.userRole === "track_supervisor" && req.userTrack) {
    absentStudents = absentStudents.filter(a => a.track.startsWith(req.userTrack!));
  }

  // Find circles with no data today
  const circlesWithData = new Set(
    (await db.select().from(recordsTable).where(eq(recordsTable.date, today))).map(r => r.circleId)
  );
  let allCircles = circles.filter(c => !c.isArchived && c.trackType !== "archive" && c.trackType !== "registration");
  if (req.userRole === "track_supervisor" && req.userTrack) {
    allCircles = allCircles.filter(c => c.track.startsWith(req.userTrack!));
  }
  const circlesWithNoData = allCircles.filter(c => !circlesWithData.has(c.id)).map(c => c.name);

  res.json({ date: today, totalAbsent: absentStudents.length, absentStudents, circlesWithNoData });
});

router.get("/attendance/repeated-absences", authenticate, async (req, res): Promise<void> => {
  const { minAbsences = "3", dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const fromDate = dateFrom ?? weekAgo;
  const toDate = dateTo ?? today;

  const records = await db.select().from(recordsTable).where(
    and(
      eq(recordsTable.isAbsent, true),
      gte(recordsTable.date, fromDate),
      lte(recordsTable.date, toDate)
    )
  );

  const students = await db.select().from(studentsTable);
  const circles = await db.select().from(circlesTable);

  const countMap: Record<number, number> = {};
  for (const r of records) {
    countMap[r.studentId] = (countMap[r.studentId] ?? 0) + 1;
  }

  const threshold = parseInt(minAbsences, 10);
  const result = Object.entries(countMap)
    .filter(([, count]) => count >= threshold)
    .map(([studentId, count]) => {
      const student = students.find(s => s.id === parseInt(studentId, 10));
      const circle = student?.circleId ? circles.find(c => c.id === student.circleId) : null;
      return {
        studentId: parseInt(studentId, 10),
        studentName: student?.fullName ?? "غير معروف",
        circleName: circle?.name ?? "غير معروف",
        track: circle?.track ?? "",
        absenceCount: count,
        phone: student?.phone ?? null,
      };
    })
    .sort((a, b) => b.absenceCount - a.absenceCount);

  let filtered = result;
  if (req.userRole === "student") {
    const sId = req.userStudentId;
    if (!sId) { res.json([]); return; }
    filtered = result.filter(r => r.studentId === sId);
  } else if (req.userRole === "track_supervisor" && req.userTrack) {
    filtered = result.filter(r => r.track.startsWith(req.userTrack!));
  }

  // فلترة صارمة بـ circleId من الرابط
  const circleIdParam = req.query.circleId as string | undefined;
  if (circleIdParam) {
    const cid = parseInt(circleIdParam, 10);
    filtered = filtered.filter(r => {
      const student = students.find(s => s.id === r.studentId);
      return student?.circleId === cid;
    });
  }

  res.json(filtered);
});

export default router;
