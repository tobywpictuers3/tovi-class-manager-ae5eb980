// Swap Request Types for Modular Lesson Swap System

export interface SwapRequest {
  id: string;
  requesterStudentId: string;
  requesterLessonId: string;
  targetStudentId: string;
  targetLessonId: string;
  requesterSwapCode: string;
  targetSwapCode?: string;
  status: 'pending_manager' | 'auto_approved' | 'rejected' | 'cancelled';
  createdAt: string;
  resolvedAt?: string;
  reason?: string;
}
