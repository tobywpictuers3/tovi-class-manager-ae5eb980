import { workerApi } from './workerApi';
import { logger } from './logger';
import { isDevMode } from './storage';

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
    logger.info('🔄 SyncManager initialized');
    
    // 🔒 CRITICAL: Don't start periodic backup in dev mode
    if (!isDevMode()) {
      // Start periodic backup to Worker every 30 minutes (secure - your Worker only)
      this.startPeriodicBackup();
    } else {
      logger.info('🔧 Dev mode: Periodic backup disabled');
    }
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
   * Periodic backup to YOUR external Worker only (every 30 minutes)
   * This is SAFE - goes to your Worker, not Lovable
   */
  startPeriodicBackup(): void {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: startPeriodicBackup blocked');
      return;
    }
    
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(() => {
      this.autoSaveToWorker();
    }, 30 * 60 * 1000); // 30 minutes
  }

  stopPeriodicBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  onSwapRequestReceived(): void {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: onSwapRequestReceived blocked');
      return;
    }
    
    this.autoSaveToWorker();
  }

  // Manual download for use in BackupImport component
  downloadSonataBackup(): void {
    this.downloadLocalBackup();
  }

  // טעינת נתונים מ-Cloudflare Worker בעת טעינת האפליקציה
  async loadDataOnInit(): Promise<void> {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: loadDataOnInit blocked');
      return;
    }
    
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
   * Auto-save to YOUR Worker on data changes (secure - your Worker only)
   */
  async onUserAction(action: string): Promise<void> {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info(`🔧 Dev mode: onUserAction (${action}) blocked`);
      return;
    }
    
    logger.info(`User action: ${action}`);
    await this.autoSaveToWorker();
  }

  /**
   * Auto-save to YOUR external Worker (secure - not Lovable)
   */
  private async autoSaveToWorker(): Promise<void> {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: autoSaveToWorker blocked');
      return;
    }
    
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
      logger.error('Failed to auto-save to Worker:', error);
    }
  }

  async importBackup(file: File): Promise<boolean> {
    // 🔒 CRITICAL: Block in dev mode
    if (isDevMode()) {
      logger.info('🔧 Dev mode: importBackup blocked');
      return false;
    }
    
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
