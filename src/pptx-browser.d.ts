declare module 'pptx-browser' {
  export class PptxRenderer {
    constructor();
    load(source: File | Blob | ArrayBuffer | Uint8Array, onProgress?: (progress: number, message: string) => void): Promise<void>;
    renderSlide(index: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
    renderAllSlides(width?: number): Promise<HTMLCanvasElement[]>;
    destroy(): void;
    slideCount: number;
  }
}
