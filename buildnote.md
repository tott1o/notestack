# 📚 NoteStack - Build & Architecture Documentation

## 🌟 Executive Overview
**NoteStack** is a high-performance, local-first academic note organization and reference document management desktop application designed specifically for college students.

It allows students to organize local Markdown (`.md`) lecture notes, reference textbooks (`.pdf`), course syllabi (`.docx`), programming source code files (`.py`, `.c`, `.cpp`, `.java`, `.js`, `.ts`, `.html`, `.css`, `.json`, `.txt`, `.rs`, `.go`, `.sh`, `.sql`), media diagrams (`.png`, `.jpg`, `.svg`, `.webp`), and video lecture recordings (`.mp4`, `.webm`, `.mov`), with multi-vault local directory persistence, LaTeX math rendering, Bionic speed reading, active recall study flashcards, and dedicated reading themes.

---

## 🛠️ Key Application Features

### 1. Programming Language Code Editor (`.py`, `.c`, `.cpp`, `.java`, `.js`, `.ts`, `.txt`...)
- **Multi-Language Syntax Support**: Full code editing & viewing for Python (`.py`), C (`.c`), C++ (`.cpp`), Java (`.java`), JavaScript (`.js`), TypeScript (`.ts`), HTML (`.html`), CSS (`.css`), JSON (`.json`), Rust (`.rs`), Go (`.go`), Shell script (`.sh`), SQL (`.sql`), Plain Text (`.txt`), XML (`.xml`), and YAML (`.yaml`).
- **Line Numbers & Custom Font Sizing**: Adjustable font sizes (12px – 20px) with custom line numbering and tab-indentation support.
- **Copy & Save Code**: 1-click **Copy Code** and **Save Code File** directly back to local disk.

### 2. PNG & Media Image Viewer (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`)
- **High-Resolution Canvas**: Displays local diagram assets, lecture slides, and images with crisp rendering.
- **Controls**: Zoom in/out, 100% reset scale, rotate 90°, file size info, light/dark backdrop toggle, and 1-click **Download Image**.

### 3. Video Lecture Viewer & Scratchpad (`.mp4`, `.webm`, `.mov`, `.mkv`)
- **Speed Watching Controls**: Watch lecture recordings at **0.75x, 1.0x, 1.25x, 1.5x, or 2.0x** speed.
- **Interactive Player**: Seek bar, -10s rewind, +10s forward, volume control, and fullscreen mode.
- **Side Lecture Note Drawer**: Type study notes while watching the video lecture and click **Export Lecture Notes to .md**!

### 4. Multi-Vault Directory Memory & Persistence
- **Persistent Local Collection Root**: Select your main notes directory (e.g. `C:\Users\Student\Documents\College-Vault`) once.
- **IndexedDB & Config Memory**: Remembers **all** previously selected main directories (`savedVaults`) in `%APPDATA%/notestack/notestack-config.json` (Desktop mode) and IndexedDB (Web mode).
- **Vault Switcher Dropdown**: Easily switch between saved notebook vaults directly from the sidebar.
- **Subdirectory Modules**: Automatically scans and displays course modules/lessons (`CS101 - Algorithms`, `PHYS201 - Quantum Mechanics`, `MATH302 - Linear Algebra`).
- **Collapsed Folders Default**: Module folders start closed by default in the sidebar tree view.

### 5. Markdown Note Editor & Fast Reader (`.md`)
- **LaTeX Math Equations**: Render complex mathematical formulas and equations inline (`$E=mc^2$`) and block (`$$\frac{\partial \Psi}{\partial t} = \hat{H}\Psi$$`) powered by KaTeX.
- **Bionic Speed Reading Mode**: Highlights the initial letters of words to increase reading speed and reduce eye fatigue.
- **Editor Toolbar**: Quick controls for bold, italics, headings, math formulas, code blocks with syntax highlighting, tables, checklists, and admonition callout boxes (`> [!NOTE]`).
- **Active Recall Flashcards**: Automatically parses questions, definitions, and headers from notes into interactive 3D flip flashcards for exam preparation.
- **Create Note Modal**: Custom modal dialog for creating new notes cleanly in Electron desktop app.

### 6. PDF Reference Book Viewer (`.pdf`)
- **Reliable HTML5 PDF Engine**: Renders PDF textbooks and slides offline with zero CORS or CDN network dependencies.
- **Reading Themes**: Dark Night Mode (🌙), Sepia Comfort Warm Mode (📜), and Original Light Mode (☀️).
- **Study Notes & Margin Drawer**: Attach study notes to specific pages and bookmark key pages.
- **1-Click Export to Markdown**: Export all PDF margin notes and page bookmarks directly into a structured `.md` study note.

