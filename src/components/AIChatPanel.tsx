import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Send,
  Plus,
  Paperclip,
  Bot,
  User,
  Copy,
  Check,
  FileText,
  Code,
  AlertCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  FileCheck,
  FilePlus,
  Edit3,
  Folder,
  Square
} from 'lucide-react';
import type { FileItem, MainDirectory } from '../types';
import { getFileTextContentForAI } from '../utils/fileContentExtractor';
import mermaid from 'mermaid';

// ── Targeted Line / Search-Replace Edit Engine ────────────────────────────────
export function applySearchReplaceBlocks(originalContent: string, searchReplaceText: string): string {
  if (!originalContent || !searchReplaceText) return originalContent;

  // Supports multiple LLM block formats:
  // 1. <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE
  // 2. <<< SEARCH ... === ... >>> REPLACE
  // 3. ```search_replace ... ======= ... ```
  const blockRegexes = [
    /<<<<<<<\s*SEARCH\s*\n([\s\S]*?)\n?=======\s*\n([\s\S]*?)\n?>>>>>>>\s*REPLACE?/gi,
    /<<<\s*SEARCH\s*\n([\s\S]*?)\n?===\s*\n([\s\S]*?)\n?>>>\s*REPLACE?/gi,
    /```(?:search_replace|diff|replace)\n([\s\S]*?)\n=======\n([\s\S]*?)\n```/gi
  ];

  let matches: RegExpMatchArray[] = [];
  for (const regex of blockRegexes) {
    const found = Array.from(searchReplaceText.matchAll(regex));
    if (found.length > 0) {
      matches = found;
      break;
    }
  }

  if (matches.length === 0) {
    return originalContent;
  }

  let updatedContent = originalContent;

  for (const match of matches) {
    const searchTarget = match[1];
    const replacementText = match[2];

    if (!searchTarget.trim()) continue;

    // Strategy 1: Exact string match
    if (updatedContent.includes(searchTarget)) {
      updatedContent = updatedContent.replace(searchTarget, replacementText);
      continue;
    }

    // Strategy 2: Normalized line endings (\r\n -> \n)
    const normOriginal = updatedContent.replace(/\r\n/g, '\n');
    const normSearch = searchTarget.replace(/\r\n/g, '\n');
    const normReplace = replacementText.replace(/\r\n/g, '\n');

    if (normOriginal.includes(normSearch)) {
      updatedContent = normOriginal.replace(normSearch, normReplace);
      continue;
    }

    // Strategy 3: Trimmed line-by-line matching
    const origLines = updatedContent.split('\n');
    const searchLines = normSearch.split('\n').map(l => l.trimEnd());
    
    if (searchLines.length > 0) {
      let foundIndex = -1;
      for (let i = 0; i <= origLines.length - searchLines.length; i++) {
        let isMatch = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (origLines[i + j].trimEnd() !== searchLines[j]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        origLines.splice(foundIndex, searchLines.length, ...normReplace.split('\n'));
        updatedContent = origLines.join('\n');
        continue;
      }
    }

    // Strategy 4: Flexible Whitespace (ignore leading & trailing spaces per line)
    const searchLinesTrimmed = normSearch.split('\n').map(l => l.trim()).filter(Boolean);
    if (searchLinesTrimmed.length > 0) {
      let foundIndex = -1;
      let matchedCount = 0;

      for (let i = 0; i < origLines.length; i++) {
        if (origLines[i].trim() === searchLinesTrimmed[0]) {
          let match = true;
          for (let j = 1; j < searchLinesTrimmed.length; j++) {
            if (i + j >= origLines.length || origLines[i + j].trim() !== searchLinesTrimmed[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            foundIndex = i;
            matchedCount = searchLinesTrimmed.length;
            break;
          }
        }
      }

      if (foundIndex !== -1) {
        origLines.splice(foundIndex, matchedCount, ...normReplace.split('\n'));
        updatedContent = origLines.join('\n');
      }
    }
  }

  return updatedContent;
}

// ─────────────────────────── Types ───────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachedFiles?: { name: string; path: string }[];
  editAction?: {
    type: 'replace' | 'append' | 'create' | 'target_edit';
    filePath: string;
    fileName: string;
    newContent: string;
    originalContent?: string;
    applied?: boolean;
    diffStats?: { added: number; removed: number };
  };
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile: FileItem | null;
  openTabs: FileItem[];
  mainDir: MainDirectory;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResizeReset?: () => void;
  onContentChange?: (newContent: string) => void;
  onFileContentUpdated?: (filePathOrName: string, newContent: string) => void;
  onSelectFile?: (file: FileItem) => void;
  onOpenInNewTab?: (file: FileItem) => void;
  onCreateNoteFromAI?: (title: string, content: string, targetFolderPath?: string) => void | Promise<void>;
}

// ─────────────────────────── Constants ───────────────────────────
const CHAT_HISTORY_KEY = 'notestack_ai_chat_history_v1';
const PROVIDER_STORAGE_KEY = 'notestack_ai_provider_v1';
const GEMINI_KEY_STORAGE = 'notestack_ai_api_key_v1';
const GROQ_KEY_STORAGE = 'notestack_ai_groq_key_v1';
const OPENROUTER_KEY_STORAGE = 'notestack_ai_openrouter_key_v1';
const MODEL_STORAGE_KEY = 'notestack_ai_model_v1';

export type AIProvider = 'gemini' | 'groq' | 'openrouter';

export const PROVIDER_CONFIGS: Record<AIProvider, { label: string; keyHint: string; keyUrl: string; models: { id: string; label: string; desc: string }[] }> = {
  gemini: {
    label: 'Google Gemini',
    keyHint: 'Get free key from',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Recommended)', desc: 'Speed & intelligence for agentic tasks' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', desc: 'Frontier performance for coding' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', desc: 'Fastest high-throughput execution' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', desc: 'Frontier performance at low cost' },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: 'Complex problem-solving & vibe coding' },
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Frontier-class preview performance' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Stable production model' }
    ]
  },
  groq: {
    label: 'Groq (Free, No Card)',
    keyHint: 'Get free key from',
    keyUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', desc: 'Best quality, free' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', desc: 'Ultra fast, free' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', desc: 'Google Gemma, free' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', desc: '32K context, free' },
      { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B', desc: 'Versatile, free' }
    ]
  },
  openrouter: {
    label: 'OpenRouter AI (Free Models)',
    keyHint: 'Get free key from',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'openrouter/free', label: 'Auto Free Router (Recommended)', desc: 'Auto-selects best active free model' },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (Free)', desc: 'Reasoning model (163K ctx)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)', desc: 'Meta flagship (131K ctx)' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Nous Hermes 3 405B (Free)', desc: 'Hermes 3 405B flagship (128K ctx)' },
      { id: 'nvidia/nemotron-4-340b-instruct:free', label: 'NVIDIA Nemotron 4 340B (Free)', desc: 'NVIDIA 340B flagship model' },
      { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', label: 'Llama 3.2 11B Vision (Free)', desc: 'Vision & text model' },
      { id: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B (Free)', desc: 'Google Gemma 2 (8K ctx)' },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)', desc: 'Google Flash (1M ctx)' },
      { id: 'qwen/qwen-2.5-coder-32b-instruct:free', label: 'Qwen 2.5 Coder 32B (Free)', desc: 'Code specialist (32K ctx)' },
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (Free)', desc: 'Ultra fast (32K ctx)' }
    ]
  }
};

