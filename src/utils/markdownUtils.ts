import { marked } from 'marked';
import katex from 'katex';
import type { Flashcard, TableOfContentsItem } from '../types';
import { highlightCodeSyntax } from './syntaxHighlighter';

// Standardized Markdown Renderer (GitHub Flavored Markdown & Obsidian Specs)
const renderer = new marked.Renderer();

// ─── Code Blocks (Terminal Design with macOS Dots & Gutter Numbers) ───────────
renderer.code = function({ text = '', lang }: { text?: string; lang?: string }) {
  const safeText = text || '';
  const language = (lang || 'code').toUpperCase();
  const lines = safeText.split('\n');
  const lineCount = lines.length;
  const highlightedCode = highlightCodeSyntax(safeText, lang || 'code');

  const lineNums = lines.map((_, i) => `<span class="code-ln">${i + 1}</span>`).join('\n');

  return `
    <div class="code-terminal">
      <div class="code-terminal-bar">
        <div class="code-terminal-dots">
          <span class="dot dot-red"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-green"></span>
        </div>
        <div class="code-terminal-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          <span class="code-terminal-lang">${language}</span>
        </div>
        <div class="code-terminal-right">
          <span class="code-terminal-meta">${lineCount} lines</span>
          <button class="copy-code-btn" data-code="${encodeURIComponent(safeText)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Code
          </button>
        </div>
      </div>
      <div class="code-terminal-body">
        <div class="code-terminal-gutter">${lineNums}</div>
        <pre class="code-terminal-pre"><code>${highlightedCode}</code></pre>
      </div>
    </div>
  `;
};

