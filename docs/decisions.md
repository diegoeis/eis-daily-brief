# Decisões

## 2026-10-14 — v0.1.0

- **Origem**: um prompt pessoal de daily brief do autor, generalizado. Regras de tarefa (migração, checagem de fechamento, evidência do fechamento, deduplicação, sync com a nota de origem, report não gera tarefa) vieram dos ajustes feitos nesse prompt em 14/10.
- **Duas skills**: `brief-setup` (interativa, única que escreve a config) e `brief-generate` (silenciosa, só lê a config). Separação para o brief rodar em agendamento sem perguntas.
- **Config num arquivo na pasta do usuário** (`eis-daily-brief.json`), nunca em `~/.claude/` ou `${CLAUDE_PLUGIN_DATA}`: no Cowork o plugin só alcança pastas conectadas à sessão. Nome reconhecível para o usuário achar e editar à mão.
- **Busca da config**: `--config` no pedido; senão, raiz ou um nível abaixo de uma pasta conectada. Nada além disso.
- **`userConfig` do plugin.json não foi usado**: os campos só aceitam valores simples (sem lista de pessoas por grupo) e não foi verificado se o Cowork mostra o diálogo.
- **Frontmatter das skills** só com `name` e `description`: o upload do claude.ai/Cowork aceita apenas `allowed-tools`, `compatibility`, `description`, `license`, `metadata`, `name`. Sem `disable-model-invocation`, que impediria rodar em tarefa agendada.
- **Conteúdo das skills em inglês**; idioma da nota vem de `language` na config. Nomes das seções do template nunca são traduzidos.

## 2026-10-20 — fechamento pelo tracker

- **Problema**: tarefas com link de issue do Jira nunca fechavam. Só havia checagem por thread (Slack/e-mail) e por report, e o report não cita tarefas de acompanhamento ("Acompanhar ... resolução do bug X").
- **Decisão**: a checagem de fechamento virou uma regra só, com três gatilhos (thread, issue no tracker em status de concluído, report) e a mesma exigência de evidência. O tracker só fecha tarefas, nunca cria.
- **`sources.tracker`**: chave ausente conta como ligada, para configs existentes funcionarem sem edição.

## 2026-10-27 — v0.2.0, Hermes

- **Manifesto duplo em `src/`**: `.claude-plugin/plugin.json` (Claude Code, Cowork, marketplace) e `plugin.json` com `$schema` do Agent Plugins v1 (Hermes: `hermes plugins install diegoeis/eis-daily-brief/src`). Os dois precisam ter a mesma `version`; o `pack.sh` recusa se divergirem.
- **Caminhos relativos à pasta da skill** (`../../references/config.md`, `templates/daily.md`) no lugar de `${CLAUDE_PLUGIN_ROOT}`, que só o Claude Code expande.
- **Busca da config ganhou um 3º passo**: caminho guardado pelo host (memória persistente, arquivo de instruções ou `EIS_DAILY_BRIEF_CONFIG`). No Hermes não existe pasta conectada; o diretório de trabalho conta como pasta conectada e quase nunca tem a config.
- **Fontes sem nome de ferramenta**: qualquer connector, MCP, skill ou CLI que leia a fonte serve.

## Pendente

- Testar `brief-setup` no Cowork (seletor de pasta) e `brief-generate` agendado com `--config`.
- Inferência de pessoas e canais pelo messenger no setup: está descrita, não testada.
- `.gitkeep` em `src/skills/` pode ser removido.
