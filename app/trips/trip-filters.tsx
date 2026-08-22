'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function TripFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || '';

  function setFilter(status: string) {
    const params = new URLSearchParams(searchParams);
    params.set('status', status);
    router.push(`/trips?${params.toString()}`);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setFilter('')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Все
      </button>
      <button
        onClick={() => setFilter('planned')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === 'planned' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Планируемые
      </button>
      <button
        onClick={() => setFilter('active')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        В пути
      </button>
      <button
        onClick={() => setFilter('completed')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Завершённые
      </button>
      <button
        onClick={() => setFilter('invoiced')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === 'invoiced' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Выставлен счёт
      </button>
      <button
        onClick={() => setFilter('paid')}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          currentStatus === 'paid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Оплаченные
      </button>
    </div>
  );
}
