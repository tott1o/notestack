// ═══════════════════════════════════════════════════════════════════════════════
// NoteStack High-Performance State Memory & Persistence Engine
// Inspired by VS Code, Obsidian & JetBrains state management architecture
// ═══════════════════════════════════════════════════════════════════════════════

export interface FileState {
  scrollTop?: number;
  scrollLeft?: number;
  pageNumber?: number;
  currentSlide?: number;
  currentTime?: number;
  cursorStart?: number;
  cursorEnd?: number;
  activeLine?: number;
  zoomLevel?: number;
  zoom?: number;
  rotation?: number;
  viewMode?: string;
  searchQuery?: string;
  studyNotes?: string;
  fontScaleRatio?: number;
  showFilmstrip?: boolean;
  showNotes?: boolean;
  overrideTheme?: string;
  lastOpenedAt?: number;
}

export interface GlobalSessionState {
  lastActiveFilePath?: string;
  lastViewMode?: string;
  expandedFolders?: Record<string, boolean>;
  selectedFilter?: string;
  openTabPaths?: string[];
  activeTabId?: string;
  lastSavedAt?: number;
}

export type SavePersistenceStrategy = 'on_close_only' | 'debounced_auto' | 'hybrid';

export interface ViewerSaveStateSettings {
  // Save strategy
  strategy: SavePersistenceStrategy;
  debounceDelayMs: number; // e.g. 500, 1000, 1500, 3000
  maxFileStates: number; // LRU limit: 100, 250, 500, 1000, 0 (unlimited)

  // File type toggles
  mdEnabled: boolean;
  pdfEnabled: boolean;
  docxEnabled: boolean;
  pptxEnabled: boolean;
  codeEnabled: boolean;
  csvEnabled: boolean;
  mediaEnabled: boolean;

  // Granular detail toggles
  saveScrollPosition: boolean;
  savePageSlide: boolean;
  saveZoomRotation: boolean;
  saveMediaTime: boolean;
  saveCodeCursor: boolean;
}

export interface StorageMetrics {
  totalFilesSaved: number;
  totalBytesUsed: number;
  formattedSize: string;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  countByFormat: {
    md: number;
    pdf: number;
    docx: number;
    pptx: number;
    code: number;
    csv: number;
    media: number;
    other: number;
  };
}

export const DEFAULT_VIEWER_SAVE_SETTINGS: ViewerSaveStateSettings = {
  strategy: 'on_close_only',
  debounceDelayMs: 1500,
  maxFileStates: 250,

  mdEnabled: true,
  pdfEnabled: true,
  docxEnabled: true,
  pptxEnabled: true,
  codeEnabled: true,
  csvEnabled: true,
  mediaEnabled: true,

  saveScrollPosition: true,
  savePageSlide: true,
  saveZoomRotation: true,
  saveMediaTime: true,
  saveCodeCursor: true
};

const VIEWER_SETTINGS_KEY = 'notestack_viewer_save_settings_v2';
const GLOBAL_SESSION_KEY = 'notestack_global_session_v2';
const FILE_STATE_PREFIX = 'notestack_file_state_v2_';
// Legacy prefix fallback support
const LEGACY_FILE_STATE_PREFIX = 'notestack_file_state_';

// In-Memory L1 Cache for zero-latency synchronous reads
const inMemoryFileStateCache = new Map<string, FileState>();
let isCacheHydrated = false;

// Pending debounced writes map
const pendingDebouncedSaves = new Map<string, FileState>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeFileKey(fileKey: string): string {
  if (!fileKey) return '';
  return fileKey.replace(/\\/g, '/').toLowerCase().trim();
}

/**
 * Hydrates L1 memory cache from localStorage on initial access
 */
