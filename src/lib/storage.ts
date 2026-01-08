import { Student, Lesson, Payment, SwapRequest, FileEntry, SchoolClass, Message, PracticeSession, MonthlyAchievement, LeaderboardEntry, MedalPurchase, YearlyLeaderboardEntry } from './types';
import { hybridSync } from './hybridSync';
import { calculateEarnedCopper, formatPriceCompact } from './storeCurrency';

// In-memory storage for production mode
const inMemoryStorage: Record<string, any[]> = {};

// Simple ID generator
const generateId = (): string => Math.random().toString(36).substr(2, 9);

// Dev mode data storage
const devData: Record<string, any[]> = {};

// Check if in dev mode
export const isDevMode = (): boolean => {
  return window.location.hostname === 'localhost' || window.location.hostname.includes('dev');
};

// Set initial data from worker
export const initializeStorage = (data: Record<string, any[]>) => {
  Object.keys(data).forEach(key => {
    inMemoryStorage[key] = data[key] || [];
  });
  
  console.log('[Storage] Initialized with:', Object.keys(data).map(k => `${k}: ${data[k]?.length || 0}`).join(', '));
};

// Generic getter
const getData = <T>(key: string): T[] => {
  if (isDevMode()) return devData[key] || [];
  return inMemoryStorage[key] || [];
};

// Generic setter
const setData = <T>(key: string, data: T[]): void => {
  if (isDevMode()) {
    devData[key] = data;
  } else {
    inMemoryStorage[key] = data;
    hybridSync.onDataChange();
  }
};

// Students
export const getStudents = (): Student[] => getData<Student>('students');

export const getStudent = (id: string): Student | undefined => {
  return getStudents().find(s => s.id === id);
};

