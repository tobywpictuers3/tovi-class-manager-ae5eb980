import { workerApi } from './workerApi';
import { logger } from './logger';

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
  
}

class SyncManagerImpl implements SyncManager {
  private backupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // REMOVED: All automatic backups for privacy
    // No beforeunload listener
    // No periodic backup
  }

  // Load data from Cloudflare Worker using workerApi
  private async loadFromWorker(): Promise<any | null> {
    try {
      logger.info('Loading data from Cloudflare Worker...');
      
      const result = await workerApi.loadData();

      if (!result.success) {
        logger.info('No data found in Worker - this is normal for first use');
        return null;
      }

      const data = result.data;
      
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        logger.info('No data available from Worker');
        return null;
      }
      
      logger.info('Data loaded from Worker');
      return data;
    } catch (error) {
      logger.error('Failed to load from Worker:', error);
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

      logger.info('Data saved to Worker');
      return true;
    } catch (error) {
      logger.error('Failed to save to Worker:', error);
      return false;
    }
  }

  /**
   * REMOVED: Automatic backup on browser close
   * Only manual backups are allowed for privacy
   */

  // Download local backup file - ONLY called manually from UI
  downloadLocalBackup(): void {
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
      
      logger.info('Local backup downloaded');
    } catch (error) {
      logger.error('Failed to create local backup:', error);
    }
  }

  /**
   * REMOVED: Periodic automatic backup
   * Only manual saves are allowed for privacy
   */
  startPeriodicBackup(): void {
    // No automatic backups
  }

  /**
   * REMOVED: Stop periodic backup (not needed)
   */
  stopPeriodicBackup(): void {
    // No automatic backups
  }

  /**
   * REMOVED: Auto-save on swap request
   * Only manual saves are allowed
   */
  onSwapRequestReceived(): void {
    // No automatic saves
  }

  // Manual download for use in BackupImport component
  downloadSonataBackup(): void {
    this.downloadLocalBackup();
  }

  // טעינת נתונים מ-Cloudflare Worker בעת טעינת האפליקציה
  async loadDataOnInit(): Promise<void> {
    try {
      logger.info('Loading data from Cloudflare Worker on init...');
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
        
        logger.info('✅ Data loaded from Cloudflare Worker successfully');
      } else {
        logger.info('ℹ️ No data found in Worker, starting fresh');
      }
    } catch (error) {
      logger.warn('⚠️ Could not load from Worker:', error);
    }
  }

  /**
   * REMOVED: Auto-save on user action
   * Only manual saves are allowed for privacy
   */
  async onUserAction(action: string): Promise<void> {
    logger.info(`User action: ${action}`);
    // No automatic saves
  }

  /**
   * REMOVED: Auto-save functionality
   * Saves are now manual only via UI buttons
   */
  private async autoSaveToWorker(): Promise<void> {
    // No automatic saves
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
      
      logger.info('Backup imported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to import backup:', error);
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
      logger.error('Failed to download backup:', error);
    }
  }

}

export const syncManager: SyncManager = new SyncManagerImpl();
