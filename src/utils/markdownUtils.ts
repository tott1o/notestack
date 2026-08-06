import { marked } from 'marked';
import katex from 'katex';
import type { Flashcard, TableOfContentsItem } from '../types';
import { highlightCodeSyntax } from './syntaxHighlighter';

// Standardized Markdown Renderer (GitHub Flavored Markdown & Obsidian Specs)
const renderer = new marked.Renderer();

// ─── Code Blocks (Terminal Design & Mermaid Diagram Cards) ───────────
renderer.code = function({ text = '', lang }: { text?: string; lang?: string }) {
  const safeText = text || '';
  const language = (lang || 'code').toLowerCase().trim();

  if (language === 'mermaid') {
    return `
      <div class="mermaid-diagram-card" data-mermaid="${encodeURIComponent(safeText)}">
        <div class="mermaid-diagram-header">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            <span class="mermaid-diagram-title" style="font-weight: 700; font-size: 0.76rem; color: var(--primary);">MERMAID DIAGRAM</span>
          </div>
          <button class="copy-code-btn" data-code="${encodeURIComponent(safeText)}">
            Copy Code
          </button>
        </div>
        <div class="mermaid-container">
          <div class="mermaid-loading" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">Rendering diagram...</div>
        </div>
      </div>
    `;
  }

  const highlightedCode = highlightCodeSyntax(safeText, lang || 'code');
  const lines = safeText.split('\n');
  const lineCount = lines.length;
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
          <span class="code-terminal-lang">${language.toUpperCase()}</span>
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

// ─── Callout & Blockquote Parser (Obsidian & GitHub Flavored Spec) ───────────
// marked v18 passes raw text to renderer.blockquote, NOT HTML-wrapped.
// It also does NOT recursively process nested blockquotes — we get raw `> ` markers.
renderer.blockquote = function({ text }: { text: string }) {
  const safeText = (text || '').trim();

  // ── 1. Check for callout syntax [!TYPE] ────────────────────────────────
  const rawCalloutRegex = /^\s*(?:<p>\s*)?\[!([A-Za-z]+)\](?:\s*([^\n<]*))?(?:<\/p>)?\s*/i;
  const match = safeText.match(rawCalloutRegex);

  if (match) {
    const rawType = match[1];
    const config = getCalloutConfig(rawType);

    if (config) {
      const sameLineText = (match[2] || '').trim();
      let bodyRaw = safeText.substring(match[0].length).trim();
      
      let displayTitle = config.title;
      let bodyContent = '';

      if (bodyRaw.length > 0) {
        if (sameLineText) displayTitle = sameLineText;
        bodyContent = bodyRaw;
      } else if (sameLineText) {
        bodyContent = sameLineText;
      }

      // Format bodyContent HTML cleanly & process inline markdown (bold, italic, code)
      bodyContent = bodyContent.replace(/^\s*<p>\s*/i, '').replace(/\s*<\/p>\s*$/i, '').trim();

      const formatInlineMarkdown = (str: string) => {
        return str
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
      };

      if (bodyContent) {
        if (!bodyContent.startsWith('<p>') && !bodyContent.startsWith('<ul') && !bodyContent.startsWith('<ol') && !bodyContent.startsWith('<div') && !bodyContent.startsWith('<h')) {
          bodyContent = `<p>${formatInlineMarkdown(bodyContent)}</p>`;
        } else {
          bodyContent = formatInlineMarkdown(bodyContent);
        }
      }

      displayTitle = formatInlineMarkdown(displayTitle);

      return `
        <div class="study-callout study-callout-${config.typeKey}" style="--callout-color: ${config.borderColor}; --callout-bg: ${config.bgColor}; --callout-border: ${config.cardBorder};">
          <div class="study-callout-bar" style="background: ${config.borderColor};"></div>
          <div class="study-callout-content">
            <div class="study-callout-header">
              <div class="study-callout-icon-wrapper" style="color: ${config.titleColor}; background: ${config.iconBg};">
                ${config.icon}
              </div>
              <span class="study-callout-title" style="color: ${config.titleColor};">${displayTitle}</span>
            </div>
            ${bodyContent ? `<div class="study-callout-body">${bodyContent}</div>` : ''}
          </div>
        </div>
      `;
    }
  }

  // ── 2. Standard Blockquote — Build rich editorial card HTML ─────────────
  // marked v18 gives us raw text with \n separators and nested > markers
  
  // Helper: recursively parse nested blockquote content from raw text lines
  function buildBlockquoteHtml(rawLines: string[], depth: number): string {
    const myLines: string[] = [];
    const nestedLines: string[] = [];
    let collectingNested = false;
    
    for (const line of rawLines) {
      // Check if this line starts with > (nested blockquote)
      const nestedMatch = line.match(/^>\s?(.*)/);
      if (nestedMatch) {
        collectingNested = true;
        nestedLines.push(nestedMatch[1]);
      } else {
        if (collectingNested) {
          // Flush nested blockquote
          collectingNested = false;
        }
        myLines.push(line);
      }
    }

    // Convert own lines to paragraphs
    const paragraphs = myLines.join('\n').split(/\n{2,}/);
    let bodyHtml = paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Process inline markdown: bold, italic, inline code
        let html = p
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        return `<p>${html}</p>`;
      })
      .join('\n');

    // Process nested blockquote recursively
    if (nestedLines.length > 0) {
      bodyHtml += buildBlockquoteHtml(nestedLines, depth + 1);
    }

    const depthClass = depth === 0 ? '' : depth === 1 ? ' bq-nested-l2' : ' bq-nested-l3';
    const quoteIcon = depth === 0 
      ? `<svg class="bq-quote-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.12"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>`
      : '';

    return `
      <blockquote class="bq-card${depthClass}">
        ${quoteIcon}
        <div class="bq-body">${bodyHtml}</div>
      </blockquote>
    `;
  }

  const lines = safeText.split('\n');
  return buildBlockquoteHtml(lines, 0);
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

  const mathBlocks: string[] = [];
  const mathInlines: string[] = [];

  // 2. Extract Display Math $$ ... $$ → Placeholder Token BEFORE any superscript/subscript/footnote regexes!
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

  // 3. Protect standalone currency values (e.g. $50,000 or $10.99 followed by space/punctuation without closing $)
  const currencyPlaceholders: string[] = [];
  processed = processed.replace(/(^|[\s(])\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?=$|[\s.,!?;:)]|\s)/g, (_match, prefix, amount) => {
    const idx = currencyPlaceholders.length;
    currencyPlaceholders.push(`$${amount}`);
    return `${prefix}\u0000CURRENCY${idx}\u0000`;
  });

  // 4. Extract Inline Math $ ... $ (including numbers like $35$, $75$, equations $n=6$, and symbols \to)
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

  // 5. Process Footnote Definitions [^1]: Explanation Text
  const footnotes: { id: string; content: string }[] = [];
  processed = processed.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_, id, content) => {
    footnotes.push({ id, content: content.trim() });
    return '';
  });

  // 6. Process Inline Footnote References [^1]
  processed = processed.replace(/\[\^([^\]]+)\]/g, (_, id) => {
    return `<sup class="footnote-ref-wrap"><a href="#fn-${id}" id="fnref-${id}" class="footnote-ref">[${id}]</a></sup>`;
  });

  // Process Superscript ^text^ & Subscript ~text~ & Highlight ==text== (Now 100% safe from LaTeX formulas!)
  processed = processed.replace(/\^([^\^\n]+?)\^/g, '<sup>$1</sup>');
  processed = processed.replace(/(^|[^~])~([^~\n]+?)~(?!~)/g, '$1<sub>$2</sub>');
  processed = processed.replace(/==([^=\n]+?)==/g, '<mark class="study-highlight">$1</mark>');

  // Normalize standalone callout lines `[!TYPE] text` without leading `>` into blockquotes `> [!TYPE] text`
  processed = processed.replace(/^([ \t]*)\[!([A-Za-z]+)\](?:\s+([^\n]+))?/gm, (_m, indent, type, text) => {
    return `${indent}> [!${type}]${text ? ' ' + text : ''}`;
  });

  // Restore Protected Code Blocks before Marked parses Markdown
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

  // Restore Display Math Blocks
  rawHtml = rawHtml.replace(/<p>\s*NOTESTACKMATHBLOCK(\d+)END\s*<\/p>|NOTESTACKMATHBLOCK(\d+)END/g, (_, id1, id2) => {
    const idx = parseInt(id1 !== undefined ? id1 : id2, 10);
    return mathBlocks[idx] || '';
  });

  // Restore Inline Math
  rawHtml = rawHtml.replace(/NOTESTACKMATHINLINE(\d+)END/g, (_, id) => {
    const idx = parseInt(id, 10);
    return mathInlines[idx] || '';
  });

  // Append Footnotes section if footnotes exist
  if (footnotes.length > 0) {
    const fnItems = footnotes.map(fn => `
      <li id="fn-${fn.id}" class="footnote-item">
        <span class="footnote-text">${fn.content}</span>
        <a href="#fnref-${fn.id}" class="footnote-backref" title="Back to content">↩</a>
      </li>
    `).join('');
    rawHtml += `
      <hr class="solid-separator" />
      <section class="footnotes-section">
        <h4 class="footnotes-title">Footnotes</h4>
        <ol class="footnotes-list">
          ${fnItems}
        </ol>
      </section>
    `;
  }

  if (bionicMode) {
    rawHtml = applyBionicReading(rawHtml);
  }

  return rawHtml;
}