renderer.heading = function({ text = '', depth }: { text?: string; depth: number }) {
  const safeText = text || 'heading';
  const cleanText = safeText
    .replace(/NOTESTACKMATHINLINE\d+END/g, '')
    .replace(/NOTESTACKMATHBLOCK\d+END/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_~`=]/g, '')
    .trim();
  const slug = cleanText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  const headingId = `heading-${slug}`;

  return `
    <div class="study-heading-section study-h${depth}-section" id="${headingId}">
      <h${depth} class="study-heading study-h${depth}" id="${slug}">${safeText}</h${depth}>
    </div>
  `;
};

// ─── Task Lists / Checkboxes ────────────────────────────────────────────────
renderer.checkbox = function({ checked }: { checked: boolean }) {
  const cls = checked ? 'study-checkbox checked' : 'study-checkbox';
  return `<input type="checkbox" class="${cls}" ${checked ? 'checked' : ''} disabled />`;
};

// ─── Horizontal Rule (Solid Separator Line) ──────────────────────────────────
renderer.hr = function() {
  return `<hr class="solid-separator" />`;
};

// ─── Callout & Blockquote Parser (Bulletproof Separation) ───────────────────
renderer.blockquote = function({ text }: { text: string }) {
  const safeText = text || '';

  // Matches [!TYPE] or [!TYPE] Custom Title at start of blockquote HTML
  const calloutRegex = /^\s*<p>\s*\[!([A-Za-z]+)\](?:\s+([^\n<]+))?(?:<br\s*\/?>|\n)?([\s\S]*)$/i;
  const match = safeText.match(calloutRegex);

  if (match) {
    const rawType = match[1];
    const customTitle = match[2] ? match[2].trim() : '';
    const bodyContent = match[3] ? match[3].trim() : '';

    const lowerType = rawType.toLowerCase();
    const validTypes = ['note', 'important', 'tip', 'warning', 'caution', 'definition', 'theorem', 'formula', 'example', 'summary'];

    if (validTypes.includes(lowerType)) {
      const config = getCalloutConfig(lowerType);
      const displayTitle = customTitle || config.title;

      let formattedBody = bodyContent;
      if (formattedBody.startsWith('</p>')) {
        formattedBody = formattedBody.replace(/^<\/p>\s*/, '');
      } else if (formattedBody && !formattedBody.startsWith('<p>')) {
        formattedBody = `<p>${formattedBody}`;
      }
      if (formattedBody && !formattedBody.endsWith('</p>')) {
        formattedBody = `${formattedBody}</p>`;
      }
      if (!formattedBody) {
        formattedBody = '<p></p>';
      }

      return `
        <div class="study-callout study-callout-${lowerType}">
          <div class="study-callout-bar" style="background: ${config.borderColor};"></div>
          <div class="study-callout-content">
            <div class="study-callout-header">
              <span class="study-callout-icon">${config.icon}</span>
              <span class="study-callout-title" style="color: ${config.titleColor};">${displayTitle}</span>
            </div>
            <div class="study-callout-body">
              ${formattedBody}
            </div>
          </div>
        </div>
      `;
    }
  }

  // Standard Blockquote: Return clean, valid <blockquote> tag
  return `<blockquote>${safeText}</blockquote>`;
};

marked.use({ renderer, gfm: true, breaks: true });

// ─── Bionic Reading Engine (DOM Text-Node Traversal) ────────────────────────
export function applyBionicReading(htmlText: string): string {
  if (!htmlText) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return htmlText;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${htmlText}</body>`, 'text/html');

    const bionifyWord = (word: string): string => {
      if (word.length <= 1 || /^[^a-zA-Z0-9]+$/.test(word)) {
        return word;
      }
      const match = word.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/);
      if (!match) return word;

      const [, prefix, coreWord, suffix] = match;
      const len = coreWord.length;
      if (len === 0) return word;

      const mid = len === 1 ? 1 : Math.ceil(len * 0.5);
      const lead = coreWord.slice(0, mid);
      const rest = coreWord.slice(mid);

      return `${prefix}<b class="bionic-lead">${lead}</b>${rest}${suffix}`;
    };

    const bionifyTextString = (text: string): string => {
      return text.split(/(\s+)/).map(token => {
        if (!token.trim()) return token;
        return bionifyWord(token);
      }).join('');
    };

    const shouldSkipElement = (element: Element): boolean => {
      const tagName = element.tagName.toLowerCase();
      if (['pre', 'code', 'script', 'style', 'svg', 'math', 'button', 'input', 'textarea'].includes(tagName)) {
        return true;
      }
      if (element.classList && (
        element.classList.contains('katex') ||
        element.classList.contains('eqn-card') ||
        element.classList.contains('eqn-inline') ||
        element.classList.contains('code-terminal') ||
        element.classList.contains('copy-code-btn')
      )) {
        return true;
      }
      return false;
    };

    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (shouldSkipElement(node as Element)) {
          return;
        }
        const children = Array.from(node.childNodes);
        for (const child of children) {
          walkNodes(child);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        if (text && text.trim().length > 0) {
          const bionifiedHtml = bionifyTextString(text);
          if (bionifiedHtml !== text) {
            const tempSpan = doc.createElement('span');
            tempSpan.innerHTML = bionifiedHtml;
            const parent = node.parentNode;
            if (parent) {
              while (tempSpan.firstChild) {
                parent.insertBefore(tempSpan.firstChild, node);
              }
              parent.removeChild(node);
            }
          }
        }
      }
    };

    walkNodes(doc.body);
    return doc.body.innerHTML;
  } catch (e) {
    console.error('Error applying bionic reading:', e);
    return htmlText;
  }
}

