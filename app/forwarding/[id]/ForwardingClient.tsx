import { Handshake, User, Phone } from 'lucide-react';

export default function ForwardingClient({
  clientName,
  clientContact,
  clientPhone,
}: {
  clientName: string;
  clientContact: string | undefined;
  clientPhone: string | undefined;
}) {
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Handshake className="w-5 h-5 text-brand-600" />
        Клиент
      </h2>
      <div className="border-l-4 border-green-500 pl-4 py-1">
        <div className="font-bold text-slate-900 break-words">{clientName}</div>
        {clientContact && (
          <div className="text-sm text-slate-600 mt-1 inline-flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {clientContact}
          </div>
        )}
        {clientPhone && (
          <div className="text-sm text-slate-600 mt-1 inline-flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <a href={`tel:${clientPhone}`} className="hover:text-brand-600 transition-colors">{clientPhone}</a>
          </div>
        )}
      </div>
    </div>
  );
}
