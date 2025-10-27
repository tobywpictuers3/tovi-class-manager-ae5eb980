import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Trophy, Sparkles } from 'lucide-react';
import { getPracticeSessions, addPracticeSession, getStudentPracticeSessions } from '@/lib/storage';
import { PracticeSession } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

interface PracticeTrackingProps {
  studentId: string;
}

interface DailyStats {
  date: string;
  sessions: PracticeSession[];
  totalMinutes: number;
  medals: string[];
}

const PracticeTracking = ({ studentId }: PracticeTrackingProps) => {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [shownCongrats, setShownCongrats] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSessions();
  }, [studentId]);

  useEffect(() => {
    calculateDailyStats();
  }, [sessions]);

  const loadSessions = () => {
    const studentSessions = getStudentPracticeSessions(studentId);
    setSessions(studentSessions);
  };

  const calculateDailyStats = () => {
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, PracticeSession[]>);

    const stats: DailyStats[] = Object.entries(grouped)
      .map(([date, daySessions]) => {
        const totalMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const medals: string[] = [];
        
        // Daily duration medals
        if (totalMinutes >= 60) medals.push('🥇 60 דקות');
        else if (totalMinutes >= 30) medals.push('🥈 30 דקות');
        else if (totalMinutes >= 15) medals.push('🥉 15 דקות');

        return { date, sessions: daySessions, totalMinutes, medals };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyStats(stats);
    checkStreaks(stats);
  };

  const checkStreaks = (stats: DailyStats[]) => {
    if (stats.length === 0) return;

    // Sort by date ascending for streak calculation
    const sorted = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const dates = sorted.map(s => s.date);
    
    // Calculate current streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = currentDate.toISOString().split('T')[0];
      if (dates.includes(checkDate)) {
        streak++;
      } else if (checkDate !== today) {
        // If we missed a day (and it's not today), streak is broken
        break;
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }

    showStreakCongrats(streak);
  };

  const showStreakCongrats = (streak: number) => {
    const key = `streak-${streak}`;
    if (shownCongrats.has(key)) return;

    let message = '';
    let medal = '';
    
    if (streak === 7) {
      message = 'וואוווו מהמם! שבוע של אימונים יומיומיים! ככה תוכלי בעזרת השם להגיע רחוק! מגיעה לך מדליית זהב!';
      medal = '🥇';
    } else if (streak === 6) {
      message = 'שמתי לב שהתאמנת 6 ימים ברציפות! מעולה! עוד יום אחד ואת סוגרת שבוע אימון רצוף. המשיכי כך! מגיעה לך מדליית כסף!';
      medal = '🥈';
    } else if (streak === 5) {
      message = 'שמתי לב שהתאמנת ברצף 5 ימים. המשיכי כך!';
      medal = '⭐';
    } else if (streak === 4) {
      message = 'שמתי לב שהתאמנת ברצף 4 ימים. המשיכי כך!';
      medal = '⭐';
    } else if (streak === 3) {
      message = 'שמתי לב שהתאמנת ברצף 3 ימים. המשיכי כך! מגיעה לך מדליית נחושת!';
      medal = '🥉';
    }

    if (message) {
      setShownCongrats(prev => new Set(prev).add(key));
      showCelebration(message, medal);
    }
  };

  const showDurationCongrats = (totalMinutes: number) => {
    const today = new Date().toISOString().split('T')[0];
    let message = '';
    let medal = '';
    
    if (totalMinutes >= 60) {
      const key = `duration-${today}-60`;
      if (!shownCongrats.has(key)) {
        message = 'וואו! צברת היום 60 דקות אימון! את עושה עבודה מצוינת! מגיעה לך מדליית זהב!';
        medal = '🥇';
        setShownCongrats(prev => new Set(prev).add(key));
      }
    } else if (totalMinutes >= 30) {
      const key = `duration-${today}-30`;
      if (!shownCongrats.has(key)) {
        message = 'נפלא! צברת היום 30 דקות אימון. מגיעה לך מדליית כסף!';
        medal = '🥈';
        setShownCongrats(prev => new Set(prev).add(key));
      }
    } else if (totalMinutes >= 15) {
      const key = `duration-${today}-15`;
      if (!shownCongrats.has(key)) {
        message = 'מצוין! צברת 15 דקות אימון היום! את כמובן מוזמנת להתאמן עוד....אבל בינתיים קבלי מדליית נחושת!';
        medal = '🥉';
        setShownCongrats(prev => new Set(prev).add(key));
      }
    }

    if (message) {
      showCelebration(message, medal);
    }
  };

  const showCelebration = (message: string, medal: string) => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347']
    });

    toast({
      title: `${medal} מזל טוב!`,
      description: message,
      duration: 6000,
    });
  };

  const handleStartTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
    toast({
      title: 'התחלת אימון',
      description: 'בהצלחה! זמן האימון החל להימדד',
    });
  };

  const handleStopTracking = () => {
    if (!startTime) return;

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    if (durationMinutes < 1) {
      toast({
        title: 'אימון קצר מדי',
        description: 'האימון היה קצר מדקה אחת',
        variant: 'destructive',
      });
      setIsTracking(false);
      setStartTime(null);
      return;
    }

    const session = addPracticeSession({
      studentId,
      date: new Date().toISOString().split('T')[0],
      startTime: startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      durationMinutes,
    });

    setIsTracking(false);
    setStartTime(null);
    loadSessions();

    // Check for duration milestones
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = sessions
      .filter(s => s.date === today)
      .reduce((sum, s) => sum + s.durationMinutes, 0) + durationMinutes;
    
    showDurationCongrats(todayTotal);

    toast({
      title: 'אימון הושלם!',
      description: `נרשמו ${durationMinutes} דקות אימון`,
    });
  };

  const handleManualEntry = () => {
    if (!manualStartTime || !manualEndTime || !manualDate) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    const [startHour, startMin] = manualStartTime.split(':').map(Number);
    const [endHour, endMin] = manualEndTime.split(':').map(Number);
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    if (durationMinutes <= 0) {
      toast({
        title: 'שגיאה',
        description: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
        variant: 'destructive',
      });
      return;
    }

    addPracticeSession({
      studentId,
      date: manualDate,
      startTime: manualStartTime,
      endTime: manualEndTime,
      durationMinutes,
    });

    loadSessions();
    setManualStartTime('');
    setManualEndTime('');
    
    const dayTotal = sessions
      .filter(s => s.date === manualDate)
      .reduce((sum, s) => sum + s.durationMinutes, 0) + durationMinutes;
    
    showDurationCongrats(dayTotal);

    toast({
      title: 'אימון נרשם!',
      description: `נרשמו ${durationMinutes} דקות אימון`,
    });
  };

  const getWeeklyTotal = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    return sessions
      .filter(s => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  };

  return (
    <div className="space-y-6">
      {/* Quick Start/Stop */}
      <Card className="card-gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            מעקב אימונים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            {!isTracking ? (
              <Button
                size="lg"
                onClick={handleStartTracking}
                className="hero-gradient"
              >
                <Play className="h-5 w-5 mr-2" />
                התחלת אימון
              </Button>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 animate-pulse" />
                  אימון פעיל
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStopTracking}
                >
                  <Square className="h-5 w-5 mr-2" />
                  סיום אימון
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">הזנה ידנית</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="manualDate">תאריך</Label>
                <Input
                  id="manualDate"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="manualStart">שעת התחלה</Label>
                <Input
                  id="manualStart"
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="manualEnd">שעת סיום</Label>
                <Input
                  id="manualEnd"
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleManualEntry} className="w-full">
                  רישום אימון
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <span className="text-lg font-semibold">סה"כ שבועי:</span>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {getWeeklyTotal()} דקות
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Daily History */}
      <Card>
        <CardHeader>
          <CardTitle>היסטוריית אימונים</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>אימונים</TableHead>
                <TableHead>סה"כ דקות</TableHead>
                <TableHead>הישגים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyStats.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">
                    {new Date(day.date).toLocaleDateString('he-IL', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {day.sessions.map((session) => (
                        <div key={session.id} className="text-sm text-muted-foreground">
                          {session.startTime && session.endTime && (
                            <span>{session.startTime} - {session.endTime}</span>
                          )}
                          <span className="mr-2">({session.durationMinutes} דק')</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{day.totalMinutes} דקות</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {day.medals.map((medal, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {medal}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeTracking;
