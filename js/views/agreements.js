// Society and department agreements: recorded by their secretaries, seen by the church's local leadership.
import { t } from "../i18n.js";
import { html, setHTML, $ } from "../util.js";
import { toast } from "../ui.js";
import * as api from "../api.js";
import { wireRows, err, agreementTable, agreementDetail, agreementForm } from "./common.js";

export async function render(view, app) {
  const key = app.scopeKey;
  // The societies or departments this person is secretary of.
  const own = app.can("agreements.local") ? app.roles().filter((r) => r.scope_level === "society_or_department" && r.organization_id).map((r) => r.organization_id) : [];
  const writable = (org) => own.includes(org);
  const all = await api.agreements(["society", "department"]);
  if (key !== app.scopeKey) return;
  const ids = new Set(app.orgIds);
  const rows = all.filter((a) => ids.has(a.organization_id) || own.includes(a.organization_id));
  const load = () => app.rerender();

  setHTML(view, html`
    <div class="row between"><h1>${t("societyAgreementsTitle")}</h1>${own.length ? html`<button class="primary" id="new">${t("newAgreement")}</button>` : ""}</div>
    <p class="note-box">${t("societyAgreementsHelp")}</p>
    <div class="panel">${agreementTable(rows, app)}</div>`);
  wireRows(view, "agr", (id) => agreementDetail(app, id, { writable, choices: own, onChange: load }).catch((x) => toast(err(x), "error")));
  const nb = $("#new", view); if (nb) nb.addEventListener("click", () => agreementForm(app, null, own, load));
  const sub = app.subRoute[0];
  if (sub) { history.replaceState(null, "", "#/acuerdos"); agreementDetail(app, sub, { writable, choices: own, onChange: load }).catch((x) => toast(err(x), "error")); }
}
