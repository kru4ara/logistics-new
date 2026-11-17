/**
 * Код валюты из базы → ISO (EUR, PLN…). Старые записи из Fakturowo хранят код
 * документа («1» — EUR, «0» — PLN); пустое и непонятное — fallback.
 */
export function isoCurrency(v: string | null | undefined, fallback = 'EUR'): string {
  const s = (v ?? '').trim();
  if (s === '1') return 'EUR';
  if (s === '0') return 'PLN';
  return /^[a-z]{3}$/i.test(s) ? s.toUpperCase() : fallback;
}
