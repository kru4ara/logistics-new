'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '../../components/I18nProvider';
import { addToGroup, removeFromGroup } from './group-actions';

export function AddToGroup({ leaderId, candidates }: { leaderId: string; candidates: { id: string; label: string }[] }) {
  const { t } = useT();
  const router = useRouter();
  const [pick, setPick] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!candidates.length) return <p className="text-xs text-slate-500">{t('group.noCandidates')}</p>;
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="input flex-1 min-w-0 text-sm"
          aria-label={t('group.addLabel')}
        >
          <option value="">{t('group.pickOrder')}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pick || pending}
          className="btn btn-primary text-sm"
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await addToGroup(leaderId, pick);
              if (!r.ok) setErr(r.error);
              else {
                setPick('');
                router.refresh();
              }
            })
          }
        >
          {pending ? '…' : t('group.add')}
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function RemoveFromGroup({ memberId }: { memberId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="text-xs text-slate-500 hover:text-red-600"
        title={t('group.remove')}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await removeFromGroup(memberId);
            if (!r.ok) setErr(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? '…' : t('group.remove')}
      </button>
      {err && <span className="text-xs text-red-600 ml-2">{err}</span>}
    </>
  );
}
