# Decisões

## 2026-10-14 — v0.1.0

- **Origem**: um prompt pessoal de daily brief do autor, generalizado. Regras de tarefa (migração, checagem de fechamento, evidência do fechamento, deduplicação, sync com a nota de origem, report não gera tarefa) vieram dos ajustes feitos nesse prompt em 14/10.
- **Duas skills**: `tasks-setup` (interativa, única que escreve a config) e `tasks-update` (silenciosa, só lê a config). Separação para o brief rodar em agendamento sem perguntas.
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

- **Manifesto duplo em `src/`**: `.claude-plugin/plugin.json` (Claude Code, Cowork, marketplace) e `plugin.json` com `$schema` do Agent Plugins v1 (Hermes: `hermes plugins install diegoeis/eis-task-manager/src`). Os dois precisam ter a mesma `version`; o `pack.sh` recusa se divergirem.
- **Caminhos relativos à pasta da skill** (`../../references/config.md`, `templates/daily.md`) no lugar de `${CLAUDE_PLUGIN_ROOT}`, que só o Claude Code expande.
- **Busca da config ganhou um 3º passo**: caminho guardado pelo host (memória persistente, arquivo de instruções ou `EIS_DAILY_BRIEF_CONFIG`). No Hermes não existe pasta conectada; o diretório de trabalho conta como pasta conectada e quase nunca tem a config.
- **Fontes sem nome de ferramenta**: qualquer connector, MCP, skill ou CLI que leia a fonte serve.

## 2026-10-27 — v0.3.0, página da daily

- **Página local em `src/app/`** (HTML, CSS e JS puros, sem servidor nem build): mostra a última daily como painel de tarefas e grava cada mudança direto na nota, no formato do brief. Copiada de um projeto de dashboard pessoal; daqui em diante evolui no plugin, sem dependência daquele projeto.
- **Acesso aos arquivos pela File System Access API**: o usuário escolhe a pasta das dailies uma vez; o handle fica no IndexedDB. Só navegadores Chromium e o painel de preview do Hermes (testado: abre do disco e escolhe pasta). Artefato de chat e widget inline rodam em sandbox e não alcançam arquivos, por isso a skill nunca abre a página assim.
- **Uma página só, telas por `#hash`**: no `file://`, alguns navegadores (Dia) guardam o armazenamento por arquivo HTML; com duas páginas, a pasta escolhida numa não aparecia na outra.
- **Grava só se o arquivo não mudou** desde a última leitura; senão recarrega e avisa. Confere a cada 4 s se a nota mudou ou se surgiu uma nota mais nova.
- **eis-ds copiado e enxugado** em `src/app/vendor/eis-ds.css` por `scripts/vendor-eis-ds.py` (só as classes que a página usa), para o plugin não depender de nada fora dele.
- **Skill `tasks-view`** só abre a página: painel de preview do host, senão navegador padrão, senão o link `file://`.

## 2026-10-27 — v0.4.0, generate e view encadeados

- **`tasks-view` gera antes de abrir**: confere se a nota de hoje (`output.folder` + `output.pattern`) existe; se não, segue o `tasks-update` (sem `--force`) e abre a página mesmo se ele terminar `BLOCKED`. Sem config, só avisa e abre.
- **`tasks-update` oferece abrir a página** no fim, com uma pergunta de sim ou não. Só quando uma pessoa iniciou a execução: agendamento (tarefa agendada, cron), `--no-view` ou chamada vinda do `tasks-view` pulam a oferta. A regra "roda sem perguntas" continua valendo durante a geração.
- **Uma skill chama a outra pelo caminho do `SKILL.md`** (`../tasks-view/SKILL.md`), sem nome de ferramenta de host: funciona igual no Claude e no Hermes. Cada lado sabe pular a parte que o outro já fez, para não haver laço.

## 2026-10-27 — v0.5.0, workspace `.eis-daily-brief/` (hoje `.eis-task-manager/`)

