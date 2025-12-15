/**
 * Commit Gateway - Single pipeline for all DB mutations
 * 
 * ARCHITECTURE:
 * - All mutations MUST go through commitChange()
 * - Worker is the ONLY source of truth
 * - UI NEVER updates until Worker confirms (confirmed: true)
 * - Offline operations are queued (queued: true, confirmed: false)
 * 
 * VERSIONING:
 * - currentVersion is initialized from Worker on loadDataOnInit
 * - Every commit includes baseVersion
 * - Worker returns 409 on version mismatch
 * - On conflict: reload from Worker, retry or abort
 */

import { workerApi } from './workerApi';
import { logger } from './logger';
import { isDevMode } from './devMode';
import { 
  EntityType, 
  DB_REGISTRY, 
  DB_REGISTRY_VERSION,
  getEntityDefinition,
  isRegisteredEntity,
} from './dbRegistry';

// ============================================================================
// TYPES
// ============================================================================

export interface CommitResult {
  /** Worker confirmed persistence - UI can update */
  confirmed: boolean;
  /** Mutation is queued for later sync - NOT confirmed */
  queued: boolean;
  /** Error message if failed */
  error?: string;
  /** New version from Worker (only if confirmed) */
  newVersion?: string;
  /** Returned data (for create operations) */
  data?: any;
}

export interface DeltaPayload {
  entity: EntityType;
  action: 'create' | 'update' | 'delete';
  id?: string;
  payload?: any;
  baseVersion: string;
  registryVersion: string;
}

interface QueuedCommit {
  delta: DeltaPayload;
  resolve: (result: CommitResult) => void;
  retryCount: number;
}

// ============================================================================
// STATE
// ============================================================================

/**
 * Current version - MUST be initialized from Worker
 * null = not initialized, commits will fail
 */
let currentVersion: string | null = null;

/**
 * Offline queue - commits waiting to be sent when online
 */
const offlineQueue: QueuedCommit[] = [];

/**
 * Feature flags for phased rollout
 * All false initially - will be enabled in phases
 */
export const COMMIT_FLAGS = {
  /** Phase 1: Enable for cascade deletes (deleteStudentCascade, deleteLessonCascade) */
  cascadeDeletes: false,
  /** Phase 2: Enable for all delete operations */
  allDeletes: false,
  /** Phase 3: Enable for update operations */
  updates: false,
  /** Phase 4: Enable for create operations */
  creates: false,
};

const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL_MS = 30000; // 30 seconds

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Initialize current version from Worker response
 * Called by hybridSync.loadDataOnInit()
 */
export function setCurrentVersion(version: string): void {
  currentVersion = version;
  logger.info(`📌 Commit Gateway: Version initialized to ${version}`);
}

/**
 * Get current version (for debugging/display)
 */
export function getCurrentVersion(): string | null {
  return currentVersion;
}

/**
 * Check if version is initialized
 */
export function isVersionInitialized(): boolean {
  return currentVersion !== null;
}

// ============================================================================
// OFFLINE QUEUE MANAGEMENT
// ============================================================================

let retryIntervalId: NodeJS.Timeout | null = null;

/**
 * Start the offline retry mechanism
 */
export function startOfflineRetry(): void {
  if (retryIntervalId) return;
  
  retryIntervalId = setInterval(async () => {
    if (offlineQueue.length > 0 && navigator.onLine) {
      logger.info(`🔄 Commit Gateway: Processing ${offlineQueue.length} queued commits...`);
      await processOfflineQueue();
    }
  }, RETRY_INTERVAL_MS);
}

/**
 * Stop the offline retry mechanism
 */
export function stopOfflineRetry(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
}

/**
 * Process queued commits when back online
 */
async function processOfflineQueue(): Promise<void> {
  while (offlineQueue.length > 0) {
    const item = offlineQueue[0];
    
    try {
      const result = await sendCommitToWorker(item.delta);
      
      if (result.confirmed) {
        // Success - remove from queue and resolve
        offlineQueue.shift();
        item.resolve(result);
      } else if (result.error === 'VERSION_CONFLICT') {
        // Conflict - need to reload, can't auto-resolve
        offlineQueue.shift();
        item.resolve({ 
          confirmed: false, 
          queued: false, 
          error: 'VERSION_CONFLICT: Reload required to resolve' 
        });
      } else {
        // Other error - retry or fail
        item.retryCount++;
        if (item.retryCount >= MAX_RETRY_COUNT) {
          offlineQueue.shift();
          item.resolve({ 
            confirmed: false, 
            queued: false, 
            error: `Failed after ${MAX_RETRY_COUNT} retries: ${result.error}` 
          });
        } else {
          // Leave in queue for next retry
          break;
        }
      }
    } catch (err) {
      // Network error - stop processing, will retry later
      logger.warn('⚠️ Commit Gateway: Network error during queue processing, will retry');
      break;
    }
  }
}

