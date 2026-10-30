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
    "| 10:00–10:30 | Platform team daily | |",
    "| 14:00–15:00 | Billing planning | organized by [[Ana Prado]] |",
    "",
    "---",
    "",
    "## Tasks",
    "",
    "**Needs to be done**",
    "- [ ] Release the new invoices screen to every account through the feature flag ➕ {{D-3}}",
    "    - {{D}} - On {{D-3}} you told support it ships on Monday and took on turning the flag on; the flag link is in the DM — [Slack DM](https://example.slack.com/archives/D01/p1001)",
    "- [ ] Build the platform strategy deck: how it connects to the business and what changes in the product ⏫ ➕ {{D-12}} 📅 {{D+20}}",
    "- [ ] new - Reply to [[Bruno Lima]] whether the talk invite and details arrived by e-mail — [Slack DM](https://example.slack.com/archives/D02/p2002) - ➕ {{D-1}}",
    "- [ ] Fill in the config file and test the slide generator [[Carla Mendes]] sent — [Slack DM](https://example.slack.com/archives/D03/p3003) - ➕ {{D-20}}",
    "    - {{D-12}} - [[Carla Mendes]] asked about the test and you replied \"testing it today\" — [Slack DM](https://example.slack.com/archives/D03/p3004)",
    "    - {{D-6}} - Not tested yet. I need the team's environment variables.",
    "- [ ] Create a status deck template for deliveries and OKRs for the whole team ➕ {{D-24}} ⬇️",
    "    - {{D-14}} - Hand the new template to the team; you told [[Ana Prado]] \"it will change\" — [Slack #product](https://example.slack.com/archives/C01/p4004)",
    "    - {{D-13}} - Still missing the outline and a routine that updates the deck by itself.",
    "- [x] Reply to [[Davi Rocha]] whether anything else blocks the payments screen release — [Slack DM](https://example.slack.com/archives/D04/p5005) - ➕ {{D-4}} ✅ {{D}}",
    "    - {{D}} - Closed: on {{D-3}} you replied to [[Davi Rocha]] in the same DM and told support and operations — [Slack DM](https://example.slack.com/archives/D04/p5006)",
    "- [ ] new - Spec the service status indicator in the header — [[{{D-2}} - monthly 1:1]] - ➕ {{D-2}} 📅 {{D}}",
    "",
    "**Billing**",
    "- [ ] Approve API access with the new payments provider — [[{{D-24}} - Billing planning]] - ➕ {{D-24}} 📅 {{D-17}}",
    "    - {{D-10}} - The provider asked for the digital certificate again. Sent.",
    "- [ ] new - Review the billing stories and take them to technical spec — [[{{D-4}} - Billing daily]] - ➕ {{D-4}} 📅 {{D}}",
    "- [ ] new - Decide how to release the invoices screen: gradually or to selected accounts — [[{{D-4}} - Billing daily]] - ➕ {{D-4}}",
    "- [x] Send the month's overdue-payments summary to finance — [E-mail](https://mail.example.com/thread/9001) - ➕ {{D-6}} ✅ {{D-1}}",
    "    - {{D}} - Closed: [[Elisa Costa]] replied \"got it, thanks\" in the same thread — [E-mail](https://mail.example.com/thread/9001)",
    "",
    "**Platform**",
    "- [ ] Prioritize the services left to migrate and agree on the cutover pace — [[{{D-26}} - Platform sync]] - ➕ {{D-26}} 📅 {{D-19}}",
    "- [ ] Book 30 min on the app's long-term vision — [[Felipe Nunes]] - ➕ {{D-20}} 📅 {{D-14}}",
    "- [ ] Define who owns each front in the platform squad ⏫ — [[{{D-25}} - 1:1 Felipe]] - ➕ {{D-25}}",
    "- [ ] new - Review the database migration plan before the maintenance window — [Slack #platform](https://example.slack.com/archives/C02/p6006) - ➕ {{D}} 📅 {{D+2}}",
    "",
    "**Data**",
    "- [ ] Check the new active-accounts metric with [[Gabi Torres]] before publishing it on the dashboard — [Slack DM](https://example.slack.com/archives/D05/p7007) - ➕ {{D-5}} 📅 {{D}}",
    "    - {{D-2}} - [[Gabi Torres]] sent the first version of the query. Cancellations still need checking.",
    "- [ ] Document the active-customer definition in the data glossary ➕ {{D-9}}",
    "- [ ] new - Ask for read access to the production database for the data team — [[{{D-1}} - Data daily]] - ➕ {{D-1}}",
    "",
    "**Team management**",
    "- [ ] Prepare the cycle feedback for [[Henrique Alves]] — [[{{D-15}} - 1:1 Henrique]] - ➕ {{D-15}} 📅 {{D+5}}",
    "- [ ] Compile the last months' deliveries, including what was asked and not delivered, with the reasons ➕ {{D-37}} ⬇️",
    "- [ ] new - Open the product designer position — [[{{D-1}} - Leadership meeting]] - ➕ {{D-1}} 📅 {{D+7}}",
    "",
    "---",
    "",
    "## Pending issues tracked by person responsible",
    "",
    "**[[Ana Prado]]**",
    "- Launch plan with the 6 milestones — [Billing report](reports/billing.md)",
    "",
    "---",
    "",
    "## Important topics",
    "",
    "| # | Subject | Status | Squad / Origin | Source |",
    "|---|---------|--------|----------------|--------|",
    "| 1 | Large account at risk: the export lacks two fields they use | urgent | Slack | [Slack DM](https://example.slack.com/archives/D06/p8008) |",
    "",
    "---",
    "",
    "## Concluded",
    "",
    "- **Provider integration tested end to end**: delivered ahead of schedule. → [Billing report](reports/billing.md)",
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
