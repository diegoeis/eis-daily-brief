/* app/js/mock/daily-source.js
   Mock data source for the daily page. Fictional data only.
   Same shape the real source will have later:
     DailySource.load()          -> Promise<{ path, markdown }>  the latest daily note
     DailySource.save(markdown)  -> Promise<void>                writes the note back
   Here the note lives in memory: a reload brings the mock back to its first state.
   Dates are written as {{D}}, {{D-3}}, {{D+2}} (days from today) so the mock never ages. */
(function (root) {
  "use strict";

  var TEMPLATE = [
    "---",
    "created: {{D}}",
    "tags:",
    "  - daily/brief",
    "type: note",
    "---",
    "",
    "# {{D}}",
    "",
    "## Agenda",
    "",
    "| Hour | Event | Observation |",
    "| --- | --- | --- |",
    "| 10:00–10:30 | Daily do time de Plataforma | |",
    "| 14:00–15:00 | Planejamento de Cobrança | organiza [[Ana Prado]] |",
    "",
    "---",
    "",
    "## Tasks",
    "",
    "**Needs to be done**",
    "- [ ] Liberar a nova tela de faturas para todas as contas via feature flag ➕ {{D-3}}",
    "    - {{D}} - Em {{D-3}} você avisou o suporte que libera na segunda e assumiu ligar a flag; o link da flag está no DM — [Slack DM](https://example.slack.com/archives/D01/p1001)",
    "- [ ] Montar a apresentação de estratégia da plataforma: como ela se conecta ao negócio e o que muda no produto ⏫ ➕ {{D-12}} 📅 {{D+20}}",
    "- [ ] new - Responder [[Bruno Lima]] se recebeu por e-mail o convite e as informações da palestra — [Slack DM](https://example.slack.com/archives/D02/p2002) - ➕ {{D-1}}",
    "- [ ] Preencher o arquivo de configuração e testar o gerador de slides que [[Carla Mendes]] mandou — [Slack DM](https://example.slack.com/archives/D03/p3003) - ➕ {{D-20}}",
    "    - {{D-12}} - [[Carla Mendes]] cobrou o teste e você respondeu \"vou testar hoje\" — [Slack DM](https://example.slack.com/archives/D03/p3004)",
    "    - {{D-6}} - Ainda não testei. Preciso das variáveis de ambiente do time.",
    "- [ ] Criar um template de apresentação de status de entregas e OKRs para todo o time ➕ {{D-24}} ⬇️",
    "    - {{D-14}} - Passar ao time o novo modelo; você disse a [[Ana Prado]] que \"vai mudar\" — [Slack #produto](https://example.slack.com/archives/C01/p4004)",
    "    - {{D-13}} - Falta o outline e uma rotina que atualize a apresentação sozinha.",
    "- [x] Responder a [[Davi Rocha]] se há mais algum impedimento para liberar a tela de pagamentos — [Slack DM](https://example.slack.com/archives/D04/p5005) - ➕ {{D-4}} ✅ {{D}}",
    "    - {{D}} - Fechada: em {{D-3}} você respondeu a [[Davi Rocha]] no mesmo DM e avisou suporte e operações — [Slack DM](https://example.slack.com/archives/D04/p5006)",
    "- [ ] new - Especificar o indicador de status dos serviços no cabeçalho — [[{{D-2}} - 1:1 mensal]] - ➕ {{D-2}} 📅 {{D}}",
    "",
    "**Cobrança**",
    "- [ ] Aprovar o acesso à API com o novo provedor de pagamentos — [[{{D-24}} - Planejamento de Cobrança]] - ➕ {{D-24}} 📅 {{D-17}}",
    "    - {{D-10}} - Provedor pediu o certificado digital de novo. Reenviado.",
    "- [ ] new - Revisar as histórias de cobrança e levar para especificação técnica — [[{{D-4}} - Daily de Cobrança]] - ➕ {{D-4}} 📅 {{D}}",
    "- [ ] new - Decidir como liberar a tela de faturas: gradual ou por contas selecionadas — [[{{D-4}} - Daily de Cobrança]] - ➕ {{D-4}}",
    "- [x] Enviar o resumo de inadimplência do mês para o financeiro — [E-mail](https://mail.example.com/thread/9001) - ➕ {{D-6}} ✅ {{D-1}}",
    "    - {{D}} - Fechada: [[Elisa Costa]] respondeu \"recebido, obrigada\" na mesma thread — [E-mail](https://mail.example.com/thread/9001)",
    "",
    "**Plataforma**",
    "- [ ] Priorizar os serviços que faltam migrar e combinar o ritmo da virada — [[{{D-26}} - Sync de Plataforma]] - ➕ {{D-26}} 📅 {{D-19}}",
    "- [ ] Agendar 30 min sobre a visão de longo prazo do app — [[Felipe Nunes]] - ➕ {{D-20}} 📅 {{D-14}}",
    "- [ ] Definir quem é dono de cada frente no squad de plataforma ⏫ — [[{{D-25}} - 1:1 Felipe]] - ➕ {{D-25}}",
    "- [ ] new - Revisar o plano de migração do banco antes da janela de manutenção — [Slack #plataforma](https://example.slack.com/archives/C02/p6006) - ➕ {{D}} 📅 {{D+2}}",
    "",
    "**Dados**",
    "- [ ] Validar com [[Gabi Torres]] a nova métrica de contas ativas antes de publicar no painel — [Slack DM](https://example.slack.com/archives/D05/p7007) - ➕ {{D-5}} 📅 {{D}}",
    "    - {{D-2}} - [[Gabi Torres]] mandou a primeira versão da consulta. Falta conferir os cancelamentos.",
    "- [ ] Documentar a definição de cliente ativo no glossário de dados ➕ {{D-9}}",
    "- [ ] new - Pedir acesso de leitura ao banco de produção para o time de dados — [[{{D-1}} - Daily de Dados]] - ➕ {{D-1}}",
    "",
    "**Gestão do time**",
    "- [ ] Preparar o feedback do ciclo para [[Henrique Alves]] — [[{{D-15}} - 1:1 Henrique]] - ➕ {{D-15}} 📅 {{D+5}}",
    "- [ ] Compilar as entregas dos últimos meses, incluindo o que foi pedido e não entregue, com os motivos ➕ {{D-37}} ⬇️",
    "- [ ] new - Abrir a vaga de pessoa designer de produto — [[{{D-1}} - Reunião de liderança]] - ➕ {{D-1}} 📅 {{D+7}}",
    "",
    "---",
    "",
    "## Pending issues tracked by person responsible",
    "",
    "**[[Ana Prado]]**",
    "- Plano de lançamento com os 6 marcos — [Report Cobrança](reports/cobranca.md)",
    "",
    "---",
    "",
    "## Important topics",
    "",
    "| # | Subject | Status | Squad / Origin | Source |",
    "|---|---------|--------|----------------|--------|",
    "| 1 | Conta grande em risco: a exportação não tem dois campos que eles usam | urgent | Slack | [Slack DM](https://example.slack.com/archives/D06/p8008) |",
    "",
    "---",
    "",
    "## Concluded",
    "",
    "- **Integração com o provedor testada de ponta a ponta**: entregue antes do prazo. → [Report Cobrança](reports/cobranca.md)",
    ""
  ].join("\n");

  function shiftDays(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return root.DailyMarkdown.toDateKey(d);
  }

  function render(template) {
    return template.replace(/\{\{D([+-]\d+)?\}\}/g, function (_, offset) {
      return shiftDays(offset ? parseInt(offset, 10) : 0);
    });
  }

  var markdown = null;

  root.MockDailySource = root.DailySource = {
    kind: "mock",
    load: function () {
      if (markdown === null) markdown = render(TEMPLATE);
      var date = shiftDays(0);
      return Promise.resolve({ path: "daily/" + date.slice(0, 7) + "/" + date + ".md", markdown: markdown });
    },
    save: function (next) {
      markdown = next;
      return Promise.resolve();
    }
  };
})(this);
