import type { MainDirectory } from '../types';

export const EMPTY_MAIN_DIRECTORY: MainDirectory = {
  name: "No Directory Selected",
  path: "",
  subDirectories: [],
  files: [],
  allVaults: []
};

const SAMPLE_PDF_BASE64 = `JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDAKL1R5cGUgL1BhZ2VzCi9Db3VudCAxCi9LaWRzIFsgMyAwIFIgXQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9SZXNvdXJjZXMgPDAKL0ZvbnQgPDAKL0YxIDQgMCBSCj4+Cj4+Ci9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjUgMCBvYmoKPDAKL0xlbmd0aCAxMzAKPj4Kc3RyZWFtCkJUMCAwIDAgUkdHIC9GMSAyNCBURiA1MCA3MDAgVGQgKFBIVVNJQ1MgMjAxOiBRVUFOVFVNIE1FQ0hBTklDUyBSRUZFUkVOQ0UpIFRqIFNUQVIgMSAwIDAgUkdICi9GMSAxMiBURiAwIC00MCBUZCAoTGVjdHVyZSAwMSAtIFNjaHJvZGRpbmdlciBFcXVhdGlvbiBhbmQgV2F2ZSBGdW5jdGlvbnMpIFRqIEVTVCAwIC0zMCBUZCAoVGhpcyBpcyBhIHNhbXBsZSBDb2xsZWdlIFBERiBSZWZlcmVuY2UgQm9vay4pIFRqIEVETgpkaW5nc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwDY1NTM1IGYKMDAwMDAwMDAwOSAwMDAwNTUgbgowMDAwMDAwMDc0IDAwMDA1NyBuCjAwMDAwMDAxNDEgMDAwMDE5IG4KMDAwMDAwMDI2OSAwMDAwNjkgbgowMDAwMDAwMzg4IDAwMDE3NSBuCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNjE1CiUlRU9G`;

export function getSamplePdfArrayBuffer(): ArrayBuffer {
  const binaryString = atob(SAMPLE_PDF_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
