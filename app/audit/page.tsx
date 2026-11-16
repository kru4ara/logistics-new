import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import {
  ScrollText,
  User as UserIcon,
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { deniedRedirect, roleLabel } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';
import type { MessageKey } from '../../lib/i18n/translate';

export const dynamic = 'force-dynamic';

const ENTITY_LABELS: Record<string, string> = {
  trip: 'aud.eTrip',
  client: 'aud.eClient',
  driver: 'aud.eDriver',
  contractor: 'rem.catContractor',
  location: 'aud.eLocation',
  forwarding_order: 'aud.eForwarding',
  trip_expense: 'aud.eTripExp',
  forwarding_expense: 'aud.eFwdExp',
  document: 'aud.eDoc',
  reminder: 'aud.eReminder',
  purchase_invoice: 'aud.ePurchase',
  user: 'aud.eUser',
  fixed_cost: 'payx.eFixedCost',
};

const ACTION_META: Record<string, { text: string; badge: string; strip: string; Icon: LucideIcon }> = {
  create: {
    text: 'toast.created',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    strip: 'bg-emerald-500',
    Icon: Plus,
  },
  update: {
    text: 'aud.aUpdated',
    badge: 'bg-brand-50 text-brand-700 border-brand-200',
    strip: 'bg-brand-500',
    Icon: Pencil,
  },
  delete: {
    text: 'toast.deleted',
    badge: 'bg-red-50 text-red-700 border-red-200',
    strip: 'bg-red-500',
    Icon: Trash2,
  },
  status_change: {
    text: 'aud.aStatus',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    strip: 'bg-amber-500',
    Icon: ArrowRightLeft,
  },
};

const FIELD_LABELS: Record<string, string> = {
  revenue_eur: 'aud.fFreight',
  driver_id: 'aud.eDriver',
  truck_id: 'aud.fTractor',
  client_id: 'aud.eClient',
  start_date: 'aud.fStart',
  end_date: 'aud.fFinish',
  route: 'aud.fRoute',
  client_request_number: 'aud.fClientReq',
  start_fuel_level: 'aud.fFuel',
  status: 'aud.fStatus',
  name: 'aud.fName',
  contact_person: 'aud.fContact',
  phone: 'aud.fPhone',
  email: 'Email',
  type: 'aud.fLocType',
  company_name: 'aud.fOrg',
  postal_code: 'aud.fPostal',
  city: 'aud.fCity',
  address: 'aud.fAddress',
  full_name: 'aud.fFullName',
  tax_id: 'NIP',
  country: 'aud.fCountry',
  notes: 'aud.fNotes',
  first_name: 'aud.fFirst',
  last_name: 'aud.fLast',
  passport_number: 'aud.fPassNo',
  passport_expiry: 'aud.fPassExp',
  visa_expiry: 'aud.fVisaExp',
  license_number: 'aud.fLicNo',
  license_expiry: 'aud.fLicExp',
  tachograph_card_number: 'aud.fTachoNo',
  tachograph_card_expiry: 'aud.fTachoExp',
  code_95_expiry: 'aud.fC95',
  adr_expiry: 'aud.fAdr',
  date_of_birth: 'aud.fBirth',
  order_number: 'aud.fReqNo',
  client_price_eur: 'aud.fClientSum',
  original_client_price: 'aud.fSumCur',
  original_currency: 'aud.fCurrency',
  load_date: 'aud.fPlanLoad',
  unload_date: 'aud.fPlanUnload',
  cargo_description: 'aud.fCargoDesc',
  transport_type: 'aud.fTransport',
  transport_temperature: 'aud.fTemp',
  cargo_type: 'aud.fCargoType',
  cargo_quantity: 'aud.fCargoQty',
  customs_loading: 'aud.fCustomsLoad',
  customs_unloading: 'aud.fCustomsUnload',
  loading_reference: 'aud.fLoadRef',
  client_request_date: 'aud.fClientReqDate',
};

const DATE_FIELDS = new Set([
  'start_date',
  'end_date',
  'passport_expiry',
  'visa_expiry',
  'license_expiry',
  'tachograph_card_expiry',
  'code_95_expiry',
  'adr_expiry',
  'date_of_birth',
  'load_date',
  'unload_date',
  'client_request_date',
]);

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  if (DATE_FIELDS.has(field)) {
    try {
      return new Date(String(value)).toLocaleDateString('ru-RU');
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hh}:${mm}`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { t } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'audit.view');
  if (denied) redirect(denied);

  const resolvedParams = await searchParams;
  const entityFilter = resolvedParams.entity || null;

  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (entityFilter) {
    query = query.eq('entity_type', entityFilter);
  }

  const { data: logs, error } = await query;

  if (error) {
    return (
      <div className="p-8 text-red-500">
        {t('aud.loadError')}{' '}{error.message}
      </div>
    );
  }

  const allEntities = Object.keys(ENTITY_LABELS);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <ScrollText className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('aud.title')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {t('aud.hint')}
          </p>
        </div>

        {/* Фильтры */}
        <div className="card p-3 flex flex-wrap gap-2">
          <a
            href="/audit"
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${!entityFilter
                ? 'bg-brand-600 text-white shadow-brand'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {t('status.filterAll')}
          </a>
          {allEntities.map((key) => (
            <a
              key={key}
              href={`/audit?entity=${key}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${entityFilter === key
                  ? 'bg-brand-600 text-white shadow-brand'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {t(ENTITY_LABELS[key] as MessageKey)}
            </a>
          ))}
        </div>

        {(!logs || logs.length === 0) ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">{t('aud.empty')}</h2>
            <p className="text-slate-500 text-sm">
              {t('aud.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const meta = ACTION_META[log.action] || {
                text: log.action,
                badge: 'bg-slate-100 text-slate-700 border-slate-200',
                strip: 'bg-slate-400',
                Icon: Pencil,
              };
              const ActionIcon = meta.Icon;
              const entityLabel = ENTITY_LABELS[log.entity_type] ? t(ENTITY_LABELS[log.entity_type] as MessageKey) : log.entity_type;

              const changes = log.changes as Record<string, { before: unknown; after: unknown }> | null;

              return (
                <div key={log.id} className="card overflow-hidden">
                  <div className="flex">
                    <div className={`w-1 ${meta.strip} shrink-0`} />
                    <div className="p-4 md:p-5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badge}`}>
                            <ActionIcon className="w-3 h-3" strokeWidth={2.5} />
                            {ACTION_META[log.action] ? t(meta.text as MessageKey) : meta.text}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {entityLabel}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      {log.summary && (
                        <div className="text-sm text-slate-800 font-medium mb-2 break-words">
                          {log.summary}
                        </div>
                      )}

                      {changes && Object.keys(changes).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                          {Object.entries(changes).map(([field, { before, after }]) => (
                            <div key={field} className="flex flex-wrap items-baseline gap-2 text-xs">
                              <span className="text-slate-500 font-medium">
                                {FIELD_LABELS[field] ? t(FIELD_LABELS[field] as MessageKey) : field}:
                              </span>
                              <span className="text-red-500 line-through tabular-nums">
                                {formatFieldValue(field, before)}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-600 font-semibold tabular-nums">
                                {formatFieldValue(field, after)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <UserIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                        <span className="font-medium text-slate-500">{log.user_name}</span>
                        {log.user_role && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span>
                              {roleLabel(log.user_role)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
