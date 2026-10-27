# eis-daily-brief

O plugin ajuda a fazer um brief diário identificando tarefas e respostas que você precisa atuar. Ele separa em tópicos, pessoas, e atualiza as tarefas sozinho quando identifica que já foram feitas ao fazer a atualização diária.

## Skills

- `brief-setup` — cria, mostra (`--show`) ou edita o arquivo de configuração `eis-daily-brief.json`. Interativa. A primeira pergunta é a pasta onde o arquivo vai ficar.
- `brief-generate` — gera a nota do dia a partir da config. Silenciosa, pode rodar agendada. Sem config, para com `STATUS: BLOCKED` pedindo para conectar a pasta do arquivo. Flags: `--date`, `--config`, `--force`.

## Configuração

Tudo que é pessoal (quem é você, idioma, pasta das notas, fontes ligadas, pessoas e canais prioritários, pastas de reuniões e reports) fica em `eis-daily-brief.json`, numa pasta escolhida no setup. O arquivo pode ser editado à mão; o brief relê antes de cada execução. O plugin nunca grava em `~/.claude/` nem em `${CLAUDE_PLUGIN_DATA}`. Schema em `src/references/config.md`.

Para agendar: a pasta do arquivo precisa estar conectada à sessão, ou o caminho vai em `--config`.

## Fechamento automático de tarefas

Toda tarefa aberta, migrada ou nova, é fechada (`[x]` com `✅ data` e um sub-item com a evidência) quando:

- a thread do Slack ou do e-mail mostra que você respondeu ou que quem pediu encerrou o assunto;
- a issue linkada no tracker (Jira, Linear...) está num status de concluído, com a data em que chegou lá (desligue com `sources.tracker: false`);
- o report mais recente mostra a tarefa feita ou decidida.

Sem evidência, a tarefa continua aberta.

## Estrutura

```
eis-daily-brief/
├── src/                    raiz do plugin: só o que entra no pacote
│   ├── .claude-plugin/plugin.json
│   └── skills/
├── docs/                   specs e documentação do projeto
├── scripts/
│   ├── pack.sh             gera o pacote em dist/
│   ├── pii-patterns.example.txt   modelo da lista de padrões
│   └── pii-patterns.txt    padrões proibidos em src/ (local, fora do git)
├── dist/                   builds gerados (fora do git)
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Desenvolver

Coloque skills, agents, hooks e outros arquivos do plugin dentro de `src/`, seguindo o [layout padrão de plugins](https://code.claude.com/docs/en/plugins-reference#standard-layout).

Para testar sem empacotar:

```
claude --plugin-dir ./src
```

## Empacotar

1. A partir do segundo pacote, suba a `version` em `src/.claude-plugin/plugin.json` (o primeiro é `0.1.0`).
2. Rode:

```
./scripts/pack.sh
```

O script valida o plugin com `claude plugin validate`, procura em `src/` os padrões listados em `scripts/pii-patterns.txt` e gera:

- `dist/vX.Y.Z/` — uma cópia limpa de `src/`
- `dist/vX.Y.Z.zip` — o zip dessa pasta, pronto para importar

Ele para se a versão já existir em `dist/`.

`scripts/pii-patterns.txt` fica fora do git, então sua lista de termos sensíveis nunca chega ao repositório. Quem clonar o projeto cria a própria a partir de `scripts/pii-patterns.example.txt`.
