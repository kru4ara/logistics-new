import 'server-only';
import { logisat, isLogisatConfigured } from './logisat';
import { GPS_PROVIDER_IDS, type GpsProvider, type GpsProviderId } from './types';

const PROVIDERS: Record<GpsProviderId, GpsProvider> = { logisat };
const configured: Record<GpsProviderId, () => boolean> = { logisat: isLogisatConfigured };

/**
 * GPS-сервис компании: GPS_PROVIDER=logisat|…, а если не задан — тот, для которого заданы ключи.
 * Ничего не задано — null.
 */
export function getGpsProvider(): GpsProvider | null {
  const explicit = (process.env.GPS_PROVIDER ?? '').trim().toLowerCase();
  if (explicit) {
    const id = GPS_PROVIDER_IDS.find((p) => p === explicit);
    return id && configured[id]() ? PROVIDERS[id] : null;
  }
  const id = GPS_PROVIDER_IDS.find((p) => configured[p]());
  return id ? PROVIDERS[id] : null;
}
