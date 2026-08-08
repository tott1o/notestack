import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Video, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  RotateCw, 
  Gauge, 
  Sparkles,
  FileDown,
  Check,
  HardDrive
} from 'lucide-react';
import type { FileItem } from '../types';
import { getFileState, saveFileState, type FileState } from '../utils/stateMemory';

interface VideoViewerProps {
  file: FileItem;
  onExportNotesToMarkdown?: (markdownContent: string) => void;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ file, onExportNotesToMarkdown }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  const [lectureNotes, setLectureNotes] = useState<string>('');
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  const isDuplicateTab = Boolean(file.isDuplicate || (file.tabId && file.tabId.includes('_dup_')));
  const fileKey = file.fullPath || file.id;

  const currentTimeRef = useRef<number>(0);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    setDuration(videoRef.current.duration || 0);
    if (!isDuplicateTab) {
      currentTimeRef.current = time;
    }
  };

  // Save video timestamp ONLY on tab close / unmount
  useEffect(() => {
    return () => {
      if (!isDuplicateTab && currentTimeRef.current > 0) {
        saveFileState(fileKey, { currentTime: currentTimeRef.current });
      }
    };
  }, [fileKey, isDuplicateTab]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    const saved: FileState = isDuplicateTab ? {} : getFileState(fileKey);
    if (saved.currentTime && saved.currentTime < videoRef.current.duration) {
      videoRef.current.currentTime = saved.currentTime;
      setCurrentTime(saved.currentTime);
    }
  };

  const videoUrl = useMemo(() => {
    if (file.url) return file.url;
    if (file.arrayBuffer) {
      const mime = `video/${file.extension || 'mp4'}`;
      const blob = new Blob([file.arrayBuffer], { type: mime });
      return URL.createObjectURL(blob);
    }
    return '';
  }, [file]);

  const formattedSize = useMemo(() => {
    if (!file.size) return 'Unknown size';
    if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
    return `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  }, [file.size]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  const handleExportVideoNotes = () => {
    let md = `# Lecture Video Notes: ${file.name}\n\n`;
    md += `*Video Duration: ${formatTime(duration)}*\n\n`;
    md += `## 📝 Lecture Key Concepts & Summary\n\n`;
    md += lectureNotes.trim() || '*No lecture notes typed yet.*';

    if (onExportNotesToMarkdown) {
      onExportNotesToMarkdown(md);
    } else {
      navigator.clipboard.writeText(md);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#070a12', color: 'var(--text-main)' }}>
      {/* Video Toolbar Header */}
      <div className="pdf-toolbar" style={{ flexWrap: 'wrap', height: 'auto', padding: '10px 18px', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Video size={20} style={{ color: '#a855f7' }} />
          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>{file.name}</span>
          <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>
            VIDEO LECTURE .{file.extension || 'MP4'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <HardDrive size={13} /> {formattedSize}
          </span>
          <span>•</span>
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>

        {/* Speed Watch Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-surface-elevated)', padding: '3px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginLeft: 'auto' }}>
          <Gauge size={14} style={{ color: 'var(--accent-amber)', marginRight: 4 }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>SPEED:</span>
          {[0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
            <button
              key={rate}
              className={`btn-icon ${playbackRate === rate ? 'active' : ''}`}
              style={{ width: 34, height: 24, fontSize: '0.75rem', fontWeight: 700 }}
              onClick={() => changePlaybackRate(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Player & Side Lecture Note Drawer */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video Canvas Player */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', position: 'relative', overflow: 'hidden' }}>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              style={{ width: '100%', height: 'calc(100% - 60px)', objectFit: 'contain' }}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Video size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p>Video format not supported or URL unavailable.</p>
            </div>
          )}

          {/* Player Custom Control Bar */}
          <div style={{ height: 60, background: 'rgba(15, 23, 42, 0.95)', borderTop: '1px solid var(--border-color)', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn-icon" onClick={togglePlay} style={{ width: 34, height: 34, background: 'var(--primary)', color: 'white' }}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
            </button>

            <button className="btn-icon" onClick={() => skipSeconds(-10)} title="Rewind 10 Seconds">
              <RotateCcw size={16} />
            </button>

            <button className="btn-icon" onClick={() => skipSeconds(10)} title="Forward 10 Seconds">
              <RotateCw size={16} />
            </button>

            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 90 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Seek Slider */}
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />

            {/* Mute toggle */}
            <button className="btn-icon" onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Fullscreen */}
            <button className="btn-icon" onClick={() => {
              if (videoRef.current) {
                videoRef.current.requestFullscreen();
              }
            }}>
              <Maximize size={18} />
            </button>
          </div>
        </div>

        {/* Side Lecture Note Drawer */}
        <aside style={{ width: 360, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)', padding: 20, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} style={{ color: 'var(--accent-amber)' }} /> Video Lecture Scratchpad Notes
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Type your notes while watching this video lecture. Click <strong>Export Notes</strong> to save as a Markdown file!
          </p>

          <textarea
            style={{
              flex: 1,
              minHeight: 250,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              fontSize: '0.88rem',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-main)',
              lineHeight: 1.6,
              outline: 'none',
              resize: 'none',
              marginBottom: 16
            }}
            placeholder={`# Notes for ${file.name}\n\n- Key concept at ${formatTime(currentTime)}:\n- `}
            value={lectureNotes}
            onChange={e => setLectureNotes(e.target.value)}
          />

          <button className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.88rem', justifyContent: 'center' }} onClick={handleExportVideoNotes}>
            {copiedExport ? <Check size={16} /> : <FileDown size={16} />}
            <span>{copiedExport ? 'Copied to Clipboard!' : 'Export Lecture Notes to .md'}</span>
          </button>
        </aside>
      </div>
    </div>
  );
};
