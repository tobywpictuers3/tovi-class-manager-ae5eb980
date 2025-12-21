import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flame, Clock, Target } from 'lucide-react';
import { getCurrentQuarterLeaderboard } from '@/lib/storage';
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
    setLeaderboard(getCurrentQuarterLeaderboard());
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
      <Card className="relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black border-2 border-yellow-400">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.1),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,rgba(255,215,0,0.3)_49%,rgba(255,215,0,0.3)_51%,transparent_52%)] bg-[length:20px_20px] opacity-20" />
        
        <CardHeader className="relative z-10">
          <CardTitle className="text-center text-3xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent animate-pulse">
            🏆 לוח המצטיינות הרבעוני 🏆
          </CardTitle>
          <p className="text-center text-sm text-yellow-200/80">
            3 המצטיינות הגבוהות ברבעון הנוכחי (3 חודשים)
          </p>
        </CardHeader>
        <CardContent className="space-y-6 relative z-10">
          {/* Top Daily Average */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg text-yellow-300">
              <Target className="h-5 w-5 text-blue-400" />
              <span>ממוצע אימונים יומי גבוה ביותר</span>
            </div>
            <div className="space-y-2">
              {topDailyAverage.length > 0 ? (
                topDailyAverage.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 hover:border-yellow-400 transition-all hover:shadow-lg hover:shadow-yellow-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium text-yellow-100">{entry.studentName}</div>
                        <div className="text-xs text-yellow-300/60">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge className="bg-yellow-600 text-yellow-50 text-base px-3 py-1 border-yellow-400">
                      {entry.dailyAverage.toFixed(1)} דק' ממוצע
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-yellow-200/60 text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          {/* Top Daily Minutes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg text-yellow-300">
              <Clock className="h-5 w-5 text-green-400" />
              <span>מספר דקות אימון יומי מקסימלי</span>
            </div>
            <div className="space-y-2">
              {topDailyMinutes.length > 0 ? (
                topDailyMinutes.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-600/50 hover:border-green-400 transition-all hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium text-yellow-100">{entry.studentName}</div>
                        <div className="text-xs text-yellow-300/60">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge className="bg-green-600 text-green-50 text-base px-3 py-1 border-green-400">
                      {entry.maxDailyMinutes} דקות ביום
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-yellow-200/60 text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          {/* Top Streak */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-lg text-yellow-300">
              <Flame className="h-5 w-5 text-orange-400" />
              <span>מספר ימי אימון ברצף מקסימלי</span>
            </div>
            <div className="space-y-2">
              {topStreak.length > 0 ? (
                topStreak.map((entry, idx) => (
                  <div
                    key={entry.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-600/50 hover:border-orange-400 transition-all hover:shadow-lg hover:shadow-orange-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalEmoji(idx)}</span>
                      <div>
                        <div className="font-medium text-yellow-100">{entry.studentName}</div>
                        <div className="text-xs text-yellow-300/60">מקום {idx + 1}</div>
                      </div>
                    </div>
                    <Badge className="bg-orange-600 text-orange-50 text-base px-3 py-1 border-orange-400">
                      {entry.maxStreak} ימים רצופים
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-yellow-200/60 text-center py-4">
                  עדיין אין נתונים לחודש זה
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg border border-yellow-500/40">
            <p className="text-sm text-center text-yellow-100 font-semibold">
              💪 המשיכי להתאמן בקביעות כדי לעלות בדירוג! כל אימון קטן משנה! 🎵
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PracticeLeaderboard;