function ensureCacheHydrated(): void {
  if (isCacheHydrated) return;
  isCacheHydrated = true;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(FILE_STATE_PREFIX) || key.startsWith(LEGACY_FILE_STATE_PREFIX))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as FileState;
            const rawFileKey = key.startsWith(FILE_STATE_PREFIX)
              ? key.replace(FILE_STATE_PREFIX, '')
              : key.replace(LEGACY_FILE_STATE_PREFIX, '');
            const normalized = normalizeFileKey(decodeURIComponent(rawFileKey));
            if (normalized && parsed) {
              inMemoryFileStateCache.set(normalized, parsed);
            }
          } catch (e) {
            // Ignore corrupted keys
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to hydrate state memory cache:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings & Preferences Persistence
// ─────────────────────────────────────────────────────────────────────────────

export function getSaveStateSettings(): ViewerSaveStateSettings {
  try {
    const raw = localStorage.getItem(VIEWER_SETTINGS_KEY);
    if (!raw) return DEFAULT_VIEWER_SAVE_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VIEWER_SAVE_SETTINGS, ...parsed };
  } catch (err) {
    return DEFAULT_VIEWER_SAVE_SETTINGS;
  }
}

export function saveSaveStateSettings(settings: Partial<ViewerSaveStateSettings>): void {
  try {
    const existing = getSaveStateSettings();
    const updated = { ...existing, ...settings };
    localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(updated));

    // Clear format cached states if format toggle was disabled
    if (settings.mdEnabled === false) clearFileTypeStates('md');
    if (settings.pdfEnabled === false) clearFileTypeStates('pdf');
    if (settings.docxEnabled === false) clearFileTypeStates('docx');
    if (settings.pptxEnabled === false) clearFileTypeStates('pptx');
    if (settings.codeEnabled === false) clearFileTypeStates('code');
    if (settings.csvEnabled === false) clearFileTypeStates('csv');
    if (settings.mediaEnabled === false) clearFileTypeStates('media');

    // Run LRU check if maxFileStates was changed
    if (settings.maxFileStates !== undefined) {
      pruneLRUEviction(settings.maxFileStates);
    }
  } catch (err) {
    console.error('Failed to save viewer state settings:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-File State Memory Persistence
// ─────────────────────────────────────────────────────────────────────────────

export function getFileState(fileKey: string): FileState {
  if (!fileKey) return { lastOpenedAt: Date.now() };
  ensureCacheHydrated();

  const normalized = normalizeFileKey(fileKey);
  const cached = inMemoryFileStateCache.get(normalized);
  if (cached) return cached;

  try {
    const storageKey = `${FILE_STATE_PREFIX}${encodeURIComponent(normalized)}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as FileState;
      inMemoryFileStateCache.set(normalized, parsed);
      return parsed;
    }
  } catch (err) {
    console.error(`Failed to read file state for ${fileKey}:`, err);
  }
  return { lastOpenedAt: Date.now() };
}

export function saveFileState(fileKey: string, state: Partial<FileState>): void {
  if (!fileKey) return;
  ensureCacheHydrated();

  const settings = getSaveStateSettings();
  const normalized = normalizeFileKey(fileKey);
  const ext = getExtensionFromKey(normalized);

  // Check if state saving is enabled for this file format
  if (!isFormatStateEnabled(ext, settings)) {
    return;
  }

  // Filter out disabled detail fields
  const filteredState: Partial<FileState> = { ...state };
  if (!settings.saveScrollPosition) {
    delete filteredState.scrollTop;
    delete filteredState.scrollLeft;
  }
  if (!settings.savePageSlide) {
    delete filteredState.pageNumber;
    delete filteredState.currentSlide;
  }
  if (!settings.saveZoomRotation) {
    delete filteredState.zoom;
    delete filteredState.zoomLevel;
    delete filteredState.rotation;
  }
  if (!settings.saveMediaTime) {
    delete filteredState.currentTime;
  }
  if (!settings.saveCodeCursor) {
    delete filteredState.cursorStart;
    delete filteredState.cursorEnd;
    delete filteredState.activeLine;
  }

  const existing = getFileState(fileKey);
  const updated: FileState = {
    ...existing,
    ...filteredState,
    lastOpenedAt: Date.now()
  };

  // Update L1 In-Memory Cache
  inMemoryFileStateCache.set(normalized, updated);

  // Synchronous write to localStorage
  try {
    const storageKey = `${FILE_STATE_PREFIX}${encodeURIComponent(normalized)}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
    pruneLRUEviction(settings.maxFileStates);
  } catch (err) {
    console.error(`Failed to save file state for ${fileKey}:`, err);
  }
}

/**
 * Debounced Save: Enqueues state save and flushes after settings.debounceDelayMs
 */
export function debouncedSaveFileState(fileKey: string, state: Partial<FileState>): void {
  if (!fileKey) return;
  const settings = getSaveStateSettings();

  // If strategy is on_close_only, do not enqueue auto-saves
  if (settings.strategy === 'on_close_only') return;

  const normalized = normalizeFileKey(fileKey);
  const existing = pendingDebouncedSaves.get(normalized) || getFileState(fileKey);
  pendingDebouncedSaves.set(normalized, {
    ...existing,
    ...state,
    lastOpenedAt: Date.now()
  });

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    flushPendingStateSaves();
  }, settings.debounceDelayMs || 1500);
}

