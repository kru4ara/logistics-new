'use client';

import { useState } from 'react';
import { uploadDocument } from './upload-actions';

export default function FileUpload({ tripId }: { tripId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  async function handleUpload() {
    if (!file) return;
    setStatus('В процессе...');
    try {
      const result = await uploadDocument(tripId, 'cmr', file);
      setStatus(result.message);
    } catch (error) {
      setStatus('Ошибка: ' + (error as Error).message);
    }
  }

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
      <button onClick={handleUpload} style={{ padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>
        📸 Загрузить CMR
      </button>
      <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>{status}</p>
    </div>
  );
}
