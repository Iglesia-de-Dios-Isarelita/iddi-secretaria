// "Install the app": puts Secretaría IDDI on the phone's or computer's home screen with its own icon.
// Android and computers (Chrome, Edge) can install with one tap; iPhone and iPad need Safari's Share menu,
// so for them the dialog shows the steps with pictures.
import { t } from "./i18n.js";
import { html, raw, $, $$ } from "./util.js";
import { modal } from "./ui.js";

let deferred = null;
const listeners = new Set();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* the app works without it */ }));
}

export const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ua = navigator.userAgent;
export const platform = () => (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) ? "ios" : /Android/.test(ua) ? "android" : "desktop";

const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

/** The button that opens the install dialog. Hidden once the app runs installed. */
export function installButton(extraClass = "ghost") {
  if (isInstalled()) return "";
  return html`<button type="button" class="${extraClass} install-btn" data-install title="${t("installApp")}">${raw(ICON)}<span>${t("installApp")}</span></button>`;
}
export function wireInstall(root = document) {
  $$("[data-install]", root).forEach((b) => b.addEventListener("click", () => openInstall()));
}

export function openInstall(tab = platform()) {
  const steps = (list) => html`<ol class="install-steps">${list.map(([icon, text]) => html`<li><span class="step-ico" aria-hidden="true">${raw(icon)}</span><span>${raw(text)}</span></li>`)}</ol>`;
  const m = modal(t("installTitle"), html`
    <div class="install-dlg">
      <div class="install-hero"><img src="assets/icons/icon-192.png" alt="" width="64" height="64"><div><strong>Secretaría IDDI</strong><p class="muted small">${t("installWhy")}</p></div></div>
      <div class="seg install-tabs" role="tablist">
        <button type="button" role="tab" data-it="android">Android</button><button type="button" role="tab" data-it="ios">iPhone / iPad</button><button type="button" role="tab" data-it="desktop">${t("installComputer")}</button>
      </div>
      <section data-ip="android">
        <div class="install-now" hidden><button type="button" class="primary big" data-now>${raw(ICON)} ${t("installNow")}</button><p class="muted small center">${t("installNowHint")}</p></div>
        <div class="install-manual">${steps([[DOTS, t("installAndroid1")], [PLUS, t("installAndroid2")], [ICON, t("installAndroid3")]])}</div>
      </section>
      <section data-ip="ios" hidden>
        ${steps([["<b>S</b>", t("installIos0")], [SHARE, t("installIos1")], [PLUS, t("installIos2")], [ICON, t("installIos3")]])}
        <p class="note-box small">${t("installIosNote")}</p>
      </section>
      <section data-ip="desktop" hidden>
        <div class="install-now" hidden><button type="button" class="primary big" data-now>${raw(ICON)} ${t("installNow")}</button></div>
        <div class="install-manual">${steps([[PLUS, t("installDesk1")], [ICON, t("installDesk2")]])}</div>
      </section>
      <p class="muted small">${t("installPrivate")}</p>
    </div>`);
  const show = (k) => {
    $$("[data-it]", m.el).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.it === k)));
    $$("[data-ip]", m.el).forEach((s) => { s.hidden = s.dataset.ip !== k; });
  };
  const refresh = () => {
    $$(".install-now", m.el).forEach((x) => { x.hidden = !deferred; });
    $$(".install-manual", m.el).forEach((x) => { x.hidden = !!deferred; });
  };
  $$("[data-it]", m.el).forEach((b) => b.addEventListener("click", () => show(b.dataset.it)));
  $$("[data-now]", m.el).forEach((b) => b.addEventListener("click", async () => {
    if (!deferred) return; deferred.prompt();
    const { outcome } = await deferred.userChoice; deferred = null; refresh();
    if (outcome === "accepted") m.close();
  }));
  listeners.add(refresh); refresh(); show(tab);
  return m;
}
