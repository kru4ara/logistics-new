import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Сторож: каждый экспорт из 'use server'-файла — публичный эндпоинт.
 * proxy.ts проверяет путь СТРАНИЦЫ, а экшен можно вызвать отдельно,
 * поэтому каждый экшен сам проверяет доступ.
 *
 * Если тест упал на новом экшене — добавьте в начало функции одно из:
 *   await requireCapability('<право>')   // lib/require-office.ts
 *   await requireOffice()
 *   await requireTripAccess(tripId) / requireExpenseAccess(expenseId)
 *   const actor = await getActorContext(); if (!actor...) return/throw
 * Публичный по смыслу экшен — в PUBLIC_ACTIONS с причиной.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  'app/login/actions.ts:login': 'вход — до авторизации',
  'app/login/actions.ts:logout': 'выход — только свою сессию',
  'app/admin-onboarding-actions.ts:completeAdminOnboarding': 'ставит cookie подсказки, данных не трогает',
};

const CHECK =
  /\b(requireCapability|requireOffice|requireTripAccess|requireExpenseAccess|getActorContext|getSessionContext)\(/;

const root = resolve(__dirname, '../..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '__tests__' || name === '.next') return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

function isUseServer(src: string): boolean {
  return /^\s*['"]use server['"]/.test(src.replace(/^(\s*\/\/.*\n|\s*\/\*[\s\S]*?\*\/)*/, ''));
}

type Action = { id: string; checked: boolean };

function collectActions(): Action[] {
  const out: Action[] = [];
  for (const file of [...tsFiles(join(root, 'app')), ...tsFiles(join(root, 'lib'))]) {
    const src = readFileSync(file, 'utf8');
    if (!isUseServer(src)) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);

    // Локальные функции: проверка может жить в хелпере файла.
    const local = new Map<string, ts.FunctionDeclaration>();
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) local.set(st.name.text, st);
    }
    const checks = (fn: ts.FunctionLikeDeclaration, depth = 0): boolean => {
      const body = fn.body?.getText(sf) ?? '';
      if (CHECK.test(body)) return true;
      if (depth > 1) return false;
      for (const [name, helper] of local) {
        if (helper !== fn && new RegExp(`\\b${name}\\(`).test(body) && checks(helper, depth + 1)) return true;
      }
      return false;
    };

    const rel = relative(root, file).split('\\').join('/');
    const exported = (n: ts.Node) =>
      ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name && exported(st)) {
        out.push({ id: `${rel}:${st.name.text}`, checked: checks(st) });
      }
      if (ts.isVariableStatement(st) && exported(st)) {
        for (const d of st.declarationList.declarations) {
          const init = d.initializer;
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            out.push({ id: `${rel}:${d.name.getText(sf)}`, checked: checks(init) });
          }
        }
      }
    }
  }
  return out;
}

describe('server actions: проверка доступа', () => {
  const actions = collectActions();

  it('экшены найдены (сторож не ослеп)', () => {
    expect(actions.length).toBeGreaterThan(40);
  });

  it('каждый экшен проверяет доступ или явно помечен публичным', () => {
    const missing = actions.filter((a) => !a.checked && !(a.id in PUBLIC_ACTIONS)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it('список публичных не устарел', () => {
    const ids = new Set(actions.map((a) => a.id));
    expect(Object.keys(PUBLIC_ACTIONS).filter((id) => !ids.has(id))).toEqual([]);
  });
});
