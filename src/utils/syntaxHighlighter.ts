// High-Performance Multilingual Syntax Tokenizer & Colorizer for NoteStack

export function highlightCodeSyntax(code: string, lang: string = 'code'): string {
  if (!code) return '';

  const cleanLang = (lang || '').toLowerCase().trim();

  // Escape raw HTML characters to prevent XSS
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Tokenize comments, strings, keywords, types, builtins, numbers, and functions
  const tokens: { id: string; html: string }[] = [];
  let tokenIdx = 0;

  const storeToken = (cls: string, val: string) => {
    const placeholder = `\u0000TK${tokenIdx++}\u0000`;
    tokens.push({
      id: placeholder,
      html: `<span class="${cls}">${val}</span>`
    });
    return placeholder;
  };

  let working = escaped;

  // 1. Multi-line & Single-line Comments
  working = working.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|&lt;!--[\s\S]*?--&gt;)/g, (match) => {
    return storeToken('hl-comment', match);
  });

  // 2. Strings & Template Literals (Double quotes, single quotes, backticks)
  working = working.replace(/("&quot;[\s\S]*?"&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)/g, (match) => {
    return storeToken('hl-string', match);
  });

  // 3. Language-Specific Keywords
  const keywordsMap: Record<string, string[]> = {
    js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'import', 'from', 'export', 'class', 'extends', 'super', 'this', 'new', 'typeof', 'instanceof', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'yield', 'delete', 'void', 'in', 'of'],
    ts: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'import', 'from', 'export', 'class', 'extends', 'super', 'this', 'new', 'typeof', 'instanceof', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'yield', 'delete', 'void', 'in', 'of', 'type', 'interface', 'implements', 'namespace', 'declare', 'abstract', 'readonly', 'enum', 'public', 'private', 'protected', 'as', 'keyof', 'is'],
    jsx: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'class', 'async', 'await'],
    tsx: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'class', 'interface', 'type', 'async', 'await'],
    py: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'raise', 'import', 'from', 'as', 'with', 'pass', 'lambda', 'async', 'await', 'yield', 'global', 'nonlocal', 'assert', 'del', 'in', 'is', 'and', 'or', 'not'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'void', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'final', 'static', 'abstract', 'synchronized', 'package', 'import'],
    cpp: ['#include', '#define', '#ifdef', '#ifndef', '#endif', 'using', 'namespace', 'template', 'typename', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'override', 'const', 'constexpr', 'auto', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'new', 'delete'],
    c: ['#include', '#define', '#ifdef', '#ifndef', '#endif', 'struct', 'typedef', 'const', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'static', 'extern', 'sizeof'],
    rs: ['fn', 'let', 'mut', 'const', 'pub', 'struct', 'enum', 'impl', 'trait', 'use', 'mod', 'match', 'if', 'else', 'for', 'while', 'loop', 'return', 'async', 'await', 'where', 'type', 'ref', 'move', 'unsafe', 'crate', 'self', 'Super'],
    go: ['package', 'import', 'func', 'type', 'struct', 'interface', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'select', 'go', 'chan', 'defer', 'map', 'var', 'const'],
    html: ['DOCTYPE', 'html', 'head', 'body', 'div', 'span', 'script', 'style', 'link', 'meta', 'header', 'main', 'footer', 'section', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'img', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'button', 'input', 'textarea', 'form', 'label', 'iframe', 'canvas', 'svg'],
    css: ['margin', 'padding', 'background', 'color', 'border', 'width', 'height', 'display', 'position', 'flex', 'grid', 'font-family', 'font-size', 'font-weight', 'line-height', 'overflow', 'opacity', 'border-radius', 'box-shadow', 'transition', 'transform', 'align-items', 'justify-content', 'z-index', 'top', 'bottom', 'left', 'right']
  };

  const defaultKeywords = ['const', 'let', 'var', 'function', 'def', 'class', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'import', 'from', 'export', 'public', 'private', 'protected', 'async', 'await', 'struct', 'enum', 'fn', 'use', 'mod', 'package'];
  
  const keywords = keywordsMap[cleanLang] || defaultKeywords;
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');

  // 4. Built-in Types & Datatypes
  const types = [
    'string', 'number', 'boolean', 'any', 'void', 'int', 'float', 'double', 'char', 'bool',
    'list', 'dict', 'set', 'tuple', 'map', 'Array', 'Object', 'Promise', 'String', 'Integer',
    'Boolean', 'Float', 'Double', 'usize', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64',
    'f32', 'f64', 'Vec', 'Option', 'Result', 'File', 'Element', 'HTMLElement', 'Node', 'Vector'
  ];
  const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'g');

  // 5. Built-in Modules & Libraries
  const builtins = [
    'console', 'Math', 'JSON', 'Promise', 'React', 'useState', 'useEffect', 'useRef',
    'useMemo', 'useCallback', 'useContext', 'fs', 'path', 'os', 'sys', 'std', 'fmt',
    'io', 'np', 'pd', 'plt', 'torch', 'express', 'document', 'window', 'process', 'System',
    'out', 'println', 'printf', 'len', 'range', 'print', 'type', 'isinstance'
  ];
  const builtinRegex = new RegExp(`\\b(${builtins.join('|')})\\b`, 'g');

  // Apply Keywords, Types, Builtins
  working = working.replace(keywordRegex, (match) => storeToken('hl-keyword', match));
  working = working.replace(typeRegex, (match) => storeToken('hl-type', match));
  working = working.replace(builtinRegex, (match) => storeToken('hl-builtin', match));

  // 6. Function Declarations & Calls: funcName(...)
  working = working.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, (match) => {
    return storeToken('hl-function', match);
  });

  // 7. Numbers, Booleans, Nulls
  working = working.replace(/\b(true|false|null|undefined|None|True|False|self|this|\d+\.?\d*|0x[0-9a-fA-F]+)\b/g, (match) => {
    return storeToken('hl-number', match);
  });

  // 8. Restore tokens in exact reverse order to safely handle nested placeholders
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    working = working.replaceAll(t.id, t.html);
  }

  return working;
}