// ─── Web Copy-Paste Artifact Sanitizer ──────────────────────────────────────
// Cleans up broken multi-line DOM text nodes & duplicated KaTeX/MathJax copy-paste tokens
export function sanitizeWebCopyArtifacts(rawText: string): string {
  if (!rawText) return rawText;

  let text = rawText;

  // 1. Fix duplicated arrow artifacts: "→\n →" or "→ →" -> "→"
  text = text.replace(/→\s*\r?\n?\s*→/g, '→');

  // 2. Fix token + arrow duplicates: "75\n →\n 75→" -> "75 →"
  text = text.replace(/(\w+)\s*\r?\n?\s*([→⇒=><+-])\s*\r?\n?\s*\1\2/g, '$1 $2');

  // 3. Fix multi-line math token duplicates:
  // e.g. "35\n <\n 75\n 35<75"  OR  "n\n =\n 6\n n=6"  OR  "i\n =\n 1\n i=1"
  // Match 2 to 6 lines of single tokens/operators followed by their exact concatenation
  const blockRegex = /((?:^[ \t]*[\w<=>+\-*/()]+\r?\n)+)([ \t]*[\w<=>+\-*/()]{2,})/gm;

  text = text.replace(blockRegex, (match, multiLines, condensed) => {
    const tokens = multiLines.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
    const joined = tokens.join('');
    const cleanCondensed = condensed.trim();

    if (joined === cleanCondensed || joined.replace(/\s+/g, '') === cleanCondensed.replace(/\s+/g, '')) {
      if (/[<=>]/.test(cleanCondensed)) {
        return `$${cleanCondensed}$`;
      }
      return cleanCondensed;
    }
    return match;
  });

  // 4. Clean up inline parentheses with line breaks around math expressions:
  // e.g. "(\n n=6\n )" or "(\n $n=6$\n )" -> "($n=6$)"
  text = text.replace(/\(\s*\r?\n\s*(\$?[^()\r\n]+\$?)\s*\r?\n\s*\)/g, '($1)');
  text = text.replace(/\(\s*\r?\n\s*(\$?[^()\r\n]+\$?)\s*\r?\n\s*,/g, '($1,');

  // 5. Fix isolated lines containing just "<", ">", "=", "→" between numbers/variables
  // e.g. "35\n <\n 75" -> "$35 < 75$"
  text = text.replace(/(\d+|\w+)\s*\r?\n+\s*([<=>])\s*\r?\n+\s*(\d+|\w+)/g, (_match, p1, p2, p3) => '$' + p1 + ' ' + p2 + ' ' + p3 + '$');

  // 6. Clean up trailing "75→" or similar attached arrows
  text = text.replace(/(\d+|\w+)→/g, '$1 →');

  // 7. Normalize excessive blank lines left over from artifact removal
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

// ─── Main Render Pipeline ────────────────────────────────────────────────────
export function renderMarkdownToHtml(markdownText: string, bionicMode: boolean = false): string {
  if (!markdownText) return '<p class="md-empty-note">Empty note. Type something or click Edit to start taking notes...</p>';

  let processed = sanitizeWebCopyArtifacts(markdownText);

  // 1. Protect Fenced Code Blocks (``` ... ```) and Inline Code (` ... `)
  const codePlaceholders: string[] = [];
  
  // Protect Fenced Code Blocks
  processed = processed.replace(/(```[\s\S]*?```)/g, (match) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  // Protect Inline Code
  processed = processed.replace(/(`[^`\n]+?`)/g, (match) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(match);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  // 2. Process ==highlighted text== → <mark class="study-highlight">
  processed = processed.replace(/==([^=\n]+?)==/g, '<mark class="study-highlight">$1</mark>');

  const mathBlocks: string[] = [];
  const mathInlines: string[] = [];

  // 3. Extract Display Math $$ ... $$ → Placeholder Token
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    const index = mathBlocks.length;
    try {
      const mathHtml = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      const cardHtml = `
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
      mathBlocks.push(cardHtml);
    } catch (e) {
      mathBlocks.push(`<pre class="katex-error">${math}</pre>`);
    }
    return `\nNOTESTACKMATHBLOCK${index}END\n`;
  });

  // 4. Protect standalone currency values (e.g. $50,000 or $10.99 followed by space/punctuation without closing $)
  const currencyPlaceholders: string[] = [];
  processed = processed.replace(/(^|[\s(])\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?=$|[\s.,!?;:)]|\s)/g, (_match, prefix, amount) => {
    const idx = currencyPlaceholders.length;
    currencyPlaceholders.push(`$${amount}`);
    return `${prefix}\u0000CURRENCY${idx}\u0000`;
  });

  // 5. Extract Inline Math $ ... $ (including numbers like $35$, $75$, equations $n=6$, and symbols \to)
  processed = processed.replace(/(^|[^\\\$])\$([^\s\$\n](?:[^\$\n]*?[^\s\$\n])?)\$/g, (_match, prefix, math) => {
    const index = mathInlines.length;
    try {
      const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      mathInlines.push(`<span class="eqn-inline">${rendered}</span>`);
    } catch (e) {
      mathInlines.push(`<code>${math}</code>`);
    }
    return `${prefix}NOTESTACKMATHINLINE${index}END`;
  });

  // Restore Currency Placeholders
  processed = processed.replace(/\u0000CURRENCY(\d+)\u0000/g, (_, id) => {
    return currencyPlaceholders[parseInt(id, 10)] || '';
  });

  // 5. Restore Protected Code Blocks before Marked parses Markdown
  processed = processed.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, id) => {
    return codePlaceholders[parseInt(id, 10)] || '';
  });

  let rawHtml = '';
  try {
    rawHtml = marked.parse(processed) as string;
  } catch (err) {
    console.error("Marked parsing error:", err);
    rawHtml = `<pre>${processed}</pre>`;
  }

  // 6. Restore Display Math Blocks
  rawHtml = rawHtml.replace(/<p>\s*NOTESTACKMATHBLOCK(\d+)END\s*<\/p>|NOTESTACKMATHBLOCK(\d+)END/g, (_, id1, id2) => {
    const idx = parseInt(id1 !== undefined ? id1 : id2, 10);
    return mathBlocks[idx] || '';
  });

  // 7. Restore Inline Math
  rawHtml = rawHtml.replace(/NOTESTACKMATHINLINE(\d+)END/g, (_, id) => {
    const idx = parseInt(id, 10);
    return mathInlines[idx] || '';
  });

  if (bionicMode) {
    rawHtml = applyBionicReading(rawHtml);
  }

  return rawHtml;
}