export const addStudent = (student: Omit<Student, 'id' | 'createdAt'>): Student => {
  const students = getStudents();
  const now = new Date().toISOString();
  const newStudent: Student = {
    ...student,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  students.push(newStudent);
  if (isDevMode()) {
    devData['students'] = students;
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
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['students'] = students;
  } else {
    inMemoryStorage['students'] = students;
    hybridSync.onDataChange();
  }
  return students[index];
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  const students = getStudents();
  const updatedStudents = students.filter(s => s.id !== id);
  if (updatedStudents.length === students.length) {
    return false;
  }
  if (isDevMode()) {
    devData['students'] = updatedStudents;
  } else {
    inMemoryStorage['students'] = updatedStudents;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Lessons
export const getLessons = (): Lesson[] => getData<Lesson>('lessons');

export const getLesson = (id: string): Lesson | undefined => {
  return getLessons().find(l => l.id === id);
};

export const addLesson = (lesson: Omit<Lesson, 'id' | 'createdAt'>): Lesson => {
  const lessons = getLessons();
  const now = new Date().toISOString();
  const newLesson: Lesson = {
    ...lesson,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  lessons.push(newLesson);
  if (isDevMode()) {
    devData['lessons'] = lessons;
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
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['lessons'] = lessons;
  } else {
    inMemoryStorage['lessons'] = lessons;
    hybridSync.onDataChange();
  }
  return lessons[index];
};

export const deleteLesson = async (id: string): Promise<boolean> => {
  const lessons = getLessons();
  const updatedLessons = lessons.filter(l => l.id !== id);
  if (updatedLessons.length === lessons.length) {
    return false;
  }
  if (isDevMode()) {
    devData['lessons'] = updatedLessons;
  } else {
    inMemoryStorage['lessons'] = updatedLessons;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Payments
export const getPayments = (): Payment[] => getData<Payment>('payments');

export const getStudentPayments = (studentId: string): Payment[] => {
  return getPayments().filter(p => p.studentId === studentId);
};

export const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
  const payments = getPayments();
  const now = new Date().toISOString();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  payments.push(newPayment);
  if (isDevMode()) {
    devData['payments'] = payments;
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
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['payments'] = payments;
  } else {
    inMemoryStorage['payments'] = payments;
    hybridSync.onDataChange();
  }
  return payments[index];
};

export const deletePayment = async (id: string): Promise<boolean> => {
  const payments = getPayments();
  const updatedPayments = payments.filter(p => p.id !== id);
  if (updatedPayments.length === payments.length) {
    return false;
  }
  if (isDevMode()) {
    devData['payments'] = updatedPayments;
  } else {
    inMemoryStorage['payments'] = updatedPayments;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Swap Requests
export const getSwapRequests = (): SwapRequest[] => getData<SwapRequest>('swapRequests');

export const getStudentSwapRequests = (studentId: string): SwapRequest[] => {
  return getSwapRequests().filter(r => r.studentId === studentId);
};

export const addSwapRequest = (request: Omit<SwapRequest, 'id' | 'createdAt'>): SwapRequest => {
  const requests = getSwapRequests();
  const now = new Date().toISOString();
  const newRequest: SwapRequest = {
    ...request,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  requests.push(newRequest);
  if (isDevMode()) {
    devData['swapRequests'] = requests;
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
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['swapRequests'] = requests;
  } else {
    inMemoryStorage['swapRequests'] = requests;
    hybridSync.onDataChange();
  }
  return requests[index];
};

export const deleteSwapRequest = async (id: string): Promise<boolean> => {
  const requests = getSwapRequests();
  const updatedRequests = requests.filter(r => r.id !== id);
  if (updatedRequests.length === requests.length) {
    return false;
  }
  if (isDevMode()) {
    devData['swapRequests'] = updatedRequests;
  } else {
    inMemoryStorage['swapRequests'] = updatedRequests;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Files
export const getFiles = (): FileEntry[] => getData<FileEntry>('files');

export const addFile = (file: Omit<FileEntry, 'id' | 'uploadedAt'>): FileEntry => {
  const files = getFiles();
  const now = new Date().toISOString();
  const newFile: FileEntry = {
    ...file,
    id: generateId(),
    uploadedAt: now,
    lastModified: now,
  };
  files.push(newFile);
  if (isDevMode()) {
    devData['files'] = files;
  } else {
    inMemoryStorage['files'] = files;
    hybridSync.onDataChange();
  }
  return newFile;
};

export const deleteFile = async (id: string): Promise<boolean> => {
  const files = getFiles();
  const updatedFiles = files.filter(f => f.id !== id);
  if (updatedFiles.length === files.length) {
    return false;
  }
  if (isDevMode()) {
    devData['files'] = updatedFiles;
  } else {
    inMemoryStorage['files'] = updatedFiles;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Classes
export const getClasses = (): SchoolClass[] => getData<SchoolClass>('classes');

export const addClass = (classData: Omit<SchoolClass, 'id' | 'createdAt'>): SchoolClass => {
  const classes = getClasses();
  const now = new Date().toISOString();
  const newClass: SchoolClass = {
    ...classData,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  classes.push(newClass);
  if (isDevMode()) {
    devData['classes'] = classes;
  } else {
    inMemoryStorage['classes'] = classes;
    hybridSync.onDataChange();
  }
  return newClass;
};

export const updateClass = (id: string, updatedFields: Partial<SchoolClass>): SchoolClass | undefined => {
  const classes = getClasses();
  const index = classes.findIndex(c => c.id === id);
  if (index === -1) return undefined;
  classes[index] = { 
    ...classes[index], 
    ...updatedFields,
    lastModified: new Date().toISOString()
  };
  if (isDevMode()) {
    devData['classes'] = classes;
  } else {
    inMemoryStorage['classes'] = classes;
    hybridSync.onDataChange();
  }
  return classes[index];
};

export const deleteClass = async (id: string): Promise<boolean> => {
  const classes = getClasses();
  const updatedClasses = classes.filter(c => c.id !== id);
  if (updatedClasses.length === classes.length) {
    return false;
  }
  if (isDevMode()) {
    devData['classes'] = updatedClasses;
  } else {
    inMemoryStorage['classes'] = updatedClasses;
    await hybridSync.onDestructiveChange();
  }
  return true;
};

// Messages
export const getMessages = (): Message[] => getData<Message>('messages');

export const addMessage = (message: Omit<Message, 'id' | 'sentAt'>): Message => {
  const messages = getMessages();
  const now = new Date().toISOString();
  const newMessage: Message = {
    ...message,
    id: generateId(),
    sentAt: now,
    lastModified: now,
  };
  messages.push(newMessage);
  if (isDevMode()) {
    devData['messages'] = messages;
  } else {
    inMemoryStorage['messages'] = messages;
    hybridSync.onDataChange();
  }
  return newMessage;
};

// Practice Sessions
export const getPracticeSessions = (): PracticeSession[] => {
  if (isDevMode()) return devData['practiceSessions'] || [];
  return inMemoryStorage['practiceSessions'] || [];
};

export const getStudentPracticeSessions = (studentId: string): PracticeSession[] => {
  const sessions = getPracticeSessions();
  return sessions.filter(s => s.studentId === studentId);
};

export const addPracticeSession = (session: Omit<PracticeSession, 'id' | 'createdAt'>): PracticeSession => {
  const sessions = getPracticeSessions();
  const now = new Date().toISOString();
  const newSession: PracticeSession = {
    ...session,
    id: generateId(),
    createdAt: now,
    lastModified: now, // Add timestamp for optimistic locking
  };
  sessions.push(newSession);
  if (isDevMode()) {
    devData['practiceSessions'] = sessions;
    // Recalculate monthly achievements for the session's month (derived from sessions)
    recalcMonthlyAchievementFromSessions(newSession.studentId, newSession.date.slice(0, 7), false);
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    // Recalculate monthly achievements for the session's month (derived from sessions)
    recalcMonthlyAchievementFromSessions(newSession.studentId, newSession.date.slice(0, 7), false);
    // Recalculate monthly achievements for the session's month (derived from sessions)
    recalcMonthlyAchievementFromSessions(newSession.studentId, newSession.date.slice(0, 7), false);
    hybridSync.onDataChange();
  }
  return newSession;
};

export const updatePracticeSession = (id: string, updatedFields: Partial<PracticeSession>): PracticeSession | undefined => {
  const sessions = getPracticeSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return undefined;
  
  sessions[index] = { 
    ...sessions[index], 
    ...updatedFields,
    lastModified: new Date().toISOString() // Update timestamp
  };
  if (isDevMode()) {
    devData['practiceSessions'] = sessions;
    // Recalculate monthly achievements for the affected month (derived from sessions)
    recalcMonthlyAchievementFromSessions(sessions[index].studentId, sessions[index].date.slice(0, 7), false);
  } else {
    inMemoryStorage['practiceSessions'] = sessions;
    // Recalculate monthly achievements for the affected month (derived from sessions)
    recalcMonthlyAchievementFromSessions(sessions[index].studentId, sessions[index].date.slice(0, 7), false);
    // Recalculate monthly achievements for the affected month (derived from sessions)
    recalcMonthlyAchievementFromSessions(sessions[index].studentId, sessions[index].date.slice(0, 7), false);
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
    devData['practiceSessions'] = updatedSessions;

    // Keep monthly achievements consistent even in dev mode
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }
  } else {
    inMemoryStorage['practiceSessions'] = updatedSessions;

    // Recalculate monthly achievements for the month that changed
    if (sessionToDelete) {
      recalcMonthlyAchievementFromSessions(sessionToDelete.studentId, sessionToDelete.date.slice(0, 7), false);
    }

    // Use onDestructiveChange for deletes to prevent merge from restoring
    await hybridSync.onDestructiveChange();
  }

  return true;
};


// ===================== DERIVED MONTHLY ACHIEVEMENTS (RECALCULATED) =====================

/**
 * Recalculate a student's monthly achievements from practice sessions (source of truth).
 * This fixes the "max only" bug where a mistaken high value could never go down after edits/deletes.
 *
 * By default this mutates storage ONLY (no sync). Caller should sync (onDataChange / onDestructiveChange)
 * in the same transaction to avoid extra network calls.
 */
const recalcMonthlyAchievementFromSessions = (
  studentId: string,
  month: string, // YYYY-MM
  shouldSync: boolean = false
): void => {
  const sessions = getPracticeSessions()
    .filter(s => s.studentId === studentId && s.date.startsWith(month));

  // Daily totals (sum of sessions per day)
  const dailyTotals: Record<string, number> = {};
  for (const s of sessions) {
    dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
  }

  const maxDailyMinutes =
    Object.keys(dailyTotals).length > 0 ? Math.max(...Object.values(dailyTotals)) : 0;

  // Daily average across practiced days in the month
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const practicedDays = Object.keys(dailyTotals).length;
  const dailyAverage = practicedDays > 0 ? totalMinutes / practicedDays : 0;

  // Longest streak inside the month (consecutive practiced dates)
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
  const now = new Date().toISOString();

  const next: MonthlyAchievement = {
    id: index !== -1 ? achievements[index].id : generateId(),
    studentId,
    month,
    maxDailyAverage: dailyAverage,
    maxDailyMinutes: maxDailyMinutes,
    maxStreak: maxStreak,
    createdAt: index !== -1 ? achievements[index].createdAt : now,
    updatedAt: now,
    lastModified: now,
  };

  if (index !== -1) {
    achievements[index] = next;
  } else {
    achievements.push(next);
  }

  if (isDevMode()) {
    devData['monthlyAchievements'] = achievements;
  } else {
    inMemoryStorage['monthlyAchievements'] = achievements;
    if (shouldSync) {
      hybridSync.onDataChange();
    }
  }
};

// Monthly Achievements
export const getMonthlyAchievements = (): MonthlyAchievement[] => {
  if (isDevMode()) return devData['monthlyAchievements'] || [];
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
  // Monthly achievements are derived from practice sessions (source of truth).
  // We recalculate to allow values to go DOWN after edits/deletes.
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

// Medal Purchases
export const getMedalPurchases = (): MedalPurchase[] => getData<MedalPurchase>('medalPurchases');

export const addMedalPurchase = (purchase: Omit<MedalPurchase, 'id' | 'createdAt'>): MedalPurchase => {
  const purchases = getMedalPurchases();
  const now = new Date().toISOString();
  const newPurchase: MedalPurchase = {
    ...purchase,
    id: generateId(),
    createdAt: now,
    lastModified: now,
  };
  purchases.push(newPurchase);
  if (isDevMode()) {
    devData['medalPurchases'] = purchases;
  } else {
    inMemoryStorage['medalPurchases'] = purchases;
    hybridSync.onDataChange();
  }
  return newPurchase;
};

// Yearly Leaderboard
export const getYearlyLeaderboard = (): YearlyLeaderboardEntry[] => {
  const students = getStudents();
  const allSessions = getPracticeSessions();

  // Helper: compute daily totals per student
  const sessionsByStudent = new Map<string, PracticeSession[]>();
  for (const s of allSessions) {
    if (!sessionsByStudent.has(s.studentId)) sessionsByStudent.set(s.studentId, []);
    sessionsByStudent.get(s.studentId)!.push(s);
  }

  // Build leaderboard entries per student
  const entries: YearlyLeaderboardEntry[] = students.map(student => {
    const sessions = sessionsByStudent.get(student.id) || [];

    // Daily totals across all dates
    const dailyTotals: Record<string, number> = {};
    for (const s of sessions) {
      dailyTotals[s.date] = (dailyTotals[s.date] || 0) + (s.durationMinutes || 0);
    }

    const dailyTotalsValues = Object.values(dailyTotals);
    const maxDaily = dailyTotalsValues.length ? Math.max(...dailyTotalsValues) : 0;

    // Longest streak overall (by practiced days)
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

    // Weekly totals: group by ISO week key (YYYY-W##)
    const weekTotals: Record<string, number> = {};
    const getWeekKey = (dateStr: string): string => {
      const d = new Date(dateStr);
      // ISO week date weeks start on Monday
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

    // Average between lessons (use intervals between sessions, reuse existing util from practiceEngine in UI)
    // Here: compute weekly average minutes (total minutes / number of weeks practiced)
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const practicedWeeks = Object.keys(weekTotals).length;
    const weeklyAverage = practicedWeeks > 0 ? totalMinutes / practicedWeeks : 0;

    // Medal score (copper) computed from sessions' medals (medalEngine stores medals derived elsewhere, but here we approximate by earned copper from minutes)
    // Use calculateEarnedCopper with student's sessions total minutes per day?
    // We'll calculate copper based on daily totals (consistent with medal thresholds per day)
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
