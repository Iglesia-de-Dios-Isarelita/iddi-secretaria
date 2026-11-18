import { t, getLang, setLang, languages } from "../i18n.js";
import { installButton, wireInstall } from "../install.js";
import { html, raw, setHTML, $, $$, friendlyError } from "../util.js";
import * as api from "../api.js";
import { HERO_IMAGE, CHURCH_SITE } from "../config.js";
import { applyLogos } from "../main.js";

function langSwitch() {
  return raw(`<div class="seg on-image" role="group" aria-label="${t("language")}">${languages.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}">${l.toUpperCase()}</button>`).join("")}</div>`);
}
function bindLang(root, onLang) {
  $$("[data-lang]", root).forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); onLang(); }));
}
const stage = (inner) => html`<div class="login-stage" style="--hero:url('${HERO_IMAGE}')"><div class="login-veil"></div>${inner}</div>`;

export function renderLogin(root, { onLang }) {
  const params = new URLSearchParams(location.search + (location.hash.includes("error") ? "&" + location.hash.slice(1) : ""));
  const rawError = params.get("error_description") || params.get("error");
  const errText = rawError ? friendlyError({ message: rawError.replace(/\+/g, " ") }, t) : "";
  setHTML(root, stage(html`
    <div class="login-tools">${langSwitch()}</div>
    <main class="login-card frost">
      <img class="login-logo" data-logo="full" alt="${t("church")}" width="240">
      <h1>${t("appName")}</h1>
      <p class="muted">${t("signInHelp")}</p>
      ${errText ? html`<p class="error-box" role="alert"><strong>${t("signInError")}.</strong> ${errText}</p>` : ""}
      <button type="button" id="google-btn" class="primary big"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg><span>${t("signInGoogle")}</span></button>
      ${installButton("ghost login-install")}
      <p class="small"><a href="${CHURCH_SITE}" rel="noopener">${CHURCH_SITE.replace("https://", "").replace(/\/$/, "")}</a></p>
    </main>`));
  applyLogos();
  bindLang(root, onLang);
  wireInstall(root);
  $("#google-btn").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const { error } = await api.auth.signIn();
    if (error) { e.currentTarget.disabled = false; renderLoginError(error); }
  });
}
function renderLoginError(error) {
  const card = $(".login-card");
  const old = $(".error-box", card); if (old) old.remove();
  const p = document.createElement("p"); p.className = "error-box"; p.setAttribute("role", "alert"); p.textContent = friendlyError(error, t);
  $("h1", card).after(p);
}

export function renderMessage(root, { title, text, onLang, signOut }) {
  setHTML(root, stage(html`
    <div class="login-tools">${langSwitch()}</div>
    <main class="login-card frost">
      <img class="login-logo" data-logo="full" alt="${t("church")}" width="200">
      <h1>${title}</h1>
      <p class="muted">${text}</p>
      ${signOut ? html`<button type="button" id="out-btn" class="primary">${t("signOut")}</button>` : ""}
    </main>`));
  applyLogos();
  bindLang(root, onLang);
  const out = $("#out-btn"); if (out) out.addEventListener("click", () => api.auth.signOut());
}

// Asked once, right after the first sign-in: how the person is named and greeted.
export function renderNameForm(root, { ctx, onLang, onDone }) {
  const parts = (ctx.full_name || "").trim().split(/\s+/);
  const first = ctx.first_name || (parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "");
  const last = ctx.last_name || (parts.length > 1 ? parts[parts.length - 1] : "");
  setHTML(root, stage(html`
    <div class="login-tools">${langSwitch()}</div>
    <main class="login-card frost name-card">
      <img class="login-logo" data-logo="full" alt="${t("church")}" width="200">
      <h1>${t("nameTitle")}</h1>
      <p class="muted">${t("nameText")}</p>
      <form id="name-form" novalidate class="name-form">
        <fieldset class="treat" aria-label="${t("treatmentLabel")}">
          <label><input type="radio" name="treatment" value="hermano"${ctx.treatment !== "hermana" ? " checked" : ""}> ${t("treatHermano")}</label>
          <label><input type="radio" name="treatment" value="hermana"${ctx.treatment === "hermana" ? " checked" : ""}> ${t("treatHermana")}</label>
        </fieldset>
        <label class="field"><span class="field-label">${t("firstName")}</span><input name="first" required maxlength="60" autocomplete="given-name" value="${first}"></label>
        <label class="field"><span class="field-label">${t("lastName")}</span><input name="last" required maxlength="60" autocomplete="family-name" value="${last}"></label>
        <p class="greet-preview" id="preview" aria-live="polite"></p>
        <p class="error-box" id="err" role="alert" hidden></p>
        <button type="submit" class="primary big">${t("continueBtn")}</button>
      </form>
    </main>`));
  applyLogos();
  bindLang(root, onLang);
  const fm = $("#name-form", root), preview = $("#preview", root);
  const show = () => {
    const name = `${fm.first.value.trim()} ${fm.last.value.trim()}`.trim();
    preview.textContent = name ? t("greeting", { who: t(fm.treatment.value), name }) : "";
  };
  fm.addEventListener("input", () => { show(); $("#err", root).hidden = true; }); show();
  fm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#err", root), btn = $("[type=submit]", fm);
    const f = fm.first.value.trim(), l = fm.last.value.trim();
    if (f.length < 2 || l.length < 2) { err.textContent = t("errYourName"); err.hidden = false; return; }
    btn.disabled = true;
    try { await api.setMyName(f, l, fm.treatment.value); onDone(); }
    catch (x) { btn.disabled = false; err.textContent = friendlyError(x, t); err.hidden = false; }
  });
}
