import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check, Lock, RefreshCw } from 'lucide-react';
import { getStudents, getLessons, updateLesson } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { addMessage } from '@/lib/messages';
import { Lesson } from '@/lib/types';

interface LessonSwapInterfaceProps {
  studentId: string;
  onLessonSelect?: (callback: (lesson: Lesson) => void) => void;
}

type Step = 'my-lesson' | 'target-lesson';

const LessonSwapInterface = ({ studentId, onLessonSelect }: LessonSwapInterfaceProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('my-lesson');
  const [isVerified, setIsVerified] = useState(false);
  
  // My lesson details
  const [myLessonDate, setMyLessonDate] = useState('');
  const [myLessonTime, setMyLessonTime] = useState('');
  const [myLessonManual, setMyLessonManual] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Target lesson details
  const [targetStudentId, setTargetStudentId] = useState('');
  const [targetLessonDate, setTargetLessonDate] = useState('');
  const [targetLessonTime, setTargetLessonTime] = useState('');
  const [targetLessonManual, setTargetLessonManual] = useState(false);
  const [swapCode, setSwapCode] = useState('');
  const [reason, setReason] = useState('');
  
  const students = getStudents();
  const currentStudent = students.find(s => s.id === studentId);
  const otherStudents = students.filter(s => s.id !== studentId);
  
  const allLessons = getLessons();
  const today = new Date().toISOString().split('T')[0];
  const myLessons = allLessons.filter(l => 
    l.studentId === studentId && 
    l.date >= today && 
    l.status === 'scheduled'
  );

  // Register lesson selection callback
  useEffect(() => {
    if (!onLessonSelect) return;

    const handleSelect = (lesson: Lesson) => {
      if (currentStep === 'my-lesson' && !isVerified) {
        if (lesson.studentId === studentId) {
          setMyLessonDate(lesson.date);
          setMyLessonTime(lesson.startTime);
          setMyLessonManual(false);
          toast({
            title: 'השיעור נבחר',
            description: `${new Date(lesson.date).toLocaleDateString('he-IL')} בשעה ${lesson.startTime}`,
          });
        }
      } else if (currentStep === 'target-lesson' && isVerified) {
        if (lesson.studentId !== studentId) {
          setTargetStudentId(lesson.studentId);
          setTargetLessonDate(lesson.date);
          setTargetLessonTime(lesson.startTime);
          setTargetLessonManual(false);
          
          const targetStudent = students.find(s => s.id === lesson.studentId);
          toast({
            title: 'השיעור המבוקש נבחר',
            description: `של ${targetStudent?.firstName} ${targetStudent?.lastName} - ${new Date(lesson.date).toLocaleDateString('he-IL')} בשעה ${lesson.startTime}`,
          });
        }
      }
    };

    onLessonSelect(handleSelect);
  }, [onLessonSelect, currentStep, isVerified, studentId, students]);

  const handleVerify = () => {
    if (!currentStudent) return;

    if (verificationCode.trim() === currentStudent.personalCode) {
      setIsVerified(true);
      setCurrentStep('target-lesson');
      toast({
        title: 'אומת בהצלחה',
        description: 'כעת בחרי את השיעור המבוקש',
      });
    } else {
      toast({
        title: 'קוד שגוי',
        description: 'הקוד האישי שהוזן אינו תואם',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitSwap = async () => {
    // Validation
    if (!myLessonDate || !myLessonTime || !targetStudentId || !targetLessonDate || !targetLessonTime) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל הפרטים',
        variant: 'destructive',
      });
      return;
    }

    const requester = currentStudent;
    const targetStudent = students.find(s => s.id === targetStudentId);

    if (!requester || !targetStudent) {
      toast({
        title: 'שגיאה',
        description: 'תלמידה לא נמצאה',
        variant: 'destructive',
      });
      return;
    }

    // Find the actual lessons
    const myLesson = allLessons.find(l => 
      l.studentId === studentId && 
      l.date === myLessonDate && 
      l.startTime === myLessonTime
    );

    const theirLesson = allLessons.find(l => 
      l.studentId === targetStudentId && 
      l.date === targetLessonDate && 
      l.startTime === targetLessonTime
    );

    if (!myLesson || !theirLesson) {
      toast({
        title: 'שגיאה',
        description: 'אחד השיעורים לא נמצא',
        variant: 'destructive',
      });
      return;
    }

    // Check swap code
    const targetSwapCode = targetStudent.swapCode || targetStudent.personalCode;
    const isAutoApproved = swapCode.trim() && swapCode.trim() === targetSwapCode;

    if (isAutoApproved) {
      // Perform automatic swap
      updateLesson(myLesson.id, { studentId: targetStudentId, notes: `שיעור שהוחלף (${new Date().toLocaleDateString('he-IL')})` });
      updateLesson(theirLesson.id, { studentId: studentId, notes: `שיעור שהוחלף (${new Date().toLocaleDateString('he-IL')})` });

      // Send notifications
      await addMessage({
        senderId: 'system',
        senderName: 'מערכת',
        recipientIds: ['admin'],
        subject: 'החלפת שיעור אושרה אוטומטית',
        content: `החלפה בין ${requester.firstName} ${requester.lastName} ל-${targetStudent.firstName} ${targetStudent.lastName}\n\nשיעור של ${requester.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}\nשיעור של ${targetStudent.firstName}: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n\nסיבה: ${reason || 'לא צוין'}`,
        type: 'system',
      });

      await addMessage({
        senderId: 'admin',
        senderName: 'המורה',
        recipientIds: [studentId, targetStudentId],
        subject: 'החלפת שיעור אושרה',
        content: `שלום,\n\nהחלפת השיעור בין ${requester.firstName} ל-${targetStudent.firstName} אושרה.\n\nהשיעורים החדשים:\n- ${requester.firstName}: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n- ${targetStudent.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}`,
        type: 'swap_approval',
      });

      toast({
        title: 'ההחלפה אושרה!',
        description: 'השיעורים הוחלפו בהצלחה',
      });

      resetForm();
    } else {
      // Send to admin for approval
      await addMessage({
        senderId: studentId,
        senderName: `${requester.firstName} ${requester.lastName}`,
        recipientIds: ['admin'],
        subject: 'בקשה להחלפת שיעור',
        content: `בקשה חדשה להחלפת שיעור:\n\nמבקשת: ${requester.firstName} ${requester.lastName}\nתלמידה מבוקשת להחלפה: ${targetStudent.firstName} ${targetStudent.lastName}\n\nשיעור של ${requester.firstName}: ${new Date(myLessonDate).toLocaleDateString('he-IL')} בשעה ${myLessonTime}\nשיעור מבוקש: ${new Date(targetLessonDate).toLocaleDateString('he-IL')} בשעה ${targetLessonTime}\n\nסיבה: ${reason || 'לא צוין'}`,
        type: 'swap_request',
      });

      toast({
        title: 'הבקשה נשלחה',
        description: 'הבקשה נשלחה לאישור המנהל',
      });

      resetForm();
    }
  };

  const resetForm = () => {
    setMyLessonDate('');
    setMyLessonTime('');
    setTargetStudentId('');
    setTargetLessonDate('');
    setTargetLessonTime('');
    setSwapCode('');
    setReason('');
    setVerificationCode('');
    setIsVerified(false);
    setCurrentStep('my-lesson');
    setMyLessonManual(false);
    setTargetLessonManual(false);
  };

  if (!currentStudent) {
    return null;
  }

  return (
    <Card className="mt-4 border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl">איזור החלפות</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cube 1: My Lesson */}
          <Card className={`border-2 ${currentStep === 'my-lesson' ? 'border-primary' : 'border-muted'}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {isVerified ? <Check className="h-5 w-5 text-green-500" /> : <Lock className="h-5 w-5" />}
                השיעור שלי להחלפה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!myLessonManual && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setMyLessonManual(false)}
                  disabled={isVerified}
                >
                  בחרי את השיעור שלך מהמערכת
                </Button>
              )}
              
              <div className="space-y-2">
                <Label>תאריך השיעור</Label>
                {myLessonManual ? (
                  <Input
                    type="date"
                    value={myLessonDate}
                    onChange={(e) => setMyLessonDate(e.target.value)}
                    disabled={isVerified}
                  />
                ) : (
                  <Select value={myLessonDate} onValueChange={setMyLessonDate} disabled={isVerified}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחרי שיעור" />
                    </SelectTrigger>
                    <SelectContent>
                      {myLessons.map(lesson => (
                        <SelectItem key={lesson.id} value={lesson.date}>
                          {new Date(lesson.date).toLocaleDateString('he-IL')} - {lesson.startTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {myLessonDate && (
                <div className="space-y-2">
                  <Label>שעה</Label>
                  <Input
                    type="time"
                    value={myLessonTime}
                    onChange={(e) => setMyLessonTime(e.target.value)}
                    disabled={isVerified}
                  />
                </div>
              )}

              <Button
                variant="link"
                size="sm"
                onClick={() => setMyLessonManual(!myLessonManual)}
                disabled={isVerified}
                className="text-xs"
              >
                {myLessonManual ? 'בחירה מהרשימה' : 'הזנה ידנית'}
              </Button>

              {myLessonDate && myLessonTime && !isVerified && (
                <>
                  <div className="space-y-2">
                    <Label>הזיני את הקוד האישי שלך</Label>
                    <Input
                      type="text"
                      maxLength={4}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="קוד אישי"
                    />
                  </div>
                  <Button onClick={handleVerify} className="w-full">
                    אימות והמשך
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cube 2: Target Lesson */}
          <Card className={`border-2 ${currentStep === 'target-lesson' && isVerified ? 'border-primary' : 'border-muted'}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {!isVerified && <Lock className="h-5 w-5" />}
                השיעור המבוקש
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isVerified ? (
                <div className="text-center py-8 text-muted-foreground">
                  יש לאמת את השיעור שלך תחילה
                </div>
              ) : (
                <>
                  {!targetLessonManual && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                    >
                      בחרי את השיעור המבוקש מהמערכת
                    </Button>
                  )}

                  <div className="space-y-2">
                    <Label>תלמידה</Label>
                    <Select value={targetStudentId} onValueChange={setTargetStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחרי תלמידה" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherStudents.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.firstName} {student.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>תאריך השיעור המבוקש</Label>
                    <Input
                      type="date"
                      value={targetLessonDate}
                      onChange={(e) => setTargetLessonDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>שעה</Label>
                    <Input
                      type="time"
                      value={targetLessonTime}
                      onChange={(e) => setTargetLessonTime(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setTargetLessonManual(!targetLessonManual)}
                    className="text-xs"
                  >
                    {targetLessonManual ? 'בחירה מהמערכת' : 'הזנה ידנית'}
                  </Button>

                  <div className="space-y-2">
                    <Label>קוד החלפה (אופציונלי)</Label>
                    <Input
                      type="text"
                      maxLength={4}
                      value={swapCode}
                      onChange={(e) => setSwapCode(e.target.value)}
                      placeholder="קוד החלפה של התלמידה"
                    />
                    <p className="text-xs text-muted-foreground">
                      הזיני קוד החלפה לאישור מיידי. ללא קוד - הבקשה תישלח לאישור מנהל
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>סיבה (אופציונלי)</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="סיבת ההחלפה..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSubmitSwap} className="flex-1">
                      שלחי בקשה
                    </Button>
                    <Button onClick={resetForm} variant="outline">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default LessonSwapInterface;
