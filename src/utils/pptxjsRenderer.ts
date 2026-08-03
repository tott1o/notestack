import JSZip from 'jszip';

export interface PPTXjsOptions {
  containerId: string;
  slideWidth?: number;
  slideHeight?: number;
  showSlideNum?: boolean;
}

export interface PPTXjsResult {
  slideCount: number;
  slidesHtml: string[];
  aspectRatio: number;
  width: number;
  height: number;
}

/**
 * Helper to determine if a hex color is dark
 */
function isColorDark(hex: string): boolean {
  if (!hex || hex === 'transparent') return true; // Default dark container
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return true;
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 130;
}

/**
 * PPTXjs HTML Rendering Engine
 * Converts OpenXML PowerPoint (.pptx) files into HTML slides with bounded page fitting and contrast text colors.
 */
export async function renderPPTXjsToHtml(
  arrayBuffer: ArrayBuffer,
  options?: PPTXjsOptions
): Promise<PPTXjsResult> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error("Invalid PPTX file: No slides found.");
  }

  // Extract media images
  const mediaImages: Record<string, string> = {};
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
  for (const mPath of mediaFiles) {
    try {
      const blob = await zip.files[mPath].async('blob');
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const name = mPath.replace('ppt/media/', '');
      mediaImages[name] = dataUrl;
    } catch (e) {}
  }

  // Parse exact PowerPoint Page Size (p:sldSz) from presentation.xml
  const baseWidth = options?.slideWidth || 1280;
  let slideWidthPx = baseWidth;
  let slideHeightPx = 720;
  let slideAspectRatio = 16 / 9;

  if (zip.files['ppt/presentation.xml']) {
    try {
      const presXml = await zip.files['ppt/presentation.xml'].async('string');
      const parser = new DOMParser();
      const presDoc = parser.parseFromString(presXml, 'application/xml');
      const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx') || '9144000', 10);
        const cy = parseInt(sldSz.getAttribute('cy') || '5143500', 10);
        if (cx > 0 && cy > 0) {
          slideAspectRatio = cx / cy;
          slideWidthPx = baseWidth;
          slideHeightPx = Math.round(baseWidth / slideAspectRatio);
        }
      }
    } catch (e) {}
  }

  const scaleFactor = slideWidthPx / 960;

  const slidesHtml: string[] = [];

  for (let sIdx = 0; sIdx < slideFiles.length; sIdx++) {
    const sFile = slideFiles[sIdx];
    const xmlText = await zip.files[sFile].async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    // Extract relationships for images
    const relsMap: Record<string, string> = {};
    const relsPath = `ppt/slides/_rels/${sFile.replace('ppt/slides/', '')}.rels`;
    if (zip.files[relsPath]) {
      try {
        const relsXml = await zip.files[relsPath].async('string');
        const relsDoc = parser.parseFromString(relsXml, 'application/xml');
        const rels = relsDoc.getElementsByTagName('Relationship');
        for (let r = 0; r < rels.length; r++) {
          const rId = rels[r].getAttribute('Id') || '';
          const target = rels[r].getAttribute('Target') || '';
          if (rId && target) {
            relsMap[rId] = target.replace('../media/', '').replace('media/', '');
          }
        }
      } catch (e) {}
    }

    let slideElementsHtml = '';

    // Process shapes (p:sp)
    const shapes = xmlDoc.getElementsByTagName('p:sp');
    for (let spIdx = 0; spIdx < shapes.length; spIdx++) {
      const sp = shapes[spIdx];

      // Check placeholder type (title vs subtitle vs body text)
      const nvSpPr = sp.getElementsByTagName('p:nvSpPr')[0];
      const phEl = nvSpPr?.getElementsByTagName('p:ph')[0];
      const phType = phEl?.getAttribute('type');

      const isTitlePlaceholder = phType === 'title' || phType === 'ctrTitle' || spIdx === 0;

      // Position & Transform (clamped to fit inside slide page bounds)
      const xfrm = sp.getElementsByTagName('a:xfrm')[0];
      let rawOffX = 0, rawOffY = 0, rawExtCX = 0, rawExtCY = 0, rotDeg = 0;
      if (xfrm) {
        const off = xfrm.getElementsByTagName('a:off')[0];
        const ext = xfrm.getElementsByTagName('a:ext')[0];
        if (off) {
          rawOffX = Math.round((parseInt(off.getAttribute('x') || '0', 10) / 9525) * scaleFactor);
          rawOffY = Math.round((parseInt(off.getAttribute('y') || '0', 10) / 9525) * scaleFactor);
        }
        if (ext) {
          rawExtCX = Math.round((parseInt(ext.getAttribute('cx') || '0', 10) / 9525) * scaleFactor);
          rawExtCY = Math.round((parseInt(ext.getAttribute('cy') || '0', 10) / 9525) * scaleFactor);
        }
        const rotAttr = xfrm.getAttribute('rot');
        if (rotAttr) {
          rotDeg = Math.round(parseInt(rotAttr, 10) / 60000);
        }
      }

      // Clamp coordinates so element fits 100% inside page
      const offX = Math.min(Math.max(0, rawOffX), slideWidthPx - 40);
      const offY = Math.min(Math.max(0, rawOffY), slideHeightPx - 40);
      const extCX = rawExtCX > 0 ? Math.min(rawExtCX, slideWidthPx - offX - 10) : 0;
      const extCY = rawExtCY > 0 ? Math.min(rawExtCY, slideHeightPx - offY - 10) : 0;

      // Fill Color
      let bgStyle = 'transparent';
      const solidFill = sp.getElementsByTagName('a:solidFill')[0];
      if (solidFill) {
        const srgbClr = solidFill.getElementsByTagName('a:srgbClr')[0];
        if (srgbClr) {
          bgStyle = `#${srgbClr.getAttribute('val')}`;
        }
      }

      // Contrast Text Color Rules:
      // Dark theme/background -> White (#ffffff) text!
      // Light theme/background -> Black (#000000) text!
      const shapeBgIsDark = isColorDark(bgStyle);
      const defaultThemeColor = shapeBgIsDark 
        ? (isTitlePlaceholder ? '#fb923c' : '#ffffff')
        : (isTitlePlaceholder ? '#ea580c' : '#000000');

      const defaultFontSizePx = isTitlePlaceholder ? 22 : 14;
      const defaultFontWeight = isTitlePlaceholder ? '800' : '400';

      // Text Content (p:txBody)
      const txBody = sp.getElementsByTagName('p:txBody')[0];
      let textContentHtml = '';

      if (txBody) {
        const paragraphs = txBody.getElementsByTagName('a:p');
        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
          const pEl = paragraphs[pIdx];
          const pPr = pEl.getElementsByTagName('a:pPr')[0];
          const algn = pPr?.getAttribute('algn') || 'l';
          const isBullet = pEl.getElementsByTagName('a:buChar').length > 0 || pEl.getElementsByTagName('a:buAutoNum').length > 0;

          let textAlignCSS = 'left';
          if (algn === 'ctr') textAlignCSS = 'center';
          if (algn === 'r') textAlignCSS = 'right';

          let paragraphRunsHtml = '';
          const runs = pEl.getElementsByTagName('a:r');

          for (let rIdx = 0; rIdx < runs.length; rIdx++) {
            const rEl = runs[rIdx];
            const tEls = rEl.getElementsByTagName('a:t');
            let rText = '';
            for (let t = 0; t < tEls.length; t++) {
              rText += tEls[t].textContent || '';
            }
            if (!rText) continue;

            const rPr = rEl.getElementsByTagName('a:rPr')[0];
            const isBold = rPr?.getAttribute('b') === '1' || rPr?.getAttribute('b') === 'true' || isTitlePlaceholder;
            const isItalic = rPr?.getAttribute('i') === '1' || rPr?.getAttribute('i') === 'true';
            
            const szAttr = rPr?.getAttribute('sz');
            let fontSizePx = defaultFontSizePx;
            if (szAttr) {
              const parsedPt = parseInt(szAttr, 10) / 100;
              fontSizePx = Math.max(11, Math.round(parsedPt * 0.85));
            }

            let colorHex = defaultThemeColor;
            const clrEl = rPr?.getElementsByTagName('a:srgbClr')[0];
            if (clrEl) {
              const rawClr = `#${clrEl.getAttribute('val')}`;
              if (shapeBgIsDark) {
                colorHex = isColorDark(rawClr) ? '#ffffff' : rawClr;
              } else {
                colorHex = !isColorDark(rawClr) ? '#000000' : rawClr;
              }
            }

            paragraphRunsHtml += `<span style="font-weight:${isBold ? '800' : defaultFontWeight};${isItalic ? 'font-style:italic;' : ''}font-size:${fontSizePx}px;color:${colorHex};line-height:1.4;">${rText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
          }

          // Fallback if no runs
          if (!paragraphRunsHtml) {
            const tEls = pEl.getElementsByTagName('a:t');
            let pText = '';
            for (let t = 0; t < tEls.length; t++) {
              pText += tEls[t].textContent || '';
            }
            if (pText) {
              paragraphRunsHtml = `<span style="font-weight:${defaultFontWeight};font-size:${defaultFontSizePx}px;color:${defaultThemeColor};line-height:1.4;">${pText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
            }
          }

          if (paragraphRunsHtml) {
            textContentHtml += `<div style="text-align:${textAlignCSS};margin-bottom:8px;${isBullet ? 'display:flex;align-items:flex-start;gap:8px;' : ''}">
              ${isBullet ? `<span style="color:${shapeBgIsDark ? '#f97316' : '#ea580c'};font-size:1.1em;line-height:1.2;">•</span>` : ''}
              <div>${paragraphRunsHtml}</div>
            </div>`;
          }
        }
      }

      if (extCX > 0 && extCY > 0) {
        slideElementsHtml += `<div style="position:absolute;left:${offX}px;top:${offY}px;max-width:${extCX}px;max-height:${extCY}px;transform:rotate(${rotDeg}deg);background:${bgStyle};box-sizing:border-box;overflow:hidden;padding:8px 12px;word-break:break-word;text-overflow:ellipsis;">
          ${textContentHtml}
        </div>`;
      } else if (textContentHtml) {
        slideElementsHtml += `<div style="margin-bottom:12px;word-break:break-word;max-width:100%;">${textContentHtml}</div>`;
      }
    }

    // Process Pictures (p:pic) - fitted inside slide page
    const pics = xmlDoc.getElementsByTagName('p:pic');
    for (let picIdx = 0; picIdx < pics.length; picIdx++) {
      const pic = pics[picIdx];
      const blip = pic.getElementsByTagName('a:blip')[0];
      const embedId = blip?.getAttribute('r:embed') || '';

      const xfrm = pic.getElementsByTagName('a:xfrm')[0];
      let rawOffX = 0, rawOffY = 0, rawExtCX = Math.round(260 * scaleFactor), rawExtCY = Math.round(200 * scaleFactor);
      if (xfrm) {
        const off = xfrm.getElementsByTagName('a:off')[0];
        const ext = xfrm.getElementsByTagName('a:ext')[0];
        if (off) {
          rawOffX = Math.round((parseInt(off.getAttribute('x') || '0', 10) / 9525) * scaleFactor);
          rawOffY = Math.round((parseInt(off.getAttribute('y') || '0', 10) / 9525) * scaleFactor);
        }
        if (ext) {
          rawExtCX = Math.round((parseInt(ext.getAttribute('cx') || '2000000', 10) / 9525) * scaleFactor);
          rawExtCY = Math.round((parseInt(ext.getAttribute('cy') || '1500000', 10) / 9525) * scaleFactor);
        }
      }

      const offX = Math.min(Math.max(0, rawOffX), slideWidthPx - 40);
      const offY = Math.min(Math.max(0, rawOffY), slideHeightPx - 40);
      const extCX = Math.min(rawExtCX, slideWidthPx - offX - 10);
      const extCY = Math.min(rawExtCY, slideHeightPx - offY - 10);

      const mediaName = relsMap[embedId];
      if (mediaName && mediaImages[mediaName]) {
        slideElementsHtml += `<img src="${mediaImages[mediaName]}" style="position:absolute;left:${offX}px;top:${offY}px;max-width:${extCX}px;max-height:${extCY}px;object-fit:contain;border-radius:10px;box-shadow:var(--shadow-md);" alt="Slide ${sIdx + 1} Picture" />`;
      }
    }

    // Process Tables (a:tbl) - fitted inside slide page
    const tables = xmlDoc.getElementsByTagName('a:tbl');
    for (let tIdx = 0; tIdx < tables.length; tIdx++) {
      const tbl = tables[tIdx];
      const rows = tbl.getElementsByTagName('a:tr');
      let tableRowsHtml = '';

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const cells = rows[rIdx].getElementsByTagName('a:tc');
        let rowCellsHtml = '';
        for (let cIdx = 0; cIdx < cells.length; cIdx++) {
          const cellText = cells[cIdx].textContent?.trim() || '';
          rowCellsHtml += `<td style="border:1px solid var(--border-color);padding:8px 12px;font-size:0.95rem;color:var(--text-main);">${cellText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
        }
        tableRowsHtml += `<tr style="background:${rIdx === 0 ? 'var(--primary-light)' : 'transparent'};">${rowCellsHtml}</tr>`;
      }

      if (tableRowsHtml) {
        slideElementsHtml += `<div style="margin:16px 0;max-width:100%;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;border:1px solid var(--border-color);border-radius:8px;overflow:hidden;">
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>`;
      }
    }

    const slideHtml = `<div className="pptx-slide-card" style="width:${slideWidthPx}px;height:${slideHeightPx}px;position:relative;background:var(--bg-surface-elevated, #0f172a);border:2px solid var(--border-color);border-radius:20px;box-shadow:var(--shadow-lg);padding:36px 44px;box-sizing:border-box;color:var(--text-main, #ffffff);overflow:hidden;margin:0 auto;">
      <div style="position:absolute;top:18px;right:22px;background:var(--primary-light);color:var(--primary);border:1px solid var(--border-color);font-size:0.75rem;font-weight:800;padding:2px 10px;border-radius:12px;letter-spacing:0.04em;">
        SLIDE ${sIdx + 1}
      </div>
      ${slideElementsHtml}
    </div>`;

    slidesHtml.push(slideHtml);
  }

  return {
    slideCount: slidesHtml.length,
    slidesHtml,
    aspectRatio: slideAspectRatio,
    width: slideWidthPx,
    height: slideHeightPx
  };
}
