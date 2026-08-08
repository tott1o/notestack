import React, { useState } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Save, 
  Sliders, 
  Bot, 
  Key, 
  Check, 
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';
import type { ReadingSettings } from '../types';
import { 
  getSaveStateSettings, 
  saveSaveStateSettings, 
  clearAllFileStates, 
  clearFileTypeStates,
  getStorageMetrics,
  exportStateMemoryBackup,
  type ViewerSaveStateSettings
} from '../utils/stateMemory';
import { PROVIDER_CONFIGS, DEFAULT_MODELS, type AIProvider, maskApiKey } from './AIChatPanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readingSettings: ReadingSettings;
  onUpdateReadingSettings: (newSettings: Partial<ReadingSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  readingSettings,
  onUpdateReadingSettings
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'viewers' | 'ai'>('general');
  const [activeSubSetting, setActiveSubSetting] = useState<'md' | 'pdf' | 'docx' | 'pptx' | null>(null);

  // Viewer Save State Settings
  const [viewerSettings, setViewerSettings] = useState<ViewerSaveStateSettings>(() => getSaveStateSettings());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // AI Configuration Settings
  const [provider, setProvider] = useState<AIProvider>(() => {
    try { return (localStorage.getItem('notestack_ai_provider_v1') as AIProvider) || 'gemini'; } catch { return 'gemini'; }
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { return localStorage.getItem('notestack_ai_model_v1') || DEFAULT_MODELS[provider] || 'gemini-1.5-flash'; } catch { return 'gemini-1.5-flash'; }
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKeyValue, setShowApiKeyValue] = useState<boolean>(false);
  const [autoAttachContext, setAutoAttachContext] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('notestack_ai_auto_context_v1');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });

  // Get stored key for active provider
  const currentApiKey = React.useMemo(() => {
    try { return localStorage.getItem(`notestack_ai_key_${provider}`) || ''; } catch { return ''; }
  }, [provider]);

  // Refresh viewer settings state from localStorage whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setViewerSettings(getSaveStateSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateViewerSetting = (key: keyof ViewerSaveStateSettings, value: any) => {
    const updated = { ...viewerSettings, [key]: value };
    setViewerSettings(updated);
    saveSaveStateSettings(updated);
    showNotice('Save state settings updated!');
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    try {
      localStorage.setItem(`notestack_ai_key_${provider}`, apiKeyInput.trim());
      setApiKeyInput('');
      showNotice(`${PROVIDER_CONFIGS[provider].label} API Key saved successfully!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearApiKey = () => {
    try {
      localStorage.removeItem(`notestack_ai_key_${provider}`);
      setApiKeyInput('');
      showNotice(`${PROVIDER_CONFIGS[provider].label} API Key cleared.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectProvider = (p: AIProvider) => {
    setProvider(p);
    try { localStorage.setItem('notestack_ai_provider_v1', p); } catch {}
    const defaultMod = DEFAULT_MODELS[p];
    setSelectedModel(defaultMod);
    try { localStorage.setItem('notestack_ai_model_v1', defaultMod); } catch {}
  };

  const handleSelectModel = (m: string) => {
    setSelectedModel(m);
    try { localStorage.setItem('notestack_ai_model_v1', m); } catch {}
  };

  const handleToggleAutoContext = (val: boolean) => {
    setAutoAttachContext(val);
    try { localStorage.setItem('notestack_ai_auto_context_v1', String(val)); } catch {}
  };

  const showNotice = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: 960, 
          width: '94%', 
          height: '84vh', 
          maxHeight: 780,
          display: 'flex', 
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-main)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Modal Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)'
            }}>
              <SettingsIcon size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                NoteStack Preferences
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Configure reading, memory save states, and AI model parameters</span>
            </div>
          </div>
          
          <button 
            className="btn-icon" 
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)' }}
            title="Close Settings (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Toast Banner */}
        {saveSuccessMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            borderBottom: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            padding: '10px 24px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <Check size={16} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Dual-Column Main Layout Body: Left Sidebar + Right Content Workspace */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Settings Navigation Sidebar */}
          <div style={{
            width: 240,
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 16,
            flexShrink: 0
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, paddingLeft: 8 }}>
              Preferences Menu
            </div>

            <button
              onClick={() => setActiveTab('general')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: activeTab === 'general' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'general' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Sliders size={16} />
              <span>General Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('viewers')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: activeTab === 'viewers' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'viewers' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Save size={16} />
              <span>Viewer Memory & State</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: activeTab === 'ai' ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'transparent',
                color: activeTab === 'ai' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease',
                boxShadow: activeTab === 'ai' ? '0 4px 12px rgba(168, 85, 247, 0.25)' : 'none'
              }}
            >
              <Bot size={16} />
              <span>AI Assistant Settings</span>
            </button>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              NoteStack v1.0.0
            </div>
          </div>

          {/* Right Scrollable Content Workspace */}
          <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: 'var(--bg-main)' }}>

            {/* ────────────────── GENERAL SETTINGS TAB ────────────────── */}
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    General Preferences
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Customize visual themes, typography, and default reading behaviors.
                  </p>
                </div>
                
                {/* Theme Settings */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    App Color Theme Preset
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { id: 'full-black', label: 'Full Black', bg: '#000000', border: '#3b82f6' },
                      { id: 'dark', label: 'Dark Studio', bg: '#0f172a', border: '#6366f1' },
                      { id: 'sepia', label: 'Warm Sepia', bg: '#fbf0d9', border: '#d97706' },
                      { id: 'light', label: 'Light Paper', bg: '#ffffff', border: '#0284c7' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => onUpdateReadingSettings({ theme: t.id as any })}
                        style={{
                          padding: '14px 12px',
                          borderRadius: 10,
                          border: readingSettings.theme === t.id ? `2px solid ${t.border}` : '1px solid var(--border-color)',
                          background: t.bg,
                          color: t.id === 'light' || t.id === 'sepia' ? '#1e293b' : '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          boxShadow: readingSettings.theme === t.id ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typography Settings */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 16px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Reading Typography & Layout
                  </h5>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>Font Size</span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Base size for rendered document text ({readingSettings.fontSize}px)</span>
                      </div>
                      <input 
                        type="range" 
                        min={12} 
                        max={24} 
                        value={readingSettings.fontSize}
                        onChange={e => onUpdateReadingSettings({ fontSize: parseInt(e.target.value, 10) })}
                        style={{ width: 180 }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>Line Height</span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Vertical paragraph line spacing ({readingSettings.lineHeight})</span>
                      </div>
                      <input 
                        type="range" 
                        min={1.2} 
                        max={2.2} 
                        step={0.1}
                        value={readingSettings.lineHeight}
                        onChange={e => onUpdateReadingSettings({ lineHeight: parseFloat(e.target.value) })}
                        style={{ width: 180 }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>Font Family</span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Primary font typeface for text</span>
                      </div>
                      <select
                        value={readingSettings.fontFamily}
                        onChange={e => onUpdateReadingSettings({ fontFamily: e.target.value })}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.84rem',
                          fontWeight: 600
                        }}
                      >
                        <option value="Inter">Inter (Sans-serif)</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Georgia">Georgia (Serif)</option>
                        <option value="Fira Code">Fira Code (Monospace)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bionic & TOC Preferences */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Document Reader Features
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      <input 
                        type="checkbox"
                        checked={readingSettings.bionicReading}
                        onChange={e => onUpdateReadingSettings({ bionicReading: e.target.checked })}
                      />
                      <span>Enable Bionic Reading Mode (Bold initial letter fixations)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      <input 
                        type="checkbox"
                        checked={readingSettings.showToc}
                        onChange={e => onUpdateReadingSettings({ showToc: e.target.checked })}
                      />
                      <span>Show Table of Contents Sidebar by Default</span>
                    </label>
                  </div>
                </div>

              </div>
            )}

            {/* ────────────────── VIEWER MEMORY & STATE SAVE TAB ────────────────── */}
            {activeTab === 'viewers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Header & Strategy Overview */}
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                    State Memory & Persistence Center
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Configure how NoteStack remembers file scroll positions, PDF pages, slide numbers, zoom levels, and media timestamps.
                  </p>
                </div>

                {/* 1. Persistence Strategy Selection Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    1. Select Persistence Strategy
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      {
                        id: 'on_close_only' as const,
                        title: 'Save on Close Only',
                        badge: 'Recommended for Speed',
                        desc: '0 CPU background overhead while scrolling. State saves ONLY when closing tabs (✕).'
                      },
                      {
                        id: 'debounced_auto' as const,
                        title: 'Debounced Auto-Save',
                        badge: 'Crash Resilient',
                        desc: 'Background auto-save after user stops scrolling or editing for a configurable pause.'
                      },
                      {
                        id: 'hybrid' as const,
                        title: 'Hybrid Protection',
                        badge: 'Maximum Safety',
                        desc: 'Debounced background auto-save + instant flush on tab close and app window exit.'
                      }
                    ].map(card => {
                      const isSelected = viewerSettings.strategy === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() => handleUpdateViewerSetting('strategy', card.id)}
                          style={{
                            background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                            borderRadius: 12,
                            padding: 14,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                                {card.title}
                              </span>
                              {isSelected && <Check size={16} color="var(--primary)" />}
                            </div>
                            <span style={{
                              display: 'inline-block',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: isSelected ? 'var(--primary)' : 'var(--bg-surface)',
                              color: isSelected ? '#ffffff' : 'var(--text-muted)',
                              marginBottom: 8
                            }}>
                              {card.badge}
                            </span>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              {card.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Auto-Save Interval & LRU Eviction Settings */}
                <div style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 18,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20
                }}>
                  {/* Debounce Interval Picker */}
                  <div>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                      Auto-Save Debounce Interval
                    </label>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
                      Pause duration before writing background state changes
                    </span>
                    <select
                      value={viewerSettings.debounceDelayMs || 1500}
                      disabled={viewerSettings.strategy === 'on_close_only'}
                      onChange={e => handleUpdateViewerSetting('debounceDelayMs', parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        color: viewerSettings.strategy === 'on_close_only' ? 'var(--text-dim)' : 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        opacity: viewerSettings.strategy === 'on_close_only' ? 0.5 : 1
                      }}
                    >
                      <option value={500}>500 ms (High Frequency)</option>
                      <option value={1000}>1000 ms (1 second)</option>
                      <option value={1500}>1500 ms (1.5 seconds - Recommended)</option>
                      <option value={3000}>3000 ms (3 seconds)</option>
                    </select>
                  </div>

                  {/* LRU Eviction Limit */}
                  <div>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                      LRU Eviction Capacity Limit
                    </label>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
                      Max files to remember before auto-pruning oldest states
                    </span>
                    <select
                      value={viewerSettings.maxFileStates || 250}
                      onChange={e => handleUpdateViewerSetting('maxFileStates', parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.84rem',
                        fontWeight: 600
                      }}
                    >
                      <option value={100}>100 Documents</option>
                      <option value={250}>250 Documents (Recommended)</option>
                      <option value={500}>500 Documents</option>
                      <option value={1000}>1000 Documents</option>
                      <option value={0}>Unlimited (No Pruning)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Real-Time Storage Diagnostics & Metrics Dashboard */}
                {(() => {
                  const metrics = getStorageMetrics();
                  return (
                    <div style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-highlight)',
                      borderRadius: 12,
                      padding: 18
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            Storage Memory Dashboard
                          </h5>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {metrics.totalFilesSaved} files remembered • Estimated size: <strong>{metrics.formattedSize}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              const jsonStr = exportStateMemoryBackup();
                              const blob = new Blob([jsonStr], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `NoteStack-State-Memory-Backup-${new Date().toISOString().slice(0,10)}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              showNotice('Exported state memory backup!');
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              background: 'var(--bg-surface)',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Export Backup
                          </button>

                          <button
                            onClick={() => {
                              clearAllFileStates();
                              showNotice('Cleared all saved position states!');
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Clear All Memory
                          </button>
                        </div>
                      </div>

                      {/* Format Memory Counters Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[
                          { key: 'md' as const, label: 'Markdown', count: metrics.countByFormat.md, extKey: 'mdEnabled' as const },
                          { key: 'pdf' as const, label: 'PDF Docs', count: metrics.countByFormat.pdf, extKey: 'pdfEnabled' as const },
                          { key: 'docx' as const, label: 'Word (.docx)', count: metrics.countByFormat.docx, extKey: 'docxEnabled' as const },
                          { key: 'pptx' as const, label: 'PPTX Slides', count: metrics.countByFormat.pptx, extKey: 'pptxEnabled' as const },
                          { key: 'code' as const, label: 'Code Files', count: metrics.countByFormat.code, extKey: 'codeEnabled' as const },
                          { key: 'csv' as const, label: 'CSV Tables', count: metrics.countByFormat.csv, extKey: 'csvEnabled' as const },
                          { key: 'media' as const, label: 'Media Files', count: metrics.countByFormat.media, extKey: 'mediaEnabled' as const }
                        ].map(f => (
                          <div
                            key={f.key}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '8px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                                {f.label}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                {f.count} saved
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                clearFileTypeStates(f.key);
                                showNotice(`Cleared .${f.key} saved positions!`);
                              }}
                              disabled={f.count === 0}
                              style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'transparent',
                                color: f.count > 0 ? '#ef4444' : 'var(--text-dim)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.68rem',
                                cursor: f.count > 0 ? 'pointer' : 'default',
                                opacity: f.count > 0 ? 1 : 0.4
                              }}
                              title={`Clear all .${f.key} saved positions`}
                            >
                              Clear
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Format Toggles & Per-Detail Switches */}
                <div style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 18
                }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Granular Detail Memory Options
                  </h5>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={viewerSettings.saveScrollPosition ?? true}
                        onChange={e => handleUpdateViewerSetting('saveScrollPosition', e.target.checked)}
                      />
                      <span>Remember Scroll Position (Offset)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={viewerSettings.savePageSlide ?? true}
                        onChange={e => handleUpdateViewerSetting('savePageSlide', e.target.checked)}
                      />
                      <span>Remember PDF Page & Slide Index</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={viewerSettings.saveZoomRotation ?? true}
                        onChange={e => handleUpdateViewerSetting('saveZoomRotation', e.target.checked)}
                      />
                      <span>Remember Document Zoom & Image Rotation</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={viewerSettings.saveMediaTime ?? true}
                        onChange={e => handleUpdateViewerSetting('saveMediaTime', e.target.checked)}
                      />
                      <span>Remember Video / Audio Playback Time</span>
                    </label>
                  </div>
                </div>

              </div>
            )}

            {/* ────────────────── AI ASSISTANT SETTINGS TAB ────────────────── */}
            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    AI Assistant Preferences
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Configure AI providers, API credentials, model parameters, and context attachment options.
                  </p>
                </div>

                {/* Provider Selection */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Select AI Provider
                  </h5>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map(p => (
                      <button
                        key={p}
                        onClick={() => handleSelectProvider(p)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: provider === p ? '2px solid #c084fc' : '1px solid var(--border-color)',
                          background: provider === p ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-surface)',
                          color: provider === p ? '#c084fc' : 'var(--text-main)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          boxShadow: provider === p ? '0 4px 12px rgba(168, 85, 247, 0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {PROVIDER_CONFIGS[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Model Selection */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Target Model ({PROVIDER_CONFIGS[provider].label})
                  </h5>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PROVIDER_CONFIGS[provider].models.map(m => (
                      <label 
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: selectedModel === m.id ? 'var(--bg-surface-hover)' : 'transparent',
                          border: selectedModel === m.id ? '1px solid var(--primary)' : '1px solid transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input 
                            type="radio" 
                            name="ai_model" 
                            checked={selectedModel === m.id}
                            onChange={() => handleSelectModel(m.id)}
                          />
                          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.label}</span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{m.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* API Key Credentials */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Key size={16} />
                      <span>{PROVIDER_CONFIGS[provider].label} API Key</span>
                    </h5>
                    <span style={{ fontSize: '0.78rem', color: currentApiKey ? '#4ade80' : '#ef4444', fontWeight: 700 }}>
                      {currentApiKey ? 'Key Configured' : 'No Key Set'}
                    </span>
                  </div>

                  {currentApiKey && !showApiKeyValue && (
                    <div style={{ marginTop: 6, marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Active Saved Key:</span>
                      <code style={{ background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, color: 'var(--primary)', fontWeight: 600 }}>
                        {maskApiKey(currentApiKey)}
                      </code>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showApiKeyValue ? 'text' : 'password'}
                        placeholder={currentApiKey ? maskApiKey(currentApiKey) : `Paste ${PROVIDER_CONFIGS[provider].label} API Key...`}
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 14px',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: '0.86rem'
                        }}
                      />
                      <button
                        onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {showApiKeyValue ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <button
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: apiKeyInput.trim() ? 'pointer' : 'not-allowed',
                        opacity: apiKeyInput.trim() ? 1 : 0.5
                      }}
                    >
                      Save Key
                    </button>

                    {currentApiKey && (
                      <button
                        onClick={handleClearApiKey}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Document Auto-Context Switch */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Active Context Preferences
                  </h5>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                    <input 
                      type="checkbox"
                      checked={autoAttachContext}
                      onChange={e => handleToggleAutoContext(e.target.checked)}
                    />
                    <span>Automatically attach active document context to AI queries</span>
                  </label>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-surface-elevated)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>

      </div>

      {/* Sub-Settings Floating Dialog Pop-Up (Fixed 560px Width x 520px Height centered overlay) */}
      {activeSubSetting && (
        <div 
          className="modal-overlay"
          onClick={() => setActiveSubSetting(null)}
          style={{ zIndex: 10000000 }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: 560,
              maxWidth: '92%',
              height: 520,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
              {/* Pop-Up Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setActiveSubSetting(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {activeSubSetting === 'md' && 'Markdown (.md) Advanced Sub-Settings'}
                    {activeSubSetting === 'pdf' && 'PDF Reader Advanced Sub-Settings'}
                    {activeSubSetting === 'docx' && 'Word (.docx) Advanced Sub-Settings'}
                    {activeSubSetting === 'pptx' && 'PowerPoint (.pptx) Advanced Sub-Settings'}
                  </h4>
                </div>

                <button 
                  className="btn-icon" 
                  onClick={() => setActiveSubSetting(null)}
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Pop-Up Scrollable Body */}
              <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* Enable / Disable State Control */}
                <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Save State Memory
                      </h5>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Persist scroll position, page index, and scale across restarts.
                      </span>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={
                          activeSubSetting === 'md' ? viewerSettings.mdEnabled :
                          activeSubSetting === 'pdf' ? viewerSettings.pdfEnabled :
                          activeSubSetting === 'docx' ? viewerSettings.docxEnabled :
                          viewerSettings.pptxEnabled
                        }
                        onChange={e => {
                          const key = activeSubSetting === 'md' ? 'mdEnabled' :
                                      activeSubSetting === 'pdf' ? 'pdfEnabled' :
                                      activeSubSetting === 'docx' ? 'docxEnabled' : 'pptxEnabled';
                          handleUpdateViewerSetting(key, e.target.checked);
                        }}
                      />
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {(activeSubSetting === 'md' ? viewerSettings.mdEnabled :
                          activeSubSetting === 'pdf' ? viewerSettings.pdfEnabled :
                          activeSubSetting === 'docx' ? viewerSettings.docxEnabled :
                          viewerSettings.pptxEnabled) ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                </div>



                {/* Format Specific Feature Flags */}
                {activeSubSetting === 'md' && (
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Markdown Editor Preferences
                    </h5>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Synchronize line numbers gutter scroll</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Auto-close markdown pairs (**bold**, *italic*, code, $, (, [, &#123;)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Highlight active line in editor</span>
                    </label>
                  </div>
                )}

                {activeSubSetting === 'pdf' && (
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      PDF Reader Preferences
                    </h5>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Smooth canvas text rendering</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Auto-scroll search matches on Enter</span>
                    </label>
                  </div>
                )}

                {activeSubSetting === 'docx' && (
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Word Document Preferences
                    </h5>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Continuous A4 page sheet layout</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Automatic chapter ID anchors for TOC</span>
                    </label>
                  </div>
                )}

                {activeSubSetting === 'pptx' && (
                  <div style={{ background: 'var(--bg-surface-elevated)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      PowerPoint Preferences
                    </h5>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>HTML5 canvas slide scale optimization</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      <input type="checkbox" defaultChecked />
                      <span>Keyboard arrow key slide navigation</span>
                    </label>
                  </div>
                )}

              </div>

              {/* Pop-Up Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-surface-elevated)',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setActiveSubSetting(null)}
                  style={{
                    padding: '6px 18px',
                    borderRadius: 6,
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer'
                  }}
                >
                  Save & Close Sub-Settings
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
};
