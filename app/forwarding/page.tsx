import { redirect } from 'next/navigation';

/**
 * Раздел «Экспедирование» выпилен 31.10.2026:
 * экспедирования — это заказы с profit_mode='forwarding'.
 * Старые ссылки ведём в список заказов с фильтром по режиму расчёта.
 */
export default function ForwardingRedirect() {
  redirect('/trips?mode=forwarding');
}
