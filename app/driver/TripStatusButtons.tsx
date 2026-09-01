'use client';

import { useTransition } from 'react';
import { changeTripStatus } from './trip-status-actions';

export default function TripStatusButtons({ 
  tripId, 
  currentStatus, 
  showAdminStatuses = false // По умолчанию скрываем кнопки офиса
}: { 
  tripId: string; 
  currentStatus: string; 
  showAdminStatuses?: boolean 
}) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: string) {
    startTransition(async () => {
      await changeTripStatus(tripId, status);
    });
  }

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {/* Кнопки водителя */}
      <button
        onClick={() => handleStatusChange('active')}
        disabled={isPending || currentStatus === 'active'}
        style={{
          padding: '10px 20px',
          backgroundColor: currentStatus === 'active' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        🚛 Начать рейс
      </button>
      <button
        onClick={() => handleStatusChange('completed')}
        disabled={isPending || currentStatus === 'completed'}
        style={{
          padding: '10px 20px',
          backgroundColor: currentStatus === 'completed' ? '#3b82f6' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        ✅ Завершить рейс
      </button>

      {/* Кнопки офиса (видны только если showAdminStatuses = true) */}
      {showAdminStatuses && (
        <>
          <button
            onClick={() => handleStatusChange('invoiced')}
            disabled={isPending || currentStatus === 'invoiced'}
            style={{
              padding: '10px 20px',
              backgroundColor: currentStatus === 'invoiced' ? '#3b82f6' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            💰 Выставить счёт
          </button>
          <button
            onClick={() => handleStatusChange('paid')}
            disabled={isPending || currentStatus === 'paid'}
            style={{
              padding: '10px 20px',
              backgroundColor: currentStatus === 'paid' ? '#3b82f6' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            💶 Оплачен
          </button>
        </>
      )}
    </div>
  );
}
