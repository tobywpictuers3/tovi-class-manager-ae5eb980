import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Clock, Target } from 'lucide-react';
import { getCurrentMonthLeaderboard } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/lib/types';

const PracticeLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboard = () => {
    setLeaderboard(getCurrentMonthLeaderboard());
  };

  const getMedalEmoji = (position: number) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return '⭐';
  };

  const topDailyAverage = [...leaderboard].sort((a, b) => b.dailyAverage - a.dailyAverage).slice(0, 3);
  const topDailyMinutes = [...leaderboard].sort((a, b) => b.maxDailyMinutes - a.maxDailyMinutes).slice(0, 3);
  const topStreak = [...leaderboard].sort((a, b) => b.maxStreak - a.maxStreak).slice(0, 3);

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6 text-yellow-500" />
            לוח המצטיינות החודשי
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            התחרי עם עצמך והשתפרי כל חודש! ההישגים מתאפסים בתחילת כל חודש
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top Daily Average */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg">
              <Target className="h-5 w-5 text-blue-500" />
              <span>ממוצע אימונים יומי גבוה ביותר</span>
            </div>
            <div className="space-y-2">
              {topDailyAverage.length > 0 ? (
                topDailyAverage.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium">{entry.studentName}</div>
                        <div className="text-xs text-muted-foreground">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {entry.dailyAverage.toFixed(1)} דק' ממוצע
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          {/* Top Daily Minutes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg">
              <Clock className="h-5 w-5 text-green-500" />
              <span>מספר דקות אימון יומי מקסימלי</span>
            </div>
            <div className="space-y-2">
              {topDailyMinutes.length > 0 ? (
                topDailyMinutes.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium">{entry.studentName}</div>
                        <div className="text-xs text-muted-foreground">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {entry.maxDailyMinutes} דקות ביום
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          {/* Top Streak */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg">
              <Flame className="h-5 w-5 text-orange-500" />
              <span>מספר ימי אימון ברצף מקסימלי</span>
            </div>
            <div className="space-y-2">
              {topStreak.length > 0 ? (
                topStreak.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium">{entry.studentName}</div>
                        <div className="text-xs text-muted-foreground">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {entry.maxStreak} ימים רצופים
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-center">
              💪 המשיכי להתאמן בקביעות כדי לעלות בדירוג! כל אימון קטן משנה! 🎵
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeLeaderboard;
