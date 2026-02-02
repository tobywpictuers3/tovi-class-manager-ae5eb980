import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setDevMode, getCurrentUser, setCurrentUser } from '@/lib/storage';
import { mockStudents } from '@/lib/mockData';
import AdminDashboard from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

const DevAdminDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getCurrentUser();
    
    // If not logged in as admin, redirect to homepage
    if (!currentUser || currentUser.type !== 'admin') {
      navigate('/');
      return;
    }

    // 🔒 CRITICAL: Force developer mode
    setDevMode(true);
    sessionStorage.setItem('musicSystem_devMode', 'true');
  }, [navigate]);

  const handleStudentLogin = (studentId: string) => {
    setCurrentUser({ type: 'student', studentId });
    navigate(`/student/${studentId}`);
  };

  return (
    <div className="space-y-6">
      {/* Developer Mode Personal Area Access */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            גישה לאזור אישי - מצב מפתחים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            כניסה לאזור אישי של תלמידות לדוגמא (נתונים מקומיים בלבד, ללא שמירה לדרופבוקס)
          </p>
          <div className="flex flex-wrap gap-2">
            {mockStudents.map((student) => (
              <Button
                key={student.id}
                variant="outline"
                onClick={() => handleStudentLogin(student.id)}
              >
                {student.firstName} {student.lastName}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Render the same AdminDashboard component */}
      <AdminDashboard />
    </div>
  );
};

export default DevAdminDashboard;
