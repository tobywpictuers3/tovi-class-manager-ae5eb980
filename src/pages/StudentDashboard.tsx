import { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, User, Phone, FileText, Timer } from 'lucide-react';
import { getCurrentUser, setCurrentUser, getStudents, getLessons } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { Student, Lesson } from '@/lib/types';
import { getAllLessonsIncludingTemplates } from '@/lib/lessonUtils';
import { useAccessMode } from '@/contexts/AccessModeContext';
import { clearClientCaches } from '@/lib/cacheManager';

import GeneralWeeklySchedule from '@/components/student/GeneralWeeklySchedule';
import SwapRequestForm from '@/components/student/SwapRequestForm';
import SwapRequestsStatus from '@/components/student/SwapRequestsStatus';
import EditableStudentDetails from '@/components/student/EditableStudentDetails';
import ContactsList from '@/components/student/ContactsList';
import StudentFiles from '@/components/student/StudentFiles';
import PaymentAlert from '@/components/student/PaymentAlert';
import PaymentSummary from '@/components/student/PaymentSummary';
import LessonHistory from '@/components/student/LessonHistory';
import PracticeTracking from '@/components/student/PracticeTracking';
import GmailStyleMessages from '@/components/student/GmailStyleMessages';
import BroadcastMessageBanner from '@/components/student/BroadcastMessageBanner';
import StarredMessagesBanner from '@/components/student/StarredMessagesBanner';
import MedalCollection from '@/components/student/MedalCollection';
import MedalStore from '@/components/student/MedalStore';
import BackButton from '@/components/ui/back-button';
import { SaveButton } from '@/components/ui/save-button';
import { UnreadMessagesBadge } from '@/components/ui/unread-messages-badge';
import StudentSwapPanel, { StudentSwapPanelRef } from '@/components/student/lessonSwap/StudentSwapPanel';

const Metronome = lazy(() => import('./Metronome'));

