import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, RefreshCw, Server, HardDrive, Cloud } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { workerApi } from '@/lib/workerApi';
import { logger } from '@/lib/logger';

const BackupImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [server2Url, setServer2Url] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<string>('');

  useEffect(() => {
    // Load from server on init
    loadFromServer1();
    
    // REMOVED: Automatic daily backups - privacy requirement
    // REMOVED: beforeunload automatic download - privacy requirement
    // All saves are now manual only
  }, []);

  const gatherAllData = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    return data;
  };

  const backupToServer1 = async () => {
    try {
      const data = gatherAllData();
      
      const result = await workerApi.saveData(data);
      
      if (result.success) {
        setLastBackupTime(new Date().toLocaleString('he-IL'));
        logger.info('✅ Backup to Dropbox completed successfully');
      } else {
        throw new Error(result.error || 'Backup failed');
      }
    } catch (error) {
      logger.error('❌ Error backing up to Dropbox:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בשמירת גיבוי',
        variant: 'destructive'
      });
    }
  };

  const loadFromServer1 = async () => {
    setIsLoading(true);
    try {
      const result = await workerApi.loadData();
      
      if (result.success && result.data) {
        Object.keys(result.data).forEach(key => {
          localStorage.setItem(key, typeof result.data[key] === 'string' ? result.data[key] : JSON.stringify(result.data[key]));
        });
        
        logger.info('✅ Data loaded from Dropbox successfully');
        toast({
          title: 'הצלחה',
          description: 'הנתונים נטענו בהצלחה'
        });
      } else {
        throw new Error(result.error || 'Load failed');
      }
    } catch (error) {
      logger.error('❌ Error loading from Dropbox:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בטעינת נתונים',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const backupToServer2 = async () => {
    if (!server2Url) return;
    
    try {
      const data = gatherAllData();
      const response = await fetch(server2Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Backup to server 2 failed');
      
      logger.info('Backup to Server 2 completed successfully');
    } catch (error) {
      logger.error('Error backing up to Server 2:', error);
    }
  };

  const loadFromServer2 = async () => {
    if (!server2Url) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין כתובת שרת 2',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(server2Url);
      if (!response.ok) throw new Error('Failed to load from server 2');
      
      const data = await response.json();
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
      });
      
      toast({
        title: 'הצלחה',
        description: 'הנתונים נטענו משרת 2'
      });
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'שגיאה בטעינה משרת 2',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync1 = async () => {
    setIsLoading(true);
    await backupToServer1();
    await loadFromServer1();
    toast({
      title: 'הצלחה',
      description: 'סינכרון ידני עם שרת 1 הושלם'
    });
    setIsLoading(false);
  };

  const handleManualSync2 = async () => {
    setIsLoading(true);
    await backupToServer2();
    await loadFromServer2();
    toast({
      title: 'הצלחה',
      description: 'סינכרון ידני עם שרת 2 הושלם'
    });
    setIsLoading(false);
  };

  const downloadLocalBackup = () => {
    const data = gatherAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `sonata-backup-${timestamp}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'הצלחה',
      description: 'הגיבוי הורד בהצלחה'
    });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: 'שגיאה',
        description: 'ניתן לטעון רק קבצי JSON',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // טעינה גם אם הנתונים לא תואמים ב-100%
      Object.keys(data).forEach(key => {
        try {
          localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
        } catch (error) {
          logger.warn(`Could not import key: ${key}`, error);
        }
      });

      toast({
        title: 'הצלחה',
        description: 'הנתונים נטענו מהקובץ בהצלחה'
      });

      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'שגיאה בקריאת הקובץ',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* גיבוי 1 - Dropbox דרך Proxy מאובטח */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            גיבוי Dropbox מאובטח
            <Badge variant="secondary">ידני בלבד</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>📁 תיקייה: LOVABLE</p>
            <p>🔒 גישה: דרך Cloudflare Worker API</p>
            {lastBackupTime && <p>⏰ גיבוי אחרון: {lastBackupTime}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleManualSync1} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 ml-2" />
              סינכרון ידני
            </Button>
            <Button onClick={backupToServer1} variant="outline" disabled={isLoading}>
              <Upload className="h-4 w-4 ml-2" />
              שלח גיבוי
            </Button>
            <Button onClick={loadFromServer1} variant="outline" disabled={isLoading}>
              <Download className="h-4 w-4 ml-2" />
              טען נתונים
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* גיבוי 2 - שרת 2 */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            גיבוי #2 - שרת 2
            <Badge variant="secondary">ידני בלבד</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server2-url">כתובת שרת 2</Label>
            <Input
              id="server2-url"
              type="url"
              value={server2Url}
              onChange={(e) => setServer2Url(e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleManualSync2} disabled={isLoading || !server2Url}>
              <RefreshCw className="h-4 w-4 ml-2" />
              סינכרון ידני
            </Button>
            <Button onClick={backupToServer2} variant="outline" disabled={isLoading || !server2Url}>
              <Upload className="h-4 w-4 ml-2" />
              שלח גיבוי
            </Button>
            <Button onClick={loadFromServer2} variant="outline" disabled={isLoading || !server2Url}>
              <Download className="h-4 w-4 ml-2" />
              טען נתונים
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* גיבוי 3 - מקומי */}
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            גיבוי מקומי
            <Badge variant="secondary">ידני בלבד</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>טעינה מקובץ</Label>
              <p className="text-sm text-muted-foreground mb-2">
                ניתן לטעון גם קבצים שירדו מאפליקציה אחרת
              </p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                  id="file-upload"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  בחר קובץ JSON
                </Button>
              </div>
            </div>

            <div>
              <Label>הורדת גיבוי</Label>
              <p className="text-sm text-muted-foreground mb-2">
                יורד קובץ JSON עם כל הנתונים מהמערכת
              </p>
              <Button onClick={downloadLocalBackup} disabled={isLoading}>
                <Download className="h-4 w-4 ml-2" />
                הורד גיבוי מקומי
              </Button>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2 mt-4">
              <p className="text-sm font-medium">
                🔒 מדיניות פרטיות - כל הגיבויים ידניים בלבד
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>שמירה ל-Dropbox:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 mr-4 mb-3">
                <li>• לחיצה ידנית על "שלח גיבוי" בלבד</li>
                <li>• לחיצה על "שמור שינויים" בראש הדף</li>
                <li>• אין שמירות אוטומטיות</li>
              </ul>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>הורדה מקומית למחשב:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 mr-4">
                <li>• לחיצה על "הורד גיבוי מקומי" בלבד</li>
                <li>• לחיצה על "שמור שינויים" (בראש הדף)</li>
                <li>• אין הורדות אוטומטיות</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupImport;
