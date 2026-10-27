# AGENTS.md

Projeto do plugin `eis-daily-brief` para Claude Code e Cowork.

O plugin ajuda a fazer um brief diário identificando tarefas e respostas que você precisa atuar. Ele separa em tópicos, pessoas, e atualiza as tarefas sozinho quando identifica que já foram feitas ao fazer a atualização diária.

## Onde as coisas ficam

- `src/` é a raiz do plugin. Só o que está aqui entra no pacote. Arquivos do plugin (skills, agents, hooks, `.mcp.json`) ficam sempre dentro de `src/`, seguindo o layout padrão: https://code.claude.com/docs/en/plugins-reference#standard-layout
- `src/.claude-plugin/plugin.json` é o manifesto e a única fonte da versão (a chave `version`).
- `docs/` guarda specs, decisões e documentação do projeto. Nada aqui entra no pacote.
- `scripts/` guarda os scripts do projeto. `pack.sh` empacota o plugin; `pii-patterns.txt` lista padrões que não podem aparecer em `src/`. Ele é local e fica fora do git (o modelo versionado é `pii-patterns.example.txt`). Nunca copie o conteúdo dele para arquivos versionados.
- `dist/` é gerado por `scripts/pack.sh` e fica fora do git. Não edite nada lá.
- `AGENTS.md`, `CLAUDE.md` e `README.md` ficam na raiz do projeto, nunca em `src/`. Um `CLAUDE.md` na raiz do plugin não é carregado como contexto e faz o `claude plugin validate` emitir aviso.

## Regras

- Não crie arquivos do projeto (notas, rascunhos, specs) dentro de `src/`.
- A cada novo pacote (depois do primeiro), suba a `version` em `src/.claude-plugin/plugin.json`. O `pack.sh` recusa uma versão que já existe em `dist/`.
- Para empacotar, rode `./scripts/pack.sh` a partir da raiz do projeto.
- Para testar localmente sem empacotar: `claude --plugin-dir ./src`.
- Consulte a documentação oficial de plugins antes de criar componentes: https://code.claude.com/docs/en/plugins-reference
