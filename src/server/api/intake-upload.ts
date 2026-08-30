// Intake document extraction boundary. Files are decoded and normalized on the
// server so browser code never needs document-parser credentials or libraries.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import type { IntakeAttachment } from '../../data/types.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

function message(error: unknown): string { return error instanceof Error ? error.message : 'Document extraction failed.'; }

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' }); return; }
  const body = req.body as { name?: unknown; contentType?: unknown; dataBase64?: unknown };
  if (typeof body?.name !== 'string' || typeof body.contentType !== 'string' || typeof body.dataBase64 !== 'string') {
    res.status(400).json({ error: 'name, contentType, and dataBase64 are required', code: 'validation_error' }); return;
  }
  if (!ALLOWED.has(body.contentType)) { res.status(400).json({ error: 'Only PDF and DOCX files are supported.', code: 'unsupported_type' }); return; }
  const buffer = Buffer.from(body.dataBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) { res.status(400).json({ error: 'Files must be between 1 byte and 10 MB.', code: 'file_size' }); return; }

  const id = `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    let extractedText = '';
    if (body.contentType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      extractedText = result.text.trim();
      await parser.destroy();
    } else {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.trim();
    }
    const attachment: IntakeAttachment = {
      id, name: body.name, contentType: body.contentType, size: buffer.length,
      extractedText: extractedText.slice(0, 50000), dataBase64: body.dataBase64,
      extractionStatus: extractedText ? 'complete' : 'partial',
    };
    res.status(200).json({ attachment });
  } catch (error) {
    res.status(200).json({ attachment: { id, name: body.name, contentType: body.contentType, size: buffer.length, extractedText: '', dataBase64: body.dataBase64, extractionStatus: 'failed' as const }, warning: message(error) });
  }
}
