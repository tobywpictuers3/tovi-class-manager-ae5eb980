import { workerApi } from './workerApi';

interface SyncManager {
  loadDataOnInit: () => Promise<void>;
  onUserAction: (action: string) => Promise<void>;
  
  // Additional methods for BackupImport component
  importBackup: (file: File) => Promise<boolean>;
  downloadBackup: () => void;
  
  // Automatic backup methods
  downloadSonataBackup: () => void;
  onSwapRequestReceived: () => void;
  startPeriodicBackup: () => void;
  stopPeriodicBackup: () => void;
  
  // Google Calendar integration
  sendCalendarEvent: (eventData: CalendarEventData) => Promise<void>;
  startCalendarSync: () => void;
  stopCalendarSync: () => void;
}

interface CalendarEventData {
  type: 'calendar_event';
  category: 'עבודה';
  sub_category: 'תלמידות' | 'הופעות';
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description?: string;
  action: 'create' | 'update' | 'delete';
  eventId?: string;
}

class SyncManagerImpl implements SyncManager {
  private backupInterval: NodeJS.Timeout | null = null;
  private calendarSyncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Setup automatic backup on app close (including unexpected close)
    this.setupAppCloseBackup();
    // Start periodic backup (every 30 minutes)
    this.startPeriodicBackup();
    // Start calendar sync (every 30 minutes)
    this.startCalendarSync();
  }

  // Load data from Cloudflare Worker using workerApi
  private async loadFromWorker(): Promise<any | null> {
    try {
      console.info('Loading data from Cloudflare Worker...');
      
      const result = await workerApi.loadData();

      if (!result.success) {
        console.info('No data found in Worker - this is normal for first use');
        return null;
      }

      const data = result.data;
      
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        console.info('No data available from Worker');
        return null;
      }
      
      console.log('✅ Data successfully loaded from Cloudflare Worker');
      return data;
    } catch (error) {
      console.error('Failed to load from Worker:', error);
      return null;
    }
  }

  // Save data to Cloudflare Worker using workerApi
  private async saveToWorker(myData: any): Promise<boolean> {
    try {
      const result = await workerApi.saveData(myData);

      if (!result.success) {
        throw new Error('Worker upload failed');
      }

      console.log('✅ Data successfully saved to Cloudflare Worker');
      return true;
    } catch (error) {
      console.error('Failed to save to Worker:', error);
      return false;
    }
  }

  private setupAppCloseBackup(): void {
    // Handle beforeunload (browser close/refresh) - only local download
    window.addEventListener('beforeunload', () => {
      this.downloadLocalBackup();
    });
  }

  // Download local backup file only (no Dropbox save)
  private downloadLocalBackup(): void {
    try {
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
      
      console.log(`Local backup created: ${filename}`);
    } catch (error) {
      console.error('Failed to create local backup:', error);
    }
  }

  startPeriodicBackup(): void {
    // Clear existing interval if any
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // Set up 30-minute interval - save to Dropbox only (no local download)
    this.backupInterval = setInterval(() => {
      console.log('Performing scheduled 30-minute Dropbox backup...');
      this.autoSaveToWorker();
    }, 30 * 60 * 1000);
  }

  stopPeriodicBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  onSwapRequestReceived(): void {
    console.log('Swap request received - triggering automatic Dropbox backup...');
    this.autoSaveToWorker();
  }

  // Manual download for use in BackupImport component
  downloadSonataBackup(): void {
    this.downloadLocalBackup();
  }

  // טעינת נתונים מ-Cloudflare Worker בעת טעינת האפליקציה
  async loadDataOnInit(): Promise<void> {
    try {
      console.info('Loading data from Cloudflare Worker on init...');
      const data = await this.loadFromWorker();
      
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Import data to memory (not localStorage)
        if (data.students) localStorage.setItem('musicSystem_students', JSON.stringify(data.students));
        if (data.lessons) localStorage.setItem('musicSystem_lessons', JSON.stringify(data.lessons));
        if (data.payments) localStorage.setItem('musicSystem_payments', JSON.stringify(data.payments));
        if (data.swapRequests) localStorage.setItem('musicSystem_swapRequests', JSON.stringify(data.swapRequests));
        if (data.files) localStorage.setItem('musicSystem_files', JSON.stringify(data.files));
        if (data.scheduleTemplates) localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(data.scheduleTemplates));
        if (data.integrationSettings) localStorage.setItem('musicSystem_integrationSettings', JSON.stringify(data.integrationSettings));
        
        console.info('✅ Data loaded from Cloudflare Worker successfully');
      } else {
        console.info('ℹ️ No data found in Worker, starting fresh');
      }
    } catch (error) {
      console.warn('⚠️ Could not load from Worker:', error);
    }
  }

  async onUserAction(action: string): Promise<void> {
    switch (action) {
      case 'update':
      case 'create':
      case 'delete':
        // Auto-save to Worker on any data change
        await this.autoSaveToWorker();
        break;
      default:
        console.log('Unknown user action:', action);
    }
  }

  // Automatic save to Cloudflare Worker when data changes
  private async autoSaveToWorker(): Promise<void> {
    try {
      const students = JSON.parse(localStorage.getItem('musicSystem_students') || '[]');
      const lessons = JSON.parse(localStorage.getItem('musicSystem_lessons') || '[]');
      const payments = JSON.parse(localStorage.getItem('musicSystem_payments') || '[]');
      const swapRequests = JSON.parse(localStorage.getItem('musicSystem_swapRequests') || '[]');
      const files = JSON.parse(localStorage.getItem('musicSystem_files') || '[]');
      const scheduleTemplates = JSON.parse(localStorage.getItem('musicSystem_scheduleTemplates') || '[]');
      const integrationSettings = JSON.parse(localStorage.getItem('musicSystem_integrationSettings') || '{}');

      const allData = {
        students,
        lessons,
        payments,
        swapRequests,
        files,
        scheduleTemplates,
        integrationSettings,
        timestamp: new Date().toISOString()
      };

      await this.saveToWorker(allData);
    } catch (error) {
      console.error('Failed to auto-save to Worker:', error);
    }
  }

  async importBackup(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Import data to localStorage
      if (data.students) localStorage.setItem('musicSystem_students', JSON.stringify(data.students));
      if (data.lessons) localStorage.setItem('musicSystem_lessons', JSON.stringify(data.lessons));
      if (data.payments) localStorage.setItem('musicSystem_payments', JSON.stringify(data.payments));
      if (data.swapRequests) localStorage.setItem('musicSystem_swapRequests', JSON.stringify(data.swapRequests));
      if (data.files) localStorage.setItem('musicSystem_files', JSON.stringify(data.files));
      if (data.scheduleTemplates) localStorage.setItem('musicSystem_scheduleTemplates', JSON.stringify(data.scheduleTemplates));
      if (data.integrationSettings) localStorage.setItem('musicSystem_integrationSettings', JSON.stringify(data.integrationSettings));
      
      console.log('Backup imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import backup:', error);
      return false;
    }
  }

  downloadBackup(): void {
    try {
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

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `music-system-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download backup:', error);
    }
  }

  // Google Calendar Integration (currently disabled - can be implemented later)
  async sendCalendarEvent(eventData: CalendarEventData): Promise<void> {
    console.log('Calendar events not implemented yet:', eventData);
  }

  private async syncFromCalendar(): Promise<void> {
    try {
      console.log('Calendar sync not implemented yet - feature disabled');
    } catch (error) {
      console.error('Failed to sync from calendar:', error);
    }
  }

  private mergeLessonsFromCalendar(currentLessons: any[], calendarLessons: any[]): any[] {
    // Simple merge logic - can be enhanced based on requirements
    const merged = [...currentLessons];
    
    calendarLessons.forEach(calLesson => {
      const existingIndex = merged.findIndex(l => l.id === calLesson.id);
      if (existingIndex >= 0) {
        // Update existing
        merged[existingIndex] = { ...merged[existingIndex], ...calLesson };
      } else {
        // Add new
        merged.push(calLesson);
      }
    });
    
    return merged;
  }

  private mergePerformancesFromCalendar(currentPerformances: any[], calendarPerformances: any[]): any[] {
    // Simple merge logic - can be enhanced based on requirements
    const merged = [...currentPerformances];
    
    calendarPerformances.forEach(calPerf => {
      const existingIndex = merged.findIndex(p => p.id === calPerf.id);
      if (existingIndex >= 0) {
        // Update existing
        merged[existingIndex] = { ...merged[existingIndex], ...calPerf };
      } else {
        // Add new
        merged.push(calPerf);
      }
    });
    
    return merged;
  }

  startCalendarSync(): void {
    // Clear existing interval if any
    if (this.calendarSyncInterval) {
      clearInterval(this.calendarSyncInterval);
    }

    // Set up 30-minute interval for calendar sync
    this.calendarSyncInterval = setInterval(() => {
      console.log('Performing scheduled calendar sync...');
      this.syncFromCalendar();
    }, 30 * 60 * 1000);

    // Also sync immediately on start
    this.syncFromCalendar();
  }

  stopCalendarSync(): void {
    if (this.calendarSyncInterval) {
      clearInterval(this.calendarSyncInterval);
      this.calendarSyncInterval = null;
    }
  }
}

export const syncManager: SyncManager = new SyncManagerImpl();
