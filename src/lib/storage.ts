import { Student, Lesson, Payment, SwapRequest, FileEntry, ScheduleItem, Message, PracticeSession, MonthlyAchievement, LeaderboardEntry, MedalPurchase, StoreItem, StorePurchase, YearlyLeaderboardEntry } from './types';
import { hybridSync } from './hybridSync';
import { logger } from './logger';
import { isDevMode, setDevMode } from './devMode';
import { calculateEarnedCopper, formatPriceCompact } from './storeCurrency';

// Re-export dev helpers for modules that import them from storage.ts
export { isDevMode, setDevMode };

// In-Memory Storage - No localStorage for sensitive data
const inMemoryStorage: Record<string, any> = {};

// Expose storage via window for lessonSwap module access
if (typeof window !== 'undefined') {
  (window as any).__musicSystemStorage = inMemoryStorage;
}

// Dev Mode: Completely isolated in-memory storage (no Worker, no sync)
const devData: Record<string, any> = {
  musicSystemData: {},
  students: [],
  lessons: [],
  payments: [],
  swapRequests: [],
  files: [],
  scheduleItems: [],
  messages: [],
  practiceSessions: [],
  monthlyAchievements: [],
  medalPurchases: [],
  storeItems: [],
  storePurchases: [],
};

// Utils
const generateId = (): string => Math.random().toString(36).substr(2, 9);

const getNow = (): string => new Date().toISOString();

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export const getAllDataKeys = (): string[] => {
  return [
    'students',
    'lessons',
    'payments',
    'swapRequests',
    'files',
    'scheduleItems',
    'messages',
    'practiceSessions',
    'monthlyAchievements',
    'medalPurchases',
    'storeItems',
    'storePurchases',
  ];
};

// === IMPORTANT: hybridSync expects these exports ===
export const exportAllData = (): Record<string, any> => {
  if (isDevMode()) {
    const out: Record<string, any> = {};
    getAllDataKeys().forEach(k => out[k] = clone(devData[k] ?? []));
    out.musicSystemData = clone(devData.musicSystemData ?? {});
    return out;
  }

  const out: Record<string, any> = {};
  getAllDataKeys().forEach(k => out[k] = clone(inMemoryStorage[k] ?? []));
  out.musicSystemData = clone(inMemoryStorage.musicSystemData ?? {});
  return out;
};

export const importAllData = (data: Record<string, any>, allowEmpty = false): void => {
  if (!data) return;

  if (!allowEmpty) {
    const hasStudents = Array.isArray(data.students) && data.students.length > 0;
    if (!hasStudents) return;
  }

  if (isDevMode()) {
    devData.musicSystemData = clone(data.musicSystemData ?? {});
    getAllDataKeys().forEach(k => devData[k] = clone(data[k] ?? []));
    return;
  }

  inMemoryStorage.musicSystemData = clone(data.musicSystemData ?? {});
  getAllDataKeys().forEach(k => inMemoryStorage[k] = clone(data[k] ?? []));
};

// Messages (local)
export const getLocalMessages = (): any[] => {
  if (isDevMode()) {
    return devData.messages || [];
  }
  return inMemoryStorage['messages'] || [];
};

export const saveLocalMessages = (messages: any[]): void => {
  if (isDevMode()) {
    devData.messages = messages;
  } else {
    inMemoryStorage['messages'] = messages;
    hybridSync.onDataChange();
  }
};

// Initialize data from Worker
export const initializeStorage = (data: Record<string, any>): void => {
  if (!data) return;

  if (isDevMode()) {
    // In dev mode we don't initialize from worker
    logger.info('[Storage] Dev mode enabled, skipping worker initialization.');
    return;
  }

  importAllData(data, true);
  logger.info('[Storage] Initialized from worker', Object.keys(data));
};

// ===================== STUDENTS =====================
export const getStudents = (): Student[] => {
  if (isDevMode()) return devData.students || [];
  return inMemoryStorage['students'] || [];
};