function getCalloutConfig(type: string): { icon: string; title: string; borderColor: string; titleColor: string } {
  switch (type.toLowerCase()) {
    case 'important':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>', 
        title: 'IMPORTANT CONCEPT', 
        borderColor: 'var(--accent-rose)', 
        titleColor: 'var(--accent-rose)' 
      };
    case 'tip':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>', 
        title: 'KEY INSIGHT & TIP', 
        borderColor: 'var(--accent-emerald)', 
        titleColor: 'var(--accent-emerald)' 
      };
    case 'warning':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', 
        title: 'WARNING', 
        borderColor: 'var(--accent-amber)', 
        titleColor: 'var(--accent-amber)' 
      };
    case 'caution':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>', 
        title: 'CRITICAL CAUTION', 
        borderColor: 'var(--accent-rose)', 
        titleColor: 'var(--accent-rose)' 
      };
    case 'definition':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>', 
        title: 'DEFINITION', 
        borderColor: 'var(--accent-cyan)', 
        titleColor: 'var(--accent-cyan)' 
      };
    case 'theorem':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m16.2 7.8-2 6.3-6.4 2.1 2-6.3z"></path></svg>', 
        title: 'THEOREM & RULE', 
        borderColor: 'var(--accent-purple)', 
        titleColor: 'var(--accent-purple)' 
      };
    case 'formula':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>', 
        title: 'FORMULA', 
        borderColor: 'var(--primary)', 
        titleColor: 'var(--primary)' 
      };
    case 'example':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.5"></path><path d="M14 2v6"></path><path d="M8.5 2h7"></path><path d="M14 9.5a5 5 0 1 1-4 0v-7.5"></path></svg>', 
        title: 'WORKED EXAMPLE', 
        borderColor: 'var(--accent-emerald)', 
        titleColor: 'var(--accent-emerald)' 
      };
    case 'summary':
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>', 
        title: 'SUMMARY', 
        borderColor: 'var(--primary)', 
        titleColor: 'var(--primary)' 
      };
    case 'note':
    default:
      return { 
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>', 
        title: 'NOTE', 
        borderColor: 'var(--primary)', 
        titleColor: 'var(--primary)' 
      };
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
      const rawTitle = match[2].trim();
      const cleanLineText = rawTitle
        .replace(/\$\$[\s\S]*?\$\$/g, '')
        .replace(/\$([^\$\n]+)\$/g, '')
        .replace(/[*_~`=]/g, '')
        .trim();

      const slug = cleanLineText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
      const id = `heading-${slug}`;
      toc.push({ id, text: cleanLineText, level });
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
