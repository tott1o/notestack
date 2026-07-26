import { marked } from 'marked';
import katex from 'katex';
import type { Flashcard, TableOfContentsItem } from '../types';

// Study-Optimized Markdown Renderer
// Theme-synced, academic-grade markdown renderer with section wrappers, math equation cards, terminal code blocks, and callout cards.
const renderer = new marked.Renderer();

// ─── Code Terminal Block Renderer ───────────────────────────────────────────
renderer.code = function({ text = '', lang }: { text?: string; lang?: string }) {
  const safeText = text || '';
  const language = (lang || 'code').toLowerCase();
  const lines = safeText.split('\n');
  const lineCount = lines.length;
  const escapedText = safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const lineNums = lines.map((_, i) => `<span class="code-ln">${i + 1}</span>`).join('\n');

  return `
    <div class="code-terminal">
      <div class="code-terminal-glow"></div>
      <div class="code-terminal-bar">
        <div class="code-terminal-left">
          <svg class="code-terminal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span class="code-terminal-lang">${language}</span>
        </div>
        <div class="code-terminal-right">
          <span class="code-terminal-meta">${lineCount} lines</span>
          <button class="copy-code-btn" data-code="${encodeURIComponent(safeText)}">
            📋 Copy Code
          </button>
        </div>
      </div>
      <div class="code-terminal-body">
        <div class="code-terminal-gutter">${lineNums}</div>
        <pre class="code-terminal-pre"><code>${escapedText}</code></pre>
      </div>
    </div>
  `;
};

// ─── Headings with Section Wrappers ─────────────────────────────────────────
renderer.heading = function({ text = '', depth }: { text?: string; depth: number }) {
  const safeText = text || 'heading';
  const cleanText = safeText.replace(/<[^>]*>/g, '');
  const id = `heading-${cleanText.toLowerCase().replace(/[^\w]+/g, '-')}`;

  return `
    <div class="study-heading-section study-h${depth}-section" id="${id}">
      <div class="study-heading-accent h${depth}-accent"></div>
      <h${depth} class="study-heading study-h${depth}">${safeText}</h${depth}>
    </div>
  `;
};

// ─── Checkbox / Task List ────────────────────────────────────────────────────
renderer.checkbox = function({ checked }: { checked: boolean }) {
  const cls = checked ? 'study-checkbox checked' : 'study-checkbox';
  return `<input type="checkbox" class="${cls}" ${checked ? 'checked' : ''} disabled />`;
};

// ─── Horizontal Rule (Thick Section Divider) ─────────────────────────────────
renderer.hr = function() {
  return `<div class="study-divider"><div class="study-divider-line"></div></div>`;
};

marked.use({ renderer, gfm: true, breaks: true });

// ─── Bionic Reading ──────────────────────────────────────────────────────────
export function applyBionicReading(text: string): string {
  if (!text) return '';
  return text.split(/(\s+)/).map(word => {
    if (!word.trim() || word.startsWith('<') || word.startsWith('&') || word.startsWith('#')) return word;
    const len = word.length;
    if (len <= 1) return word;
    const mid = Math.ceil(len / 2);
    const lead = word.substring(0, mid);
    const rest = word.substring(mid);
    return `<b class="bionic-lead">${lead}</b>${rest}`;
  }).join('');
}

// ─── Main Render Pipeline ────────────────────────────────────────────────────
export function renderMarkdownToHtml(markdownText: string, bionicMode: boolean = false): string {
  if (!markdownText) return '<p class="md-empty-note">Empty note. Type something or click Edit to start taking notes...</p>';

  let processed = markdownText;

  // Process ==highlighted text== → <mark class="study-highlight">
  processed = processed.replace(/==([^=\n]+?)==/g, '<mark class="study-highlight">$1</mark>');

  // Process Display Math $$ ... $$ → Academic Equation Card
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const mathHtml = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      return `
        <div class="eqn-card">
          <div class="eqn-card-top">
            <div class="eqn-card-tag">
              <span class="eqn-symbol">𝑓(𝑥)</span>
              <span class="eqn-title">EQUATION</span>
            </div>
            <button class="copy-code-btn" data-code="${encodeURIComponent(math.trim())}">
              Copy LaTeX
            </button>
          </div>
          <div class="eqn-card-render">${mathHtml}</div>
        </div>
      `;
    } catch (e) {
      return `<pre class="katex-error">${math}</pre>`;
    }
  });

  // Process Inline Math $ ... $ → Inline Pill
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      return `<span class="eqn-inline">${rendered}</span>`;
    } catch (e) {
      return `<code>${math}</code>`;
    }
  });

  let rawHtml = '';
  try {
    rawHtml = marked.parse(processed) as string;
  } catch (err) {
    console.error("Marked parsing error:", err);
    rawHtml = `<pre>${processed}</pre>`;
  }

  // Process Callouts > [!TYPE]
  const calloutTypes = 'NOTE|IMPORTANT|TIP|WARNING|CAUTION|DEFINITION|THEOREM|FORMULA|EXAMPLE|SUMMARY';
  rawHtml = rawHtml.replace(
    new RegExp(`<blockquote>\\s*<p>\\s*\\[!(${calloutTypes})\\]`, 'gi'),
    (_, type) => {
      const lower = type.toLowerCase();
      const config = getCalloutConfig(lower);
      return `
        <div class="study-callout study-callout-${lower}">
          <div class="study-callout-bar" style="background: ${config.borderColor};"></div>
          <div class="study-callout-content">
            <div class="study-callout-header">
              <span class="study-callout-icon">${config.icon}</span>
              <span class="study-callout-title" style="color: ${config.titleColor};">${config.title}</span>
            </div>
            <div class="study-callout-body"><p>
      `;
    }
  ).replace(/<\/p>\s*<\/blockquote>/gi, '</p></div></div></div>');

  if (bionicMode) {
    rawHtml = applyBionicReading(rawHtml);
  }

  return rawHtml;
}

