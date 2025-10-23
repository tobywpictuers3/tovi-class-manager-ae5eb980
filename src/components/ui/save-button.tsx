import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Cloud, Loader2 } from 'lucide-react';
import { workerApi } from '@/lib/workerApi';
import { toast } from '@/hooks/use-toast';

export const SaveButton = () => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Collect all data from localStorage
      const students = JSON.parse(localStorage.getItem('musicSystem_students') || '[]');
      const lessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
      const payments = JSON.parse(localStorage.getItem('musicSystem_payments') || '[]');
      const swapRequests = JSON.parse(localStorage.getItem('musicSystem_swapRequests') || '[]');
      const files = JSON.parse(localStorage.getItem('musicSystem_files') || '[]');
      const scheduleTemplates = JSON.parse(localStorage.getItem('musicSystem_scheduleTemplates') || '[]');
      const integrationSettings = JSON.parse(localStorage.getItem('musicSystem_integrationSettings') || '{}');

      const backupData = {
        students,
        lessons,
        payments,
        swapRequests,
        files,
        scheduleTemplates,
        integrationSettings,
        timestamp: new Date().toISOString()
      };

      // 1. Save to Dropbox via Worker
      const cloudResult = await workerApi.saveData(backupData);

      if (!cloudResult.success) {
        throw new Error('שגיאה בשמירה לדרופבוקס');
      }

      // 2. Download local backup file
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      
      const timestamp = `${year}${month}${day}${hour}${minute}`;
      const filename = `סונטה${timestamp}.json`;

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: '✅ השמירה הושלמה בהצלחה',
        description: `הנתונים נשמרו לדרופבוקס והורדו למחשב (${filename})`,
      });

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: '❌ שגיאה בשמירה',
        description: error instanceof Error ? error.message : 'אנא נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button 
      onClick={handleSave} 
      disabled={isSaving}
      className="gap-2"
      variant="default"
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          שומר...
        </>
      ) : (
        <>
          <Cloud className="h-4 w-4" />
          <Save className="h-4 w-4" />
          שמור שינויים
        </>
      )}
    </Button>
  );
};
