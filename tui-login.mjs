import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parseOAuthClientConfig } from './lib/index.js';
export const name = 'antigravity-tui-login';
export const inject = ['commands', 'credentials', 'antiGravityAuth'];
export function apply(ctx) {
  ctx.commands.register({
    name: 'antigravity-client', description: 'Importar configuração OAuth do Antigravity de um arquivo JSON', input: { hint: '<arquivo.json>' },
    handler: async ({ rawInput }) => {
      const path = rawInput.trim();
      if (!path) return { kind: 'error', text: 'Informe um arquivo JSON contendo clientId e clientSecret do cliente autorizado.' };
      const config = parseOAuthClientConfig(await readFile(path, 'utf8'));
      await ctx.credentials.set('GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG', JSON.stringify(config));
      return { kind: 'success', text: 'Configuração importada. Use /antigravity-login.' };
    },
  });
  ctx.commands.register({
    name: 'antigravity-login', description: 'Autorizar Antigravity no navegador',
    handler: async ({ signal }) => {
      const info = await ctx.credentials.describe('GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG');
      if (!info.configured) return { kind: 'error', text: 'No Linux, importe primeiro a configuração OAuth com /antigravity-client <arquivo.json>.' };
      const attempt = await ctx.antiGravityAuth.start();
      const browser = spawn('xdg-open', [attempt.authorizationUrl], { stdio: 'ignore', detached: true });
      browser.on('error', () => {});
      browser.unref();
      for (let i = 0; i < 180; i++) {
        if (signal?.aborted) { await ctx.antiGravityAuth.logout(); return { kind: 'error', text: 'Login cancelado.' }; }
        const status = ctx.antiGravityAuth.poll(attempt.loginId);
        if (status.kind === 'succeeded') return { kind: 'success', text: 'Antigravity autorizado. Selecione google-antigravity em /model.' };
        if (status.kind !== 'pending') return { kind: 'error', text: status.message ?? 'Login cancelado.' };
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      await ctx.antiGravityAuth.logout();
      return { kind: 'error', text: 'Tempo de login esgotado.' };
    },
  });
}
