// Who can use Secretaría. People only give responsibilities below their own, inside their area.
import { t, getLang } from "../i18n.js";
import { html, raw, setHTML, $, $$, fmtDateTime } from "../util.js";
import { modal, toast, field, options, openMenu, moreButton } from "../ui.js";
import * as api from "../api.js";
import { onSubmit, formFoot, err } from "./common.js";

const ORG_KINDS = {
  national: (o) => o.kind === "administration" && o.admin_level === "national",
  zone: (o) => o.kind === "administration" && o.admin_level === "zone",
  church: (o) => o.kind === "church",
  society_or_department: (o) => o.kind === "society" || o.kind === "department",
};

export async function render(view, app) {
  const [grants, roles] = await Promise.all([api.listAccess(), api.roles()]);
  const top = app.topRank();
  const canInvite = app.isCreator() || app.can("users.invite");
  const invitable = roles.filter((r) => app.isCreator() || (r.rank < top && top >= (r.min_inviter_rank || 0)));
  const roleName = (g) => (getLang() === "en" ? g.role_name_en : g.role_name_es);
  const person = (g) => [g.first_name, g.last_name].filter(Boolean).join(" ");

  setHTML(view, html`
    <div class="row between"><h1>${t("accessTitle")}</h1>${canInvite && invitable.length ? html`<button class="primary" id="new">${t("invite")}</button>` : ""}</div>
    <p class="note-box">${t("inviteHelp")}</p>
    <div class="panel">${grants.length ? html`<div class="table-wrap"><table>
      <thead><tr><th>${t("email")}</th><th>${t("role")}</th><th>${t("organization")}</th><th>${t("lastAccess")}</th><th>${t("status")}</th><th><span class="sr-only">${t("actions")}</span></th></tr></thead>
      <tbody>${grants.map((g) => html`<tr class="${g.active ? "" : "voided"}">
        <td>${person(g) ? html`<strong>${person(g)}</strong><br>` : ""}<small>${g.email}</small></td><td>${roleName(g)}</td><td>${g.organization_name || t("scopeHq")}</td>
        <td>${g.last_sign_in_at ? fmtDateTime(g.last_sign_in_at) : html`<span class="muted">${t("neverSignedIn")}</span>`}</td>
        <td><span class="badge ${g.active ? "ok" : "muted"}">${t(g.active ? "active" : "inactive")}</span></td>
        <td class="end">${canInvite && g.email !== (app.ctx.email || "").toLowerCase() ? html`${raw(moreButton("g", g.id, t("actions")))}` : ""}</td></tr>`)}</tbody></table></div>`
      : html`<p class="empty">${t("empty")}</p>`}</div>`);

  const reload = () => app.rerender();
  const nb = $("#new", view); if (nb) nb.addEventListener("click", () => inviteForm(app, invitable, null, reload));
  $$("[data-g]", view).forEach((b) => b.addEventListener("click", () => {
    const g = grants.find((x) => x.id === b.dataset.g);
    openMenu(b, [
      { label: t("roleChange"), run: () => inviteForm(app, invitable, g, reload) },
      { label: t(g.active ? "disable" : "enable"), danger: g.active, run: async () => {
        try { await api.setGrantActive(g.id, !g.active); toast(t("saved")); reload(); } catch (x) { toast(err(x), "error"); } } },
    ]);
  }));
}

function inviteForm(app, roles, g, reload) {
  const name = (r) => (getLang() === "en" ? r.display_name_en : r.display_name_es);
  const m = modal(t(g ? "roleChange" : "inviteTitle"), html`<form id="f" novalidate>
    ${field(t("email"), html`<input type="email" name="email" required maxlength="200" autocomplete="off" value="${g ? g.email : ""}" ${g ? "readonly" : ""}>`)}
    ${field(t("role"), html`<select name="role" required>${options(roles.map((r) => [r.code, name(r)]), g ? g.role : "", t("role"))}</select>`)}
    <div id="org-wrap"></div>
    ${formFoot()}</form>`);
  const fm = $("#f", m.el), wrap = $("#org-wrap", m.el);
  const fill = () => {
    const r = roles.find((x) => x.code === fm.role.value);
    const test = r && ORG_KINDS[r.scope_level];
    if (!test) return setHTML(wrap, "");
    const list = app.inScope().filter(test).sort((a, b) => app.orgName(a.id).localeCompare(app.orgName(b.id)));
    setHTML(wrap, field(t("organization"), html`<select name="org" required>${options(list.map((o) => [o.id, app.orgName(o.id)]), g ? g.organization_id : list.length === 1 ? list[0].id : "", list.length === 1 ? null : t("chooseOrg"))}</select>`));
  };
  fm.role.addEventListener("change", fill); fill();
  onSubmit(m, fm, async () => {
    const email = fm.email.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(t("emailInvalid"));
    if (!fm.role.value) throw new Error(t("role"));
    if (fm.org && !fm.org.value) throw new Error(t("chooseOrg"));
    await api.grantAccess(email, fm.role.value, fm.org ? fm.org.value : null);
    m.close(); toast(t("invited")); reload();
  });
}

