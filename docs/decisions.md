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

## 2026-10-27 — v0.4.0, generate e view encadeados

- **`brief-view` gera antes de abrir**: confere se a nota de hoje (`output.folder` + `output.pattern`) existe; se não, segue o `brief-generate` (sem `--force`) e abre a página mesmo se ele terminar `BLOCKED`. Sem config, só avisa e abre.
- **`brief-generate` oferece abrir a página** no fim, com uma pergunta de sim ou não. Só quando uma pessoa iniciou a execução: agendamento (tarefa agendada, cron), `--no-view` ou chamada vinda do `brief-view` pulam a oferta. A regra "roda sem perguntas" continua valendo durante a geração.
- **Uma skill chama a outra pelo caminho do `SKILL.md`** (`../brief-view/SKILL.md`), sem nome de ferramenta de host: funciona igual no Claude e no Hermes. Cada lado sabe pular a parte que o outro já fez, para não haver laço.

## 2026-10-27 — v0.5.0, workspace `.eis-daily-brief/`

- **Problema**: no Claude Desktop a skill roda isolada e não abre o navegador; o plugin fica numa pasta temporária que muda a cada versão. Como o navegador guarda a pasta escolhida por endereço da página, o usuário perderia a escolha a cada atualização.
- **Decisão**: o `brief-setup` cria `.eis-daily-brief/` na pasta que o usuário escolhe. Lá ficam `config.json` e `app/`, a cópia da página. O `brief-view` (e o setup) atualiza a cópia quando `app/VERSION` difere da versão do plugin, e abre sempre essa cópia: o endereço nunca muda. Funciona igual em qualquer host, porque a pasta escolhida é alcançável em todos (pasta conectada no Cowork, caminho no Hermes e no Claude Code).
- **Ponto com ponto na frente**: apps de notas (Obsidian) ignoram, então a página e a config não viram notas.
- **Compatibilidade**: `eis-daily-brief.json` solto na pasta continua sendo lido; o workspace dele é o `.eis-daily-brief/` ao lado. O setup oferece mover.
- **Sem workspace, o `brief-view` para** e indica o `brief-setup`: não há cópia da página para abrir, e abrir a do plugin traria de volta o endereço instável.

## 2026-10-27 — v0.6.0, formato da daily como dado

- **Problema**: a página tinha o formato das tarefas e o padrão `YYYY-MM/YYYY-MM-DD.md` fixos no código. Quem usa outro `output.pattern` via "Nenhuma nota"; quem escreve tarefas de outro jeito via zero tarefas.
- **Decisão**: o formato das tarefas vira um JSON declarativo e versionado (`references/daily-format.json`, com JSON Schema), no espírito dos design tokens do W3C. O `brief-generate` escreve e a página lê e edita pelo mesmo arquivo. Só texto literal e marcadores (`YYYY`, `{date}`, `{text}`), nunca regex. Só a seção de tarefas; o resto da nota segue o template.
- **Formato do usuário**: opcional, em `.eis-daily-brief/daily-format.json`. O `brief-setup` lê algumas notas, propõe o JSON e grava só após confirmação. A LLM trabalha uma vez; a página segue previsível e sem tokens.
- **Página recebe config por script**: `file://` não lê JSON, mas carrega `<script>`. As skills escrevem `.eis-daily-brief/page-settings.js` (padrão + formato) fora de `app/`, para atualizações não apagarem. Sem o arquivo, a página usa os padrões. Inválido: usa o padrão e avisa.
- **Fora do escopo**: Logseq/outliner, org-mode, tarefas em tabela.
- **Prova**: o parser novo dá o mesmo modelo e as mesmas edições que o antigo em todas as dailies reais do autor; um formato bem diferente (`# TODO`, `###`, `DD/MM/YYYY`, marcas em texto) passa por parse, marcar, desmarcar, comentar e adicionar.

## 2026-10-27 — v0.7.0, atualização da daily no mesmo dia

- **Problema**: rodar de novo no mesmo dia parava com `BLOCKED` (nota existe), e o `--force` regerava a partir da daily anterior, apagando o que o usuário marcou e comentou na nota ou na página. Um cron de hora em hora não servia para nada depois da 1ª execução.
- **Decisão**: três modos. *Create* (nota não existe, base = daily anterior), *update* (nota existe, base = a própria nota) e *rebuild* (`--force`, como create). No update, toda tarefa da nota fica como está (abertas, feitas, comentários, tarefas criadas à mão ou pela página); só entram fechamento, sub-item de dedup e posição. Agenda, pendências, tópicos e concluídos são reescritos. Antes de gravar, relê a nota e aplica as mudanças sobre a versão nova se ela mudou durante a execução. Sem mudança, não grava.
- **Tarefa feita não volta**: dedup de novas contra as tarefas feitas da base e da daily anterior.
- **Ordem dentro do grupo**: abertas por 📅 mais próximo (atrasadas primeiro, sem data depois), depois ➕ mais recente, depois prioridade mais alta (marcas de `tasks.priority`; sem marca = entre medium e low, como no Obsidian Tasks). Feitas no fim, ✅ mais recente primeiro.
- **Fechamento por outras fontes**: tarefa vinda de nota do vault fecha pelo checkbox da nota; como nota de reunião quase nunca é atualizada, sem evidência ali roda uma busca dirigida. Tarefa sem link segue a mesma busca. Menção, plano ou progresso parcial não fecham.
- **Busca dirigida, não varredura** (v0.7.1): varrer várias fontes por tarefa, desde a criação, custaria tokens demais num cron de hora em hora. A busca é recortada pelo contexto da tarefa, da mais barata para a mais cara, parando na 1ª evidência: (1) notas seguintes da mesma série (mesma pasta, mesmo título sem a data, ou propriedade de série); (2) DMs e e-mails só com as pessoas citadas na tarefa, ou com as 1-2 pessoas da nota de origem (reunião grande sem pessoa citada pula este passo); (3) só as issues citadas. Tarefas agrupadas por pessoa e por série: cada DM/série é lida uma vez por execução. Janela incremental: a partir de `lastCheck` em `.eis-daily-brief/state.json`, gravado no fim de cada execução.
- **v0.7.2**: o passo de pessoas começa pelas notas do vault que citam a pessoa (propriedade people/attendees ou link para a nota dela) modificadas na janela, antes de DM e e-mail. Thread e issue ligadas a uma tarefa só são abertas inteiras quando tiveram atividade depois do início da janela (última resposta, última atualização); issues numa consulta só. Uso pessoal do autor: cron às 8h (cria a nota) e 18h (atualiza), em vez de hora em hora.

## 2026-10-27 — v0.8.0, brief-view sempre roda o brief

- **`brief-view` roda o `brief-generate` antes de abrir**, não só quando a nota falta: com o modo update, o generate cria ou atualiza, então um único `brief-view` agendado gera, atualiza e abre. `--no-generate` só abre (para quem quer olhar sem gastar uma execução do brief). Substitui a regra da v0.4.0.
- **Página confere menos**: de 4 s para 15 s, só com a aba visível (já era assim), e a varredura da pasta atrás de nota mais nova só roda enquanto a nota aberta não é a de hoje; com a de hoje aberta, cada checagem é um `getFile()` só. `findLatest` passou a devolver `date`.

## Pendente

- Testar `brief-setup` no Cowork (seletor de pasta) e `brief-generate` agendado com `--config`.
- Inferência de pessoas e canais pelo messenger no setup: está descrita, não testada.
- `.gitkeep` em `src/skills/` pode ser removido.
- Página: textos da interface em português; seguir o `language` da config.
