import 'server-only';
import { fakturowo } from './fakturowo';
import { fakturownia } from './fakturownia';
import { isFakturowniaConfigured } from './fakturownia-api';
import { PROVIDER_IDS, type InvoiceProvider, type ProviderId, type ProviderInfo } from './types';

const PROVIDERS: Record<ProviderId, InvoiceProvider> = { fakturowo, fakturownia };

const configured: Record<ProviderId, () => boolean> = {
  fakturowo: () => Boolean(process.env.FAKTUROWO_API_ID),
  fakturownia: isFakturowniaConfigured,
};

/**
 * Сервис фактур этой компании: INVOICING_PROVIDER=fakturowo|fakturownia, а если не задан —
 * тот, для которого заданы ключи. Ничего не задано — null (блок фактуры подскажет, что сделать).
 */
export function getInvoiceProvider(): InvoiceProvider | null {
  const explicit = (process.env.INVOICING_PROVIDER ?? '').trim().toLowerCase();
  if (explicit) {
    const id = PROVIDER_IDS.find((p) => p === explicit);
    return id && configured[id]() ? PROVIDERS[id] : null;
  }
  const id = PROVIDER_IDS.find((p) => configured[p]());
  return id ? PROVIDERS[id] : null;
}

/** Сервис, которым выставлена конкретная фактура (даже если компания потом сменила сервис). */
export function providerById(id: string | null | undefined): InvoiceProvider | null {
  return id && (PROVIDER_IDS as readonly string[]).includes(id) ? PROVIDERS[id as ProviderId] : null;
}

export const providerInfo = (p: InvoiceProvider): ProviderInfo => ({
  id: p.id, name: p.name, autoKsef: p.autoKsef, appUrl: p.appUrl,
});
