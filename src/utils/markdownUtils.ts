import { marked } from 'marked';
import katex from 'katex';
import type { Flashcard, TableOfContentsItem } from '../types';

// Custom Marked Renderer for Obsidian/Claude & GitHub-Grade Markdown
const renderer = new marked.Renderer();

renderer.code = function({ text = '', lang }: { text?: string; lang?: string }) {
  const safeText = text || '';
  const language = (lang || 'text').toLowerCase();
  const lineCount = safeText.split('\n').length;
  const escapedText = safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return `
    <div class="code-block-wrapper" style="margin: 20px 0; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; background: #0d1117; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #161b22; border-bottom: 1px solid var(--border-color); font-family: var(--font-mono); font-size: 0.78rem; color: #8b949e;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff5f56;"></span>
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ffbd2e;"></span>
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #27c93f;"></span>
          <span style="font-weight: 700; text-transform: uppercase; color: var(--primary); font-size: 0.72rem; margin-left: 6px;">${language}</span>
          <span style="font-size: 0.7rem; color: #6e7681;">(${lineCount} lines)</span>
        </div>
        <button class="copy-code-btn" data-code="${encodeURIComponent(safeText)}" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #c9d1d9; padding: 4px 12px; border-radius: var(--radius-sm); font-size: 0.74rem; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: var(--transition);">
          📋 Copy Code
        </button>
      </div>
      <pre style="margin: 0; padding: 16px 18px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.88rem; line-height: 1.65; color: #e6edf3;"><code>${escapedText}</code></pre>
    </div>
  `;
};

renderer.heading = function({ text = '', depth }: { text?: string; depth: number }) {
  const safeText = text || 'heading';
  const cleanText = safeText.replace(/<[^>]*>/g, '');
  const id = `heading-${cleanText.toLowerCase().replace(/[^\w]+/g, '-')}`;
  return `<h${depth} id="${id}" style="scroll-margin-top: 80px;">${safeText}</h${depth}>`;
};

renderer.checkbox = function({ checked }: { checked: boolean }) {
  return `<input type="checkbox" class="task-list-item-checkbox" ${checked ? 'checked' : ''} disabled style="margin-right: 8px; cursor: pointer;" />`;
};

marked.use({ renderer, gfm: true, breaks: true });

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

export function renderMarkdownToHtml(markdownText: string, bionicMode: boolean = false): string {
  if (!markdownText) return '<p style="color: var(--text-dim); italic">Empty note. Type something or click Edit to start...</p>';

  let processed = markdownText;

  // Process Display Math $$ ... $$ — ChatGPT-style clean centered equations
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="katex-display-block">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return `<pre class="katex-error">${math}</pre>`;
    }
  });

  // Process Inline Math $ ... $
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
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

  // Process Callouts > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  rawHtml = rawHtml.replace(/<blockquote>\s*<p>\s*\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\]/gi, (_, type) => {
    const lower = type.toLowerCase();
    return `<div class="callout ${lower}"><div class="callout-header"><span class="callout-icon">${getCalloutIcon(lower)}</span><span class="callout-title">${type}</span></div><div class="callout-body"><p>`;
  }).replace(/<\/p>\s*<\/blockquote>/gi, '</p></div></div>');

  if (bionicMode) {
    rawHtml = applyBionicReading(rawHtml);
  }

  return rawHtml;
}

function getCalloutIcon(type: string): string {
  switch (type) {
    case 'important': return '📌';
    case 'tip': return '💡';
    case 'warning': return '⚠️';
    case 'caution': return '🚨';
    default: return '📝';
  }
}

export function extractTableOfContents(markdownText: string): TableOfContentsItem[] {
  if (!markdownText) return [];
  const lines = markdownText.split('\n');
  const toc: TableOfContentsItem[] = [];

  lines.forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*_~`]/g, '');
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
