import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Cloud, Loader2 } from 'lucide-react';
import { workerApi } from '@/lib/workerApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export const SaveButton = () => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Collect ALL data from localStorage (full backup)
      const backupData: Record<string, any> = {};
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            backupData[key] = JSON.parse(localStorage.getItem(key) || '');
          } catch {
            backupData[key] = localStorage.getItem(key);
          }
        }
      }

      // 1. Save to Dropbox via Worker
      const cloudResult = await workerApi.saveData(backupData);

      if (!cloudResult.success) {
        throw new Error('שגיאה בשמירה לדרופבוקס');
      }

      // 2. Download local backup file (BACKUP format)
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `sonata-backup-${timestamp}.json`;

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
      logger.error('Save error:', error);
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
