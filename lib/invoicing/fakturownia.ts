import 'server-only';
import { buildInvoicePayload, govErrors, fakturowniaKsefState } from '../invoice-rules';
import {
  createInvoice, getInvoice, resendToKsef, markPaid, getInvoicePdf, deleteInvoice, FakturowniaError,
  type FakturowniaInvoice,
} from './fakturownia-api';
import { InvoicingError, type InvoiceProvider, type InvoiceSnapshot } from './types';

// Fakturownia.pl: сама отправляет фактуру в KSeF (gov_save_and_send).
// Переменные: FAKTUROWNIA_DOMAIN, FAKTUROWNIA_API_TOKEN.

const snap = (inv: FakturowniaInvoice): InvoiceSnapshot => ({
  number: inv.number ?? null,
  ksef: fakturowniaKsefState(inv.gov_status),
  ksefNumber: inv.gov_id ?? null,
  ksefError: govErrors(inv.gov_error_messages),
});

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof FakturowniaError) throw new InvoicingError(e.message, e.status);
    throw e;
  }
}

export const fakturownia: InvoiceProvider = {
  id: 'fakturownia',
  name: 'Fakturownia',
  autoKsef: true,
  appUrl: 'https://fakturownia.pl',

  async issue(input, { bankAccount, sendToKsef }) {
    const inv = await wrap(createInvoice(buildInvoicePayload(input, bankAccount), sendToKsef));
    return { ...snap(inv), externalId: String(inv.id), paymentDue: inv.payment_to ?? null };
  },
  refresh: async (id) => snap(await wrap(getInvoice(Number(id)))),
  resendToKsef: async (id) => snap(await wrap(resendToKsef(Number(id)))),
  markPaid: (id) => wrap(markPaid(Number(id))),
  cancel: (id) => wrap(deleteInvoice(Number(id))),
  pdf: (id) => wrap(getInvoicePdf(Number(id))),
};
