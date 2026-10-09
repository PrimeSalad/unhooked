import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { Evidence, RiskLevel } from '@/domain/types';
import { deleteEvidenceImage, isAppCacheFile, saveEvidenceImage } from '@/lib/evidenceFiles';

import { logEvent } from './events';
import { bumpData } from './useDbQuery';

interface EvidenceRow {
  id: string;
  debt_id: string | null;
  lender: string;
  agent_name: string | null;
  incident_date: string;
  image_uri: string | null;
  message_text: string | null;
  risk_level: RiskLevel | null;
  note: string | null;
  created_at: string;
}

const fromRow = (row: EvidenceRow): Evidence => ({
  id: row.id,
  debtId: row.debt_id,
  lender: row.lender,
  agentName: row.agent_name,
  incidentDate: row.incident_date,
  imageUri: row.image_uri,
  messageText: row.message_text,
  riskLevel: row.risk_level,
  note: row.note,
  createdAt: row.created_at,
});

export async function listEvidence(db: SQLiteDatabase): Promise<Evidence[]> {
  const rows = await db.getAllAsync<EvidenceRow>(
    'SELECT * FROM evidence ORDER BY lender COLLATE NOCASE, incident_date DESC, created_at DESC',
  );
  return rows.map(fromRow);
}

export async function evidenceSummary(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ n: number; lenders: number }>(
    'SELECT COUNT(*) AS n, COUNT(DISTINCT lender) AS lenders FROM evidence',
  );
  return { count: row?.n ?? 0, lenders: row?.lenders ?? 0 };
}

export interface NewEvidence {
  lender: string;
  agentName?: string | null;
  incidentDate?: string;
  note?: string | null;
  imageUri?: string | null;
  imageMimeType?: string | null;
  messageText?: string | null;
  riskLevel?: RiskLevel | null;
}

export async function addEvidence(db: SQLiteDatabase, evidence: NewEvidence): Promise<void> {
  const id = Crypto.randomUUID();
  const imageUri = evidence.imageUri
    ? await saveEvidenceImage(evidence.imageUri, id, evidence.imageMimeType ?? null)
    : null;
  try {
    await db.runAsync(
      `INSERT INTO evidence (id, lender, agent_name, incident_date, image_uri, message_text, risk_level, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      evidence.lender.trim() || 'Unknown sender',
      evidence.agentName?.trim().slice(0, 80) || null,
      evidence.incidentDate ?? new Date().toISOString(),
      imageUri,
      evidence.messageText ?? null,
      evidence.riskLevel ?? null,
      evidence.note?.trim() || null,
      new Date().toISOString(),
    );
  } catch (error) {
    deleteEvidenceImage(imageUri);
    throw error;
  }
  await logEvent(db, 'evidence_added', { kind: imageUri ? 'screenshot' : 'message' });
  bumpData();
}

export async function deleteEvidence(db: SQLiteDatabase, id: string): Promise<void> {
  const row = await db.getFirstAsync<{ image_uri: string | null }>(
    'SELECT image_uri FROM evidence WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM evidence WHERE id = ?', id);
  bumpData();
  try {
    deleteEvidenceImage(row?.image_uri ?? null);
  } catch {
    throw new Error(
      'Record removed, but its screenshot file could not be deleted. Try Delete all data in Settings.',
    );
  }
}

/** Copies pre-Phase-2 picker cache files into durable app storage when still available. */
export async function migrateLegacyEvidenceImages(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') return;
  const rows = await db.getAllAsync<{ id: string; image_uri: string }>(
    'SELECT id, image_uri FROM evidence WHERE image_uri IS NOT NULL',
  );
  for (const row of rows) {
    if (!isAppCacheFile(row.image_uri)) continue;
    try {
      const saved = await saveEvidenceImage(row.image_uri, row.id, null);
      await db.runAsync('UPDATE evidence SET image_uri = ? WHERE id = ?', saved, row.id);
      deleteEvidenceImage(row.image_uri);
    } catch {
      // The old cache may already have been cleared. Keep the record and its text.
    }
  }
}
