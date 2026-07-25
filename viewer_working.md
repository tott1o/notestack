# NoteStack Viewer Architecture & Technical Working Guide

This document provides a comprehensive technical overview of the rendering engines, parsing pipelines, state memory mechanisms, and optimization strategies powering every file viewer in **NoteStack**.

---

## 1. 📊 PowerPoint Presentation Engine (`PptxViewer.tsx`)

### Architecture Overview
The PowerPoint engine parses binary `.pptx` archives directly in the browser/Electron environment without external server dependencies, converting OpenXML presentation data into interactive, themed React components.

```
.pptx File (ZIP Buffer)
 ├── JSZip Unzipper
 ├── Extract ppt/slides/slideN.xml ────► DOMParser (XML AST)
 ├── Extract ppt/slides/_rels/*.rels ──► Relationship Media Mapping
 └── Extract ppt/media/* ─────────────► Base64 Data URL Converter
                                             │
                                             ▼
                                  OpenXML Content Parser
                                  ├── sz (Font Size in 100th pt)
                                  ├── a:pPr (Bullet vs Paragraph)
                                  └── Slide Master 3D Canvas
```

### Key Technical Components & Mechanics
1. **OpenXML Archive Extraction (`JSZip`)**:
   - Reads `file.arrayBuffer` or fetches the file directly via `file:///` URI protocol.
   - Iterates through `ppt/slides/slideN.xml` sorted numerically (`slide1.xml`, `slide2.xml`, etc.).
   - Extracts embedded images (`ppt/media/*`) and converts them into `data:image/*;base64` Data URLs mapped to internal relationship IDs (`rId`).

2. **OpenXML Text Element Classification**:
   - Inspects paragraph properties (`a:pPr`):
     - Checks for `a:buChar`, `a:buAutoNum`, indent level `lvl > 0`, or text starting with bullet symbols (`•`, `-`, `*`).
     - **Bullet Items**: Classified as `type: 'bullet'` and rendered inside indented bullet point list structures with level offsets (`level * 24px`).
     - **Body Text**: Paragraphs with `a:buNone` or no bullet tags are classified as `type: 'paragraph'` and rendered in standard `<p>` typography blocks.

3. **OpenXML Font Size (`sz`) Typography Engine**:
   - Extracts font size attributes `sz` from text run properties (`a:rPr`) and paragraph default properties (`a:defRPr`).
   - In OpenXML, font size `sz` is stored in **hundredths of a point** (`1 pt = 100 sz`).
   - **Conversion Formula**:
     $$\text{fontSizeRem} = \left(\frac{\text{sz}}{100} \times 0.082 \times \text{fontScaleRatio} \times \text{zoomScale}\right)\text{rem}$$
   - Preserves exact slide title sizes (`36–44pt`), subtitles (`22–26pt`), and body text proportions (`16–20pt`).

4. **5 View Modes**:
   - **Stream Mode**: Magazine continuous reader with full-width 3D slide cards.
   - **Grid Sorter Mode**: Keynote Light Table slide sorter with live thumbnail cards.
   - **Stage Focus Mode**: Single slide presenter deck with presenter notes drawer & keyboard navigation (`ArrowKeys`, `Space`).
   - **Split Notes Mode**: Dual-pane study interface with active slide on the left and an integrated Markdown study scratchpad on the right.
   - **Outline Mode**: High-density condensed outline view.

5. **Post-Load State Restoration & Observer Shield**:
   - Uses `hasRestoredRef` shield to prevent `IntersectionObserver` from overriding user scroll position during initial asynchronous layout.
   - Restores `currentSlide`, `scrollTop`, `viewMode`, `zoomScale`, and `fontScaleRatio` from `stateMemory.ts`.

---

## 2. 📝 Markdown Viewer & Studio Editor (`MarkdownViewer.tsx` & `markdownUtils.ts`)

### Architecture Overview
A high-performance GFM (GitHub Flavored Markdown) and Obsidian-quality rendering engine with live split-pane sync scrolling, LaTeX math parsing, and debounced disk synchronization.