/**
 * Get current queue length (for UI display)
 */
export function getPendingCommitCount(): number {
  return offlineQueue.length;
}

// ============================================================================
// VALID ACTIONS CONSTANT
// ============================================================================

const VALID_ACTIONS = ['create', 'update', 'delete'] as const;

// ============================================================================
// CORE COMMIT FUNCTION
// ============================================================================

/**
 * Send a single commit to the Worker
 */
async function sendCommitToWorker(delta: DeltaPayload): Promise<CommitResult> {
  try {
    const response = await workerApi.commitDelta(delta);
    
    // Validate server response has required fields on success
    if (response.ok && !response.newVersion) {
      logger.error('❌ Commit Gateway: Server returned ok:true without newVersion');
      return { confirmed: false, queued: false, error: 'INVALID_SERVER_RESPONSE' };
    }
    
    if (response.ok && response.newVersion) {
      // Update local version
      const oldVersion = currentVersion;
      currentVersion = response.newVersion;
      logger.info(`📌 Version updated: ${oldVersion} → ${response.newVersion}`);
      
      return {
        confirmed: true,
        queued: false,
        newVersion: response.newVersion,
        data: response.data,
      };
    }
    
    // Handle 409 VERSION_CONFLICT with automatic re-sync
    if (response.status === 409) {
      console.log('Commit blocked due to version conflict – state re-synced');
      logger.warn('⚠️ Commit Gateway: VERSION_CONFLICT - triggering re-sync from server');
      
      // Re-sync from server
      try {
        const freshData = await workerApi.downloadLatest();
        if (freshData.success && freshData.data?._version) {
          currentVersion = freshData.data._version;
          logger.info(`📌 Version re-synced to: ${currentVersion}`);
          // Emit event for UI to refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('commitgateway:resync', { detail: freshData.data }));
          }
        }
      } catch (syncErr) {
        logger.error('❌ Commit Gateway: Failed to re-sync after conflict', syncErr);
      }
      
      return {
        confirmed: false,
        queued: false,
        error: 'VERSION_CONFLICT_RESYNCED',
      };
    }
    
    return {
      confirmed: false,
      queued: false,
      error: response.error || 'Unknown error from Worker',
    };
  } catch (err) {
    throw err; // Re-throw network errors
  }
}

/**
 * Main commit function - ALL DB mutations MUST use this
 * 
 * @param params.entity - Entity type (must be registered in DB_REGISTRY)
 * @param params.action - 'create' | 'update' | 'delete'
 * @param params.id - Entity ID (required for update/delete)
 * @param params.payload - Data (required for create/update)
 * @returns CommitResult with confirmed/queued status
 */
