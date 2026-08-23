'use client';

import { useTransition } from 'react';
import { changeTripStatus } from './trip-status-actions';

export default function TripStatusButtons({ tripId, currentStatus }: { tripId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChangeStatus(status: string) {
    startTransition(async () => {
      try {
        await changeTripStatus(tripId, status);
        location.reload();
      } catch (error) {
        alert('Ошибка: ' + (error as Error).message);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button
        onClick={() => handleChangeStatus('active')}
        style={{
          padding: '12px 20px',
          backgroundColor: currentStatus === 'active' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          margin: '0 auto',
          maxWidth: '280px'
        }}
      >
        🚛 Запустить рейс
      </button>
      <button
        onClick={() => handleChangeStatus('completed')}
        style={{
          padding: '12px 20px',
          backgroundColor: currentStatus === 'completed' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          margin: '0 auto',
          maxWidth: '280px'
        }}
      >
        ✅ Завершить рейс
      </button>
      <button
        onClick={() => handleChangeStatus('invoiced')}
        style={{
          padding: '12px 20px',
          backgroundColor: currentStatus === 'invoiced' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          margin: '0 auto',
          maxWidth: '280px'
        }}
      >
        💰 Выставить счёт
      </button>
      <button
        onClick={() => handleChangeStatus('paid')}
        style={{
          padding: '12px 20px',
          backgroundColor: currentStatus === 'paid' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          margin: '0 auto',
          maxWidth: '280px'
        }}
      >
        💶 Оплачен
      </button>
    </div>
  );
}