### Key Technical Components & Mechanics
1. **Parser & Tokenizer Pipeline (`markdownUtils.ts`)**:
   - Pre-processes Markdown string to parse:
     - **KaTeX Math Blocks**: `$inline$` and `$$display$$` math expressions.
     - **Callout Admonitions**: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`.
     - **Task Lists**: `- [ ]` and `- [x]` interactive checkboxes.
     - **Syntax Code Blocks**: Backtick fenced code blocks with language detection and copy buttons.
     - **Table of Contents**: Dynamically generated heading hierarchy (`H1` to `H6`).

2. **Debounced Disk Writes & Zero Cursor Jumping**:
   - UI state updates immediately on character entry (`activeFile.content`).
   - Disk write (`saveFileToDisk`) and vault tree update are debounced by 1000ms after the user stops typing to eliminate disk thrashing and cursor jumping bugs.

3. **Synchronized Dual Scroll (Split View)**:
   - Tracks relative scroll percentage between raw `<textarea>` and preview pane:
     $$\text{ScrollPercentage} = \frac{\text{scrollTop}}{\text{scrollHeight} - \text{clientHeight}}$$
   - Synchronizes preview scroll position seamlessly without infinite scroll loops.

---

## 3. 📄 PDF Document Engine (`PdfViewer.tsx` & `SplitPdfNoteView.tsx`)

### Architecture Overview
Integrates `pdfjs-dist` to render vector PDF pages into HTML5 Canvases with high-DPI resolution adjustment.

### Key Technical Components & Mechanics
1. **High-DPI Canvas Rendering**:
   - Multiplies viewport scale by `window.devicePixelRatio` (e.g. 2.0 on Retina / 4K displays) to prevent text blurring.
   - Renders page layers asynchronously using `pdfPage.render({ canvasContext, viewport })`.

2. **Persistent State Memory**:
   - Saves active page number (`pageNumber`) and vertical scroll offset (`scrollTop`) per file key in `localStorage` via `stateMemory.ts`.

3. **Split Note Workspace (`SplitPdfNoteView.tsx`)**:
   - Embeds PDF viewer on the left and a live Markdown study notes editor on the right, saving notes under `fileState.studyNotes`.

---

## 4. 📰 Rich Text / Word Document Engine (`DocxViewer.tsx`)

### Architecture Overview
Parses OpenXML Microsoft Word (`.docx`) files into semantic HTML using `mammoth.js`.

### Key Technical Components & Mechanics
1. **OpenXML to Semantic HTML**:
   - Transforms word processing XML structures (`w:p`, `w:r`, `w:tbl`) into standard HTML elements (`<h1>`, `<p>`, `<table>`, `<img>`).
   - Converts embedded Word images into Base64 inline images.

2. **Typography Styling**:
   - Applies clean document framing with max-width constraints (`820px`), line-height (`1.7`), and font hierarchy.

---

## 5. 📈 Data & CSV Analytics Engine (`CsvViewer.tsx`)

### Architecture Overview
Parses tabular dataset files (`.csv`, `.tsv`) into interactive data tables with search, column sorting, and cell editing.

### Key Technical Components & Mechanics
1. **RFC 4180 CSV Parsing**:
   - Delimiter detection (commas, tabs, semicolons) and escape character handling.
2. **Interactive Data Table**:
   - Sticky headers with column sort triggers (Ascending / Descending).
   - Dynamic search filtering across all data fields.
   - Zebra striping and theme-aware cell highlight states.

---

## 6. 💻 Code Editor Engine (`CodeEditor.tsx`)

### Architecture Overview
A lightweight IDE code viewer/editor supporting over 25 programming languages.

### Key Technical Components & Mechanics
1. **Syntax Highlighting & Tokenizing**:
   - Uses Prism.js / CodeMirror tokenizers for language keywords, strings, comments, and functions.
2. **Editor Features**:
   - Monospace line numbering container synced with code line breaks.
   - Indentation guides and active line highlights.
   - Font size scale controls and line wrap toggles.

---

## 7. 🖼️ & 🎥 Media Engine (`ImageViewer.tsx` & `VideoViewer.tsx`)

### Architecture Overview
Provides media inspection tools for graphic assets and video lectures.

### Key Technical Components & Mechanics
1. **Image Engine (`ImageViewer.tsx`)**:
   - Pan/zoom stage (`zoomScale`, `positionX`, `positionY`).
   - Metadata overlay (resolution width x height, file size, format).
   - Background grid toggle for transparent PNG/SVG assets.

2. **Video Player (`VideoViewer.tsx`)**:
   - HTML5 Video Element wrapper with custom controls overlay.
   - Variable playback speed controls (`0.5x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
   - Timestamp bookmarking for quick lesson review.

---

## 💾 Global State Memory System (`utils/stateMemory.ts`)

All viewers interface with a unified state persistence layer (`stateMemory.ts`):

```ts
export interface FileState {
  scrollTop?: number;
  pageNumber?: number;
  currentSlide?: number;
  currentTime?: number;
  zoomLevel?: number;
  zoom?: number;
  viewMode?: string;
  searchQuery?: string;
  studyNotes?: string;
  fontScaleRatio?: number;
  showFilmstrip?: boolean;
  showNotes?: boolean;
  lastOpenedAt?: number;
}
```

- Keyed by absolute file path (`file.fullPath`) or file ID (`file.id`).
- Automatically written on user interaction and restored on initial frame render.
