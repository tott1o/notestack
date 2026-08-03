import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Send,
  Settings,
  Key,
  Eye,
  EyeOff,
  Plus,
  Paperclip,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
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

// ─────────────────────────── Types ───────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachedFiles?: { name: string; path: string }[];
  editAction?: {
    type: 'replace' | 'append' | 'create';
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

type AIProvider = 'gemini' | 'groq' | 'openrouter';

const PROVIDER_CONFIGS: Record<AIProvider, { label: string; keyHint: string; keyUrl: string; models: { id: string; label: string; desc: string }[] }> = {
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

const DEFAULT_PROVIDER: AIProvider = 'gemini';
const DEFAULT_MODELS: Record<AIProvider, string> = {
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

function storeApiKey(provider: AIProvider, apiKeyValue: string): void {
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
    // Keep only last 100 messages to avoid storage bloat
    const trimmed = messages.slice(-100);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to store chat history:', err);
  }
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.substring(0, 4) + '••••••••••••' + key.substring(key.length - 4);
}

function truncateContent(content: string, maxChars: number = 8000): string {
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

// Simple markdown-like rendering for chat messages
function renderMessageContent(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="ai-code-block"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
}

// ─────────────────────────── Component ───────────────────────────
export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  isOpen,
  onClose,
  activeFile,
  openTabs,
  mainDir,
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
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(() => {
    try { return (localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider) || DEFAULT_PROVIDER; } catch { return DEFAULT_PROVIDER; }
  });
  const [apiKey, setApiKey] = useState(() => getStoredApiKey((() => { try { return (localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider) || DEFAULT_PROVIDER; } catch { return DEFAULT_PROVIDER; } })()));
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileItem[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODELS[DEFAULT_PROVIDER]; } catch { return DEFAULT_MODELS[DEFAULT_PROVIDER]; }
  });
  const [showAltProviders, setShowAltProviders] = useState(false);
  const [showKeyManage, setShowKeyManage] = useState(false);

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
              parts.push(`### File in attached folder "${folder.name}": "${child.name}" (${child.type})\nPath: ${displayPath}\n\n${truncateContent(text, 3000)}`);
            }
          }
        }
      }
      return parts;
    };

    // Active file context (auto-attached)
    if (activeFile && activeFile.type !== 'folder') {
      const text = await getFileTextContentForAI(activeFile);
      if (text) {
        const displayPath = activeFile.path ? activeFile.path.replace(/^\//, '').replace(/\//g, ' / ') : activeFile.name;
        contextParts.push(
          `## Currently Active File: "${activeFile.name}" (${activeFile.type})\nPath: ${displayPath}\n\n${truncateContent(text)}`
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
              `## Attached File: "${file.name}" (${file.type})\nPath: ${displayPath}\n\n${truncateContent(text, 4000)}`
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

    const systemPrompt = `You are NoteStack AI — an intelligent coding and note-taking assistant embedded in a desktop file manager app called NoteStack. 

Your capabilities:
1. Answer questions about the user's currently open files
2. Perform line-by-line code analysis, refactoring, and note editing like VS Code Copilot
3. Explain code, summarize documents, and generate content
4. When the user asks you to edit or replace a file, respond with the COMPLETE updated file content wrapped in an edit block:
   <<<EDIT_FILE: filename.ext>>>
   (complete new file content here)
   <<<END_EDIT>>>
5. When the user asks you to append or add content to the end of a file, respond with an append block:
   <<<APPEND_FILE: filename.ext>>>
   (new content to append at the end of the file)
   <<<END_APPEND>>>

Rules:
- Provide comprehensive, exhaustive, and fully detailed responses without truncating or shortening any code, notes, or file outputs.
- Never omit code or use placeholders like "// rest of code...". Always output complete, full file contents regardless of length.
- Use markdown formatting in your responses
- When editing files, provide the complete updated file so line diffs can be accurately calculated
- If you're asked about a file that isn't in context, let the user know they can attach it
- Be helpful, friendly, and proactive in suggesting improvements

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

  // ── Parse edit & append & create actions from AI response ──
  const parseEditActions = useCallback((responseText: string) => {
    const edits: { type: 'replace' | 'append' | 'create'; fileName: string; content: string }[] = [];

    // Match EDIT_FILE blocks
    const editRegex = /<<<EDIT_FILE:\s*(.+?)>>>\n([\s\S]*?)(?:<<<END_EDIT>>>|<<<END_CREATE>>>|$)/g;
    let match;
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

    return edits;
  }, []);

  // ── Send message ──
  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      showNotification('error', 'No API key configured. Open Settings to add your API key.');
      setShowSettings(true);
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
        .replace(/<<<EDIT_FILE:\s*.+?>>>\n[\s\S]*?<<<END_EDIT>>>/g, '')
        .replace(/<<<APPEND_FILE:\s*.+?>>>\n[\s\S]*?<<<END_APPEND>>>/g, '')
        .trim();

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: cleanedResponse || 'VS Code Copilot style edit prepared. Review line diff below:',
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

          if (edit.type === 'append') {
            targetNewContent = originalText ? `${originalText.trim()}\n\n${edit.content}` : edit.content;
          }

          assistantMsg.editAction = {
            type: edit.type,
            filePath: matchingFile.fullPath || matchingFile.path || edit.fileName,
            fileName: cleanEditName,
            newContent: targetNewContent,
            originalContent: originalText,
            applied: false
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
        errorMsg = 'No API key configured. Please add your Gemini API key in Settings.';
        setShowSettings(true);
      } else if (err.message?.startsWith('QUOTA_EXCEEDED')) {
        const hint = err.message.replace('QUOTA_EXCEEDED:', '').trim();
        if (provider === 'gemini') {
          errorMsg = `Google Gemini Daily Quota Limit Reached.${hint ? ' ' + hint : ''}\n\nPlease check your Google AI Studio quota or try adding a new key in Settings.`;
          showNotification('error', `Gemini Quota limit hit! Please check your API key in Settings.`);
        } else {
          errorMsg = `${PROVIDER_CONFIGS[provider].label} Rate Limit Reached.${hint ? ' ' + hint : ''} Please wait a few seconds and try again.`;
          showNotification('error', `Rate limit hit! Please wait a moment.`);
        }
        setShowSettings(true);
      } else if (err.message === 'INVALID_API_KEY') {
        errorMsg = 'Invalid API key. Please check your API key in Settings.';
        showNotification('error', 'Invalid API key! Please update it in Settings.');
        setShowSettings(true);
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

  const handleCreateNoteFromAI = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const defaultTitle = lines[0]
      ? lines[0].replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 30).trim()
      : `AI Note ${new Date().toISOString().substring(0, 10)}`;
    const title = prompt('Enter a name for the new note:', defaultTitle || 'AI Note');
    if (!title || !title.trim()) return;

    const targetFolder = getTargetFolderForNewNote();
    if (onCreateNoteFromAI) {
      onCreateNoteFromAI(title.trim(), content, targetFolder);
      showNotification('success', `Created note "${title.trim()}.md" in ${targetFolder || 'vault'}!`);
    }
  };

  const handleWriteToActiveFile = (content: string) => {
    if (!activeFile) return;
    const currentContent = activeFile.content || '';
    const newContent = currentContent ? `${currentContent}\n\n${content}` : content;
    
    if (onFileContentUpdated && (activeFile.fullPath || activeFile.path)) {
      onFileContentUpdated(activeFile.fullPath || activeFile.path || activeFile.name, newContent);
    } else if (onContentChange) {
      onContentChange(newContent);
    }
    
    showNotification('success', `Written AI content into "${activeFile.name}"`);
  };

  // ── Save API key ──
  const handleSaveApiKey = useCallback(() => {
    const key = apiKeyInput.trim();
    if (!key) {
      setApiKeyError('Please enter a valid API key');
      return;
    }
    if (key.length < 20) {
      setApiKeyError('API key seems too short. Please check and try again.');
      return;
    }
    storeApiKey(provider, key);
    setApiKey(key);
    setApiKeyInput('');
    setApiKeyError('');
    setShowApiKeyValue(false);
    showNotification('success', `🔑 ${PROVIDER_CONFIGS[provider].label} API key saved!`);
  }, [apiKeyInput, showNotification, provider]);

  // ── Remove API key ──
  const handleRemoveApiKey = useCallback(() => {
    storeApiKey(provider, '');
    setApiKey('');
    showNotification('info', '🔑 API key removed.');
  }, [showNotification, provider]);

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
    <div className="ai-chat-panel">
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
            <div className="ai-header-model-picker">
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  try { localStorage.setItem(MODEL_STORAGE_KEY, e.target.value); } catch {}
                  showNotification('info', `Model set to ${e.target.value}`);
                }}
                className="ai-header-model-select"
                title="Choose AI Model"
              >
                {PROVIDER_CONFIGS[provider].models.map(m => (
                  <option key={m.id} value={m.id}>
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
          <button
            className="ai-header-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={14} />
          </button>
          <button className="ai-header-btn ai-close-btn" onClick={onClose} title="Close AI Panel">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="ai-settings-panel">
          {/* ── Collapsible Provider Switcher ── */}
          <div style={{ marginBottom: 12 }}>
            <button
              className="ai-alt-providers-toggle"
              onClick={() => setShowAltProviders(!showAltProviders)}
            >
              {showAltProviders ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>{showAltProviders ? 'Hide Provider Selection' : `Provider: ${PROVIDER_CONFIGS[provider].label} (Change)`}</span>
            </button>

            {showAltProviders && (
              <div className="ai-provider-tabs" style={{ marginTop: 8 }}>
                {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map(p => (
                  <button
                    key={p}
                    className={`ai-provider-tab ${provider === p ? 'active' : ''}`}
                    onClick={() => {
                      setProvider(p);
                      try { localStorage.setItem(PROVIDER_STORAGE_KEY, p); } catch {}
                      const storedKey = getStoredApiKey(p);
                      setApiKey(storedKey);
                      // Switch to that provider's default model
                      const newModel = DEFAULT_MODELS[p];
                      setSelectedModel(newModel);
                      try { localStorage.setItem(MODEL_STORAGE_KEY, newModel); } catch {}
                      setApiKeyInput('');
                      setApiKeyError('');
                      showNotification('info', `Switched to ${PROVIDER_CONFIGS[p].label}`);
                    }}
                  >
                    {PROVIDER_CONFIGS[p].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── API Key ── */}
          <div style={{ marginTop: 12 }}>
            <div className="ai-settings-title" style={{ marginBottom: 8 }}>
              <Key size={14} />
              <span>{PROVIDER_CONFIGS[provider].label} API Key</span>
            </div>

            {apiKey ? (
              <div style={{ marginTop: 4 }}>
                <button
                  className="ai-alt-providers-toggle"
                  onClick={() => setShowKeyManage(!showKeyManage)}
                >
                  {showKeyManage ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>{showKeyManage ? 'Hide Key Details' : 'API Key Configured (Manage)'}</span>
                </button>

                {showKeyManage && (
                  <div className="ai-key-status-container" style={{ marginTop: 8 }}>
                    <div className="ai-key-status-row">
                      <div className="ai-key-badge ai-key-active">
                        <Check size={12} />
                        <span>Key active: {maskApiKey(apiKey)}</span>
                      </div>
                      <button
                        className="ai-key-remove-btn"
                        onClick={() => {
                          handleRemoveApiKey();
                          setShowKeyManage(false);
                        }}
                      >
                        <Trash2 size={12} />
                        <span>Remove Key</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ai-key-form">
                <div className="ai-key-input-wrapper">
                  <input
                    type={showApiKeyValue ? 'text' : 'password'}
                    placeholder={`Enter your ${PROVIDER_CONFIGS[provider].label} API key...`}
                    value={apiKeyInput}
                    onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
                    className="ai-key-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    className="ai-key-eye-btn"
                    onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                    title={showApiKeyValue ? 'Hide key' : 'Show key'}
                  >
                    {showApiKeyValue ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {apiKeyError && (
                  <div className="ai-key-error">
                    <AlertCircle size={12} />
                    <span>{apiKeyError}</span>
                  </div>
                )}
                <button className="ai-key-save-btn" onClick={handleSaveApiKey}>
                  <Key size={14} />
                  <span>Save API Key</span>
                </button>
                <p className="ai-key-hint">
                  {PROVIDER_CONFIGS[provider].keyHint}{' '}
                  <a href={PROVIDER_CONFIGS[provider].keyUrl} target="_blank" rel="noopener noreferrer">
                    {provider === 'openrouter' ? 'openrouter.ai/keys' : provider === 'groq' ? 'console.groq.com' : 'Google AI Studio'}
                  </a>
                  {provider === 'openrouter' && <span style={{ color: '#38bdf8', fontWeight: 600 }}> — 200+ AI Models & Free Tier</span>}
                  {provider === 'groq' && <span style={{ color: '#34d399', fontWeight: 600 }}> — Free, No Credit Card Needed</span>}
                </p>
              </div>
            )}
          </div>

          {/* ── Model Selector ── */}
          <div style={{ marginTop: 14, borderTop: '1px solid rgba(168,85,247,0.1)', paddingTop: 12 }}>
            <div className="ai-settings-title" style={{ marginBottom: 8 }}>
              <Sparkles size={14} />
              <span>Model</span>
            </div>
            <select
              className="ai-model-select"
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                try { localStorage.setItem(MODEL_STORAGE_KEY, e.target.value); } catch {}
                const found = PROVIDER_CONFIGS[provider].models.find(m => m.id === e.target.value);
                showNotification('info', `Switched to ${found?.label || e.target.value}`);
              }}
            >
              {PROVIDER_CONFIGS[provider].models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Context Bar: Shows currently attached files ── */}
      <div className="ai-context-bar">
        <div className="ai-context-label">
          <Paperclip size={12} />
          <span>Context</span>
        </div>
        <div className="ai-context-files">
          {activeFile && (
            <div className="ai-context-chip ai-context-auto" title={`Auto-attached: ${activeFile.name}`}>
              <FileText size={11} />
              <span>{activeFile.name}</span>
              <span className="ai-context-auto-badge">auto</span>
            </div>
          )}
          {attachedFiles.filter(f => f.id !== activeFile?.id).map(f => (
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
                      <span className="copilot-mode-badge">{msg.editAction.type}</span>
                    </div>

                    {msg.editAction.applied && (
                      <span className="ai-edit-applied-badge">
                        <Check size={11} /> Saved & Active
                      </span>
                    )}
                  </div>

                  <button
                    className="ai-edit-apply-btn"
                    onClick={() => handleApplyEdit(msg.id)}
                  >
                    <FileText size={14} />
                    <span>
                      {msg.editAction.applied
                        ? `Open ${msg.editAction.fileName} in Editor`
                        : msg.editAction.type === 'create'
                        ? `Create & Open ${msg.editAction.fileName}`
                        : `Save & Open ${msg.editAction.fileName}`}
                    </span>
                  </button>
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
                      onClick={() => handleCreateNoteFromAI(msg.content)}
                      title="Create new note file from response"
                    >
                      <FilePlus size={12} />
                      <span style={{ fontSize: '0.62rem', marginLeft: 3 }}>New Note</span>
                    </button>

                    {activeFile && activeFile.type === 'md' && (
                      <button
                        className="ai-msg-action-btn"
                        onClick={() => handleWriteToActiveFile(msg.content)}
                        title={`Append response to active file (${activeFile.name})`}
                      >
                        <Edit3 size={12} />
                        <span style={{ fontSize: '0.62rem', marginLeft: 3 }}>Write to Note</span>
                      </button>
                    )}
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
                const isAttached = attachedFiles.some(af => af.id === f.id) || f.id === activeFile?.id;
                const fKey = f.fullPath || f.path || f.id;
                const isActiveFile = activeFile && (activeFile.fullPath || activeFile.path || activeFile.id) === fKey;
                const isOpenTab = openTabs.some(t => (t.fullPath || t.path || t.id) === fKey);
                const displayPath = f.path ? f.path.replace(/^\//, '').replace(/\//g, ' / ') : (f.moduleName || '');

                return (
                  <button
                    key={f.id}
                    className={`ai-file-picker-item ${isAttached ? 'attached' : ''}`}
                    onClick={() => {
                      if (f.id !== activeFile?.id) {
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
            {activeFile && (
              <div className="ai-context-chip ai-context-auto" title={`Auto-attached: ${activeFile.name}`}>
                <FileText size={11} />
                <span>{activeFile.name}</span>
                <span className="ai-context-auto-badge">auto</span>
              </div>
            )}
            {attachedFiles.filter(f => f.id !== activeFile?.id).map(f => (
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
          {activeFile && <span className="ai-input-context-hint">Context: {activeFile.name}</span>}
        </div>
      </div>
    </div>
  );
};