export const DEFAULT_PROVIDER: AIProvider = 'gemini';
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-3.6-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openrouter/free'
};

// ─────────────────────────── Helpers ───────────────────────────
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function getStoredApiKey(provider: AIProvider): string {
  try {
    const key = provider === 'openrouter' ? OPENROUTER_KEY_STORAGE : provider === 'groq' ? GROQ_KEY_STORAGE : GEMINI_KEY_STORAGE;
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function storeApiKey(provider: AIProvider, apiKeyValue: string): void {
  try {
    const key = provider === 'openrouter' ? OPENROUTER_KEY_STORAGE : provider === 'groq' ? GROQ_KEY_STORAGE : GEMINI_KEY_STORAGE;
    localStorage.setItem(key, apiKeyValue);
  } catch (err) {
    console.error('Failed to store API key:', err);
  }
}

function getStoredChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeChatHistory(messages: ChatMessage[]): void {
  try {
    // Keep up to 200 messages for extended conversation retention
    const trimmed = messages.slice(-200);
    // Sanitize large editAction contents for localStorage safety
    const safePayload = trimmed.map(m => {
      if (!m.editAction) return m;
      return {
        ...m,
        editAction: {
          ...m.editAction,
          // Retain full content in memory, but cap stored local cache preview if > 40KB
          newContent: m.editAction.newContent.length > 40000 
            ? m.editAction.newContent.substring(0, 40000) 
            : m.editAction.newContent,
          originalContent: ''
        }
      };
    });
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(safePayload));
  } catch (err) {
    try {
      // Fallback on QuotaExceededError: retain last 30 messages with minimal payloads
      const minimal = messages.slice(-30).map(m => ({
        ...m,
        editAction: m.editAction ? { ...m.editAction, originalContent: '', newContent: '' } : undefined
      }));
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(minimal));
    } catch (_) {}
  }
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 6) return '****';
  // Show first 4 characters and mask the rest with 16 stars
  return key.substring(0, 4) + '****************';
}

export function truncateContent(content: string, maxChars: number = 150000): string {
  if (!content || content.length <= maxChars) return content;
  return content.substring(0, maxChars) + '\n\n[... content truncated for context window ...]';
}

function flattenFiles(files: FileItem[]): FileItem[] {
  const result: FileItem[] = [];
  for (const file of files) {
    result.push(file);
    if (file.children && file.children.length > 0) {
      result.push(...flattenFiles(file.children));
    }
  }
  return result;
}

import { renderMarkdownToHtml } from '../utils/markdownUtils';

// Markdown rendering for chat messages
function renderMessageContent(text: string): string {
  if (!text) return '';
  return renderMarkdownToHtml(text);
}