export async function commitChange(params: {
  entity: EntityType;
  action: 'create' | 'update' | 'delete';
  id?: string;
  payload?: any;
}): Promise<CommitResult> {
  const { entity, action, id, payload } = params;
  
  // -------------------------------------------------------------------------
  // DEV MODE: Skip Worker, return success immediately
  // -------------------------------------------------------------------------
  if (isDevMode()) {
    logger.info(`🔧 DEV MODE: commitChange(${entity}, ${action}) - auto-confirmed`);
    return { confirmed: true, queued: false, data: payload };
  }
  
  // -------------------------------------------------------------------------
  // HARD GUARD: Validate delta BEFORE sending (Section A)
  // -------------------------------------------------------------------------
  
  // Action must be one of allowed values
  if (!VALID_ACTIONS.includes(action)) {
    console.error('Blocked invalid commit_delta from client', { entity, action, id, payload });
    logger.error(`❌ Commit Gateway: Invalid action: ${action}`);
    return { confirmed: false, queued: false, error: 'INVALID_DELTA_BLOCKED_CLIENT' };
  }
  
  // Entity must be defined and non-empty string
  if (!entity || typeof entity !== 'string') {
    console.error('Blocked invalid commit_delta from client', { entity, action, id, payload });
    logger.error('❌ Commit Gateway: Entity is required and must be non-empty');
    return { confirmed: false, queued: false, error: 'INVALID_DELTA_BLOCKED_CLIENT' };
  }
  
  // Entity must be registered in DB_REGISTRY
  if (!isRegisteredEntity(entity)) {
    console.error('Blocked invalid commit_delta from client', { entity, action, id, payload });
    logger.error(`❌ Commit Gateway: Unknown entity type: ${entity}`);
    return { confirmed: false, queued: false, error: 'INVALID_DELTA_BLOCKED_CLIENT' };
  }
  
  // Version must be initialized (baseVersion will be a string)
  if (currentVersion === null) {
    console.error('Blocked invalid commit_delta from client - version not initialized', { entity, action, id });
    logger.error('❌ Commit Gateway: Version not initialized - reload required');
    return { 
      confirmed: false, 
      queued: false, 
      error: 'INVALID_DELTA_BLOCKED_CLIENT' 
    };
  }
  
  // ID required for update/delete
  if ((action === 'update' || action === 'delete') && !id) {
    console.error('Blocked invalid commit_delta from client', { entity, action, id, payload });
    logger.error(`❌ Commit Gateway: ${action} requires id`);
    return { confirmed: false, queued: false, error: 'INVALID_DELTA_BLOCKED_CLIENT' };
  }
  
  // Payload required for create/update
  if ((action === 'create' || action === 'update') && !payload) {
    console.error('Blocked invalid commit_delta from client', { entity, action, id, payload });
    logger.error(`❌ Commit Gateway: ${action} requires payload`);
    return { confirmed: false, queued: false, error: 'INVALID_DELTA_BLOCKED_CLIENT' };
  }
  
  // -------------------------------------------------------------------------
  // BUILD DELTA
  // -------------------------------------------------------------------------
  
  const delta: DeltaPayload = {
    entity,
    action,
    id,
    payload,
    baseVersion: currentVersion,
    registryVersion: DB_REGISTRY_VERSION,
  };
  
  // -------------------------------------------------------------------------
  // OFFLINE HANDLING
  // -------------------------------------------------------------------------
  
  if (!navigator.onLine) {
    logger.warn(`📡 Commit Gateway: Offline - queueing ${action} on ${entity}`);
    
    return new Promise((resolve) => {
      offlineQueue.push({ delta, resolve, retryCount: 0 });
      
      // CRITICAL: queued=true, confirmed=false
      // UI must show \"pending sync\" state, NOT confirmed state
      resolve({ confirmed: false, queued: true });
    });
  }
  
  // -------------------------------------------------------------------------
  // ONLINE: SEND TO WORKER
  // -------------------------------------------------------------------------
  
  try {
    logger.info(`🔄 Commit Gateway: ${action} on ${entity}${id ? ` (${id})` : ''}`);
    
    const result = await sendCommitToWorker(delta);
    
    if (result.confirmed) {
      logger.info(`✅ Commit Gateway: ${action} on ${entity} confirmed, v=${result.newVersion}`);
    } else {
      logger.warn(`⚠️ Commit Gateway: ${action} on ${entity} failed: ${result.error}`);
    }
    
    return result;
    
  } catch (err) {
    // Network error - queue for later
    logger.warn(`📡 Commit Gateway: Network error - queueing ${action} on ${entity}`);
    
    return new Promise((resolve) => {
      offlineQueue.push({ delta, resolve, retryCount: 0 });
      resolve({ confirmed: false, queued: true });
    });
  }
}

// ============================================================================
// FEATURE FLAG HELPERS
// ============================================================================

/**
 * Check if an action is enabled via feature flags
 */
export function isCommitEnabled(action: 'create' | 'update' | 'delete', isCascade: boolean = false): boolean {
  if (action === 'delete') {
    if (isCascade) return COMMIT_FLAGS.cascadeDeletes;
    return COMMIT_FLAGS.allDeletes;
  }
  if (action === 'update') return COMMIT_FLAGS.updates;
  if (action === 'create') return COMMIT_FLAGS.creates;
  return false;
}

// ============================================================================
// NETWORK LISTENERS
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logger.info('🌐 Commit Gateway: Back online - processing queue...');
    processOfflineQueue();
  });
  
  // Start offline retry on module load
  startOfflineRetry();
}
