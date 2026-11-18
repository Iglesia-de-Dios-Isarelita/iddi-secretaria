// IDDI AI: searches only the church's own records (no outside AI), and every answer links to its source.
import { t } from "../i18n.js";
import { html, setHTML, $, fmtDate } from "../util.js";
import * as api from "../api.js";
import { wireRows, err } from "./common.js";

const ROUTE = { service: "predicaciones/", document: "biblioteca/doc/", letter: "cartas/", circular: "circulares/" };
let last = "";

export async function render(view, app) {
  setHTML(view, html`
    <h1>${t("searchTitle")}</h1>
    <p class="note-box">${t("searchHelp")}</p>
    <form class="panel search-form" id="sf" role="search">
      <input type="search" name="q" placeholder="${t("searchPlaceholder")}" aria-label="${t("searchTitle")}" value="${last}" maxlength="200" autocomplete="off">
      <button class="primary" type="submit">${t("searchBtn")}</button></form>
    <div id="res"></div>`);
  const fm = $("#sf", view), box = $("#res", view);
  const run = async () => {
    const q = fm.q.value.trim(); last = q;
    if (!q) return setHTML(box, "");
    setHTML(box, html`<div class="center-screen small"><div class="spinner"></div></div>`);
    try {
      const rows = await api.search(q);
      if (q !== last) return;
      setHTML(box, rows.length ? html`<div class="panel"><ul class="txlist">${rows.map((r) => html`<li class="click" data-hit="${r.kind}:${r.id}:${r.organization_id || ""}" tabindex="0">
          <span class="badge">${t("k_" + r.kind)}</span><span class="grow"><span>${r.title}</span>
          <small class="muted">${[detailText(r), app.orgName(r.organization_id), r.item_date ? fmtDate(r.item_date) : ""].filter(Boolean).join(" · ")}</small></span></li>`)}</ul></div>`
        : html`<p class="empty">${t("noResults")}</p>`);
      wireRows(box, "hit", (v) => {
        const [kind, id, org] = v.split(":");
        if (kind === "agreement") {
          const o = app.orgById.get(org);
          location.hash = o && (o.kind === "society" || o.kind === "department") ? "#/acuerdos/" + id : "#/biblioteca/acuerdo/" + id;
        } else location.hash = "#/" + ROUTE[kind] + id;
      });
    } catch (x) { setHTML(box, html`<p class="error-box">${err(x)}</p>`); }
  };
  fm.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  fm.q.focus();
  if (last) run();
}

function detailText(r) {
  if (!r.detail) return "";
  if (r.kind === "document") return t("kind_" + r.detail);
  if (r.kind === "letter") return t("lk_" + r.detail);
  if (r.kind === "agreement") return t("st_" + r.detail);
  return r.detail;
}