export const addStudent = (student: Omit<Student, 'id' | 'createdAt'>): Student => {
  const students = getStudents();
  const now = getNow();
  const newStudent: Student = {
    ...student,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  students.push(newStudent);

  if (isDevMode()) {
    devData.students = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return newStudent;
};

export const updateStudent = (id: string, updatedFields: Partial<Student>): Student | undefined => {
  const students = getStudents();
  const index = students.findIndex(s => s.id === id);
  if (index === -1) return undefined;

  students[index] = {
    ...students[index],
    ...updatedFields,
    lastModified: getNow(),
  };

  if (isDevMode()) {
    devData.students = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return students[index];
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  const students = getStudents();
  const updated = students.filter(s => s.id !== id);
  if (updated.length === students.length) return false;

  if (isDevMode()) {
    devData.students = updated;
  } else {
    inMemoryStorage['students'] = updated;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ===================== LESSONS =====================
export const getLessons = (): Lesson[] => {
  if (isDevMode()) return devData.lessons || [];
  return inMemoryStorage['lessons'] || [];
};

export const addLesson = (lesson: Omit<Lesson, 'id' | 'createdAt'>): Lesson => {
  const lessons = getLessons();
  const now = getNow();
  const newLesson: Lesson = {
    ...lesson,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  lessons.push(newLesson);

  if (isDevMode()) {
    devData.lessons = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return newLesson;
};

export const updateLesson = (id: string, updatedFields: Partial<Lesson>): Lesson | undefined => {
  const lessons = getLessons();
  const index = lessons.findIndex(l => l.id === id);
  if (index === -1) return undefined;

  lessons[index] = {
    ...lessons[index],
    ...updatedFields,
    lastModified: getNow(),
  };

  if (isDevMode()) {
    devData.lessons = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return lessons[index];
};

export const deleteLesson = async (id: string): Promise<boolean> => {
  const lessons = getLessons();
  const updated = lessons.filter(l => l.id !== id);
  if (updated.length === lessons.length) return false;

  if (isDevMode()) {
    devData.lessons = updated;
  } else {
    inMemoryStorage['lessons'] = updated;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ===================== PAYMENTS =====================
export const getPayments = (): Payment[] => {
  if (isDevMode()) return devData.payments || [];
  return inMemoryStorage['payments'] || [];
};

export const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
  const payments = getPayments();
  const now = getNow();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  payments.push(newPayment);

  if (isDevMode()) {
    devData.payments = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return newPayment;
};

export const updatePayment = (id: string, updatedFields: Partial<Payment>): Payment | undefined => {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === id);
  if (index === -1) return undefined;

  payments[index] = {
    ...payments[index],
    ...updatedFields,
    lastModified: getNow(),
  };

  if (isDevMode()) {
    devData.payments = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return payments[index];
};

export const deletePayment = async (id: string): Promise<boolean> => {
  const payments = getPayments();
  const updated = payments.filter(p => p.id !== id);
  if (updated.length === payments.length) return false;

  if (isDevMode()) {
    devData.payments = updated;
  } else {
    inMemoryStorage['payments'] = updated;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ===================== SWAP REQUESTS =====================
export const getSwapRequests = (): SwapRequest[] => {
  if (isDevMode()) return devData.swapRequests || [];
  return inMemoryStorage['swapRequests'] || [];
};

export const addSwapRequest = (request: Omit<SwapRequest, 'id' | 'createdAt'>): SwapRequest => {
  const requests = getSwapRequests();
  const now = getNow();
  const newRequest: SwapRequest = {
    ...request,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  requests.push(newRequest);

  if (isDevMode()) {
    devData.swapRequests = requests;
  } else {
    inMemoryStorage['swapRequests'] = requests;
    hybridSync.onDataChange();
  }
  return newRequest;
};

export const updateSwapRequest = (id: string, updatedFields: Partial<SwapRequest>): SwapRequest | undefined => {
  const requests = getSwapRequests();
  const index = requests.findIndex(r => r.id === id);
  if (index === -1) return undefined;

  requests[index] = {
    ...requests[index],
    ...updatedFields,
    lastModified: getNow(),
  };

  if (isDevMode()) {
    devData.swapRequests = requests;
  } else {
    inMemoryStorage['swapRequests'] = requests;
    hybridSync.onDataChange();
  }
  return requests[index];
};

export const deleteSwapRequest = async (id: string): Promise<boolean> => {
  const requests = getSwapRequests();
  const updated = requests.filter(r => r.id !== id);
  if (updated.length === requests.length) return false;

  if (isDevMode()) {
    devData.swapRequests = updated;
  } else {
    inMemoryStorage['swapRequests'] = updated;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ===================== FILES =====================
export const getFiles = (): FileEntry[] => {
  if (isDevMode()) return devData.files || [];
  return inMemoryStorage['files'] || [];
};

export const addFile = (file: Omit<FileEntry, 'id' | 'uploadedAt'>): FileEntry => {
  const files = getFiles();
  const now = getNow();
  const newFile: FileEntry = {
    ...file,
    id: generateId(),
    uploadedAt: now,
    lastModified: now,
  };
  files.push(newFile);

  if (isDevMode()) {
    devData.files = files;
  } else {
    inMemoryStorage['files'] = files;
    hybridSync.onDataChange();
  }
  return newFile;
};

export const deleteFile = async (id: string): Promise<boolean> => {
  const files = getFiles();
  const updated = files.filter(f => f.id !== id);
  if (updated.length === files.length) return false;

  if (isDevMode()) {
    devData.files = updated;
  } else {
    inMemoryStorage['files'] = updated;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// ===================== SCHEDULE ITEMS =====================
export const getScheduleItems = (): ScheduleItem[] => {
  if (isDevMode()) return devData.scheduleItems || [];
  return inMemoryStorage['scheduleItems'] || [];
};

export const saveScheduleItems = (items: ScheduleItem[]): void => {
  if (isDevMode()) {
    devData.scheduleItems = items;
  } else {
    inMemoryStorage['scheduleItems'] = items;
    hybridSync.onDataChange();
  }
};

// ===================== PRACTICE SESSIONS =====================
export const getPracticeSessions = (): PracticeSession[] => {
  if (isDevMode()) return devData.practiceSessions || [];
  return inMemoryStorage['practiceSessions'] || [];
};

export const getStudentPracticeSessions = (studentId: string): PracticeSession[] => {
  const sessions = getPracticeSessions();
  return sessions
    .filter(s => s.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addPracticeSession = (session: Omit<PracticeSession, 'id' | 'createdAt'>): PracticeSession => {
  const sessions = getPracticeSessions();
  const now = getNow();
  const newSession: PracticeSession = {
    ...session,
    id: generateId(),
    createdAt: now,
    lastModified: now, // optimistic locking
  };
  sessions.push(newSession);

  // Keep MonthlyAchievements derived from sessions (can go up or down)
  recalcMonthlyAchievementFromSessions(newSession.studentId, newSession.date.slice(0, 7), false);

  if (isDevMode()) {
    devData.practiceSessions = sessions;
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    hybridSync.onDataChange();
  }
  return newSession;
};

export const updatePracticeSession = (id: string, updatedFields: Partial<PracticeSession>): PracticeSession | undefined => {
  const sessions = getPracticeSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return undefined;

  const before = sessions[index];
  const beforeMonth = before.date.slice(0, 7);

  sessions[index] = {
    ...sessions[index],
    ...updatedFields,
    lastModified: getNow(),
  };

  const after = sessions[index];
  const afterMonth = after.date.slice(0, 7);

  // Recalc affected month(s) so achievements can decrease after edits
  recalcMonthlyAchievementFromSessions(after.studentId, afterMonth, false);
  if (beforeMonth !== afterMonth) {
    recalcMonthlyAchievementFromSessions(before.studentId, beforeMonth, false);
  }

  if (isDevMode()) {
    devData.practiceSessions = sessions;
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    hybridSync.onDataChange();
  }
  return sessions[index];
};

export const deletePracticeSession = async (id: string): Promise<boolean> => {
  const sessions = getPracticeSessions();
  const sessionToDelete = sessions.find(s => s.id === id);
  const updatedSessions = sessions.filter(s => s.id !== id);

  if (updatedSessions.length === sessions.length) {
    return false;
  }

  if (isDevMode()) {
    devData.practiceSessions = updatedSessions;
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }
  } else {
    inMemoryStorage['practiceSessions'] = updatedSessions;
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }
    // Destructive change so merge won't "restore" deleted sessions
    await hybridSync.onDestructiveChange();
  }

  return true;
};

// ===================== DERIVED MONTHLY ACHIEVEMENTS (RECALCULATED) =====================
/**
 * Recalculate a student's monthly achievements from practice sessions (source of truth).
 * Fixes the "max-only" bug where a mistaken high value could never go down after edits/deletes.
 *
 * By default this mutates storage only. Pass shouldSync=true if you want to sync immediately.
 */
const recalcMonthlyAchievementFromSessions = (
  studentId: string,
  month: string, // YYYY-MM
  shouldSync: boolean = false
): void => {
  const sessions = getPracticeSessions()
    .filter(s => s.studentId === studentId && s.date.startsWith(month));

  // Daily totals (sum sessions per day)
  const dailyTotals: Record<string, number> = {};
  for (const s of sessions) {
    dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
  }

  const maxDailyMinutes =
    Object.keys(dailyTotals).length > 0 ? Math.max(...Object.values(dailyTotals)) : 0;

  // Daily average across practiced days
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const practicedDays = Object.keys(dailyTotals).length;
  const dailyAverage = practicedDays > 0 ? totalMinutes / practicedDays : 0;

  // Longest streak within the month (consecutive practiced dates)
  const practicedDates = Object.keys(dailyTotals)
    .filter(d => dailyTotals[d] >= 1)
    .sort();

  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const d of practicedDates) {
    const cur = new Date(d);
    if (!prevDate) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    prevDate = cur;
  }

  const achievements = getMonthlyAchievements();
  const index = achievements.findIndex(a => a.studentId === studentId && a.month === month);
  const now = getNow();

  const next: MonthlyAchievement = {
    id: index !== -1 ? achievements[index].id : generateId(),
    studentId,
    month,
    maxDailyAverage: dailyAverage,
    maxDailyMinutes,
    maxStreak,
    createdAt: index !== -1 ? achievements[index].createdAt : now,
    updatedAt: now,
    lastModified: now,
  };

  if (index !== -1) achievements[index] = next;
  else achievements.push(next);

  if (isDevMode()) {
    devData['monthlyAchievements'] = achievements;
  } else {
    inMemoryStorage['monthlyAchievements'] = achievements;
    if (shouldSync) hybridSync.onDataChange();
  }
};

// Monthly Achievements
export const getMonthlyAchievements = (): MonthlyAchievement[] => {
  if (isDevMode()) return devData.monthlyAchievements || [];
  return inMemoryStorage['monthlyAchievements'] || [];
};

export const getStudentMonthlyAchievements = (studentId: string): MonthlyAchievement[] => {
  const achievements = getMonthlyAchievements();
  return achievements.filter(a => a.studentId === studentId);
};

export const getCurrentMonthAchievement = (studentId: string): MonthlyAchievement | null => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const achievements = getMonthlyAchievements();
  return achievements.find(a => a.studentId === studentId && a.month === currentMonth) || null;
};

export const updateMonthlyAchievement = (
  studentId: string,
  _updates: { maxDailyAverage?: number; maxDailyMinutes?: number; maxStreak?: number }
): void => {
  // Monthly achievements are derived from PracticeSessions (source of truth).
  // Recalculate so values can also go DOWN after edits/deletes.
  const currentMonth = new Date().toISOString().slice(0, 7);
  recalcMonthlyAchievementFromSessions(studentId, currentMonth, true);
};

export const getCurrentMonthLeaderboard = (): LeaderboardEntry[] => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const achievements = getMonthlyAchievements().filter(a => a.month === currentMonth);
  const students = getStudents();

  return achievements
    .map(a => {
      const student = students.find(s => s.id === a.studentId);
      if (!student) return null;

      return {
        studentId: a.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        value: a.maxDailyAverage,
        type: 'avgDailyMinutes',
      } as LeaderboardEntry;
    })
    .filter(Boolean) as LeaderboardEntry[];
};

// ===================== MEDAL PURCHASES =====================
export const getMedalPurchases = (): MedalPurchase[] => {
  if (isDevMode()) return devData.medalPurchases || [];
  return inMemoryStorage['medalPurchases'] || [];
};

export const addMedalPurchase = (purchase: Omit<MedalPurchase, 'id' | 'createdAt'>): MedalPurchase => {
  const purchases = getMedalPurchases();
  const now = getNow();
  const newPurchase: MedalPurchase = {
    ...purchase,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  purchases.push(newPurchase);

  if (isDevMode()) {
    devData.medalPurchases = purchases;
  } else {
    inMemoryStorage['medalPurchases'] = purchases;
    hybridSync.onDataChange();
  }
  return newPurchase;
};

// ===================== STORE =====================
export const getStoreItems = (): StoreItem[] => {
  if (isDevMode()) return devData.storeItems || [];
  return inMemoryStorage['storeItems'] || [];
};

export const getStorePurchases = (): StorePurchase[] => {
  if (isDevMode()) return devData.storePurchases || [];
  return inMemoryStorage['storePurchases'] || [];
};

export const saveStoreItems = (items: StoreItem[]): void => {
  if (isDevMode()) {
    devData.storeItems = items;
  } else {
    inMemoryStorage['storeItems'] = items;
    hybridSync.onDataChange();
  }
};

export const addStorePurchase = (purchase: Omit<StorePurchase, 'id' | 'createdAt'>): StorePurchase => {
  const purchases = getStorePurchases();
  const now = getNow();
  const newPurchase: StorePurchase = {
    ...purchase,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  purchases.push(newPurchase);

  if (isDevMode()) {
    devData.storePurchases = purchases;
  } else {
    inMemoryStorage['storePurchases'] = purchases;
    hybridSync.onDataChange();
  }
  return newPurchase;
};

// ===================== YEARLY LEADERBOARD =====================
export const getYearlyLeaderboard = (): YearlyLeaderboardEntry[] => {
  const students = getStudents();
  const allSessions = getPracticeSessions();

  const sessionsByStudent = new Map<string, PracticeSession[]>();
  for (const s of allSessions) {
    if (!sessionsByStudent.has(s.studentId)) sessionsByStudent.set(s.studentId, []);
    sessionsByStudent.get(s.studentId)!.push(s);
  }

  const entries: YearlyLeaderboardEntry[] = students.map(student => {
    const sessions = sessionsByStudent.get(student.id) || [];

    const dailyTotals: Record<string, number> = {};
    for (const s of sessions) {
      dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
    }

    const dailyTotalsValues = Object.values(dailyTotals);
    const maxDaily = dailyTotalsValues.length ? Math.max(...dailyTotalsValues) : 0;

    const practicedDates = Object.keys(dailyTotals)
      .filter(d => dailyTotals[d] >= 1)
      .sort();

    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const d of practicedDates) {
      const cur = new Date(d);
      if (!prevDate) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
      prevDate = cur;
    }

    const weekTotals: Record<string, number> = {};
    const getWeekKey = (dateStr: string): string => {
      const d = new Date(dateStr);
      const dayNum = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
      d.setDate(d.getDate() - dayNum + 3); // Thursday
      const firstThursday = new Date(d.getFullYear(), 0, 4);
      const firstDayNum = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
      const weekNo = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
      const year = d.getFullYear();
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    };

    for (const s of sessions) {
      const wk = getWeekKey(s.date);
      weekTotals[wk] = (weekTotals[wk] || 0) + (s.durationMinutes || 0);
    }

    const maxWeekly = Object.values(weekTotals).length ? Math.max(...Object.values(weekTotals)) : 0;

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const practicedWeeks = Object.keys(weekTotals).length;
    const weeklyAverage = practicedWeeks > 0 ? totalMinutes / practicedWeeks : 0;

    let medalCopper = 0;
    for (const minutes of Object.values(dailyTotals)) {
      medalCopper += calculateEarnedCopper(minutes);
    }

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      maxDailyMinutes: maxDaily,
      maxWeeklyMinutes: maxWeekly,
      longestStreak: maxStreak,
      weeklyAverageMinutes: weeklyAverage,
      medalScoreCopper: medalCopper,
      medalScoreFormatted: formatPriceCompact(medalCopper),
    };
  });

  return entries;
};
