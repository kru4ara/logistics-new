import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { can, deniedRedirect, roleLabel, capabilityForRequest } from '../roles';

describe('deniedRedirect', () => {
  it('есть право — null', () => {
    expect(deniedRedirect('office', 'clients.view')).toBeNull();
    expect(deniedRedirect('admin', 'audit.view')).toBeNull(); // admin = office
  });

  it('водитель без права — в свой раздел', () => {
    expect(deniedRedirect('driver', 'clients.view')).toBe('/driver');
  });

  it('остальные без права — на вход', () => {
    expect(deniedRedirect('manager', 'audit.view')).toBe('/login');
    expect(deniedRedirect(null, 'clients.view')).toBe('/login');
    expect(deniedRedirect('client', 'clients.view')).toBe('/login');
  });

  it('офис с ролью office проходит туда, куда раньше пускали только admin', () => {
    // /audit, /reports/excel, /reports/logisat, /reports/profitability
    // проверяли role !== 'admin' и отправляли office на /login.
    for (const cap of ['audit.view', 'export.view', 'reports.viewAll'] as const) {
      expect(deniedRedirect('office', cap)).toBeNull();
    }
  });
});

describe('новые права', () => {
  it('reports.viewAll — только офис: отчёты без скоупа показали бы менеджеру чужие заказы', () => {
    expect(can('office', 'reports.viewAll')).toBe(true);
    expect(can('manager', 'reports.viewAll')).toBe(false);
    expect(can('driver', 'reports.viewAll')).toBe(false);
    expect(can('manager', 'reports.view')).toBe(true); // общий отчёт со скоупом — можно
  });

  it('reminders.viewAll — офис и менеджер, водитель нет', () => {
    expect(can('office', 'reminders.viewAll')).toBe(true);
    expect(can('manager', 'reminders.viewAll')).toBe(true);
    expect(can('driver', 'reminders.viewAll')).toBe(false);
    expect(can('driver', 'reminders.view')).toBe(true); // свой раздел /driver/reminders
  });

  it('proxy не пускает водителя на общую страницу /reminders', () => {
    const cap = capabilityForRequest('/reminders', 'GET');
    expect(cap).toBe('reminders.viewAll');
    expect(can('driver', cap!)).toBe(false);
  });
});

describe('roleLabel', () => {
  it('подписи ролей, admin — как офис', () => {
    expect(roleLabel('admin')).toBe('Офис');
    expect(roleLabel('office')).toBe('Офис');
    expect(roleLabel('manager')).toBe('Менеджер');
    expect(roleLabel('driver')).toBe('Водитель');
    expect(roleLabel(null)).toBe('Неизвестно');
    expect(roleLabel('accountant')).toBe('accountant');
  });
});

/**
 * Сторож: роль не сравнивается со строкой (AGENTS.md, «Права доступа», п. 1).
 * Сравнение `role === 'admin'` уже давало отказ офису с ролью 'office'
 * на четырёх страницах и в driver-docx. Проверяем через can() /
 * deniedRedirect() / isDriverRole() из lib/roles.ts.
 *
 * Исключения: lib/roles.ts (сама матрица) и чистые правила доступа,
 * где роль — уже нормализованный тип 'office' | 'manager' | 'driver'.
 */
const ALLOWED_FILES = new Set(['lib/roles.ts', 'lib/access-rules.ts', 'lib/driver-access.ts']);
const ROLE_VALUES = new Set(['admin', 'office', 'manager', 'driver', 'logistics', 'accountant', 'client']);

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', '__tests__', '.next'].includes(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe('сторож: роль не сравнивается строкой', () => {
  it('нет сравнений вида role === "driver" вне lib/roles.ts', () => {
    const root = resolve(__dirname, '../..');
    const files = [...tsFiles(join(root, 'app')), ...tsFiles(join(root, 'lib')), join(root, 'proxy.ts')];
    const found: string[] = [];
    for (const file of files) {
      const rel = relative(root, file).split('\\').join('/');
      if (ALLOWED_FILES.has(rel)) continue;
      const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (n: ts.Node) => {
        if (
          ts.isBinaryExpression(n) &&
          [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
           ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)
        ) {
          const [lit, other] = ts.isStringLiteral(n.right) ? [n.right, n.left] : [n.left, n.right];
          if (ts.isStringLiteral(lit) && ROLE_VALUES.has(lit.text) && /role\b/i.test(other.getText(sf))) {
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
            found.push(`${rel}:${line + 1}  ${n.getText(sf)}`);
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(found).toEqual([]);
  });
});