const StudentDashboard = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('schedule');
  const [student, setStudent] = useState<Student | null>(null);
  const { isPublicMode, setAccessMode } = useAccessMode();
  const [swapPanelRef, setSwapPanelRef] = useState<StudentSwapPanelRef | null>(null);
  const [currentSwapStep, setCurrentSwapStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSwapSelectionActive, setIsSwapSelectionActive] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    const fetchStudent = async () => {
      if (!studentId) return;

      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          navigate('/');
          return;
        }

        // allow student self access or admin access
        const allStudents = getStudents();
        const foundStudent = allStudents.find((s) => s.id === studentId);
        if (!foundStudent) {
          toast({
            title: 'שגיאה',
            description: 'התלמידה לא נמצאה',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }

        setStudent(foundStudent);

        // Load lessons for the student
        const allLessons = getLessons();
        const templatesAndLessons = getAllLessonsIncludingTemplates(allLessons);
        const studentLessons = templatesAndLessons.filter((l) => l.studentId === studentId);
        setLessons(studentLessons);
      } catch (e) {
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בטעינת הנתונים',
          variant: 'destructive',
        });
      }
    };

    fetchStudent();
  }, [studentId, navigate]);

  const refreshLessons = () => {
    if (!studentId) return;
    const allLessons = getLessons();
    const templatesAndLessons = getAllLessonsIncludingTemplates(allLessons);
    const studentLessons = templatesAndLessons.filter((l) => l.studentId === studentId);
    setLessons(studentLessons);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearClientCaches();
    setAccessMode({ isPublicMode: false });
    navigate('/');
  };

  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/20 bg-secondary/10 backdrop-blur">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BackButton
                onClick={isPublicMode ? () => navigate('/') : handleBackToAdmin}
                label={isPublicMode ? 'חזור לדף הבית' : 'חזור לדף הבית'}
              />
              <div className="space-y-1">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-primary">{student.firstName} {student.lastName}</span>
                  {!isPublicMode && <UnreadMessagesBadge studentId={studentId!} />}
                </h1>
                <p className="text-sm opacity-80">
                  {isPublicMode ? 'מצב תצוגה כללית' : 'אזור אישי'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isPublicMode && (
                <>
                  <SaveButton />
                  <Button variant="secondary" onClick={handleLogout} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    התנתק
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-6 pt-2">
        {/* Starred Messages Banner - Above everything */}
        {!isPublicMode && <StarredMessagesBanner studentId={studentId!} />}

        {/* Broadcast Messages Banner */}
        {!isPublicMode && <BroadcastMessageBanner studentId={studentId!} />}

        {/* Payment Alerts - Hide in public mode */}
        {!isPublicMode && <PaymentAlert studentId={studentId!} />}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-9 bg-secondary/20 backdrop-blur">
            <TabsTrigger value="schedule" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              מערכת שבועית
            </TabsTrigger>

            <TabsTrigger value="practice" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              מעקב אימונים
            </TabsTrigger>

            <TabsTrigger value="metronome" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Timer className="h-4 w-4" />
              מטרונום
            </TabsTrigger>

            <TabsTrigger value="medals" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              🏆 המדליות שלי
            </TabsTrigger>

            <TabsTrigger value="store" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary">
              <Calendar className="h-4 w-4" />
              🛒 חנות
            </TabsTrigger>

            <TabsTrigger value="history" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Calendar className="h-4 w-4" />
              היסטוריית שיעורים
            </TabsTrigger>

            <TabsTrigger value="messages" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Calendar className="h-4 w-4" />
              תקשורת
            </TabsTrigger>

            <TabsTrigger value="details" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <User className="h-4 w-4" />
              הפרטים שלי
            </TabsTrigger>

            <TabsTrigger value="contacts" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <Phone className="h-4 w-4" />
              פרטי קשר
            </TabsTrigger>

            <TabsTrigger value="files" className="flex items-center gap-2 text-card-foreground data-[state=active]:text-primary" disabled={isPublicMode}>
              <FileText className="h-4 w-4" />
              קבצים אישיים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            {isPublicMode ? (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <p className="text-lg">מצב תצוגה כללית - רק נתונים ציבוריים מוצגים</p>
                    <Button onClick={() => navigate('/')} variant="secondary">
                      חזרה לדף הבית
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Swap panel always visible */}
                <StudentSwapPanel
                  ref={(ref) => setSwapPanelRef(ref)}
                  studentId={studentId!}
                  lessons={lessons}
                  onStepChange={(step) => setCurrentSwapStep(step)}
                  onSelectionActiveChange={(active) => setIsSwapSelectionActive(active)}
                  onSwapCompleted={() => refreshLessons()}
                />

                <GeneralWeeklySchedule
                  studentId={studentId!}
                  lessons={lessons}
                  onLessonsUpdate={() => refreshLessons()}
                  swapPanelRef={swapPanelRef}
                  currentSwapStep={currentSwapStep}
                  isSwapSelectionActive={isSwapSelectionActive}
                />

                {/* Swap requests */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SwapRequestForm studentId={studentId!} />
                  <SwapRequestsStatus
                    studentId={studentId!}
                    onSwapCompleted={() => refreshLessons()}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="practice" className="space-y-6">
            <PracticeTracking studentId={studentId!} />
          </TabsContent>

          <TabsContent value="metronome" className="space-y-6">
            <Card className="card-gradient card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  המטרונום של טובי
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div className="text-center py-8 opacity-70">טוען מטרונום...</div>}>
                  <Metronome />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medals" className="space-y-6">
            <MedalCollection studentId={studentId!} />
          </TabsContent>

          <TabsContent value="store" className="space-y-6">
            <MedalStore studentId={studentId!} />
            {!isPublicMode && <PaymentSummary studentId={studentId!} />}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {!isPublicMode ? (
              <LessonHistory studentId={studentId!} />
            ) : (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <p className="text-lg">לא זמין במצב תצוגה כללית</p>
                    <p className="opacity-70">התחברי כדי לצפות בהיסטוריה</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            {!isPublicMode ? (
              <GmailStyleMessages studentId={studentId!} />
            ) : (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <p className="text-lg">לא זמין במצב תצוגה כללית</p>
                    <p className="opacity-70">התחברי כדי לצפות בהודעות</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {!isPublicMode ? (
              <EditableStudentDetails studentId={studentId!} />
            ) : (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <p className="text-lg">לא זמין במצב תצוגה כללית</p>
                    <p className="opacity-70">התחברי כדי לצפות/לערוך פרטים</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            {!isPublicMode ? (
              <ContactsList studentId={studentId!} />
            ) : (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <p className="text-lg">לא זמין במצב תצוגה כללית</p>
                    <p className="opacity-70">התחברי כדי לצפות בפרטי קשר</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            {!isPublicMode ? (
              <StudentFiles studentId={studentId!} />
            ) : (
              <Card className="card-gradient card-shadow">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <p className="text-lg">לא זמין במצב תצוגה כללית</p>
                    <p className="opacity-70">התחברי כדי לצפות בקבצים</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentDashboard;
