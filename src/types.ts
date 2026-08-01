export type FileType = 'folder' | 'md' | 'pdf' | 'docx' | 'pptx' | 'image' | 'video' | 'code' | 'csv' | 'other';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  fullPath?: string;
  type: FileType;
  extension: string;
  size?: number;
  lastModified?: number;
  content?: string;
  arrayBuffer?: ArrayBuffer;
  url?: string;
  moduleName?: string;
  children?: FileItem[];
  handle?: any;
  isFavorite?: boolean;
  tags?: string[];
}

export interface MainDirectorySummary {
  name: string;
  path: string;
  fileCount: number;
}

export interface MainDirectory {
  name: string;
  path: string;
  handle?: any;
  subDirectories: string[];
  files: FileItem[];
  allVaults?: MainDirectorySummary[];
}

export interface ReadingSettings {
  theme: 'dark' | 'light' | 'sepia' | 'nord' | 'full-black';
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  bionicReading: boolean;
  showToc: boolean;
  speedReadingActive: boolean;
  speedReadingWpm: number;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  moduleName?: string;
  sourceNote?: string;
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

export type ViewMode = 'dashboard' | 'split' | 'preview' | 'focus' | 'split-pdf';

export interface PdfAnnotation {
  id: string;
  pdfFileName: string;
  pageNumber: number;
  x: number;
  y: number;
  text: string;
  color: string;
  type: 'sticky' | 'highlight';
  createdAt: number;
}

export interface PdfBookmark {
  id: string;
  pdfFileName: string;
  pageNumber: number;
  title: string;
}

declare global {
  interface Window {
    electronAPI?: {
      openDirectoryDialog: () => Promise<any>;
      scanDirectory: (path: string) => Promise<any>;
      getSavedDirectory: () => Promise<any>;
      saveVaultList: (vaults: any[]) => Promise<any>;
      removeSavedVault: (vaultPath: string) => Promise<any>;
      readFileText: (path: string) => Promise<string | null>;
      readFileBuffer: (path: string) => Promise<ArrayBuffer | null>;
      writeFileText: (path: string, content: string) => Promise<boolean>;
      createNewFile: (parentPath: string, fileName: string, content: string) => Promise<any>;
      createNewFolder: (parentPath: string, folderName: string) => Promise<any>;
      openExternalFile: (filePath: string) => Promise<string>;
      deleteItem: (itemPath: string) => Promise<boolean>;
      renameItem: (oldPath: string, newName: string) => Promise<{ success: boolean; newPath?: string; newName?: string; error?: string }>;
    };
  }
}
