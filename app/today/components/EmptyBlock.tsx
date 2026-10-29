import { Inbox } from 'lucide-react';

/** Заглушка для пустой секции. */
export default function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="card p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-50 flex items-center justify-center">
        <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="text-sm text-slate-400">{text}</div>
    </div>
  
  );
}