- **Problema**: no Claude Desktop a skill roda isolada e não abre o navegador; o plugin fica numa pasta temporária que muda a cada versão. Como o navegador guarda a pasta escolhida por endereço da página, o usuário perderia a escolha a cada atualização.
- **Decisão**: o `tasks-setup` cria `.eis-task-manager/` na pasta que o usuário escolhe. Lá ficam `config.json` e `app/`, a cópia da página. O `tasks-view` (e o setup) atualiza a cópia quando `app/VERSION` difere da versão do plugin, e abre sempre essa cópia: o endereço nunca muda. Funciona igual em qualquer host, porque a pasta escolhida é alcançável em todos (pasta conectada no Cowork, caminho no Hermes e no Claude Code).
- **Ponto com ponto na frente**: apps de notas (Obsidian) ignoram, então a página e a config não viram notas.
- **Compatibilidade**: `eis-daily-brief.json` solto na pasta continua sendo lido; o workspace dele é o `.eis-daily-brief/` ao lado. O setup oferece mover.
- **Sem workspace, o `tasks-view` para** e indica o `tasks-setup`: não há cópia da página para abrir, e abrir a do plugin traria de volta o endereço instável.

## 2026-10-27 — v0.6.0, formato da daily como dado

- **Problema**: a página tinha o formato das tarefas e o padrão `YYYY-MM/YYYY-MM-DD.md` fixos no código. Quem usa outro `output.pattern` via "Nenhuma nota"; quem escreve tarefas de outro jeito via zero tarefas.
- **Decisão**: o formato das tarefas vira um JSON declarativo e versionado (`references/daily-format.json`, com JSON Schema), no espírito dos design tokens do W3C. O `tasks-update` escreve e a página lê e edita pelo mesmo arquivo. Só texto literal e marcadores (`YYYY`, `{date}`, `{text}`), nunca regex. Só a seção de tarefas; o resto da nota segue o template.
- **Formato do usuário**: opcional, em `.eis-task-manager/daily-format.json`. O `tasks-setup` lê algumas notas, propõe o JSON e grava só após confirmação. A LLM trabalha uma vez; a página segue previsível e sem tokens.
- **Página recebe config por script**: `file://` não lê JSON, mas carrega `<script>`. As skills escrevem `.eis-task-manager/page-settings.js` (padrão + formato) fora de `app/`, para atualizações não apagarem. Sem o arquivo, a página usa os padrões. Inválido: usa o padrão e avisa.
- **Fora do escopo**: Logseq/outliner, org-mode, tarefas em tabela.
- **Prova**: o parser novo dá o mesmo modelo e as mesmas edições que o antigo em todas as dailies reais do autor; um formato bem diferente (`# TODO`, `###`, `DD/MM/YYYY`, marcas em texto) passa por parse, marcar, desmarcar, comentar e adicionar.

## 2026-10-27 — v0.7.0, atualização da daily no mesmo dia

- **Problema**: rodar de novo no mesmo dia parava com `BLOCKED` (nota existe), e o `--force` regerava a partir da daily anterior, apagando o que o usuário marcou e comentou na nota ou na página. Um cron de hora em hora não servia para nada depois da 1ª execução.
- **Decisão**: três modos. *Create* (nota não existe, base = daily anterior), *update* (nota existe, base = a própria nota) e *rebuild* (`--force`, como create). No update, toda tarefa da nota fica como está (abertas, feitas, comentários, tarefas criadas à mão ou pela página); só entram fechamento, sub-item de dedup e posição. Agenda, pendências, tópicos e concluídos são reescritos. Antes de gravar, relê a nota e aplica as mudanças sobre a versão nova se ela mudou durante a execução. Sem mudança, não grava.
- **Tarefa feita não volta**: dedup de novas contra as tarefas feitas da base e da daily anterior.
- **Ordem dentro do grupo**: abertas por 📅 mais próximo (atrasadas primeiro, sem data depois), depois ➕ mais recente, depois prioridade mais alta (marcas de `tasks.priority`; sem marca = entre medium e low, como no Obsidian Tasks). Feitas no fim, ✅ mais recente primeiro.
- **Fechamento por outras fontes**: tarefa vinda de nota do vault fecha pelo checkbox da nota; como nota de reunião quase nunca é atualizada, sem evidência ali roda uma busca dirigida. Tarefa sem link segue a mesma busca. Menção, plano ou progresso parcial não fecham.
- **Busca dirigida, não varredura** (v0.7.1): varrer várias fontes por tarefa, desde a criação, custaria tokens demais num cron de hora em hora. A busca é recortada pelo contexto da tarefa, da mais barata para a mais cara, parando na 1ª evidência: (1) notas seguintes da mesma série (mesma pasta, mesmo título sem a data, ou propriedade de série); (2) DMs e e-mails só com as pessoas citadas na tarefa, ou com as 1-2 pessoas da nota de origem (reunião grande sem pessoa citada pula este passo); (3) só as issues citadas. Tarefas agrupadas por pessoa e por série: cada DM/série é lida uma vez por execução. Janela incremental: a partir de `lastCheck` em `.eis-task-manager/state.json`, gravado no fim de cada execução.
- **v0.7.2**: o passo de pessoas começa pelas notas do vault que citam a pessoa (propriedade people/attendees ou link para a nota dela) modificadas na janela, antes de DM e e-mail. Thread e issue ligadas a uma tarefa só são abertas inteiras quando tiveram atividade depois do início da janela (última resposta, última atualização); issues numa consulta só. Uso pessoal do autor: cron às 8h (cria a nota) e 18h (atualiza), em vez de hora em hora.