function getCalloutConfig(type: string): { icon: string; title: string; borderColor: string; titleColor: string } {
  switch (type) {
    case 'important':
      return { icon: '📌', title: 'CORE EXAM CONCEPT', borderColor: 'var(--accent-rose)', titleColor: 'var(--accent-rose)' };
    case 'tip':
      return { icon: '💡', title: 'KEY INSIGHT & TIP', borderColor: 'var(--accent-emerald)', titleColor: 'var(--accent-emerald)' };
    case 'warning':
      return { icon: '⚠️', title: 'COMMON PITFALL / WARNING', borderColor: 'var(--accent-amber)', titleColor: 'var(--accent-amber)' };
    case 'caution':
      return { icon: '🚨', title: 'CRITICAL CAUTION', borderColor: 'var(--accent-rose)', titleColor: 'var(--accent-rose)' };
    case 'definition':
      return { icon: '📖', title: 'KEY DEFINITION', borderColor: 'var(--accent-cyan)', titleColor: 'var(--accent-cyan)' };
    case 'theorem':
      return { icon: '📐', title: 'THEOREM / RULE', borderColor: 'var(--accent-purple)', titleColor: 'var(--accent-purple)' };
    case 'formula':
      return { icon: '🔢', title: 'IMPORTANT EQUATION', borderColor: 'var(--primary)', titleColor: 'var(--primary)' };
    case 'example':
      return { icon: '🧪', title: 'WORKED EXAMPLE', borderColor: 'var(--accent-emerald)', titleColor: 'var(--accent-emerald)' };
    case 'summary':
      return { icon: '📝', title: 'SECTION SUMMARY', borderColor: 'var(--primary)', titleColor: 'var(--primary)' };
    default:
      return { icon: 'ℹ️', title: 'STUDY NOTE', borderColor: 'var(--primary)', titleColor: 'var(--primary)' };
  }
}

export function getTaskProgress(markdownText: string): { total: number; completed: number; percent: number } {
  if (!markdownText) return { total: 0, completed: 0, percent: 0 };
  const matches = markdownText.match(/- \[(x| )\]/gi) || [];
  const total = matches.length;
  if (total === 0) return { total: 0, completed: 0, percent: 0 };
  const completed = (markdownText.match(/- \[x\]/gi) || []).length;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
}

export function extractTableOfContents(markdownText: string): TableOfContentsItem[] {
  if (!markdownText) return [];
  const lines = markdownText.split('\n');
  const toc: TableOfContentsItem[] = [];

  lines.forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*_~`=]/g, '');
      const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, '-')}`;
      toc.push({ id, text, level });
    }
  });

  return toc;
}

export function generateFlashcardsFromNote(noteTitle: string, markdownText: string): Flashcard[] {
  if (!markdownText) return [];
  const cards: Flashcard[] = [];
  const lines = markdownText.split('\n');

  let currentHeading = noteTitle;
  let currentContent: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('#')) {
      if (currentContent.length > 0 && currentHeading) {
        const text = currentContent.join(' ').trim();
        if (text.length > 20) {
          cards.push({
            id: `card-${cards.length + 1}`,
            question: `What are the key concepts of "${currentHeading}"?`,
            answer: text.substring(0, 300) + (text.length > 300 ? '...' : ''),
            sourceNote: noteTitle
          });
        }
      }
      currentHeading = line.replace(/^#+\s*/, '').trim();
      currentContent = [];
    } else if (line.trim() && !line.startsWith('![')) {
      const qaMatch = line.match(/^(Q|Question|Term):\s*(.+?)\s*[-–—:]\s*(A|Answer|Def|Definition):\s*(.+)$/i);
      if (qaMatch) {
        cards.push({
          id: `card-qa-${cards.length + 1}`,
          question: qaMatch[2].trim(),
          answer: qaMatch[4].trim(),
          sourceNote: noteTitle
        });
      } else {
        currentContent.push(line.trim());
      }
    }
  });

  if (currentContent.length > 0 && currentHeading && cards.length < 5) {
    const text = currentContent.join(' ').trim();
    if (text.length > 20) {
      cards.push({
        id: `card-${cards.length + 1}`,
        question: `Explain: ${currentHeading}`,
        answer: text.substring(0, 300) + (text.length > 300 ? '...' : ''),
        sourceNote: noteTitle
      });
    }
  }

  return cards;
}

export function calculateReadingTime(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 200);
}
