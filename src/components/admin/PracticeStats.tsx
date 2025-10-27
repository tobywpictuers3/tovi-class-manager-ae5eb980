import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { getStudentPracticeSessions } from '@/lib/storage';

interface PracticeStatsProps {
  studentId: string;
}

const PracticeStats = ({ studentId }: PracticeStatsProps) => {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  useEffect(() => {
    const sessions = getStudentPracticeSessions(studentId);
    
    // Calculate weekly total (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    const weeklyTotal = sessions
      .filter(s => s.date >= weekAgoStr)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    setWeeklyMinutes(weeklyTotal);

    // Calculate medals (from all time, most impressive achievements)
    const allMedals: string[] = [];
    
    // Group by date
    const grouped = sessions.reduce((acc, session) => {
      if (!acc[session.date]) {
        acc[session.date] = [];
      }
      acc[session.date].push(session);
      return acc;
    }, {} as Record<string, typeof sessions>);

    // Check for streaks
    const dates = Object.keys(grouped).sort();
    let currentStreak = 0;
    let maxStreak = 0;
    let prevDate = new Date(0);

    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      const dayDiff = Math.floor((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 1 || currentStreak === 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
      prevDate = date;
    });

    if (maxStreak >= 7) allMedals.push('🥇 שבוע רצוף');
    else if (maxStreak >= 6) allMedals.push('🥈 6 ימים רצופים');
    else if (maxStreak >= 3) allMedals.push('🥉 ' + maxStreak + ' ימים רצופים');

    // Check for daily duration records
    let maxDailyMinutes = 0;
    Object.values(grouped).forEach(daySessions => {
      const dailyTotal = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      maxDailyMinutes = Math.max(maxDailyMinutes, dailyTotal);
    });

    if (maxDailyMinutes >= 60) allMedals.push('🥇 60 דק\' ביום');
    else if (maxDailyMinutes >= 30) allMedals.push('🥈 30 דק\' ביום');
    else if (maxDailyMinutes >= 15) allMedals.push('🥉 15 דק\' ביום');

    setMedals(allMedals);
  }, [studentId]);

  if (weeklyMinutes === 0 && medals.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {weeklyMinutes > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          {weeklyMinutes} דק' שבועי
        </Badge>
      )}
      {medals.map((medal, idx) => (
        <Badge key={idx} variant="secondary" className="text-xs">
          {medal}
        </Badge>
      ))}
    </div>
  );
};

export default PracticeStats;
