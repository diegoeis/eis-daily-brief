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

## 2026-10-27 — v0.3.0, página da daily

- **Página local em `src/app/`** (HTML, CSS e JS puros, sem servidor nem build): mostra a última daily como painel de tarefas e grava cada mudança direto na nota, no formato do brief. Copiada de um projeto de dashboard pessoal; daqui em diante evolui no plugin, sem dependência daquele projeto.
- **Acesso aos arquivos pela File System Access API**: o usuário escolhe a pasta das dailies uma vez; o handle fica no IndexedDB. Só navegadores Chromium e o painel de preview do Hermes (testado: abre do disco e escolhe pasta). Artefato de chat e widget inline rodam em sandbox e não alcançam arquivos, por isso a skill nunca abre a página assim.
- **Uma página só, telas por `#hash`**: no `file://`, alguns navegadores (Dia) guardam o armazenamento por arquivo HTML; com duas páginas, a pasta escolhida numa não aparecia na outra.
- **Grava só se o arquivo não mudou** desde a última leitura; senão recarrega e avisa. Confere a cada 4 s se a nota mudou ou se surgiu uma nota mais nova.
- **eis-ds copiado e enxugado** em `src/app/vendor/eis-ds.css` por `scripts/vendor-eis-ds.py` (só as classes que a página usa), para o plugin não depender de nada fora dele.
- **Skill `brief-view`** só abre a página: painel de preview do host, senão navegador padrão, senão o link `file://`.

## Pendente

- Testar `brief-setup` no Cowork (seletor de pasta) e `brief-generate` agendado com `--config`.
- Inferência de pessoas e canais pelo messenger no setup: está descrita, não testada.
- `.gitkeep` em `src/skills/` pode ser removido.
- Página: textos da interface em português; seguir o `language` da config.
- Página: após atualizar o plugin a página muda de pasta e o navegador pede a pasta das dailies de novo.