## 2026-10-27 — v0.8.0, tasks-view sempre roda o brief

- **`tasks-view` roda o `tasks-update` antes de abrir**, não só quando a nota falta: com o modo update, o generate cria ou atualiza, então um único `tasks-view` agendado gera, atualiza e abre. `--no-generate` só abre (para quem quer olhar sem gastar uma execução do brief). Substitui a regra da v0.4.0.
- **v0.8.2**: o cabeçalho da página mostrava v0.6 fixo; agora mostra a versão do plugin e o `pack.sh` recusa se divergir.
- **Página confere menos**: a cada 5 s, só com a aba visível (já era assim; chegou a ir para 15 s na v0.8.0 e voltou na v0.8.1, porque com a aba oculta nada roda), e a varredura da pasta atrás de nota mais nova só roda enquanto a nota aberta não é a de hoje; com a de hoje aberta, cada checagem é um `getFile()` só. `findLatest` passou a devolver `date`.

## 2026-10-28 — v0.9.0, `eis-daily-brief` vira `eis-task-manager`

- **Por quê**: o uso real é gerir tarefas e obrigações, não ler um brief. O nome passa a dizer isso.
- **Renomes**: plugin e repositório `eis-daily-brief` → `eis-task-manager`; skills `brief-setup` → `tasks-setup`, `brief-generate` → `tasks-update`, `brief-view` → `tasks-view`; workspace `.eis-daily-brief/` → `.eis-task-manager/`; variável `EIS_DAILY_BRIEF_CONFIG` → `EIS_TASK_MANAGER_CONFIG`; global da página `EisDailyBriefSettings` → `EisTaskManagerSettings`. No marketplace, `renames` aponta o nome antigo para o novo.
- **Compatibilidade**: `.eis-daily-brief/` e `eis-daily-brief.json` continuam sendo lidos e o `tasks-setup` oferece mover para `.eis-task-manager/`; a página aceita o global antigo e a variável antiga continua valendo.
- **Nomes internos mantidos**: o banco IndexedDB (`eis-daily-brief`, guarda a pasta escolhida) e a chave de preferências da página (`eis-daily-brief:view:v1`). Trocá-los faria todo usuário escolher a pasta de novo e perder filtros, sem ganho visível. As classes CSS `brief-*` também ficam.
- **Nota diária**: o conceito de daily note continua (é onde as tarefas moram), assim como a tag `daily/brief` do template.

## 2026-10-29 — v0.10.0, prioridade, editar e apagar na página

- **Prioridade segue o padrão das notas**: as marcas do Obsidian Tasks (🔺 ⏫ 🔼 🔽 ⏬), que o vault já usa, logo antes das datas (`Texto ⏫ ➕ 2026-10-14`). O formato já lia essas marcas; agora a página e o `tasks-update` também escrevem, sempre a 1ª marca listada para o nível em `tasks.priority`.
- **`tasks-update` só põe prioridade com sinal explícito na fonte**: marca no checkbox de origem (copiada) ou urgência dita em palavras. Nunca infere pela pessoa, canal ou prazo. Prioridade de tarefa existente é do usuário: o run não mexe.
- **Página**: botão "+ Tarefa" sempre visível (antes só aparecia sem tarefas abertas), com grupo, prioridade e prazo; editar tarefa (texto, prioridade, prazo) e comentário (texto, mantém a data); apagar comentário, com confirmação em dois cliques na própria linha (sem `confirm()`, que pode não existir no painel do host). Nova ordenação "Prioridade" (sem marca = entre média e baixa).
- **Tarefa se cancela, não se apaga**: um ícone na linha troca `- [ ]` por `- [-]` (status cancelado do Obsidian Tasks, já usado no vault, sem data); o mesmo botão reabre. Apagar tiraria a tarefa da nota e o próximo `tasks-update` a cadastraria de novo pela fonte, porque a dedup não teria contra o que comparar. Cancelada fica na nota, conta como fechada, não migra para a próxima daily e barra a mesma tarefa de voltar. Nova chave opcional `tasks.item.cancelled` no formato.
- **Edição no lugar**: só a parte alterada da linha muda (texto, marca ou data); o resto fica como escrito. Descrição cortada por marcas no meio é reescrita com as mesmas partes.

