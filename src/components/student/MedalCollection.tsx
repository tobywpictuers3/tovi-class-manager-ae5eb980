import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { getStudentMedalRecords, getStudentBestAchievements } from '@/lib/storage';
import { useEffect, useState } from 'react';
import { MedalRecord } from '@/lib/types';

interface MedalCollectionProps {
  studentId: string;
}

const MedalCollection = ({ studentId }: MedalCollectionProps) => {
  const [medals, setMedals] = useState<MedalRecord[]>([]);
  const [bestAchievements, setBestAchievements] = useState({
    bestDailyAverage: 0,
    bestDailyMinutes: 0,
    bestStreak: 0,
  });

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = () => {
    const records = getStudentMedalRecords(studentId);
    setMedals(records);
    
    const best = getStudentBestAchievements(studentId);
    setBestAchievements(best);
  };

  const getMedalIcon = (level: string): string => {
    const icons: Record<string, string> = {
      'bronze': '🥉',
      'silver': '🥈',
      'gold': '🥇',
      'platinum': '💎',
      'diamond': '💠',
      'streak4': '🔥',
      'streak7': '⚡',
      'streak12': '💎',
      'streak21': '👑',
    };
    return icons[level] || '⭐';
  };

  const getMedalName = (level: string): string => {
    const names: Record<string, string> = {
      'bronze': 'נחושת',
      'silver': 'כסף',
      'gold': 'זהב',
      'platinum': 'פלטינום',
      'diamond': 'יהלום',
      'streak4': 'רצוף',
      'streak7': 'מרוצף',
      'streak12': 'מרצפת',
      'streak21': 'אלופה',
    };
    return names[level] || 'מדליה';
  };

  const getMedalDescription = (medal: MedalRecord) => {
    if (medal.medalType === 'duration') {
      return `${medal.durationMinutes} דקות אימון`;
    } else {
      return `${medal.streakDays} ימים רצופים`;
    }
  };

  const groupedByMonth = medals.reduce((acc, medal) => {
    const month = medal.earnedDate.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(medal);
    return acc;
  }, {} as Record<string, MedalRecord[]>);

  const formatMonth = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* Best Achievements Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-400/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Award className="h-6 w-6 text-blue-600" />
            ההישגים הטובים ביותר שלי
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
            <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{bestAchievements.bestDailyAverage.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">דקות ממוצע יומי מקסימלי</div>
          </div>
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{bestAchievements.bestDailyMinutes}</div>
            <div className="text-sm text-muted-foreground">דקות יומי מקסימלי</div>
          </div>
          <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold text-orange-600">{bestAchievements.bestStreak}</div>
            <div className="text-sm text-muted-foreground">רצף מקסימלי</div>
          </div>
        </CardContent>
      </Card>

      {/* Medal Collection Card */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black border-2 border-yellow-400">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.15),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_48%,rgba(255,215,0,0.3)_49%,rgba(255,215,0,0.3)_51%,transparent_52%)] bg-[length:20px_20px] opacity-20" />
        
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2 text-2xl bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 bg-clip-text text-transparent">
            <Trophy className="h-6 w-6 text-yellow-400" />
            אוסף המדליות שלי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          {Object.entries(groupedByMonth).length > 0 ? (
            Object.entries(groupedByMonth)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([month, monthMedals]) => (
                <div key={month} className="space-y-2">
                  <h3 className="font-semibold text-lg bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
                    {formatMonth(month)}
                  </h3>
                  <div className="grid gap-2">
                    {monthMedals.map((medal) => (
                      <div
                        key={medal.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50 hover:border-yellow-400 transition-all hover:shadow-lg hover:shadow-yellow-500/20"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{getMedalIcon(medal.level)}</span>
                          <div>
                            <div className="font-medium text-yellow-100">
                              {getMedalName(medal.level)} - {getMedalDescription(medal)}
                            </div>
                            <div className="text-sm text-yellow-300/60">
                              {new Date(medal.earnedDate).toLocaleDateString('he-IL')}
                            </div>
                          </div>
                        </div>
                        <Badge className={medal.used ? "bg-gray-600 text-gray-200" : "bg-yellow-600 text-yellow-50 border-yellow-400"}>
                          {medal.used ? `נוצל ב${medal.usedForItem}` : 'זמין'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-center py-8 text-yellow-200/60">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20 text-yellow-400" />
              <p>עדיין אין מדליות. המשיכי להתאמן כדי לזכות במדליות!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedalCollection;
