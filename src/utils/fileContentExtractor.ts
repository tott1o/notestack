import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import type { FileItem } from '../types';

// Ensure worker is configured for pdfjs
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Extracts plain text content from any supported file type (PDF, DOCX, PPTX, MD, Code, CSV)
 * so it can be passed to NoteStack AI as rich file context.
 */
export async function getFileTextContentForAI(file: FileItem): Promise<string> {
  if (!file) return '';

  // 0. Folders (Recursively extract all files inside folder)
  if (file.type === 'folder') {
    return await getFolderTextContentForAI(file);
  }

  // 1. Text-based files (.md, .code, .csv, .txt, etc.)
  if (file.content) {
    return file.content;
  }

  // If text file content is not loaded yet, try loading it via Electron API
  if (file.type === 'md' || file.type === 'code' || file.type === 'csv' || file.type === 'other') {
    if (window.electronAPI?.readFileText && file.fullPath) {
      const text = await window.electronAPI.readFileText(file.fullPath);
      if (text) {
        file.content = text;
        return text;
      }
    }
  }

  // 2. PDF Files (.pdf)
  if (file.type === 'pdf') {
    return await extractPdfText(file);
  }

  // 3. DOCX Files (.docx)
  if (file.type === 'docx') {
    return await extractDocxText(file);
  }

  // 4. PPTX Files (.pptx)
  if (file.type === 'pptx') {
    return await extractPptxText(file);
  }

  return '';
}

/**
 * Recursively extracts plain text content from all files inside a folder
 */
export async function getFolderTextContentForAI(folderItem: FileItem): Promise<string> {
  if (!folderItem || folderItem.type !== 'folder') return '';

  const fileTexts: string[] = [];

  async function traverse(item: FileItem) {
    if (item.type === 'folder' && item.children) {
      for (const child of item.children) {
        await traverse(child);
      }
    } else if (item.type !== 'folder') {
      const text = await getFileTextContentForAI(item);
      if (text && text.trim()) {
        fileTexts.push(`=== FILE: ${item.name} (${item.moduleName || item.path || item.name}) ===\n${text.trim()}`);
      }
    }
  }

  await traverse(folderItem);

  if (fileTexts.length === 0) {
    return `[Folder "${folderItem.name}" is empty or contains unsupported files]`;
  }

  return `📁 FOLDER CONTEXT: "${folderItem.name}" (${fileTexts.length} Files Included):\n\n` + fileTexts.join('\n\n' + '─'.repeat(40) + '\n\n');
}

/**
 * Helper to reliably fetch ArrayBuffer for binary files (PDF, DOCX, PPTX)
 * from memory, local disk via Electron API, or URL fetch.
 */
async function getArrayBufferForFile(file: FileItem): Promise<ArrayBuffer | null> {
  if (file.arrayBuffer) return file.arrayBuffer;

  const targetPath = file.fullPath || file.path;
  if (window.electronAPI?.readFileBuffer && targetPath) {
    try {
      const buffer = await window.electronAPI.readFileBuffer(targetPath);
      if (buffer) {
        file.arrayBuffer = buffer;
        return buffer;
      }
    } catch (err) {
      console.warn('Failed to read binary file via Electron API:', err);
    }
  }

  if (file.url) {
    try {
      const res = await fetch(file.url);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        file.arrayBuffer = ab;
        return ab;
      }
    } catch (e) {
      console.warn('Failed to fetch array buffer from file URL:', e);
    }
  }

  return null;
}

import Tesseract from 'tesseract.js';

/**
 * Render a PDF page onto an off-screen HTML5 canvas and perform OCR text recognition.
 */
async function ocrPdfPageCanvas(page: any): Promise<string> {
  try {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return '';

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    const { data } = await Tesseract.recognize(canvas, 'eng');
    return data.text ? data.text.trim() : '';
  } catch (err) {
    console.warn('OCR processing failed for PDF page:', err);
    return '';
  }
}

/**
 * Extract text from PDF files page-by-page using pdfjs-dist, with Tesseract OCR fallback for scanned pages.
 */
async function extractPdfText(file: FileItem, forceOCR = false): Promise<string> {
  try {
    const arrayBuffer = await getArrayBufferForFile(file);
    if (!arrayBuffer) return '';

    const sourceData = { data: new Uint8Array(arrayBuffer) };
    const loadingTask = pdfjsLib.getDocument(sourceData);
    const pdf = await loadingTask.promise;
    const maxPages = Math.min(pdf.numPages, 30); // Cap at 30 pages for OCR processing speed
    const pageTexts: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      let pageText = '';

      if (!forceOCR) {
        const textContent = await page.getTextContent();
        pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .filter(Boolean)
          .join(' ')
          .trim();
      }

      // If page text is empty or sparse (< 15 chars), perform Tesseract OCR on scanned image page!
      if (forceOCR || !pageText || pageText.length < 15) {
        const ocrResult = await ocrPdfPageCanvas(page);
        if (ocrResult) {
          pageText = ocrResult;
        }
      }

      if (pageText) {
        pageTexts.push(`--- Page ${i} ---\n${pageText}`);
      }
    }

    const fullText = pageTexts.join('\n\n');
    if (fullText) {
      file.content = fullText; // Cache extracted text in fileItem
    }
    return fullText;
  } catch (err) {
    console.error('Failed to extract PDF text:', err);
    return '';
  }
}

/**
 * Explicitly force OCR text extraction on all pages of a PDF document
 */
export async function extractPdfTextWithOCR(file: FileItem): Promise<string> {
  return await extractPdfText(file, true);
}

/**
 * Extract text from Word DOCX files using JSZip
 */
async function extractDocxText(file: FileItem): Promise<string> {
  try {
    const buffer = await getArrayBufferForFile(file);
    if (!buffer) return '';

    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '';

    const xmlText = await docXmlFile.async('text');
    // Extract paragraph text by stripping XML tags
    const text = xmlText
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (text) {
      file.content = text;
    }
    return text;
  } catch (err) {
    console.error('Failed to extract DOCX text:', err);
    return '';
  }
}

/**
 * Extract text from PowerPoint PPTX files using JSZip
 */
async function extractPptxText(file: FileItem): Promise<string> {
  try {
    const buffer = await getArrayBufferForFile(file);
    if (!buffer) return '';

    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
    const slideTexts: string[] = [];

    // Sort slide names numerically
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = zip.file(slideFiles[i]);
      if (slideFile) {
        const xmlText = await slideFile.async('text');
        const text = xmlText
          .replace(/<a:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\s*\n/g, '\n')
          .trim();
        if (text) {
          slideTexts.push(`--- Slide ${i + 1} ---\n${text}`);
        }
      }
    }

    const fullText = slideTexts.join('\n\n');
    if (fullText) {
      file.content = fullText;
    }
    return fullText;
  } catch (err) {
    console.error('Failed to extract PPTX text:', err);
    return '';
  }
}
