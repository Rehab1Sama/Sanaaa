import { Router, type IRouter } from "express";
import { db, dataEntryCircleAssignmentsTable, usersTable, circlesTable, recordsTable, studentsTable, teacherAbsencesTable } from "@workspace/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { getMakkahDay } from "../lib/date";

const router: IRouter = Router();

function getMeccaTodayServer(): string {
  return getMakkahDay();
}

// GET /api/data-entry/my-circles — حلقات مدخلة البيانات المعيّنة لها
router.get("/data-entry/my-circles", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "data_entry") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const assignments = await db.select().from(dataEntryCircleAssignmentsTable)
    .where(eq(dataEntryCircleAssignmentsTable.dataEntryUserId, req.userId!));

  if (assignments.length === 0) {
    // إذا لم تُعيَّن حلقات → ترجع جميع الحلقات النشطة (سلوك افتراضي)
    const allCircles = await db.select().from(circlesTable)
      .where(eq(circlesTable.isArchived, false));
    res.json(allCircles); return;
  }

  const circleIds = assignments.map(a => a.circleId);
  const circles = await db.select().from(circlesTable)
    .where(and(
      inArray(circlesTable.id, circleIds),
      eq(circlesTable.isArchived, false),
    ));

  res.json(circles);
});

// GET /api/data-entry/assignments — جميع الإسناد (للقائدة والنائبة)
router.get("/data-entry/assignments", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const assignments = await db.select().from(dataEntryCircleAssignmentsTable);
  const allUsers = await db.select().from(usersTable).where(eq(usersTable.role, "data_entry"));
  const allCircles = await db.select().from(circlesTable);

  // تجميع الإسناد حسب مدخلة البيانات
  const grouped: Record<number, {
    userId: number;
    userName: string;
    circleIds: number[];
    circleNames: string[];
  }> = {};

  for (const user of allUsers.filter(u => !u.isArchived)) {
    grouped[user.id] = {
      userId: user.id,
      userName: user.name,
      circleIds: [],
      circleNames: [],
    };
  }

  for (const a of assignments) {
    if (!grouped[a.dataEntryUserId]) continue;
    const circle = allCircles.find(c => c.id === a.circleId);
    if (circle) {
      grouped[a.dataEntryUserId].circleIds.push(circle.id);
      grouped[a.dataEntryUserId].circleNames.push(circle.name);
    }
  }

  res.json(Object.values(grouped));
});

// POST /api/data-entry/assignments/:userId — إسناد حلقات لمدخلة بيانات (للقائدة والنائبة)
router.post("/data-entry/assignments/:userId", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const userId = parseInt(req.params.userId as string);
  const { circleIds } = req.body as { circleIds: number[] };

  if (!Array.isArray(circleIds)) {
    res.status(400).json({ error: "circleIds يجب أن يكون مصفوفة" }); return;
  }

  // التحقق من أن المستخدم هو مدخلة بيانات
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "data_entry") {
    res.status(400).json({ error: "المستخدم ليس مدخلة بيانات" }); return;
  }

  // حذف الإسناد القديم
  await db.delete(dataEntryCircleAssignmentsTable)
    .where(eq(dataEntryCircleAssignmentsTable.dataEntryUserId, userId));

  // إضافة الإسناد الجديد
  if (circleIds.length > 0) {
    await db.insert(dataEntryCircleAssignmentsTable).values(
      circleIds.map(cid => ({
        dataEntryUserId: userId,
        circleId: cid,
        assignedById: req.userId!,
      }))
    );
  }

  res.json({ ok: true, assigned: circleIds.length });
});