interface CalloutConfig {
  typeKey: string;
  icon: string;
  title: string;
  borderColor: string;
  titleColor: string;
  bgColor: string;
  cardBorder: string;
  iconBg: string;
}

function getCalloutConfig(type: string): CalloutConfig {
  const t = type.toLowerCase();
  
  if (['caution', 'danger', 'error', 'failure', 'bug'].includes(t)) {
    return {
      typeKey: 'caution',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      title: t === 'bug' ? 'BUG DETECTED' : 'CRITICAL CAUTION',
      borderColor: 'var(--accent-rose, #f43f5e)',
      titleColor: 'var(--accent-rose, #f43f5e)',
      bgColor: 'rgba(244, 63, 94, 0.08)',
      cardBorder: 'rgba(244, 63, 94, 0.22)',
      iconBg: 'rgba(244, 63, 94, 0.14)'
    };
  }

  if (['warning', 'attention'].includes(t)) {
    return {
      typeKey: 'warning',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      title: 'WARNING',
      borderColor: 'var(--accent-amber, #f59e0b)',
      titleColor: 'var(--accent-amber, #f59e0b)',
      bgColor: 'rgba(245, 158, 11, 0.08)',
      cardBorder: 'rgba(245, 158, 11, 0.22)',
      iconBg: 'rgba(245, 158, 11, 0.14)'
    };
  }

  if (['tip', 'hint', 'insight'].includes(t)) {
    return {
      typeKey: 'tip',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`,
      title: 'KEY INSIGHT & TIP',
      borderColor: 'var(--accent-emerald, #10b981)',
      titleColor: 'var(--accent-emerald, #10b981)',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      cardBorder: 'rgba(16, 185, 129, 0.22)',
      iconBg: 'rgba(16, 185, 129, 0.14)'
    };
  }

  if (['important', 'check', 'done'].includes(t)) {
    return {
      typeKey: 'important',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
      title: 'IMPORTANT CONCEPT',
      borderColor: 'var(--accent-purple, #a855f7)',
      titleColor: 'var(--accent-purple, #a855f7)',
      bgColor: 'rgba(168, 85, 247, 0.08)',
      cardBorder: 'rgba(168, 85, 247, 0.22)',
      iconBg: 'rgba(168, 85, 247, 0.14)'
    };
  }

  if (['definition', 'abstract', 'summary', 'tldr'].includes(t)) {
    return {
      typeKey: 'definition',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
      title: t.toUpperCase(),
      borderColor: 'var(--accent-cyan, #06b6d4)',
      titleColor: 'var(--accent-cyan, #06b6d4)',
      bgColor: 'rgba(6, 182, 212, 0.08)',
      cardBorder: 'rgba(6, 182, 212, 0.22)',
      iconBg: 'rgba(6, 182, 212, 0.14)'
    };
  }

  if (['theorem', 'proposition', 'proof'].includes(t)) {
    return {
      typeKey: 'theorem',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m16.2 7.8-2 6.3-6.4 2.1 2-6.3z"></path></svg>`,
      title: 'THEOREM & RULE',
      borderColor: 'var(--accent-purple, #8b5cf6)',
      titleColor: 'var(--accent-purple, #8b5cf6)',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      cardBorder: 'rgba(139, 92, 246, 0.22)',
      iconBg: 'rgba(139, 92, 246, 0.14)'
    };
  }

  if (['formula', 'math'].includes(t)) {
    return {
      typeKey: 'formula',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>`,
      title: 'FORMULA',
      borderColor: 'var(--primary, #3b82f6)',
      titleColor: 'var(--primary, #3b82f6)',
      bgColor: 'rgba(59, 130, 246, 0.08)',
      cardBorder: 'rgba(59, 130, 246, 0.22)',
      iconBg: 'rgba(59, 130, 246, 0.14)'
    };
  }

  if (['example'].includes(t)) {
    return {
      typeKey: 'example',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.5"></path><path d="M14 2v6"></path><path d="M8.5 2h7"></path><path d="M14 9.5a5 5 0 1 1-4 0v-7.5"></path></svg>`,
      title: 'WORKED EXAMPLE',
      borderColor: 'var(--accent-emerald, #10b981)',
      titleColor: 'var(--accent-emerald, #10b981)',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      cardBorder: 'rgba(16, 185, 129, 0.22)',
      iconBg: 'rgba(16, 185, 129, 0.14)'
    };
  }

  if (['question', 'faq', 'help'].includes(t)) {
    return {
      typeKey: 'question',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      title: 'QUESTION / FAQ',
      borderColor: 'var(--accent-amber, #eab308)',
      titleColor: 'var(--accent-amber, #eab308)',
      bgColor: 'rgba(234, 179, 8, 0.08)',
      cardBorder: 'rgba(234, 179, 8, 0.22)',
      iconBg: 'rgba(234, 179, 8, 0.14)'
    };
  }

  if (['quote', 'cite'].includes(t)) {
    return {
      typeKey: 'quote',
      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>`,
      title: 'QUOTE',
      borderColor: 'var(--text-muted, #64748b)',
      titleColor: 'var(--text-muted, #64748b)',
      bgColor: 'rgba(100, 116, 139, 0.08)',
      cardBorder: 'rgba(100, 116, 139, 0.22)',
      iconBg: 'rgba(100, 116, 139, 0.14)'
    };
  }

  // Default: Note / Info
  return {
    typeKey: 'note',
    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    title: 'NOTE',
    borderColor: 'var(--primary, #3b82f6)',
    titleColor: 'var(--primary, #3b82f6)',
    bgColor: 'rgba(59, 130, 246, 0.08)',
    cardBorder: 'rgba(59, 130, 246, 0.22)',
    iconBg: 'rgba(59, 130, 246, 0.14)'
  };
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
