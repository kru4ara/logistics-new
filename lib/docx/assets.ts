import { imageSize } from 'image-size';
import QRCode from 'qrcode';
import type { createClient } from '../supabase/admin';

// Тип admin-клиента Supabase — тот же, что и в исходных роутах.
type SupabaseAdmin = Awaited<ReturnType<typeof createClient>>;

export function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    const dims = imageSize(buffer);
    if (dims.width && dims.height) {
      return { width: dims.width, height: dims.height };
    }
    return null;
  } catch (e) {
    console.error('[DOCX] imageSize error:', e);
    return null;
  }
}

export function scaleImage(
  dims: { width: number; height: number } | null,
  maxWidth: number,
  maxHeight: number,
  fallback: { width: number; height: number }
): { width: number; height: number } {
  if (!dims || dims.width === 0 || dims.height === 0) {
    return fallback;
  }
  const ratio = dims.width / dims.height;
  let w = maxWidth;
  let h = Math.round(maxWidth / ratio);
  if (h > maxHeight) {
    h = maxHeight;
    w = Math.round(maxHeight * ratio);
  }
  return { width: w, height: h };
}

/** Скачивает файл из бакета documents. logPrefix различает источники логов. */
export async function downloadAsset(
  supabase: SupabaseAdmin,
  path: string,
  label: string,
  logPrefix = 'DOCX'
): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage.from('documents').download(path);
    if (error || !data) {
      console.error(`[${logPrefix}] ${label} download error:`, error);
      return null;
    }
    const ab = await data.arrayBuffer();
    console.log(`[${logPrefix}] ${label} downloaded: ${ab.byteLength} bytes`);
    return Buffer.from(ab);
  } catch (e) {
    console.error(`[${logPrefix}] ${label} exception:`, e);
    return null;
  }
}

export async function generateQrBuffer(text: string, logPrefix = 'DOCX'): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(text, {
      type: 'png',
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1E40AF', light: '#FFFFFF' },
    });
  } catch (e) {
    console.error(`[${logPrefix}] QR generation error:`, e);
    return null;
  }
}
