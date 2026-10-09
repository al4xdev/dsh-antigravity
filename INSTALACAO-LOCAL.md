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
Não verificado: login no Google e inferência autenticada.

O modelo principal existente permanece selecionado. O plugin aparece após uma
nova abertura da TUI. A atualização do checkout deve preservar as adaptações locais.
