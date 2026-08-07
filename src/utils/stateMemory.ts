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

export interface ViewerSaveStateSettings {
  mdEnabled: boolean;
  mdInterval: number; // ms
  pdfEnabled: boolean;
  pdfInterval: number; // ms
  docxEnabled: boolean;
  docxInterval: number; // ms
  pptxEnabled: boolean;
  pptxInterval: number; // ms
}

const DEFAULT_VIEWER_SAVE_SETTINGS: ViewerSaveStateSettings = {
  mdEnabled: true,
  mdInterval: 500,
  pdfEnabled: true,
  pdfInterval: 400,
  docxEnabled: true,
  docxInterval: 400,
  pptxEnabled: true,
  pptxInterval: 400
};

const VIEWER_SETTINGS_KEY = 'notestack_viewer_save_settings_v1';

export function getSaveStateSettings(): ViewerSaveStateSettings {
  try {
    const raw = localStorage.getItem(VIEWER_SETTINGS_KEY);
    return raw ? { ...DEFAULT_VIEWER_SAVE_SETTINGS, ...JSON.parse(raw) } : DEFAULT_VIEWER_SAVE_SETTINGS;
  } catch (err) {
    return DEFAULT_VIEWER_SAVE_SETTINGS;
  }
}

export function clearFileTypeStates(extension: 'md' | 'pdf' | 'docx' | 'pptx'): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FILE_STATE_PREFIX)) {
        const decodedKey = decodeURIComponent(key.replace(FILE_STATE_PREFIX, '')).toLowerCase();
        if (
          (extension === 'md' && (decodedKey.endsWith('.md') || decodedKey.endsWith('.markdown'))) ||
          (extension === 'pdf' && decodedKey.endsWith('.pdf')) ||
          (extension === 'docx' && (decodedKey.endsWith('.docx') || decodedKey.endsWith('.doc'))) ||
          (extension === 'pptx' && (decodedKey.endsWith('.pptx') || decodedKey.endsWith('.ppt')))
        ) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error(`Failed to clear saved states for file type .${extension}:`, err);
  }
}

export function saveSaveStateSettings(settings: Partial<ViewerSaveStateSettings>): void {
  try {
    const existing = getSaveStateSettings();
    const updated = { ...existing, ...settings };
    localStorage.setItem(VIEWER_SETTINGS_KEY, JSON.stringify(updated));

    // Clear cached states if any format toggle was just disabled
    if (settings.mdEnabled === false) clearFileTypeStates('md');
    if (settings.pdfEnabled === false) clearFileTypeStates('pdf');
    if (settings.docxEnabled === false) clearFileTypeStates('docx');
    if (settings.pptxEnabled === false) clearFileTypeStates('pptx');
  } catch (err) {
    console.error("Failed to save viewer state settings:", err);
  }
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
