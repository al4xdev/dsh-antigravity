# Instalação local no DSH TUI

Revisão upstream: `1cb9010`, versão `0.1.0-rc.5`.
Perfil: `~/.dsh/profiles/dsh-tui`.

O pacote está ligado ao checkout local, com dependências de runtime compartilhadas
com a instalação do DSH. As referências `workspace:` do manifesto foram ajustadas
para as versões instaladas; as dependências de desenvolvimento foram retiradas.

`tui-login.mjs` acrescenta dois comandos locais:

- `/antigravity-client <arquivo.json>` importa `clientId` e `clientSecret` para o
  armazenamento de credenciais do DSH, sem imprimir esses valores.
- `/antigravity-login` usa o OAuth do plugin e abre o navegador.

No Linux o upstream não importa automaticamente a configuração do cliente OAuth.
Ela precisa ser fornecida antes do login. Nenhum token ou configuração de cliente
foi extraído de outro aplicativo nesta instalação.

Verificado: importação dos módulos, composição do perfil, início real da TUI e
execução do comando com diagnóstico correto quando falta a configuração OAuth.
Na instalação inicial, login no Google e inferência autenticada não foram testados.
A validação de pesquisa autenticada abaixo usa o OAuth já existente, sem novo login.

## Pesquisa Google opt-in

O código local oferece `webSearch` (padrão `false`) e `searchModel` (padrão
`gemini-3.8-flash-low`). Habilitar `webSearch: true` no plugin registra pesquisa
`google-antigravity` quando o serviço `web` estiver disponível, reutilizando OAuth.
Se houver outros providers, selecionar explicitamente
`searchProvider: google-antigravity` no serviço web e preservar explicitamente
`fetchProvider: http` ao substituir o bloco de configuração do loader.
Nenhuma dessas configurações é modificada automaticamente pelo plugin.

A pesquisa exige grounding nativo e término `STOP`; não troca de modelo nem
extrai fontes de URLs no texto. Preserva URLs HTTP(S) de grounding, incluindo
redirecionamentos Google. Limites: 60 segundos, 2 MiB de SSE, 128 Ki caracteres de
resposta e 64 fontes. Truncamento de resposta/fontes é sinalizado no resultado.

Validação mockada sem rede: `npm run test:search`.
Build host isolado local: `npm run bundle:host`.
O build padrão `pnpm run bundle` ainda referencia tooling do monorepo upstream.
A implementação em `src` só entra em runtime após build, sem editar `lib` à mão.

### Validação e ativação — 2026-10-12

- Pesquisa real com `gemini-3.8-flash-low` e OAuth: HTTP 200, término STOP,
  consultas Google e quatro fontes no teste Node.js (15,3 segundos).
- Provider compilado montado via Cordis/`ctx.web`: pesquisa Qwen3.8-27B retornou
  resposta e oito fontes (23,9 segundos); descarregar o plugin removeu o provider.
- Datas/codinome Node.js e características principais Qwen foram conferidos nas
  páginas oficiais. Grounding comprova busca, não garante cada afirmação do resumo.
- Suíte de 30 testes host passou; fontes passaram no typecheck standalone.
- Perfil `dsh-tui`: busca Google ativada, pesquisa DeepSeek desativada,
  `web_fetch` permanece HTTP. Composição offline dos três bundles passou sem avisos.
- Relatórios locais ficam em `.dumps/antigravity-search-{probe,live}.json` e
  `.dumps/antigravity-profile-check.json` do repositório pai (não versionados).

O modelo principal existente permanece selecionado. O plugin aparece após uma
nova abertura da TUI. A atualização do checkout deve preservar as adaptações locais.
