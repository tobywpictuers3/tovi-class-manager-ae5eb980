import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Check, AlertCircle } from 'lucide-react';
import { getStudents } from '@/lib/storage';
import { addSwapRequest, markLessonsAsSwapped } from '@/lib/lessonSwap/store';
import { validateSwap, determineSwapStatus } from '@/lib/lessonSwap/logic';
import { addMessage } from '@/lib/messages';
import { toast } from '@/hooks/use-toast';
import { Lesson } from '@/lib/types';

interface StudentSwapPanelProps {
  studentId: string;
  myLesson: Lesson | null;
  targetLesson: Lesson | null;
  onMyLessonClick: () => void;
  onTargetLessonClick: () => void;
}

const StudentSwapPanel = ({ 
  studentId, 
  myLesson, 
  targetLesson,
  onMyLessonClick,
  onTargetLessonClick 
}: StudentSwapPanelProps) => {
  const [targetSwapCode, setTargetSwapCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const students = getStudents();
  const currentStudent = students.find(s => s.id === studentId);
  const targetStudent = targetLesson ? students.find(s => s.id === targetLesson.studentId) : null;

  const handleSubmit = async () => {
    if (!myLesson || !targetLesson || !currentStudent) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור שני שיעורים',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const request = {
      requesterStudentId: studentId,
      requesterLessonId: myLesson.id,
      targetLessonId: targetLesson.id,
      targetStudentId: targetLesson.studentId,
      requesterSwapCode: currentStudent.swapCode || currentStudent.personalCode,
      targetSwapCode: targetSwapCode.trim() || undefined,
      status: 'pending_manager' as const,
      reason: `החלפה: ${new Date(myLesson.date).toLocaleDateString('he-IL')} ${myLesson.startTime} ↔ ${new Date(targetLesson.date).toLocaleDateString('he-IL')} ${targetLesson.startTime}`,
    };

    const validation = validateSwap(request, [myLesson, targetLesson], students);
    
    if (!validation.valid) {
      toast({
        title: 'שגיאה בבקשה',
        description: validation.error,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    const status = determineSwapStatus(request, students);
    const finalRequest = { ...request, status };

    const createdRequest = addSwapRequest(finalRequest);

    if (status === 'auto_approved') {
      markLessonsAsSwapped(createdRequest);
      
      await addMessage({
        senderId: 'admin',
        senderName: 'מערכת',
        recipientIds: [studentId, targetLesson.studentId],
        subject: 'החלפת שיעור אושרה אוטומטית',
        content: `השיעורים הוחלפו בהצלחה:\n${currentStudent.firstName} ${currentStudent.lastName}: ${new Date(myLesson.date).toLocaleDateString('he-IL')} ${myLesson.startTime}\n↔\n${targetStudent?.firstName} ${targetStudent?.lastName}: ${new Date(targetLesson.date).toLocaleDateString('he-IL')} ${targetLesson.startTime}`,
        type: 'swap_approval',
      });

      toast({
        title: 'החלפה בוצעה!',
        description: 'השיעורים הוחלפו בהצלחה',
      });
    } else {
      await addMessage({
        senderId: studentId,
        senderName: `${currentStudent.firstName} ${currentStudent.lastName}`,
        recipientIds: ['admin'],
        subject: 'בקשה להחלפת שיעור',
        content: `בקשה חדשה להחלפת שיעור:\nמבקשת: ${currentStudent.firstName} ${currentStudent.lastName}\nשיעור: ${new Date(myLesson.date).toLocaleDateString('he-IL')} ${myLesson.startTime}\n\nלהחלפה עם: ${targetStudent?.firstName} ${targetStudent?.lastName}\nשיעור: ${new Date(targetLesson.date).toLocaleDateString('he-IL')} ${targetLesson.startTime}`,
        type: 'swap_request',
      });

      toast({
        title: 'בקשה נשלחה',
        description: 'הבקשה נשלחה לאישור המנהלת',
      });
    }

    setTargetSwapCode('');
    setSubmitting(false);
  };

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6" />
          החלפת שיעורים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {/* קוביה 1: השיעור שלי */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">השיעור שלי</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myLesson ? (
                <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="default">נבחר</Badge>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {new Date(myLesson.date).toLocaleDateString('he-IL')}
                    </p>
                    <p className="text-muted-foreground">
                      {myLesson.startTime} - {myLesson.endTime}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    לחצי על שיעור במערכת השבועית
                  </p>
                  <Button 
                    onClick={onMyLessonClick}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    בחירת שיעור מהמערכת
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* קוביה 2: השיעור המבוקש */}
          <Card className="border-2 border-secondary/20">
            <CardHeader>
              <CardTitle className="text-lg">השיעור המבוקש</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {targetLesson && targetStudent ? (
                <div className="p-4 bg-secondary/10 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">נבחר</Badge>
                    <Check className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {targetStudent.firstName} {targetStudent.lastName}
                    </p>
                    <p className="font-medium">
                      {new Date(targetLesson.date).toLocaleDateString('he-IL')}
                    </p>
                    <p className="text-muted-foreground">
                      {targetLesson.startTime} - {targetLesson.endTime}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    לחצי על שיעור של תלמידה אחרת במערכת
                  </p>
                  <Button 
                    onClick={onTargetLessonClick}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    disabled={!myLesson}
                  >
                    בחירת שיעור מהמערכת
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* אזור קוד אישור */}
        {myLesson && targetLesson && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="targetSwapCode">
                    קוד החלפה של {targetStudent?.firstName} (אופציונלי)
                  </Label>
                  <Input
                    id="targetSwapCode"
                    type="text"
                    placeholder="הזיני קוד לאישור אוטומטי"
                    value={targetSwapCode}
                    onChange={(e) => setTargetSwapCode(e.target.value)}
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    עם קוד תקין - החלפה מיידית | ללא קוד - בקשה למנהלת
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? 'שולח...' : 'שליחת בקשת החלפה'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentSwapPanel;