// ─────────────────────────── Component ───────────────────────────
export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  isOpen,
  onClose,
  activeFile,
  openTabs,
  mainDir,
  width,
  onResizeStart,
  onResizeReset,
  onContentChange,
  onFileContentUpdated,
  onSelectFile,
  onOpenInNewTab,
  onCreateNoteFromAI
}) => {
  // ── State ──
  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredChatHistory());
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileItem[]>([]);
  const [excludeAutoContext, setExcludeAutoContext] = useState<boolean>(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset auto-context exclusion when active file changes
  useEffect(() => {
    setExcludeAutoContext(false);
  }, [activeFile?.id]);
  // ── Dynamic State from LocalStorage / Settings ──
  const [provider, setProviderState] = useState<AIProvider>(() => {
    try { return (localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider) || DEFAULT_PROVIDER; } catch { return DEFAULT_PROVIDER; }
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODELS[provider] || DEFAULT_MODELS[DEFAULT_PROVIDER]; } catch { return DEFAULT_MODELS[DEFAULT_PROVIDER]; }
  });

  // Refresh provider and model from localStorage when panel opens or settings updated
  useEffect(() => {
    if (isOpen) {
      try {
        const storedProv = (localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider) || DEFAULT_PROVIDER;
        const storedMod = localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODELS[storedProv] || DEFAULT_MODELS[DEFAULT_PROVIDER];
        setProviderState(storedProv);
        setSelectedModel(storedMod);
      } catch {}
    }
  }, [isOpen]);

  const handleSelectModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, newModel);
    } catch (err) {
      console.error('Failed to save selected AI model:', err);
    }
  };

  const apiKey = useMemo(() => {
    return getStoredApiKey(provider);
  }, [provider, isOpen]);

  const autoAttachActiveFile = useMemo(() => {
    try {
      const val = localStorage.getItem('notestack_ai_auto_context_v1');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  }, [isOpen]);

  // ── Refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Persist chat history ──
  useEffect(() => {
    storeChatHistory(messages);
  }, [messages]);

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Render Mermaid diagrams inside AI Chat messages ──
  useEffect(() => {
    if (!isOpen) return;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });

      const nodes = document.querySelectorAll('.ai-chat-messages .mermaid-diagram-card');
      nodes.forEach(async (node, idx) => {
        const rawCode = node.getAttribute('data-mermaid-code');
        const hasSvg = Boolean(node.querySelector('svg'));
        if (rawCode && (!hasSvg || node.getAttribute('data-rendered-code') !== rawCode)) {
          const id = `ai_chat_mermaid_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          try {
            const { svg } = await mermaid.render(id, rawCode);
            node.innerHTML = svg;
            node.setAttribute('data-rendered-code', rawCode);
          } catch (err) {
            console.error('Mermaid render error in AI Chat:', err);
          }
        }
      });
    } catch (e) {}
  }, [messages, isOpen]);

  // ── Focus input when panel opens ──
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // ── Notification auto-dismiss ──
  const showNotification = useCallback((type: 'error' | 'success' | 'info', text: string) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setNotification({ type, text });
    notificationTimeoutRef.current = setTimeout(() => setNotification(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // ── Flatten all vault files for file picker & prioritize open tabs ──
  const allVaultFiles = useMemo(() => flattenFiles(mainDir.files), [mainDir.files]);

  const filteredPickerFiles = useMemo(() => {
    const openTabSet = new Set(openTabs.map(t => t.fullPath || t.path || t.id));
    const activePath = activeFile ? (activeFile.fullPath || activeFile.path || activeFile.id) : null;
    const q = filePickerQuery.toLowerCase().trim();

    let matches = allVaultFiles;
    if (q) {
      matches = allVaultFiles.filter(f => 
        f.name.toLowerCase().includes(q) ||
        (f.path && f.path.toLowerCase().includes(q))
      );
    }

    // Sort so open tabs and active file appear at the top!
    const sorted = [...matches].sort((a, b) => {
      const aKey = a.fullPath || a.path || a.id;
      const bKey = b.fullPath || b.path || b.id;

      const aActive = aKey === activePath;
      const bActive = bKey === activePath;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aOpen = openTabSet.has(aKey);
      const bOpen = openTabSet.has(bKey);
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;

      return 0;
    });

    return sorted.slice(0, 35);
  }, [allVaultFiles, filePickerQuery, openTabs, activeFile]);

  // ── Build context from active file + open tabs + attached files ──
  const buildContextString = useCallback(async (): Promise<string> => {
    const contextParts: string[] = [];

    // Helper to recursively scan text files inside attached folders
    const scanFolderContents = async (folder: FileItem): Promise<string[]> => {
      const parts: string[] = [];
      if (folder.type === 'folder' && folder.children) {
        for (const child of folder.children) {
          if (child.type === 'folder') {
            const subParts = await scanFolderContents(child);
            parts.push(...subParts);
          } else {
            const text = await getFileTextContentForAI(child);
            if (text) {
              const displayPath = child.path ? child.path.replace(/^\//, '').replace(/\//g, ' / ') : child.name;
              parts.push(`### File in attached folder "${folder.name}": "${child.name}" (${child.type})\nPath: ${displayPath}\n\n${text}`);
            }
          }
        }
      }
      return parts;
    };

    // Active file context (auto-attached unless dismissed or toggled off)
    if (activeFile && activeFile.type !== 'folder' && autoAttachActiveFile && !excludeAutoContext) {
      const text = await getFileTextContentForAI(activeFile);
      if (text) {
        const displayPath = activeFile.path ? activeFile.path.replace(/^\//, '').replace(/\//g, ' / ') : activeFile.name;
        contextParts.push(
          `## Currently Active File: "${activeFile.name}" (${activeFile.type})\nPath: ${displayPath}\n\n${text}`
        );
      }
    }

    // Manually attached files & folders
    for (const file of attachedFiles) {
      if (file.id !== activeFile?.id) {
        if (file.type === 'folder') {
          const folderFiles = await scanFolderContents(file);
          if (folderFiles.length > 0) {
            const displayFolderPath = file.path ? file.path.replace(/^\//, '').replace(/\//g, ' / ') : file.name;
            contextParts.push(
              `## Attached Folder: "${file.name}"\nPath: ${displayFolderPath}\n\n${folderFiles.join('\n\n')}`
            );
          }
        } else {
          const text = await getFileTextContentForAI(file);
          if (text) {
            const displayPath = file.path ? file.path.replace(/^\//, '').replace(/\//g, ' / ') : file.name;
            contextParts.push(
              `## Attached File: "${file.name}" (${file.type})\nPath: ${displayPath}\n\n${text}`
            );
          }
        }
      }
    }

    if (contextParts.length === 0) {
      return 'No file context is currently available.';
    }

    return contextParts.join('\n\n---\n\n');
  }, [activeFile, attachedFiles]);

  // ── Stop Generation Handler ──
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    showNotification('info', 'AI generation stopped.');
  }, [showNotification]);

  // ── Call AI API (Gemini, Groq, or OpenRouter) ──
  const callAIAPI = useCallback(async (userMessage: string, context: string, signal?: AbortSignal, chatHistory: ChatMessage[] = []): Promise<string> => {
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }

    const systemPrompt = `You are NoteStack AI — an intelligent, highly skilled AI coding, scientific, and note-taking assistant embedded in NoteStack.

SMART RESPONSE & UNLIMITED FILE/NOTE WRITING DIRECTIVES:
1. **Lightweight Chat Responses & Direct Note Action Cards**:
   - Keep chat text concise, clear, and helpful.
   - When asked to write, generate, summarize, or edit long study notes, documents, essays, guides, or code files, DO NOT dump massive text walls directly into the chat bubble text!
   - Instead, provide a brief 1-3 sentence summary in chat text, and put the full document/note content cleanly inside a file directive block so NoteStack creates/edits the file directly:
     <<<CREATE_FILE: NoteTitle.md>>>
     (full comprehensive note/document content without any length truncation or omissions)
     <<<END_CREATE>>>
     or
     <<<EDIT_FILE: ActiveNote.md>>>
     (full updated note content)
     <<<END_EDIT>>>
   - NoteStack automatically parses file directives into a 1-click "Save & Open in Note Editor" card for the user!

2. **Unlimited Generation Content Length**:
   - Always generate complete, thorough, fully detailed notes, guides, and files without skipping sections or truncating content.

3. **Minimal Clean Markdown Rules**:
   - Use clean, minimal Markdown formatting suitable for sidebar chat:
     - Clear section headers (## H2, ### H3)
     - Clean task checklists (- [ ] task)
     - Fenced code blocks (\`\`\`typescript, \`\`\`python) with exact language tags
     - Clean LaTeX inline ($e=mc^2$) and display math ($$f(x)...$$)
     - Concise GitHub-style callouts (> [!NOTE], > [!TIP], > [!WARNING])
     - Mermaid diagrams (\`\`\`mermaid) when helpful

Code & Note Directives:
- For TARGETED EDITS (modifying specific lines without replacing the rest of the file):
  <<<TARGET_EDIT: filename.ext>>>
  <<<<<<< SEARCH
  [exact existing code/lines to replace]
  =======
  [new replacement code/lines]
  >>>>>>> REPLACE
  <<<END_TARGET_EDIT>>>
- For REPLACING an entire note/file completely:
  <<<EDIT_FILE: filename.ext>>>
  (complete new file content)
  <<<END_EDIT>>>
- For CREATING a new note/file:
  <<<CREATE_FILE: filename.ext>>>
  (new file content)
  <<<END_CREATE>>>
- For APPENDING to a note/file:
  <<<APPEND_FILE: filename.ext>>>
  (content to append)
  <<<END_APPEND>>>

Current file context:
${context}`;

    // Format conversation history for OpenAI-compatible APIs (OpenRouter & Groq)
    const formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    const recentHistory = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20);
    for (const msg of recentHistory) {
      formattedMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    formattedMessages.push({
      role: 'user',
      content: userMessage
    });

    if (provider === 'openrouter') {
      // ── OpenRouter API with Free Model Fallback Queue ──
      const fallbackQueue = Array.from(new Set([
        selectedModel,
        'openrouter/free',
        'deepseek/deepseek-r1:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'nousresearch/hermes-3-llama-3.1-405b:free',
        'nvidia/nemotron-4-340b-instruct:free',
        'google/gemini-2.0-flash-exp:free',
        'google/gemma-2-9b-it:free',
        'qwen/qwen-2.5-coder-32b-instruct:free',
        'mistralai/mistral-7b-instruct:free'
      ]));

      let lastError = '';

      for (const modelId of fallbackQueue) {
        try {
          const payload = {
            model: modelId,
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 32768,
            top_p: 0.95
          };

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://notestack.app',
              'X-Title': 'NoteStack Desktop'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) return text;
          }

          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData?.error?.message || '';
          lastError = errMsg;

          if (response.status === 401) {
            throw new Error('INVALID_API_KEY');
          }

          console.warn(`OpenRouter model ${modelId} failed (${response.status}: ${errMsg}), trying fallback...`);
          continue;
        } catch (err: any) {
          if (err.message === 'INVALID_API_KEY') throw err;
          lastError = err.message || lastError;
        }
      }

      throw new Error(lastError || 'All OpenRouter free models are currently busy. Please try Groq or try again in a moment.');

    } else if (provider === 'groq') {
      // ── Groq API (OpenAI-compatible) ──
      const payload = {
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 32768,
        top_p: 0.95
      };

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || '';
        if (response.status === 429 || errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('limit')) {
          throw new Error(`QUOTA_EXCEEDED: Groq rate limit hit. Wait a moment and try again.`);
        }
        if (response.status === 401) {
          throw new Error('INVALID_API_KEY');
        }
        throw new Error(errMsg || `Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq API');
      return text;

    } else {
      // ── Gemini API with Google Official Exponential Backoff + Auto-Fallback ──
      const geminiContents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
      const recentGeminiHistory = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20);

      for (const msg of recentGeminiHistory) {
        const gRole = msg.role === 'user' ? 'user' : 'model';
        const lastContent = geminiContents[geminiContents.length - 1];
        if (lastContent && lastContent.role === gRole) {
          lastContent.parts[0].text += `\n\n${msg.content}`;
        } else {
          geminiContents.push({
            role: gRole,
            parts: [{ text: msg.content }]
          });
        }
      }

      const lastContent = geminiContents[geminiContents.length - 1];
      if (lastContent && lastContent.role === 'user') {
        lastContent.parts[0].text += `\n\n${userMessage}`;
      } else {
        geminiContents.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });
      }

      const fallbackQueue = Array.from(new Set([
        selectedModel,
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-1.5-flash'
      ]));

      let lastError = '';

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (const modelId of fallbackQueue) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const payload = {
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: geminiContents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 65536,
                topP: 0.95,
                topK: 40
              }
            };

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                signal,
                headers: { 
                  'Content-Type': 'application/json',
                  'x-goog-api-key': apiKey
                },
                body: JSON.stringify(payload)
              }
            );

            if (response.ok) {
              const data = await response.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) return text;
              
              // Handle safety rating block or finishReason
              const finishReason = data?.candidates?.[0]?.finishReason;
              if (finishReason === 'SAFETY') {
                throw new Error('Response blocked by Gemini safety filters.');
              }
            }

            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData?.error?.message || '';
            lastError = errMsg;

            // 400 (INVALID_ARGUMENT) & 403 (PERMISSION_DENIED): Do NOT retry (Syntax or API Key issue)
            if (response.status === 400 || response.status === 403) {
              if (errMsg.toLowerCase().includes('key') || response.status === 403) {
                throw new Error('INVALID_API_KEY');
              }
              throw new Error(errMsg || 'Invalid argument passed to Gemini API.');
            }

            // 429 (RESOURCE_EXHAUSTED) or 500/503 (SERVER ERROR): Exponential Backoff with Jitter!
            if (response.status === 429 || response.status >= 500 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) {
              console.warn(`Gemini ${modelId} hit ${response.status} (attempt ${attempt + 1}). Retrying with backoff...`);
              // Exponential backoff delay: 1000ms * (2^attempt) + random jitter (0-500ms)
              const backoffMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
              await sleep(backoffMs);
              continue;
            }

            break; // Break attempt loop on non-retryable error
          } catch (err: any) {
            if (err.message === 'INVALID_API_KEY') throw err;
            lastError = err.message || lastError;
          }
        }
      }

      // If all fallback models and retries failed:
      const retryMatch = lastError.match(/retry in ([\d.]+)s/i);
      const retryHint = retryMatch ? ` Try again in ~${Math.ceil(parseFloat(retryMatch[1]))} seconds.` : '';
      throw new Error(`QUOTA_EXCEEDED:${retryHint}`);
    }
  }, [apiKey, selectedModel, provider]);

  // ── Parse edit & append & create & target line actions from AI response ──
  const parseEditActions = useCallback((responseText: string) => {
    const edits: { type: 'replace' | 'append' | 'create' | 'target_edit'; fileName: string; content: string }[] = [];

    // Match TARGET_EDIT blocks (SEARCH / REPLACE format)
    const targetEditRegex = /<<<TARGET_EDIT:\s*(.+?)>>>\n([\s\S]*?)(?:<<<END_TARGET_EDIT>>>|<<<END_EDIT>>>|$)/g;
    let match;
    while ((match = targetEditRegex.exec(responseText)) !== null) {
      edits.push({ type: 'target_edit', fileName: match[1].trim(), content: match[2].trim() });
    }

    // Match EDIT_FILE blocks
    const editRegex = /<<<EDIT_FILE:\s*(.+?)>>>\n([\s\S]*?)(?:<<<END_EDIT>>>|<<<END_CREATE>>>|$)/g;
    while ((match = editRegex.exec(responseText)) !== null) {
      edits.push({ type: 'replace', fileName: match[1].trim(), content: match[2].trim() });
    }

    // Match CREATE_FILE blocks
    const createRegex = /<<<CREATE_FILE:\s*(.+?)>>>\n([\s\S]*?)(?:<<<END_CREATE>>>|<<<END_EDIT>>>|$)/g;
    while ((match = createRegex.exec(responseText)) !== null) {
      edits.push({ type: 'create', fileName: match[1].trim(), content: match[2].trim() });
    }

    // Match APPEND_FILE blocks
    const appendRegex = /<<<APPEND_FILE:\s*(.+?)>>>\n([\s\S]*?)(?:<<<END_APPEND>>>|$)/g;
    while ((match = appendRegex.exec(responseText)) !== null) {
      edits.push({ type: 'append', fileName: match[1].trim(), content: match[2].trim() });
    }

    // Match standalone <<<<<<< SEARCH ... >>>>>>> REPLACE blocks if no wrapper tag was used
    if (edits.length === 0 && (responseText.includes('<<<<<<< SEARCH') || responseText.includes('<<< SEARCH'))) {
      const activeName = activeFile?.name || 'active_file.md';
      edits.push({ type: 'target_edit', fileName: activeName, content: responseText });
    }

    return edits;
  }, [activeFile?.name]);

  // ── Send message ──
  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      showNotification('error', 'No API key configured. Open App Settings to configure your AI key.');
      return;
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachedFiles: [
        ...(activeFile ? [{ name: activeFile.name, path: activeFile.fullPath || activeFile.path }] : []),
        ...attachedFiles.filter(f => f.id !== activeFile?.id).map(f => ({ name: f.name, path: f.fullPath || f.path }))
      ]
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const context = await buildContextString();
      const responseText = await callAIAPI(text, context, signal, messages);

      // Check for edit actions in the response
      const edits = parseEditActions(responseText);
      let cleanedResponse = responseText
        .replace(/<<<TARGET_EDIT:\s*.+?>>>[\s\S]*?(?:<<<END_TARGET_EDIT>>>|<<<END_EDIT>>>|$)/gi, '')
        .replace(/<<<EDIT_FILE:\s*.+?>>>[\s\S]*?(?:<<<END_EDIT>>>|<<<END_CREATE>>>|$)/gi, '')
        .replace(/<<<CREATE_FILE:\s*.+?>>>[\s\S]*?(?:<<<END_CREATE>>>|<<<END_EDIT>>>|$)/gi, '')
        .replace(/<<<APPEND_FILE:\s*.+?>>>[\s\S]*?(?:<<<END_APPEND>>>|$)/gi, '')
        .trim();

      // If an action card is generated, ensure cleanedResponse contains only a sleek concise summary
      if (edits.length > 0) {
        const cleanName = edits[0].fileName.split('/').pop() || edits[0].fileName;
        if (!cleanedResponse || cleanedResponse.includes('```')) {
          cleanedResponse = edits[0].type === 'create' 
            ? `Generated new document **${cleanName}**. Click below to save and open in note editor:`
            : `Prepared edits for **${cleanName}**. Click below to review and apply:`;
        }
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: cleanedResponse || 'Prepared document action below:',
        timestamp: Date.now()
      };

      // If there are edit actions, attach the first one to the message with diff stats
      if (edits.length > 0) {
        const edit = edits[0];
        const cleanEditName = edit.fileName.split('/').pop() || edit.fileName;

        const matchingFile = (activeFile && (activeFile.name === cleanEditName || activeFile.name === edit.fileName || activeFile.path?.endsWith(cleanEditName)))
          ? activeFile
          : [...openTabs, ...attachedFiles, ...allVaultFiles].find(f => 
              f.name === cleanEditName || 
              f.name === edit.fileName ||
              (f.path && f.path.endsWith(cleanEditName)) ||
              (f.fullPath && f.fullPath.replace(/\\/g, '/').endsWith(cleanEditName))
            );

        if (matchingFile) {
          const originalText = matchingFile.content || '';
          let targetNewContent = edit.content;

          if (edit.type === 'target_edit') {
            targetNewContent = applySearchReplaceBlocks(originalText, edit.content);
          } else if (edit.type === 'append') {
            targetNewContent = originalText ? `${originalText.trim()}\n\n${edit.content}` : edit.content;
          }

          // Calculate line diff stats
          const oldLines = originalText.split('\n');
          const newLines = targetNewContent.split('\n');
          const added = Math.max(0, newLines.length - oldLines.length);
          const removed = Math.max(0, oldLines.length - newLines.length);

          assistantMsg.editAction = {
            type: edit.type,
            filePath: matchingFile.fullPath || matchingFile.path || edit.fileName,
            fileName: cleanEditName,
            newContent: targetNewContent,
            originalContent: originalText,
            applied: false,
            diffStats: { added, removed }
          };
        } else {
          // File does not exist yet (File Creation Action!)
          let displayFileName = edit.fileName;
          if (displayFileName.includes('/') || displayFileName.includes('\\')) {
            displayFileName = displayFileName.replace(/\\/g, '/').split('/').pop()!;
          }

          assistantMsg.editAction = {
            type: 'create',
            filePath: edit.fileName,
            fileName: displayFileName,
            newContent: edit.content,
            originalContent: '',
            applied: false
          };
        }
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'ABORTED' || abortControllerRef.current?.signal.aborted) {
        const cancelMsg: ChatMessage = {
          id: generateId(),
          role: 'system',
          content: '🛑 AI response generation stopped by user.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, cancelMsg]);
        showNotification('info', 'AI generation stopped.');
        return;
      }

      let errorMsg = 'An unexpected error occurred.';

      if (err.message === 'NO_API_KEY') {
        errorMsg = 'No API key configured. Please add your API key in Settings.';
      } else if (err.message?.startsWith('QUOTA_EXCEEDED')) {
        const hint = err.message.replace('QUOTA_EXCEEDED:', '').trim();
        if (provider === 'gemini') {
          errorMsg = `Google Gemini Daily Quota Limit Reached.${hint ? ' ' + hint : ''}\n\nPlease check your Google AI Studio quota or try adding a new key in Settings.`;
          showNotification('error', `Gemini Quota limit hit! Please check your API key in Settings.`);
        } else {
          errorMsg = `${PROVIDER_CONFIGS[provider].label} Rate Limit Reached.${hint ? ' ' + hint : ''} Please wait a few seconds and try again.`;
          showNotification('error', `Rate limit hit! Please wait a moment.`);
        }
      } else if (err.message === 'INVALID_API_KEY') {
        errorMsg = 'Invalid API key. Please check your API key in Settings.';
        showNotification('error', 'Invalid API key! Please update it in Settings.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else {
        errorMsg = err.message || errorMsg;
      }

      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'system',
        content: `❌ ${errorMsg}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      showNotification('error', errorMsg);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputText, isLoading, apiKey, activeFile, attachedFiles, openTabs, buildContextString, callAIAPI, parseEditActions, showNotification, selectedModel, provider]);

  const getTargetFolderForNewNote = useCallback((): string | undefined => {
    if (activeFile) {
      if (activeFile.type === 'folder') {
        return activeFile.path;
      }
      if (activeFile.path && activeFile.path.includes('/')) {
        const parent = activeFile.path.substring(0, activeFile.path.lastIndexOf('/'));
        if (parent && parent !== '/') return parent;
      }
      if (activeFile.moduleName && activeFile.moduleName !== mainDir.name) {
        return activeFile.moduleName;
      }
    }

    if (attachedFiles.length > 0) {
      const attached = attachedFiles[0];
      if (attached.type === 'folder') {
        return attached.path;
      }
      if (attached.path && attached.path.includes('/')) {
        const parent = attached.path.substring(0, attached.path.lastIndexOf('/'));
        if (parent && parent !== '/') return parent;
      }
      if (attached.moduleName && attached.moduleName !== mainDir.name) {
        return attached.moduleName;
      }
    }

    return undefined;
  }, [activeFile, attachedFiles, mainDir.name]);

  // ── Apply file edit & Open file in editor ──
  const handleApplyEdit = useCallback(async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.editAction) return;

    try {
      // If already applied, just find and open the file in its existing tab (or open tab if not open yet)
      if (msg.editAction.applied) {
        const existingFile = [...openTabs, ...allVaultFiles].find(f =>
          (f.fullPath && f.fullPath === msg.editAction?.filePath) ||
          (f.path && f.path === msg.editAction?.filePath) ||
          f.name === msg.editAction?.fileName
        );
        if (existingFile) {
          if (onSelectFile) {
            onSelectFile(existingFile);
          } else if (onOpenInNewTab) {
            onOpenInNewTab(existingFile);
          }
          showNotification('success', `Opened "${msg.editAction.fileName}" in editor!`);
        } else {
          showNotification('error', `Could not find "${msg.editAction.fileName}" in vault.`);
        }
        return;
      }

      if (msg.editAction.type === 'create') {
        const targetFolder = getTargetFolderForNewNote();
        if (onCreateNoteFromAI) {
          await onCreateNoteFromAI(msg.editAction.fileName, msg.editAction.newContent, targetFolder);
        }
        setMessages(prev => prev.map(m => {
          if (m.id === msgId && m.editAction) {
            return { ...m, editAction: { ...m.editAction, applied: true } };
          }
          return m;
        }));
        showNotification('success', `Created & opened "${msg.editAction.fileName}"!`);
        return;
      }

      // Write to disk via Electron API using absolute path
      let targetDiskPath = msg.editAction.filePath;
      if (!targetDiskPath || (!targetDiskPath.includes('/') && !targetDiskPath.includes('\\'))) {
        const matchingFile = allVaultFiles.find(f => 
          f.name === msg.editAction?.fileName || 
          (f.path && f.path.endsWith(msg.editAction?.fileName || ''))
        );
        if (matchingFile?.fullPath) {
          targetDiskPath = matchingFile.fullPath;
        } else if (mainDir.path) {
          const cleanMain = mainDir.path.replace(/\\/g, '/').replace(/\/$/, '');
          targetDiskPath = `${cleanMain}/${msg.editAction.fileName}`;
        }
      }

      if (window.electronAPI?.writeFileText && targetDiskPath) {
        const success = await window.electronAPI.writeFileText(targetDiskPath, msg.editAction.newContent);
        if (!success) {
          showNotification('error', 'Failed to write file to disk.');
          return;
        }
      }

      // Immediately notify App state (openTabs, activeFile, mainDir.files) in React memory!
      if (onFileContentUpdated) {
        onFileContentUpdated(msg.editAction.filePath, msg.editAction.newContent);
      } else if (onContentChange && activeFile && (activeFile.fullPath === msg.editAction.filePath || activeFile.path === msg.editAction.filePath || activeFile.name === msg.editAction.fileName)) {
        onContentChange(msg.editAction.newContent);
      }

      // Open or switch to the target file tab with updated content!
      const targetFile = [...openTabs, ...allVaultFiles].find(f => 
        (f.fullPath && f.fullPath === msg.editAction?.filePath) ||
        (f.path && f.path === msg.editAction?.filePath) ||
        f.name === msg.editAction?.fileName
      );

      if (targetFile) {
        const freshFile: FileItem = { ...targetFile, content: msg.editAction.newContent };
        if (onSelectFile) {
          onSelectFile(freshFile);
        } else if (onOpenInNewTab) {
          onOpenInNewTab(freshFile);
        }
      }

      // Mark as applied
      setMessages(prev => prev.map(m => {
        if (m.id === msgId && m.editAction) {
          return { ...m, editAction: { ...m.editAction, applied: true } };
        }
        return m;
      }));

      showNotification('success', `Opened "${msg.editAction.fileName}" in editor!`);
    } catch (err) {
      showNotification('error', `Failed to open file: ${err}`);
    }
  }, [messages, activeFile, onContentChange, onFileContentUpdated, onCreateNoteFromAI, onSelectFile, onOpenInNewTab, openTabs, allVaultFiles, showNotification, getTargetFolderForNewNote]);

  // ── Copy message ──
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showNotification('success', 'Message copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Modals for New Note & Append to Note ──
  const [newNoteModal, setNewNoteModal] = useState<{
    isOpen: boolean;
    content: string;
    filename: string;
    selectedFolder: string;
  } | null>(null);

  const [appendToNoteModal, setAppendToNoteModal] = useState<{
    isOpen: boolean;
    content: string;
    searchQuery: string;
  } | null>(null);

  // Collect all folders in vault
  const vaultFolders = useMemo(() => {
    const folders: { name: string; path: string }[] = [
      { name: `📁 Vault Root (${mainDir.name})`, path: mainDir.path || '/' }
    ];

    const scan = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'folder') {
          const itemPath = item.fullPath || item.path || item.name;
          const displayPath = item.path ? item.path.replace(/^\//, '').replace(/\//g, ' / ') : item.name;
          folders.push({ name: `📁 ${displayPath}`, path: itemPath });
          if (item.children) {
            scan(item.children);
          }
        }
      }
    };

    scan(mainDir.files || []);
    return folders;
  }, [mainDir]);

  // Open New Note Dialog
  const handleOpenNewNoteModal = useCallback((content: string) => {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const defaultTitle = lines[0]
      ? lines[0].replace(/[^a-zA-Z0-9\s-_]/g, '').substring(0, 35).trim()
      : `AI Note ${new Date().toISOString().substring(0, 10)}`;

    const targetFolder = getTargetFolderForNewNote() || mainDir.path || '/';

    setNewNoteModal({
      isOpen: true,
      content,
      filename: defaultTitle || 'AI Note',
      selectedFolder: targetFolder
    });
  }, [getTargetFolderForNewNote, mainDir.path]);

  // Submit New Note
  const handleConfirmCreateNote = useCallback(async () => {
    if (!newNoteModal || !newNoteModal.filename.trim()) return;

    let cleanName = newNoteModal.filename.trim();
    if (!cleanName.endsWith('.md') && !cleanName.endsWith('.txt') && !cleanName.includes('.')) {
      cleanName = `${cleanName}.md`;
    }

    if (onCreateNoteFromAI) {
      await onCreateNoteFromAI(cleanName, newNoteModal.content, newNoteModal.selectedFolder);
      showNotification('success', `Created note "${cleanName}" in selected location!`);
    }
    setNewNoteModal(null);
  }, [newNoteModal, onCreateNoteFromAI, showNotification]);

  // Open Append to Note Dialog
  const handleOpenAppendModal = useCallback((content: string) => {
    setAppendToNoteModal({
      isOpen: true,
      content,
      searchQuery: ''
    });
  }, []);

  // Submit Append to Selected Note
  const handleConfirmAppendToNote = useCallback(async (targetFile: FileItem) => {
    if (!appendToNoteModal) return;

    let targetPath = targetFile.fullPath || targetFile.path || targetFile.name;
    let existingContent = targetFile.content || '';

    if (!existingContent && window.electronAPI?.readFileText && targetFile.fullPath) {
      try {
        const text = await window.electronAPI.readFileText(targetFile.fullPath);
        if (text !== null) existingContent = text;
      } catch (e) {
        console.error('Error reading note file content:', e);
      }
    }

    const updatedContent = existingContent
      ? `${existingContent.trim()}\n\n${appendToNoteModal.content}`
      : appendToNoteModal.content;

    if (window.electronAPI?.writeFileText && targetFile.fullPath) {
      await window.electronAPI.writeFileText(targetFile.fullPath, updatedContent);
    }

    if (onFileContentUpdated) {
      onFileContentUpdated(targetPath, updatedContent);
    } else if (onContentChange && activeFile && (activeFile.id === targetFile.id || activeFile.fullPath === targetFile.fullPath)) {
      onContentChange(updatedContent);
    }

    showNotification('success', `Appended AI response to "${targetFile.name}"!`);
    setAppendToNoteModal(null);
  }, [appendToNoteModal, activeFile, onFileContentUpdated, onContentChange, showNotification]);

  // ── Clear chat ──
  const handleClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    showNotification('info', '🗑️ Chat history cleared.');
  }, [showNotification]);

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ── Toggle file attachment ──
  const handleToggleFileAttach = useCallback(async (file: FileItem) => {
    // Pre-extract text content so it's ready for AI context
    await getFileTextContentForAI(file);
    setAttachedFiles(prev => {
      const exists = prev.find(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      }
      return [...prev, file];
    });
  }, []);

  // ── Auto-resize textarea ──
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  if (!isOpen) return null;

  // ─────────────────────────── Render ───────────────────────────
  return (
    <div className="ai-chat-panel" style={{ width: width ? `${width}px` : undefined }}>
      {/* Resizable Width Drag Handle on Left Edge */}
      <div
        className="ai-resizer-bar"
        onMouseDown={(e) => {
          e.preventDefault();
          if (onResizeStart) onResizeStart(e);
        }}
        onDoubleClick={() => {
          if (onResizeReset) onResizeReset();
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 25,
          userSelect: 'none',
          touchAction: 'none'
        }}
        title="Drag horizontally to resize AI Section | Double-click to reset width (380px)"
      />
      {/* ── Notification Toast ── */}
      {notification && (
        <div className={`ai-notification ai-notification-${notification.type}`}>
          <AlertCircle size={14} />
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="ai-notification-close">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-logo">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="ai-chat-title">NoteStack AI</h3>
            <div className="ai-header-model-picker" style={{ marginTop: 2 }}>
              <select
                value={selectedModel}
                onChange={(e) => handleSelectModelChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 6,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {PROVIDER_CONFIGS[provider]?.models.map((m) => (
                  <option key={m.id} value={m.id} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="ai-chat-header-actions">
          <button
            className="ai-header-btn"
            onClick={handleClearChat}
            title="Clear chat history"
          >
            <RotateCcw size={14} />
          </button>
          <button className="ai-header-btn ai-close-btn" onClick={onClose} title="Close AI Panel">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div className="ai-chat-messages" ref={chatContainerRef}>
        {messages.length === 0 && (
          <div className="ai-empty-state">
            <div className="ai-empty-icon">
              <Sparkles size={32} />
            </div>
            <h4>Hello! I'm NoteStack AI</h4>
            <p>I can help you with your notes and code. I automatically have access to your currently open file.</p>
            <div className="ai-empty-suggestions">
              <button onClick={() => setInputText('Summarize this file')}>Summarize this file</button>
              <button onClick={() => setInputText('Explain the code')}>Explain the code</button>
              <button onClick={() => setInputText('Find bugs or issues')}>Find bugs</button>
              <button onClick={() => setInputText('Improve this document')}>Improve this doc</button>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`ai-message ai-message-${msg.role}`}>
            <div className="ai-message-avatar">
              {msg.role === 'user' ? (
                <User size={14} />
              ) : msg.role === 'assistant' ? (
                <Bot size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
            </div>
            <div className="ai-message-body">
              <div className="ai-message-header">
                <span className="ai-message-sender">
                  {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'NoteStack AI' : 'System'}
                </span>
                <span className="ai-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Attached files info */}
              {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                <div className="ai-message-files">
                  {msg.attachedFiles.map((f, idx) => (
                    <span key={idx} className="ai-message-file-tag">
                      <Paperclip size={10} />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}

              <div
                className="ai-message-content"
                dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }}
              />

              {/* Direct Open File Action Card */}
              {msg.editAction && (
                <div className={`copilot-diff-card ${msg.editAction.applied ? 'applied' : ''}`}>
                  <div className="copilot-diff-header">
                    <div className="copilot-diff-header-left">
                      <Sparkles size={14} className="copilot-diff-icon" />
                      <span className="copilot-diff-filename">{msg.editAction.fileName}</span>
                      <span className={`copilot-mode-badge ${msg.editAction.type}`}>
                        {msg.editAction.type === 'create'
                          ? 'NEW FILE'
                          : msg.editAction.type === 'target_edit'
                          ? 'TARGETED LINE EDIT'
                          : msg.editAction.type === 'append'
                          ? 'APPEND'
                          : 'FULL EDIT'}
                      </span>
                    </div>

                    {msg.editAction.applied && (
                      <span className="ai-edit-applied-badge">
                        <Check size={11} /> Saved & Active
                      </span>
                    )}
                  </div>

                  <div className="copilot-diff-action-body">
                    <button
                      className={`ai-edit-apply-btn ${msg.editAction.applied ? 'applied' : ''}`}
                      onClick={() => handleApplyEdit(msg.id)}
                    >
                      {msg.editAction.applied ? <FileCheck size={14} /> : <FileText size={14} />}
                      <span>
                        {msg.editAction.applied
                          ? `Open ${msg.editAction.fileName} in Editor`
                          : msg.editAction.type === 'create'
                          ? `Create & Open ${msg.editAction.fileName}`
                          : msg.editAction.type === 'target_edit'
                          ? `Apply Targeted Line Edit (${msg.editAction.fileName})`
                          : `Save & Open ${msg.editAction.fileName}`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Message actions */}
              <div className="ai-message-actions">
                <button
                  className="ai-msg-action-btn"
                  onClick={() => handleCopyMessage(msg.id, msg.content)}
                  title="Copy message"
                >
                  {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                </button>

                {msg.role === 'assistant' && (
                  <>
                    <button
                      className="ai-msg-action-btn"
                      onClick={() => handleOpenNewNoteModal(msg.content)}
                      title="Create new note with custom name & folder location"
                    >
                      <FilePlus size={12} />
                      <span style={{ fontSize: '0.62rem', marginLeft: 3 }}>New Note</span>
                    </button>

                    <button
                      className="ai-msg-action-btn"
                      onClick={() => handleOpenAppendModal(msg.content)}
                      title="Select a note file to append AI response at end"
                    >
                      <Edit3 size={12} />
                      <span style={{ fontSize: '0.62rem', marginLeft: 3 }}>Write to Note</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator with Stop button */}
        {isLoading && (
          <div className="ai-message ai-message-assistant">
            <div className="ai-message-avatar">
              <Bot size={14} />
            </div>
            <div className="ai-message-body">
              <div className="ai-typing-indicator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} className="ai-spinner" />
                  <span>Generating response...</span>
                </div>
                <button
                  className="ai-stop-inline-btn"
                  onClick={handleStopGeneration}
                  title="Stop response generation (Escape)"
                >
                  <Square size={10} fill="currentColor" />
                  <span>Stop</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="ai-chat-input-area">
        {/* File Search Picker Dropdown at the Bottom */}
        {showFilePicker && (
          <div className="ai-file-picker">
            <input
              type="text"
              placeholder="Search vault files to attach..."
              value={filePickerQuery}
              onChange={e => setFilePickerQuery(e.target.value)}
              className="ai-file-picker-search"
              autoFocus
            />
            <div className="ai-file-picker-list">
              {filteredPickerFiles.map(f => {
                const fKey = f.fullPath || f.path || f.id;
                const isActiveFile = activeFile && (activeFile.fullPath || activeFile.path || activeFile.id) === fKey;
                const isAttached = attachedFiles.some(af => af.id === f.id) || (isActiveFile && autoAttachActiveFile && !excludeAutoContext);
                const isOpenTab = openTabs.some(t => (t.fullPath || t.path || t.id) === fKey);
                const displayPath = f.path ? f.path.replace(/^\//, '').replace(/\//g, ' / ') : (f.moduleName || '');

                return (
                  <button
                    key={f.id}
                    className={`ai-file-picker-item ${isAttached ? 'attached' : ''}`}
                    onClick={() => {
                      if (isActiveFile) {
                        if (excludeAutoContext || !autoAttachActiveFile) {
                          setExcludeAutoContext(false);
                          try { localStorage.setItem('notestack_ai_auto_context_v1', 'true'); } catch {}
                        } else {
                          setExcludeAutoContext(true);
                        }
                      } else {
                        if (f.type === 'folder') {
                          handleToggleFileAttach(f);
                        } else if (window.electronAPI?.readFileText && f.fullPath && !f.content) {
                          window.electronAPI.readFileText(f.fullPath).then(content => {
                            const fileWithContent = content !== null ? { ...f, content } : f;
                            handleToggleFileAttach(fileWithContent);
                          }).catch(() => {
                            handleToggleFileAttach(f);
                          });
                        } else {
                          handleToggleFileAttach(f);
                        }
                      }
                      setShowFilePicker(false);
                      setFilePickerQuery('');
                    }}
                  >
                    <div className="ai-file-picker-info">
                      {f.type === 'folder' ? <Folder size={13} style={{ color: '#eab308' }} /> : f.type === 'code' ? <Code size={13} /> : <FileText size={13} />}
                      <span className="ai-file-picker-name">{f.name}</span>
                      {f.type === 'folder' ? (
                        <span className="ai-file-tab-badge folder" style={{ color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.3)' }}>folder</span>
                      ) : isActiveFile ? (
                        <span className="ai-file-tab-badge active">active tab</span>
                      ) : isOpenTab ? (
                        <span className="ai-file-tab-badge">open tab</span>
                      ) : null}
                      <span className="ai-file-picker-path">{displayPath}</span>
                    </div>
                    {isAttached && <FileCheck size={13} className="ai-file-picker-check" />}
                  </button>
                );
              })}
              {filteredPickerFiles.length === 0 && (
                <div className="ai-file-picker-empty">No files found</div>
              )}
            </div>
          </div>
        )}

        {/* VS Code / Cursor Style Context Bar */}
        <div className="ai-context-bar">
          <div className="ai-context-label">
            <Paperclip size={12} />
            <span>Context</span>
          </div>
          <div className="ai-context-files">
            {activeFile && autoAttachActiveFile && !excludeAutoContext && (
              <div className="ai-context-chip ai-context-auto" title={`Auto-attached: ${activeFile.name}`}>
                <FileText size={11} />
                <span>{activeFile.name}</span>
                <span className="ai-context-auto-badge">auto</span>
                <button
                  className="ai-context-remove"
                  onClick={() => setExcludeAutoContext(true)}
                  title="Remove active file from AI context"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {attachedFiles.filter(f => f.id !== activeFile?.id || excludeAutoContext).map(f => (
              <div key={f.id} className="ai-context-chip" title={f.fullPath || f.path}>
                <FileText size={11} />
                <span>{f.name}</span>
                <button
                  className="ai-context-remove"
                  onClick={() => handleToggleFileAttach(f)}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              className="ai-context-add-btn"
              onClick={() => setShowFilePicker(!showFilePicker)}
              title="Add file to context"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="ai-input-wrapper">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            placeholder={apiKey ? 'Ask NoteStack AI anything...' : 'Add API key in Settings to start...'}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <div className="ai-input-actions">
            <button
              className="ai-attach-btn"
              onClick={() => setShowFilePicker(!showFilePicker)}
              title="Attach file"
              disabled={isLoading}
            >
              <Plus size={15} />
            </button>

            {isLoading ? (
              <button
                className="ai-send-btn stop-btn active"
                onClick={handleStopGeneration}
                title="Stop AI response generation (Escape)"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                className={`ai-send-btn ${inputText.trim() ? 'active' : ''}`}
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                title="Send message (Enter)"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="ai-input-hint">
          <span>{isLoading ? 'Click Stop button or press Esc to cancel' : 'Enter to send • Shift+Enter for new line'}</span>
          {activeFile && autoAttachActiveFile && !excludeAutoContext && <span className="ai-input-context-hint">Context: {activeFile.name}</span>}
        </div>
      </div>

      {/* ── New Note Dialog Overlay ── */}
      {newNoteModal && (
        <div className="ai-modal-overlay" onClick={() => setNewNoteModal(null)}>
          <div className="ai-modal-card" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="ai-modal-title">
                <FilePlus size={16} style={{ color: 'var(--primary)' }} />
                <span>Create New Note from AI</span>
              </div>
              <button className="ai-modal-close" onClick={() => setNewNoteModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="ai-modal-body">
              <label className="ai-modal-label">Note Title / File Name</label>
              <input
                type="text"
                className="ai-modal-input"
                placeholder="e.g. Sorting_Algorithms.md"
                value={newNoteModal.filename}
                onChange={e => setNewNoteModal({ ...newNoteModal, filename: e.target.value })}
                autoFocus
              />

              <label className="ai-modal-label" style={{ marginTop: 12 }}>Save Location / Folder</label>
              <select
                className="ai-modal-select"
                value={newNoteModal.selectedFolder}
                onChange={e => setNewNoteModal({ ...newNoteModal, selectedFolder: e.target.value })}
              >
                {vaultFolders.map((f, i) => (
                  <option key={i} value={f.path}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ai-modal-footer">
              <button className="ai-modal-btn cancel" onClick={() => setNewNoteModal(null)}>Cancel</button>
              <button className="ai-modal-btn primary" onClick={handleConfirmCreateNote}>
                <FilePlus size={14} />
                <span>Create & Open Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Append to Note Dialog Overlay ── */}
      {appendToNoteModal && (
        <div className="ai-modal-overlay" onClick={() => setAppendToNoteModal(null)}>
          <div className="ai-modal-card" onClick={e => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="ai-modal-title">
                <Edit3 size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>Select Note to Append AI Content</span>
              </div>
              <button className="ai-modal-close" onClick={() => setAppendToNoteModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="ai-modal-body">
              <input
                type="text"
                className="ai-modal-input"
                placeholder="Search note files by name..."
                value={appendToNoteModal.searchQuery}
                onChange={e => setAppendToNoteModal({ ...appendToNoteModal, searchQuery: e.target.value })}
                autoFocus
              />

              <div className="ai-modal-file-list">
                {allVaultFiles
                  .filter(f => f.type === 'md' || f.name.endsWith('.md') || f.name.endsWith('.txt'))
                  .filter(f => !appendToNoteModal.searchQuery.trim() || f.name.toLowerCase().includes(appendToNoteModal.searchQuery.toLowerCase()))
                  .map(f => {
                    const isActive = activeFile && (activeFile.id === f.id || activeFile.fullPath === f.fullPath);
                    return (
                      <button
                        key={f.id}
                        className={`ai-modal-file-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleConfirmAppendToNote(f)}
                      >
                        <FileText size={14} style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }} />
                        <span className="ai-modal-file-name">{f.name}</span>
                        {isActive && <span className="ai-file-tab-badge active">active note</span>}
                        <span className="ai-modal-file-path">{f.path}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="ai-modal-footer">
              <button className="ai-modal-btn cancel" onClick={() => setAppendToNoteModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