### 7. DOCX Document Reader (`.docx`)
- Integrates `mammoth.js` to parse Microsoft Word documents into clean formatted HTML paper layouts.

---

## ⚙️ Technology Stack & Architecture

- **UI Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Vanilla CSS Design System with CSS Custom Properties, Dark Mode, Glassmorphism, and Google Fonts (`Outfit`, `Inter`, `Fira Code`).
- **Math Engine**: KaTeX (`katex`)
- **Markdown Parser**: Marked (`marked`)
- **DOCX Parser**: Mammoth (`mammoth`)
- **Desktop Runtime**: Electron (`electron`)
- **Desktop Builder**: Electron Packager (`@electron/packager`)
- **Web Persistence**: `idb-keyval` (IndexedDB FileSystemDirectoryHandle storage)

---

## 💻 Building & Running Commands

All commands should be executed from the project root directory (`C:\Users\akhil\Downloads\notestack`):

### 1. Development Commands
```bash
# Run local Vite web development server
npm run dev

# Run Electron desktop app in development mode
npm run electron:dev
```

### 2. Production Web Build
```bash
# Compile TypeScript and build web production bundle to dist/
npm run build
```

### 3. Build Desktop Application Executable (.exe)
```bash
# Step 1: Compile web production bundle
npm run build

# Step 2: Package standalone Windows Desktop Executable (.exe)
npx electron-packager . NoteStack --platform=win32 --arch=x64 --out=dist_app --overwrite
```

*The generated executable is output to:*
`dist_app\NoteStack-win32-x64\NoteStack.exe`

### 4. Create Desktop & Start Menu Shortcuts
```bash
# Run PowerShell script to install NoteStack shortcut to Windows Desktop and Start Menu
powershell -ExecutionPolicy Bypass -File .\Create-Desktop-Shortcut.ps1
```

---

## 📁 Project Directory Map

```
notestack/
├── dist_app/
│   └── NoteStack-win32-x64/
│       └── NoteStack.exe             # Standalone Windows Executable
├── electron/
│   ├── main.cjs                      # Electron Main Process (IPC, config, fs scanner)
│   └── preload.cjs                   # Safe contextBridge IPC wrapper
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx               # Folder tree & Vault Switcher dropdown & filter pills
│   │   ├── HeaderBar.tsx             # Breadcrumbs, theme selector, view modes
│   │   ├── MarkdownViewer.tsx        # Editor, live preview, KaTeX math, Bionic reading
│   │   ├── CodeEditor.tsx            # Multi-language programming code editor (.py, .c, .java, etc.)
│   │   ├── ImageViewer.tsx           # PNG/JPG image viewer with zoom & rotation
│   │   ├── VideoViewer.tsx           # Video lecture player with speed watch & lecture notes
│   │   ├── PdfViewer.tsx             # PDF reader with dark/sepia themes & margin notes
│   │   ├── DocxViewer.tsx            # Word document reader
│   │   ├── SplitPdfNoteView.tsx      # Side-by-side PDF + Markdown note taking
│   │   ├── DashboardOverview.tsx     # Welcome workspace dashboard & statistics
│   │   ├── CreateNoteModal.tsx       # Custom Create Note modal dialog
│   │   └── FlashcardsModal.tsx       # Active recall 3D flip card study modal
│   ├── utils/
│   │   ├── fileSystem.ts             # Multi-vault storage & multi-format file scanners
│   │   ├── markdownUtils.ts          # Bionic reading, KaTeX renderer, flashcards
│   │   └── sampleData.ts             # Empty main directory initial state
│   ├── App.tsx                       # Main application state & multi-format routing
│   ├── index.css                     # Design system stylesheet
│   ├── main.tsx                      # React entry point
│   └── types.ts                      # Core TypeScript interface definitions
├── buildnote.md                      # Build & architecture reference guide
├── Create-Desktop-Shortcut.ps1       # Desktop shortcut installer script
├── NoteStack-Desktop-Launcher.bat    # Double-clickable Windows batch launcher
├── package.json                      # Dependencies and build scripts
└── vite.config.ts                    # Vite config with base: './' for Electron file://
```

---

*NoteStack — Built for fast, organized college study & research.*