/**
 * Flushes all pending debounced saves to disk immediately
 */
export function flushPendingStateSaves(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (pendingDebouncedSaves.size === 0) return;

  const entries = Array.from(pendingDebouncedSaves.entries());
  pendingDebouncedSaves.clear();

  for (const [key, state] of entries) {
    saveFileState(key, state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU Eviction & Format Pruning
// ─────────────────────────────────────────────────────────────────────────────

function pruneLRUEviction(maxAllowed: number): void {
  if (!maxAllowed || maxAllowed <= 0) return; // 0 means unlimited
  ensureCacheHydrated();

  if (inMemoryFileStateCache.size <= maxAllowed) return;

  const entries = Array.from(inMemoryFileStateCache.entries());
  // Sort ascending by lastOpenedAt (oldest first)
  entries.sort((a, b) => (a[1].lastOpenedAt || 0) - (b[1].lastOpenedAt || 0));

  const overflowCount = inMemoryFileStateCache.size - maxAllowed;
  for (let i = 0; i < overflowCount; i++) {
    const [keyToEvict] = entries[i];
    inMemoryFileStateCache.delete(keyToEvict);

    try {
      const storageKey = `${FILE_STATE_PREFIX}${encodeURIComponent(keyToEvict)}`;
      localStorage.removeItem(storageKey);
      const legacyKey = `${LEGACY_FILE_STATE_PREFIX}${encodeURIComponent(keyToEvict)}`;
      localStorage.removeItem(legacyKey);
    } catch (e) {
      // Ignore
    }
  }
}

export function clearFileTypeStates(extension: 'md' | 'pdf' | 'docx' | 'pptx' | 'code' | 'csv' | 'media'): void {
  ensureCacheHydrated();
  const keysToRemove: string[] = [];

  for (const [normalizedKey] of inMemoryFileStateCache.entries()) {
    const ext = getExtensionFromKey(normalizedKey);
    if (matchesFormatExtension(ext, extension)) {
      keysToRemove.push(normalizedKey);
    }
  }

  keysToRemove.forEach(k => {
    inMemoryFileStateCache.delete(k);
    try {
      localStorage.removeItem(`${FILE_STATE_PREFIX}${encodeURIComponent(k)}`);
      localStorage.removeItem(`${LEGACY_FILE_STATE_PREFIX}${encodeURIComponent(k)}`);
    } catch (e) {}
  });
}

export function clearAllFileStates(): void {
  ensureCacheHydrated();
  inMemoryFileStateCache.clear();
  pendingDebouncedSaves.clear();

  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(FILE_STATE_PREFIX) || k.startsWith(LEGACY_FILE_STATE_PREFIX))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed to clear all saved file states:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Diagnostics & Metrics Calculator
// ─────────────────────────────────────────────────────────────────────────────

export function getStorageMetrics(): StorageMetrics {
  ensureCacheHydrated();

  let totalBytes = 0;
  let oldest: number | null = null;
  let newest: number | null = null;

  const countByFormat = {
    md: 0,
    pdf: 0,
    docx: 0,
    pptx: 0,
    code: 0,
    csv: 0,
    media: 0,
    other: 0
  };

  for (const [key, state] of inMemoryFileStateCache.entries()) {
    const jsonStr = JSON.stringify(state);
    totalBytes += jsonStr.length * 2; // UTF-16 estimation

    const ts = state.lastOpenedAt || Date.now();
    if (oldest === null || ts < oldest) oldest = ts;
    if (newest === null || ts > newest) newest = ts;

    const ext = getExtensionFromKey(key);
    if (['md', 'markdown'].includes(ext)) countByFormat.md++;
    else if (ext === 'pdf') countByFormat.pdf++;
    else if (['docx', 'doc'].includes(ext)) countByFormat.docx++;
    else if (['pptx', 'ppt'].includes(ext)) countByFormat.pptx++;
    else if (['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'css', 'html', 'c', 'cpp', 'java', 'go', 'rs'].includes(ext)) countByFormat.code++;
    else if (ext === 'csv') countByFormat.csv++;
    else if (['mp4', 'webm', 'mp3', 'png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) countByFormat.media++;
    else countByFormat.other++;
  }

  const formattedSize = totalBytes < 1024
    ? `${totalBytes} B`
    : totalBytes < 1024 * 1024
    ? `${(totalBytes / 1024).toFixed(1)} KB`
    : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

  return {
    totalFilesSaved: inMemoryFileStateCache.size,
    totalBytesUsed: totalBytes,
    formattedSize,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
    countByFormat
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backup Export & Import Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function exportStateMemoryBackup(): string {
  ensureCacheHydrated();
  const exportPayload = {
    version: 2,
    exportedAt: Date.now(),
    settings: getSaveStateSettings(),
    states: Array.from(inMemoryFileStateCache.entries()).map(([key, value]) => ({ key, value }))
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function importStateMemoryBackup(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.states)) return false;

    if (parsed.settings) {
      saveSaveStateSettings(parsed.settings);
    }

    for (const item of parsed.states) {
      if (item.key && item.value) {
        saveFileState(item.key, item.value);
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to import state memory backup:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Session State
// ─────────────────────────────────────────────────────────────────────────────

export function saveGlobalSession(state: Partial<GlobalSessionState>): void {
  try {
    const existing = getGlobalSession();
    const updated = { ...existing, ...state, lastSavedAt: Date.now() };
    localStorage.setItem(GLOBAL_SESSION_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save global session:', err);
  }
}

export function getGlobalSession(): GlobalSessionState {
  try {
    const raw = localStorage.getItem(GLOBAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to get global session:', err);
    return {};
  }
}

// ──────── Internal Helper Functions ────────

function getExtensionFromKey(fileKey: string): string {
  const parts = fileKey.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

function isFormatStateEnabled(ext: string, settings: ViewerSaveStateSettings): boolean {
  if (['md', 'markdown'].includes(ext)) return settings.mdEnabled;
  if (ext === 'pdf') return settings.pdfEnabled;
  if (['docx', 'doc'].includes(ext)) return settings.docxEnabled;
  if (['pptx', 'ppt'].includes(ext)) return settings.pptxEnabled;
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'css', 'html', 'c', 'cpp', 'java', 'go', 'rs'].includes(ext)) return settings.codeEnabled;
  if (ext === 'csv') return settings.csvEnabled;
  if (['mp4', 'webm', 'mp3', 'png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) return settings.mediaEnabled;
  return true;
}

function matchesFormatExtension(ext: string, target: 'md' | 'pdf' | 'docx' | 'pptx' | 'code' | 'csv' | 'media'): boolean {
  if (target === 'md') return ['md', 'markdown'].includes(ext);
  if (target === 'pdf') return ext === 'pdf';
  if (target === 'docx') return ['docx', 'doc'].includes(ext);
  if (target === 'pptx') return ['pptx', 'ppt'].includes(ext);
  if (target === 'code') return ['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'css', 'html', 'c', 'cpp', 'java', 'go', 'rs'].includes(ext);
  if (target === 'csv') return ext === 'csv';
  if (target === 'media') return ['mp4', 'webm', 'mp3', 'png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext);
  return false;
}
