'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DocumentUpload({ entityType, entityId, onUploaded }: { entityType: string; entityId: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('passport');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState('');

  async function handleUpload() {
    if (!file) return;
    setStatus('Загрузка...');
    
    try {
      // Загружаем файл в Supabase Storage
      const filePath = `${entityType}/${entityId}/${documentType}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);

      // Сохраняем запись в таблицу documents
      const { error: dbError } = await supabase.from('documents').insert({
        entity_type: entityType,
        entity_id: entityId,
        document_type: documentType,
        file_path: filePath,
        expiry_date: expiryDate || null
      });

      if (dbError) throw new Error(`Ошибка сохранения записи: ${dbError.message}`);

      setStatus('Документ загружен!');
      setFile(null);
      setExpiryDate('');
      onUploaded();
    } catch (error) {
      setStatus('Ошибка: ' + (error as Error).message);
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '15px' }}>
      <h3>📎 Загрузить документ</h3>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={{ padding: '8px' }}>
          <option value="passport">Паспорт</option>
          <option value="visa">Виза</option>
          <option value="license">Водительское удостоверение</option>
          <option value="tachograph_card">Карта водителя</option>
          <option value="code95">Код 95</option>
          <option value="adr">АДР</option>
          <option value="insurance">Страховка</option>
          <option value="tech_passport">Техпаспорт</option>
          <option value="border_insurance">Пограничная страховка</option>
          <option value="tachograph_legalization">Легализация тахографа</option>
          <option value="other">Другое</option>
        </select>
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} placeholder="Срок действия (если есть)" style={{ padding: '8px' }} />
      </div>
      <div style={{ marginTop: '10px' }}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
      </div>
      <button onClick={handleUpload} disabled={!file} style={{ marginTop: '10px', padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Загрузить
      </button>
      {status && <p style={{ marginTop: '10px', color: status.startsWith('Ошибка') ? 'red' : 'green' }}>{status}</p>}
    </div>
  );
}
