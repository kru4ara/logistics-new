// Общий интерфейс сервиса фактур. Каждый сервис (Fakturowo.pl, Fakturownia, …) —
// отдельный модуль в lib/invoicing/, выбор — переменная INVOICING_PROVIDER.
import type { InvoiceInput } from '../invoice-rules';

export type ProviderId = 'fakturowo' | 'fakturownia';
export const PROVIDER_IDS: readonly ProviderId[] = ['fakturowo', 'fakturownia'];

/** Наше состояние фактуры в KSeF — одинаковое для всех сервисов (хранится в trips.ksef_status). */
export type KsefState = 'none' | 'pending' | 'processing' | 'ok' | 'error' | 'notConnected' | 'notApplicable';
export const KSEF_STATES: readonly KsefState[] = ['none', 'pending', 'processing', 'ok', 'error', 'notConnected', 'notApplicable'];

export const ksefStateOf = (v: string | null | undefined): KsefState =>
  (KSEF_STATES as readonly string[]).includes(v ?? '') ? (v as KsefState) : 'none';

/** Что сервис знает о фактуре сейчас. */
export type InvoiceSnapshot = {
  number: string | null;
  ksef: KsefState;
  ksefNumber: string | null;
  ksefError: string | null;
};

export type IssueResult = InvoiceSnapshot & { externalId: string; paymentDue: string | null };

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  /** сервис сам отправляет в KSeF по нашему запросу; иначе — кнопкой в его программе */
  autoKsef: boolean;
  /** где пользователь отправляет фактуры в KSeF вручную */
  appUrl: string;
};

/** Фактура из списка сервиса — для сверки дебиторки. */
export type RemoteInvoice = {
  externalId: string;
  number: string | null;
  issueDate: string | null;
  paymentDue: string | null;
  payment: 'paid' | 'partial' | 'unpaid';
  ksefNumber: string | null;
  gross: number | null;
  currency: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  /** корректирующий документ (korekta) — не счёт заказа: не сопоставляется и не в списке «без заказа» */
  kind?: 'invoice' | 'correction';
};

export interface InvoiceProvider extends ProviderInfo {
  issue(input: InvoiceInput, opts: { bankAccount: string | null; sendToKsef: boolean }): Promise<IssueResult>;
  refresh(externalId: string): Promise<InvoiceSnapshot>;
  /** повторная отправка в KSeF — только у сервисов с autoKsef */
  resendToKsef?(externalId: string): Promise<InvoiceSnapshot>;
  markPaid(externalId: string): Promise<void>;
  /** удалить фактуру в сервисе — только пока она не ушла в KSeF */
  cancel(externalId: string): Promise<void>;
  pdf(externalId: string): Promise<ArrayBuffer>;
  /** все фактуры сервиса (для сверки оплат и номеров KSeF); нет — сверки нет */
  listInvoices?(opts?: { maxPages?: number }): Promise<RemoteInvoice[]>;
}

/** Ошибка сервиса фактур с понятным текстом (его показываем пользователю). */
export class InvoicingError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
  }
}
