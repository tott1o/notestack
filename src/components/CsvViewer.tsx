import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Table, Edit3, Eye, Search, Download, Check, Save, ExternalLink, Database, AlertCircle } from 'lucide-react';
import type { FileItem } from '../types';
import { getFileState, saveFileState } from '../utils/stateMemory';

interface CsvViewerProps {
  file: FileItem;
  onContentChange: (newContent: string) => void;
}

export const CsvViewer: React.FC<CsvViewerProps> = ({ file, onContentChange }) => {
  const isDuplicateTab = Boolean(file.isDuplicate || (file.tabId && file.tabId.includes('_dup_')));
  const fileKey = file.fullPath || file.id;

  const [csvText, setCsvText] = useState<string>(file.content || '');
  const [loadAllRows, setLoadAllRows] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'raw'>(() => {
    const saved = isDuplicateTab ? {} : getFileState(fileKey);
    return (saved.viewMode as 'grid' | 'raw') || 'grid';
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const saved = isDuplicateTab ? {} : getFileState(fileKey);
    return saved.searchQuery || '';
  });
  const [isSaved, setIsSaved] = useState<boolean>(true);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restore state when opening CSV file
  useLayoutEffect(() => {
    setCsvText(file.content || '');
    setIsSaved(true);
    setLoadAllRows(false);

    const saved = isDuplicateTab ? {} : getFileState(fileKey);
    if (saved.searchQuery) setSearchQuery(saved.searchQuery);
    if (saved.viewMode) setViewMode(saved.viewMode as 'grid' | 'raw');

    if (saved.scrollTop && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = saved.scrollTop;
    }
  }, [file.id, fileKey, isDuplicateTab]);

  const handleCsvScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isDuplicateTab) {
      saveFileState(fileKey, { scrollTop: e.currentTarget.scrollTop, searchQuery, viewMode });
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const isLargeDataset = useMemo(() => {
    const size = file.size || (file.content ? file.content.length : 0);
    const lineCount = (file.content || csvText).split('\n').length;
    return size > 500000 || lineCount > 5000;
  }, [file.size, file.content, csvText]);

  const handleOpenExternal = async () => {
    if (file.fullPath && window.electronAPI?.openExternalFile) {
      await window.electronAPI.openExternalFile(file.fullPath);
    } else {
      handleExportCsv();
    }
  };

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCsvText(val);
    setIsSaved(false);
    onContentChange(val);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setIsSaved(true), 600);
  };

  // Safe parsing for CSV data grid with 100 row truncation when > 500 total rows
  const parsedGrid = useMemo(() => {
    if (!csvText.trim()) return { headers: [], rows: [], totalRowsCount: 0, isTruncated: false };
    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const allSampleLines = lines.slice(1);
      const totalRowsCount = allSampleLines.length;

      // Rule: If total rows > 500, only load first 100 unless user explicitly clicks "Load All"
      const isTruncated = totalRowsCount > 500 && !loadAllRows;
      const displayLines = isTruncated ? allSampleLines.slice(0, 100) : allSampleLines;

      const rows = displayLines.map((line, rIndex) => {
        const cells = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        return { id: rIndex, cells };
      });
      return { headers, rows, totalRowsCount, isTruncated };
    } catch (err) {
      console.error("CSV Parsing Error:", err);
      return { headers: [], rows: [], totalRowsCount: 0, isTruncated: false };
    }
  }, [csvText, loadAllRows]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return parsedGrid.rows;
    const q = searchQuery.toLowerCase();
    return parsedGrid.rows.filter(row => 
      row.cells.some(cell => cell.toLowerCase().includes(q))
    );
  }, [parsedGrid.rows, searchQuery]);

  const handleCellEdit = (rowIndex: number, colIndex: number, newValue: string) => {
    const newRows = parsedGrid.rows.map(row => {
      if (row.id === rowIndex) {
        const updatedCells = [...row.cells];
        updatedCells[colIndex] = newValue;
        return { ...row, cells: updatedCells };
      }
      return row;
    });

    const newCsvContent = [
      parsedGrid.headers.join(','),
      ...newRows.map(r => r.cells.join(','))
    ].join('\n');

    setCsvText(newCsvContent);
    setIsSaved(false);
    onContentChange(newCsvContent);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setIsSaved(true), 600);
  };

  const handleExportCsv = () => {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.name || 'dataset.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="csv-viewer-container">
      {/* CSV Header Toolbar */}
      <div className="csv-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-main)' }}>
            <Table size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>{file.name}</span>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', gap: 2 }}>
            <button className={`mode-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
              <Eye size={14} /> Data Grid
            </button>
            <button className={`mode-btn ${viewMode === 'raw' ? 'active' : ''}`} onClick={() => setViewMode('raw')}>
              <Edit3 size={14} /> Raw CSV
            </button>
          </div>
        </div>

        {/* Search Bar in Grid View */}
        {viewMode === 'grid' && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="csv-search-input"
              style={{ paddingLeft: 30 }}
              placeholder="Search table records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* External App Launch Button */}
          <button 
            className="btn-primary" 
            onClick={handleOpenExternal}
            style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Open CSV Dataset in Microsoft Excel / External Viewer"
          >
            <ExternalLink size={14} />
            <span>Open in External App</span>
          </button>

          <button className="tool-btn" onClick={handleExportCsv} title="Download CSV File">
            <Download size={14} />
            <span>Export</span>
          </button>

          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isSaved ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontSize: '0.78rem', fontWeight: 600 }}>
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            {isSaved ? 'Saved' : 'Saving...'}
          </span>
        </div>
      </div>

      {/* Truncation Notice Banner (When > 500 rows, loads first 100 rows) */}
      {parsedGrid.isTruncated && viewMode === 'grid' && (
        <div style={{ padding: '10px 20px', background: 'rgba(56, 189, 248, 0.12)', borderBottom: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-cyan)', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={16} />
            <span>⚡ Large dataset: Showing first 100 rows out of <strong>{parsedGrid.totalRowsCount}</strong> total rows for performance optimization.</span>
          </div>
          <button 
            onClick={() => setLoadAllRows(true)}
            style={{ padding: '4px 14px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Load All {parsedGrid.totalRowsCount} Rows
          </button>
        </div>
      )}

      {/* Extremely Large Dataset Warning */}
      {isLargeDataset && (
        <div style={{ padding: '12px 20px', background: 'rgba(245, 158, 11, 0.12)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-amber)', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} />
            <span>Extremely large CSV file detected. To edit smoothly without lag, open directly in Excel or external data tool.</span>
          </div>
          <button 
            className="btn-primary"
            onClick={handleOpenExternal}
            style={{ padding: '4px 12px', fontSize: '0.78rem', background: 'var(--accent-amber)', color: '#000', fontWeight: 700 }}
          >
            Launch in Excel
          </button>
        </div>
      )}

      {/* Main View Area */}
      {viewMode === 'grid' ? (
        <div className="csv-table-wrapper" ref={scrollContainerRef} onScroll={handleCsvScroll}>
          {parsedGrid.headers.length > 0 ? (
            <table className="csv-table">
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: 'center' }}>#</th>
                  {parsedGrid.headers.map((head, i) => (
                    <th key={i}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, rIndex) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>{rIndex + 1}</td>
                    {row.cells.map((cell, cIndex) => (
                      <td key={cIndex}>
                        <input
                          className="csv-cell-input"
                          value={cell}
                          onChange={e => handleCellEdit(row.id, cIndex, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Database size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
              <h4 style={{ color: 'var(--text-main)', marginBottom: 8 }}>External CSV Dataset</h4>
              <p style={{ maxWidth: 450, margin: '0 auto 16px auto', fontSize: '0.88rem' }}>
                This dataset file contains raw tabular data. Click below to open it cleanly in Microsoft Excel or your default CSV spreadsheet application.
              </p>
              <button className="btn-primary" onClick={handleOpenExternal}>
                <ExternalLink size={16} /> Open in External App
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', background: 'var(--bg-main)' }}>
          <textarea
            className="markdown-textarea"
            style={{ padding: 24, fontSize: '14px', fontFamily: 'var(--font-mono)' }}
            placeholder="col1,col2,col3..."
            value={csvText}
            onChange={handleRawChange}
          />
        </div>
      )}
    </div>
  );
};
