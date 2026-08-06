// Persistent State Memory Utility for NoteStack
// Saves global session state (active file, view mode, expanded folders) 
// and per-file position memory (scroll position, PDF page, video timestamp, code cursor)

export interface FileState {
  scrollTop?: number;
  pageNumber?: number;
  currentSlide?: number;
  currentTime?: number;
  cursorStart?: number;
  cursorEnd?: number;
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
}

const GLOBAL_SESSION_KEY = 'notestack_global_session_v1';
const FILE_STATE_PREFIX = 'notestack_file_state_';

// --- Global Session Persistence ---
export function saveGlobalSession(state: Partial<GlobalSessionState>): void {
  try {
    const existing = getGlobalSession();
    const updated = { ...existing, ...state };
    localStorage.setItem(GLOBAL_SESSION_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save global session:", err);
  }
}

export function getGlobalSession(): GlobalSessionState {
  try {
    const raw = localStorage.getItem(GLOBAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to get global session:", err);
    return {};
  }
}

function normalizeFileKey(fileKey: string): string {
  if (!fileKey) return '';
  return fileKey.replace(/\\/g, '/').toLowerCase().trim();
}

// --- Per-File State Memory Persistence ---
export function saveFileState(fileKey: string, state: Partial<FileState>): void {
  if (!fileKey) return;
  const normalizedKey = normalizeFileKey(fileKey);
  try {
    const key = `${FILE_STATE_PREFIX}${encodeURIComponent(normalizedKey)}`;
    const existing = getFileState(fileKey);
    const updated: FileState = {
      ...existing,
      ...state,
      lastOpenedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error(`Failed to save file state for ${fileKey}:`, err);
  }
}

export function getFileState(fileKey: string): FileState {
  if (!fileKey) return {};
  const normalizedKey = normalizeFileKey(fileKey);
  try {
    const key = `${FILE_STATE_PREFIX}${encodeURIComponent(normalizedKey)}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`Failed to get file state for ${fileKey}:`, err);
    return {};
  }
}
