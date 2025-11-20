// Swap Request Logic and Validation
import { SwapRequest } from './types';
import { Lesson, Student } from '@/lib/types';
import { parse, isBefore, parseISO } from 'date-fns';

// Check if a lesson is in the future
export function isFutureLesson(lesson: Lesson): boolean {
  const now = new Date();
  
  // Parse lesson date and time
  const lessonDateTime = parse(
    `${lesson.date} ${lesson.startTime}`,
    'yyyy-MM-dd HH:mm',
    new Date()
  );
  
  return isBefore(now, lessonDateTime);
}

// Validate a swap request before processing
export function validateSwap(
  request: SwapRequest,
  lessons: Lesson[],
  students: Student[]
): { ok: boolean; error?: string } {
  // Find the lessons
  const requesterLesson = lessons.find(l => l.id === request.requesterLessonId);
  const targetLesson = lessons.find(l => l.id === request.targetLessonId);
  
  if (!requesterLesson) {
    return { ok: false, error: 'שיעור המבקשת לא נמצא' };
  }
  
  if (!targetLesson) {
    return { ok: false, error: 'שיעור היעד לא נמצא' };
  }
  
  // Check that both lessons are in the future
  if (!isFutureLesson(requesterLesson)) {
    return { ok: false, error: 'לא ניתן להחליף שיעור שעבר' };
  }
  
  if (!isFutureLesson(targetLesson)) {
    return { ok: false, error: 'לא ניתן להחליף לשיעור שעבר' };
  }
  
  // Find the students
  const requesterStudent = students.find(s => s.id === request.requesterStudentId);
  const targetStudent = students.find(s => s.id === request.targetStudentId);
  
  if (!requesterStudent) {
    return { ok: false, error: 'תלמידה מבקשת לא נמצאה' };
  }
  
  if (!targetStudent) {
    return { ok: false, error: 'תלמידת יעד לא נמצאה' };
  }
  
  // Validate swap codes if provided
  if (request.requesterSwapCode && requesterStudent.swapCode !== request.requesterSwapCode) {
    return { ok: false, error: 'קוד ההחלפה של המבקשת שגוי' };
  }
  
  if (request.targetSwapCode && targetStudent.swapCode !== request.targetSwapCode) {
    return { ok: false, error: 'קוד ההחלפה של היעד שגוי' };
  }
  
  return { ok: true };
}

// Apply the swap (either auto-approve or leave pending)
export function applySwap(
  request: SwapRequest,
  lessons: Lesson[],
  students: Student[],
  markLessonsAsSwappedFn: (req: SwapRequest) => void
): { ok: boolean; error?: string; status?: SwapRequest['status'] } {
  // First validate
  const validation = validateSwap(request, lessons, students);
  if (!validation.ok) {
    return validation;
  }
  
  // Find target student to check swap code
  const targetStudent = students.find(s => s.id === request.targetStudentId);
  
  if (!targetStudent) {
    return { ok: false, error: 'תלמידת יעד לא נמצאה' };
  }
  
  // Check if we have valid target swap code for auto-approval
  if (request.targetSwapCode && request.targetSwapCode === targetStudent.swapCode) {
    // Auto-approve: swap the lessons
    try {
      markLessonsAsSwappedFn(request);
      return { ok: true, status: 'auto_approved' };
    } catch (error) {
      return { ok: false, error: 'שגיאה בביצוע ההחלפה' };
    }
  } else {
    // No valid code - leave pending for manager approval
    return { ok: true, status: 'pending_manager' };
  }
}
