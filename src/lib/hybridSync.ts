import { workerApi } from './workerApi';
import { logger } from './logger';
import { exportAllData, initializeStorage } from './storage';

/**
 * Hybrid Sync Manager - Worker as source of truth, localStorage as cache
 * Architecture: State Management ↔️ Worker ↔️ localStorage (cache)
 */

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
}

class HybridSyncManager {
  private syncState: SyncState = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
  };

  private syncInterval: NodeJS.Timeout | null = null;
  private pendingQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.setupNetworkListeners();
    this.startPeriodicSync();
    this.setupUnloadListener();
  }

  /**
   * Setup online/offline listeners
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      logger.info('🌐 Network online - syncing...');
      this.syncState.isOnline = true;
      this.processPendingQueue();
    });

    window.addEventListener('offline', () => {
      logger.warn('📡 Network offline - using cache');
      this.syncState.isOnline = false;
    });
  }

  /**
   * Setup beforeunload listener to sync on close
   */
  private setupUnloadListener() {
    window.addEventListener('beforeunload', () => {
      if (this.syncState.isOnline && this.syncState.pendingChanges > 0) {
        logger.info('💾 Saving to Worker on close...');
        // Use sendBeacon for reliable sync on unload
        const data = this.gatherAllData();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(
          'https://lovable-dropbox-api.w0504124161.workers.dev/?action=upload_versioned',
          blob
        );
      }
    });
  }

  /**
   * Periodic sync is disabled - we sync on every change
   */
  private startPeriodicSync() {
    // No periodic sync needed - we sync immediately on every change
  }

  /**
   * Load data on app initialization
   * Always loads from Worker on every page load/refresh
   */
  async loadDataOnInit(): Promise<void> {
    try {
      logger.info('🔄 Loading from Worker...');

      if (!this.syncState.isOnline) {
        logger.warn('📡 Offline - cannot load from Worker');
        throw new Error('Offline - cannot load data');
      }

      const result = await workerApi.downloadLatest();

      if (result.success && result.data) {
        // 🛡️ VALIDATION: Check that data is not empty
        const dataKeys = Object.keys(result.data);
        const hasData = dataKeys.length > 1; // More than just timestamp
        
        if (!hasData) {
          logger.error('❌ Loaded empty data from Worker - refusing to initialize');
          throw new Error('Empty data received from Worker');
        }
        
        logger.info('✅ Data loaded from Worker');
        this.updateInMemoryStorage(result.data);
        this.syncState.lastSyncTime = new Date().toISOString();
      } else if (result.error === 'NO_VERSION_FOUND') {
        logger.info('ℹ️ No version found on Worker - starting fresh');
        // In this case, it's OK to start with empty system (first use)
      } else {
        logger.error('❌ Worker load failed:', result.error);
        throw new Error('Failed to load from Worker');
      }
    } catch (error) {
      logger.error('❌ Load error:', error);
      throw error; // Throw error so main.tsx can handle it
    }
  }


  /**
   * Update in-memory storage with Worker data
   */
  private updateInMemoryStorage(data: any) {
    try {
      initializeStorage(data);
      logger.info('💾 Memory updated from Worker');
    } catch (error) {
      logger.error('❌ Memory update error:', error);
    }
  }

  /**
   * On data change - immediately sync to Worker
   */
  async onDataChange(): Promise<{ success: boolean; message: string }> {
    this.syncState.pendingChanges++;

    if (!this.syncState.isOnline) {
      logger.warn('📡 Offline - cannot sync');
      return { 
        success: false, 
        message: 'שמירה נכשלה, בדקי חיבור לאינטרנט' 
      };
    }

    const success = await this.syncToWorker();
    
    if (success) {
      return { 
        success: true, 
        message: 'נשמר בדרופבוקס בהצלחה' 
      };
    } else {
      return { 
        success: false, 
        message: 'שמירה נכשלה, בדקי חיבור לאינטרנט' 
      };
    }
  }

  /**
   * Sync all data to Worker
   */
  private async syncToWorker(): Promise<boolean> {
    if (this.syncState.isSyncing) {
      logger.info('⏳ Sync already in progress');
      return false;
    }

    try {
      this.syncState.isSyncing = true;
      logger.info('🔄 Syncing to Worker...');

      const data = this.gatherAllData(); // This now throws error if data is empty
      
      // 🛡️ GUARD: Additional check before sending
      const dataSize = JSON.stringify(data).length;
      if (dataSize < 100) {
        logger.error('❌ PREVENTED SYNC - Data too small, likely corrupted');
        return false;
      }
      
      const result = await workerApi.uploadVersioned(data);

      if (result.success) {
        this.syncState.lastSyncTime = new Date().toISOString();
        this.syncState.pendingChanges = 0;
        logger.info('✅ Synced to Worker successfully');
        return true;
      } else {
        logger.warn('⚠️ Sync failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Sync error:', error);
      return false;
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Gather all data from in-memory storage
   */
  private gatherAllData(): any {
    return exportAllData();
  }

  /**
   * Process pending queue when coming back online
   */
  private async processPendingQueue() {
    if (this.pendingQueue.length === 0) return;

    logger.info(`🔄 Processing ${this.pendingQueue.length} pending changes...`);

    while (this.pendingQueue.length > 0) {
      const task = this.pendingQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          logger.error('❌ Pending task error:', error);
        }
      }
    }

    await this.syncToWorker();
  }

  /**
   * Manual sync trigger
   */
  async manualSync(): Promise<boolean> {
    return await this.syncToWorker();
  }

  /**
   * Get sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Download backup (for manual export)
   */
  downloadBackup() {
    const data = this.gatherAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `sonata-backup-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info('📦 Backup downloaded:', filename);
  }

  /**
   * Import backup from file and sync to Worker
   */
  async importBackup(file: File): Promise<{ success: boolean; message: string }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.updateInMemoryStorage(data);
      
      // Immediately sync to Worker
      const success = await this.syncToWorker();

      if (success) {
        logger.info('✅ Backup imported and synced to Worker');
        return { 
          success: true, 
          message: 'הגיבוי נטען והועלה לדרופבוקס בהצלחה' 
        };
      } else {
        logger.warn('⚠️ Backup imported but sync failed');
        return { 
          success: false, 
          message: 'הגיבוי נטען אך ההעלאה לדרופבוקס נכשלה' 
        };
      }
    } catch (error) {
      logger.error('❌ Import error:', error);
      return { 
        success: false, 
        message: 'שגיאה בטעינת הגיבוי' 
      };
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const hybridSync = new HybridSyncManager();
