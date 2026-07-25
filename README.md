# 📚 NoteStack — Academic Knowledge Vault & Multi-Format Note Manager

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43.2.0-4785D4?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.1.5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/KaTeX-0.18.1-006400?style=for-the-badge&logo=latex&logoColor=white" alt="KaTeX" />
  <img src="https://img.shields.io/badge/OpenXML-PowerPoint-D24726?style=for-the-badge&logo=microsoftpowerpoint&logoColor=white" alt="PowerPoint" />
</p>

**NoteStack** is a state-of-the-art desktop academic knowledge manager built with **Electron**, **React 19**, **TypeScript**, and **Vite**. It functions as a local local-first vault for managing Markdown notes, PowerPoint presentations (`.pptx`), textbook PDFs, program code files, CSV datasets, DOCX documents, images, and videos in a single unified workspace.

---

## 🌟 Key Features

### 📊 1. PowerPoint Presentation Engine (`.pptx`)
- **Native OpenXML ZIP Extraction**: Parses binary `.pptx` archives directly in the browser/Electron environment using `JSZip` and XML `DOMParser`.
- **Embedded Hero Media Display**: Extracts embedded images (`ppt/media/*`) into Base64 Data URLs mapped to internal slide relationship IDs (`rId`).
- **OpenXML Paragraph Classification**: Inspects paragraph properties (`a:pPr`) to distinguish bullet items (`a:buChar`, `a:buAutoNum`, indent `lvl`) from standard body text paragraphs.
- **Exact OpenXML Font Size (`sz`) Typography**: Extracts font size attributes `sz` (in hundredths of a pt) to preserve exact presentation font size proportions.
- **5 Professional View Modes**:
  - 🎬 **Stream Mode**: Magazine continuous reader with full-width 3D slide cards.
  - 🎛️ **Grid Sorter Mode**: Keynote Light Table slide sorter with live thumbnail cards.
  - 🎭 **Stage Focus Mode**: Single slide presenter deck with speaker notes drawer & keyboard navigation.
  - 📝 **Split Notes Mode**: Dual-pane study interface with active slide on the left and an integrated Markdown study scratchpad on the right.
  - 📖 **Outline Mode**: High-density condensed text and diagram summary.

