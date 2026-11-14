import { NextResponse } from 'next/server';
import { getSessionContext } from '../../../../lib/session';
import { can } from '../../../../lib/roles';
import { getT } from '../../../../lib/i18n/server';
import { IMPORT_TYPES, type ImportType } from '../../../../lib/import-rules';
import { buildTemplate } from '../../../../lib/import-excel';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { role } = await getSessionContext();
  if (!can(role, 'settings.edit')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = new URL(request.url).searchParams.get('type') as ImportType;
  if (!IMPORT_TYPES.includes(type)) return NextResponse.json({ error: 'Unknown type' }, { status: 400 });

  const { t } = await getT();
  const buffer = await buildTemplate(type, t);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="import_${type}.xlsx"`,
    },
  });
}