## 2026-10-29 — v0.11.0, edição por duplo clique, abas e links das fontes

- **Duplo clique edita no lugar**: título (texto e prioridade), comentário e prazo. Enter ou "Salvar" grava; Esc descarta sem gravar. Saem os botões Editar/Apagar: comentário não se apaga mais pela página (dá para editar o texto).
- **Abas**: Abertas, Vence hoje (aberta com prazo hoje), Feitas (sem as canceladas), Canceladas, Todas. Cancelar fica numa coluna própria, a última; a tarefa vai para Canceladas.
- **Colunas**: número antes do checkbox. Comentários e o campo de novo comentário ficam acima do "+ Comentário".
- **Links das fontes**: `[[Nota]]` abre no Obsidian (`obsidian://open?vault=…&file=…`, caminho no tooltip) quando o `page-settings.js` traz `vault` (de `vault.path`). A página não lê o vault, então o link do Granola vem da nota: o `tasks-update` escreve `[[Nota]] · [Granola](url)` quando a nota de origem tem `granola_url` no frontmatter, e completa tarefas antigas que não têm.

## 2026-10-29 — v0.12.0, ações para a IA nos comentários

- **Comentário-ação**: um comentário que começa com 🤖 é uma instrução para a IA (`- 2026-10-29 - 🤖 /prod-specs-story Crie a história…`). A tarefa é o contexto. Vale qualquer coisa que a sessão saiba fazer: skill, plugin, connector, cron.
- **Skill própria, `tasks-act`**: roda quando o usuário pede ou num agendamento. Fora do `tasks-update`, para o brief continuar só lendo e escrevendo a nota.
- **Estado na própria nota**: 🤖 a executar, 🤖✅ executada, 🤖⚠️ falhou; abaixo, um comentário `Resultado: … — [links]` ou `Não executada: {motivo ou pergunta}`. Grava logo depois de cada ação, para uma execução interrompida não repetir o que já foi feito. Editar uma ação que falhou na página volta para 🤖 (nova tentativa).
- **Segurança**: só o texto do comentário-ação é instrução; tarefa, fonte e tudo o que for lido ao agir são dados. O `tasks-update` nunca escreve um comentário começando com a marca, para que texto vindo de mensagens não vire ação. Ações sob tarefa feita ou cancelada não rodam. Sem pessoa na sessão (agendamento), dúvida vira falha com a pergunta, nunca palpite.
- **Página**: botão 🤖 no campo de comentário liga "ação para a IA"; os comentários-ação aparecem com selo (A executar, Executada, Falhou). Formato ganhou a chave opcional `tasks.comment.action`.
- **Trava contra execução dupla**: antes de executar, a ação vira 🤖⏳ e entra em `.eis-task-manager/act-state.json` com a hora de início; só depois roda. Outra sessão vê o ⏳ e pula. Um ⏳ com mais de 2 h (ou sem registro) é de uma execução que parou no meio: vira 🤖⚠️ para o usuário conferir, nunca roda de novo sozinho, porque pode ter feito metade.
- **Pré-checagem sem LLM**: `skills/tasks-act/scripts/pending.py` lista as ações pendentes e as travadas; sem nada, imprime `{"wakeAgent": false}` e o agendador nem acorda o agente. Uso do autor: cron de hora em hora, 8h–22h, dias úteis.
- **Página**: busca ao lado do Grupo filtra enquanto digita (texto, fonte, grupo e comentários; sem diferença de maiúsculas e acentos; Esc limpa). "+ Tarefa" saiu de cima das tabelas e foi para a linha das abas, à direita.
- **Prioridade na edição** vira um seletor só com as marcas do formato (🔺 ⏫ 🔼 🔽 ⏬, do Obsidian Tasks), à esquerda do texto.
- **Links para o Obsidian** no formato `obsidian://open?file=<nota>.md` (sem `vault`: abre no cofre aberto). Valem para `[[Nota]]` e para o caminho da daily no topo; esse caminho é montado com `folder` (`output.folder`), nova chave do `page-settings.js`.

## 2026-10-30 — v0.12.1, favicon do eis-ds

- **Favicon**: a página usa o favicon do eis-ds (`src/shared/brand/` no eis-ds, tag v0.5.0). `scripts/vendor-eis-ds.py` copia `favicon.svg` e `apple-touch-icon.png` para `src/app/vendor/` junto com o CSS; o `index.html` linka os dois.