### 📝 2. Claude & ChatGPT-Grade Markdown Viewer & Editor
- **Full-Screen Canvas Layout**: Pure 100% edge-to-edge reading and editing canvas with zero unrendered blank gaps.
- **ChatGPT-Style Equations**: Native **KaTeX** integration for display math equations (`$$ ... $$`) rendered as clean, centered formulas, alongside seamless inline math (`$ ... $`).
- **Callout Cards**: Support for GitHub-style alerts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`).
- **Interactive Checklists & Code Blocks**: Rendered GFM task checkboxes and 1-click `📋 Copy Code` buttons with visual confirmation.
- **Debounced Save System**: Auto-saves to disk 1 second after typing stops, keeping the UI fast and responsive without cursor-jumping bugs.

### 📄 3. MS Edge PDF Reader & Split-Screen Study Mode
- **Native MS Edge Engine**: Renders PDFs using Electron's native Chromium PDF renderer with continuous scroll, page thumbnails sidebar, and search.
- **Split PDF Note Mode**: Side-by-side view featuring an embedded PDF reference on the left and a live Markdown note editor on the right.
- **Folder-Scoped PDF Selector**: Quick dropdown selector in split view that filters to display only PDFs located inside the exact same folder as the active note.

### 💻 4. VS Code-Grade Code Editor
- **Multi-Language Support**: Specialized code editing for `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.rs`, `.go`, `.sh`, `.sql`, `.html`, `.css`, and `.json`.
- **Custom Line-Number Column**: Line-numbered sidebar with font size scaling (`-` / `+`), language badges, and 1-click copy code.

### 📈 5. CSV Data Grid & External App Launcher
- **Dual-View Data Grid**: Toggle between an **Airtable-style Data Grid** (with sticky headers, row search/filtering, and inline cell editing) and a **Raw CSV Editor**.
- **External App Launcher**: 1-click **`Open in External App`** button that opens datasets directly in Microsoft Excel, VS Code, or system default applications.
- **Crash Protection**: Auto-detects large CSV datasets (>300 KB or 2,500+ rows) and safely caps preview rendering to prevent UI freezes.

### 🎴 6. Active Recall 3D Flashcards
- **Anki/Quizlet-Style Flashcards**: Automatically extracts questions and headings from Markdown notes into interactive active-recall flashcards.
- **3D Card Flip Animation**: Smooth CSS `preserve-3d` flip animation revealing question fronts and answer backs.
- **Spaced Repetition Rating**: Difficulty buttons (`1 · Hard`, `2 · Good`, `3 · Easy`) with keyboard navigation (`Space` to flip, `1/2/3` to rate).

### 📄 7. Word DOCX, Image & Video Players
- **DOCX Reader**: Mammoth-powered Word document rendering inside a clean paper canvas layout with 1-click document printing.
- **Lightroom-Style Image Canvas**: Zoom (-/+ 25%), scale reset, and 90° image rotation with `URL.revokeObjectURL` RAM memory cleanup.
- **Video Note Scratchpad**: Custom video player controls with playback speed options (0.5x to 2x) and 1-click timestamp note bookmarking.

### 📁 8. Clean Folder Explorer & Theme Synchronization
- **Dedicated PPT Sidebar Branding**: Orange `Presentation` icon for `.pptx` presentation files in the folder explorer tree.
- **Main App Theme Sync**: Automatically synchronizes all viewers with NoteStack's 4 core themes (**Dark**, **Light**, **Sepia**, and **Nord**).
- **Persistent State Memory**: Restores slide position, scroll offset, zoom scale, view modes, and notes via `stateMemory.ts`.

---

## 📂 Project Directory Structure

```
notestack/
├── electron/
│   ├── main.cjs            # Electron main process (IPC handlers, disk scanning, shell.openPath)
│   └── preload.cjs         # Context bridge exposing electronAPI to React frontend
├── src/
│   ├── components/
│   │   ├── CodeEditor.tsx          # VS Code-grade code editor with line numbers
│   │   ├── CreateFolderModal.tsx   # Modal dialog for creating new folders/subfolders
│   │   ├── CreateNoteModal.tsx     # Modal dialog for creating .md or program code files
│   │   ├── CsvViewer.tsx           # CSV Data Grid with row search & Excel launcher
│   │   ├── DashboardOverview.tsx   # Workspace hero dashboard with vault metrics
│   │   ├── DocxViewer.tsx          # Word .docx paper view & print engine
│   │   ├── FlashcardsModal.tsx     # 3D interactive flashcards with keyboard shortcuts
│   │   ├── HeaderBar.tsx           # Top navigation bar with breadcrumbs & theme toggles
│   │   ├── ImageViewer.tsx         # Image canvas with zoom/rotate controls
│   │   ├── MarkdownViewer.tsx      # Claude/ChatGPT Markdown & KaTeX rendering engine
│   │   ├── PdfViewer.tsx           # MS Edge Chromium PDF embed viewer
│   │   ├── PptxViewer.tsx          # OpenXML PowerPoint presentation engine & 5 view modes
│   │   ├── Sidebar.tsx             # Folder tree explorer with right-click context menu & PPT branding
│   │   ├── SplitPdfNoteView.tsx    # Side-by-side PDF reference & Markdown editor
│   │   └── VideoViewer.tsx         # Video player with timestamped note scratchpad
│   ├── utils/
│   │   ├── fileSystem.ts           # File System Access API & disk persistence handlers
│   │   ├── markdownUtils.ts        # Custom Marked renderer, KaTeX, Callouts, Flashcard parser
│   │   ├── sampleData.ts           # Sample vault fallback datasets
│   │   └── stateMemory.ts          # Unified state memory persistence for slide & scroll positions
│   ├── App.tsx                     # Master layout orchestrator & state manager
│   ├── index.css                   # Global CSS design system tokens & viewer themes
│   ├── main.tsx                    # React application entry point
│   └── types.ts                    # TypeScript interface & Window.electronAPI declarations
├── viewer_working.md               # Detailed technical architecture guide for all viewers
├── index.html                      # HTML root template
├── package.json                    # Dependencies & build scripts
├── tsconfig.json                   # TypeScript compiler configuration
└── vite.config.ts                  # Vite bundler configuration
```

---

## 🛠️ Installation & Development Setup

### Prerequisites
- **Node.js** v18+ 
- **npm** or **yarn**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/notestack.git
cd notestack
npm install
```

### 2. Run in Development Mode
Launch Vite dev server alongside Electron:
```bash
npm run electron:dev
```
*Or run as a web application in your browser:*
```bash
npm run dev
```

### 3. Build Web Application Bundle
```bash
npm run build
```

### 4. Package Windows Executable (`.exe`)
```bash
npx electron-packager . NoteStack --platform=win32 --arch=x64 --out=dist_app --overwrite
```
The packaged desktop application will be written to `dist_app/NoteStack-win32-x64/NoteStack.exe`.

---

## ⌨️ Keyboard Shortcuts & Controls

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `ArrowRight` / `ArrowDown` / `Space` | Next Slide | PPT Viewer Stage / Stream |
| `ArrowLeft` / `ArrowUp` | Previous Slide | PPT Viewer Stage / Stream |
| `F` | Toggle Fullscreen | PPT Viewer |
| `Space` | Flip Flashcard Front/Back | Flashcard Modal |
| `1`, `2`, `3` | Rate Difficulty (Hard, Good, Easy) | Flashcard Modal |
| `Esc` | Close Modal / Menu | Modals & Context Menus |
| `Right-Click` | Open Context Menu (Create, Star, Delete) | Sidebar File Tree |

---

## 📄 Documentation Links
- [viewer_working.md](file:///C:/Users/akhil/Downloads/notestack/viewer_working.md) — In-depth technical architecture breakdown of all NoteStack file viewers.

---

## 🎨 Tech Stack & Libraries

- **Desktop Framework**: Electron 43.2.0
- **UI Framework**: React 19, Lucide React Icons
- **Language**: TypeScript 6.0
- **Bundler**: Vite 8.1
- **Presentation Engine**: JSZip 3.10, DOMParser (OpenXML)
- **Markdown & Math**: Marked 18.0, KaTeX 0.18
- **Document Parsing**: Mammoth 1.12 (DOCX)

---

## 📄 License
This project is licensed under the MIT License — see the LICENSE file for details.