// GET /api/data-entry/circles-today — حالة حلقات كل مدخلة اليوم (للقائدة والنائبة)
router.get("/data-entry/circles-today", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const allDataEntryUsers = await db.select().from(usersTable)
    .where(and(eq(usersTable.role, "data_entry"), eq(usersTable.isArchived, false)));
  const allAssignments = await db.select().from(dataEntryCircleAssignmentsTable);
  const allCircles = await db.select().from(circlesTable).where(eq(circlesTable.isArchived, false));

  // الحلقات التي أُدخلت فيها سجلات اليوم (بأي مدخلة)
  const todayRecords = await db.select({
    circleId: recordsTable.circleId,
    enteredById: recordsTable.enteredById,
  }).from(recordsTable).where(eq(recordsTable.date, today));

  const enteredCirclesByUser = new Map<number, Set<number>>();
  for (const r of todayRecords) {
    if (!r.enteredById) continue;
    if (!enteredCirclesByUser.has(r.enteredById)) enteredCirclesByUser.set(r.enteredById, new Set());
    enteredCirclesByUser.get(r.enteredById)!.add(r.circleId);
  }

  const result = allDataEntryUsers.map(user => {
    const myAssignments = allAssignments.filter(a => a.dataEntryUserId === user.id);
    const enteredToday = enteredCirclesByUser.get(user.id) ?? new Set<number>();

    const circles = myAssignments.map(a => {
      const circle = allCircles.find(c => c.id === a.circleId);
      return {
        circleId: a.circleId,
        circleName: circle?.name ?? "؟",
        track: circle?.track ?? "؟",
        enteredToday: enteredToday.has(a.circleId),
      };
    });

    return {
      userId: user.id,
      userName: user.name,
      assignedCount: circles.length,
      enteredCount: circles.filter(c => c.enteredToday).length,
      circles,
    };
  });

  res.json(result);
});

// GET /api/data-entry/my-stats — إحصائيات مدخلة البيانات (للمدخلة نفسها)
router.get("/data-entry/my-stats", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "data_entry") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = getMeccaTodayServer();

  // الحلقات المُسندة لهذه المدخلة
  const assignments = await db.select().from(dataEntryCircleAssignmentsTable)
    .where(eq(dataEntryCircleAssignmentsTable.dataEntryUserId, req.userId!));

  if (assignments.length === 0) {
    res.json({
      assignedCircles: [],
      enteredToday: [],
      notEnteredToday: [],
      absentTeacherToday: [],
    }); return;
  }

  const circleIds = assignments.map(a => a.circleId);
  const circles = await db.select().from(circlesTable)
    .where(inArray(circlesTable.id, circleIds));

  // السجلات التي دخلتها اليوم
  const todayRecords = await db.select({ circleId: recordsTable.circleId })
    .from(recordsTable)
    .where(and(
      eq(recordsTable.date, today),
      eq(recordsTable.enteredById, req.userId!),
    ));

  const enteredCircleIds = new Set(todayRecords.map(r => r.circleId));

  // حلقات غاب معلمتها اليوم
  const teacherAbsences = await db.select({ circleId: teacherAbsencesTable.circleId })
    .from(teacherAbsencesTable)
    .where(and(
      eq(teacherAbsencesTable.date, today),
      inArray(teacherAbsencesTable.circleId, circleIds),
    ));

  const absentTeacherCircleIds = new Set(teacherAbsences.map(a => a.circleId));

  // الطالبات الغائبات اليوم (في الحلقات المُسندة)
  const allStudents = await db.select().from(studentsTable)
    .where(and(
      inArray(studentsTable.circleId, circleIds),
      eq(studentsTable.isArchived, false),
    ));

  const absentStudentRecords = await db.select()
    .from(recordsTable)
    .where(and(
      eq(recordsTable.date, today),
      inArray(recordsTable.circleId, circleIds),
      eq(recordsTable.isAbsent, true),
    ));

  const absentStudentIds = new Set(absentStudentRecords.map(r => r.studentId));
  const absentStudents = allStudents.filter(s => absentStudentIds.has(s.id))
    .map(s => ({
      studentId: s.id,
      studentName: s.fullName,
      circleId: s.circleId,
      circleName: circles.find(c => c.id === s.circleId)?.name ?? "",
    }));

  res.json({
    assignedCircles: circles.map(c => ({
      circleId: c.id,
      circleName: c.name,
      track: c.track,
      entered: enteredCircleIds.has(c.id),
      teacherAbsent: absentTeacherCircleIds.has(c.id),
    })),
    enteredToday: circles.filter(c => enteredCircleIds.has(c.id)).map(c => c.name),
    notEnteredToday: circles.filter(c => !enteredCircleIds.has(c.id) && !absentTeacherCircleIds.has(c.id)).map(c => c.name),
    absentTeacherToday: circles.filter(c => absentTeacherCircleIds.has(c.id)).map(c => c.name),
    absentStudentsToday: absentStudents,
  });
});

export default router;