## 2026-10-30 — v0.12.2, abas e "+ Tarefa" alinhados

- **Toolbar**: "+ Tarefa" usa o botão de tamanho padrão (40px) e as abas de status ganharam a mesma altura no eis-ds (v0.5.1). Antes: abas 38px e botão `--sm` 32px, desalinhados.

## 2026-10-30 — v0.12.3, abas de status no celular

- **Sem rolagem horizontal**: em telas estreitas (360–390px) as cinco abas de status quebram em duas linhas (eis-ds v0.5.2), em vez de empurrar a página para os lados.

## 2026-10-30 — v0.12.4, comentários longos com rolagem

- **Altura máxima de 250px por comentário**: o texto de um comentário longo (ação para a IA, resultado) para em 250px e rola por dentro, para a lista de tarefas não esticar.

## 2026-10-30 — v0.13.0, workspace em `eis-ops/task-manager/`

- **Decisão**: o workspace sai de `.eis-task-manager/` (oculta) e vai para `eis-ops/task-manager/`, na mesma pasta escolhida no setup. `eis-ops/` é uma pasta visível compartilhada pelos plugins de assistente do usuário (o eis-answer-assistant vai para lá também); cada um tem sua subpasta e não mexe nas dos outros.
- **Compatibilidade**: `.eis-task-manager/` entra em "Older layouts": continua sendo lida (skills e `pending.py`) e o `tasks-setup` oferece mover, agora incluindo `act-state.json`. `--config` aceita a pasta escolhida, `eis-ops/`, `eis-ops/task-manager/` ou o `config.json`.
- **Página**: a cópia muda de endereço (`eis-ops/task-manager/app/index.html`), então o navegador pede a pasta das notas uma vez de novo.
- **Regras comuns do eis-ops**: `src/eis-ops/` (`rules.md` + `eis_ops.py`) é cópia de `eis-plugins/eis-ops/`, sincronizada por `eis-plugins/scripts/sync-eis-ops.sh`; o `pack.sh` recusa se a cópia divergir. O setup acha a `eis-ops` pelo pointer `~/.config/eis-ops/eis-ops-pointer.json` (fora de qualquer harness; sessões isoladas não o veem e perguntam) e se registra na tabela do `eis-ops/AGENTS.md`.

## 2026-10-30 — v0.13.1, página em inglês

- **Interface em inglês**: textos da página (HTML, `daily.js`, `settings.js`, `app.js`) e a nota de exemplo (mock) passam para inglês; datas em `en-GB` (dia antes do mês). O conteúdo da daily continua no `language` da config.

## 2026-10-30 — v0.14.0, menu entre as páginas do eis-ops

- **Menu compartilhado**: a página carrega `../../nav.js` (gerado pelo `eis_ops.py register` na raiz da `eis-ops`) e ganha uma seção com links para as páginas dos outros plugins. Cada plugin com página tem `eis-ops-page.js` na própria pasta; se a pasta some, o link some. Com uma página só, a seção fica escondida.

## 2026-10-30 — v0.14.1, comentários numa linha própria

- **Tabela de tarefas**: cada tarefa vira duas linhas. A segunda (`brief-task-detail`, `colspan` da tabela toda) guarda os comentários, o formulário de comentário, a data de conclusão e as ações (`ul.brief-task-actions`, no lugar do `p.eis-app-meta`), alinhada ao texto da tarefa.

## 2026-10-30 — v0.14.2, Settings no rodapé da sidebar

- **Sidebar**: o link "Settings - Task Manager" sai da seção System e fica no rodapé, no lugar de "Data: mock" (que saiu). Na barra do topo (até 1024px), onde o eis-ds esconde o rodapé, ele aparece no fim da barra. Mesmo padrão no eis-answer-assistant.

## 2026-10-30 — v0.14.3, fonte e datas abaixo do texto

- **Tabela de tarefas**: as colunas Source, Created e Due saem; viram uma linha (`dl.brief-task-meta`) abaixo do texto da tarefa. Ficam só #, checkbox, tarefa e o botão de cancelar. Duplo clique no Due continua abrindo o campo de data, agora na própria linha.

## Pendente


- Testar `tasks-setup` no Cowork (seletor de pasta) e `tasks-update` agendado com `--config`.
- Inferência de pessoas e canais pelo messenger no setup: está descrita, não testada.
- `.gitkeep` em `src/skills/` pode ser removido.
