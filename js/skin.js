// Gives plain HTML elements their daisyUI component classes, so every screen shares one look.
// Views keep writing <button class="primary">, <input>, <table>; this adds btn, input, table, badge, etc.
const add = (el, ...c) => el.classList.add(...c);
const RULES = [
  ["button:not(.btn):not(.tile):not(.lesson-btn):not(.sidebar-foot):not(.splash-skip):not(.chip-opt):not(.scope-btn):not(.day):not(.period-btn):not(.preset):not(.more-btn):not(.menu-item):not(.church-chip):not(.add-link):not(.side-toggle)", (b) => {
    add(b, "btn");
    if (b.classList.contains("primary")) add(b, "btn-primary");
    if (b.classList.contains("danger")) add(b, "btn-error");
    if (b.classList.contains("ghost")) add(b, "btn-ghost");
    if (b.classList.contains("icon-btn")) add(b, "btn-ghost", "btn-circle", "btn-sm");
    if (b.classList.contains("big")) add(b, "btn-lg", "btn-block");
    if (b.closest("td,.txlist,.seg,.seg-types")) add(b, "btn-sm");
    if (b.closest(".seg")) add(b, "join-item");
  }],
  ["input:not(.input):not(.file-input):not(.checkbox):not(.radio):not(.toggle)", (i) => {
    const type = i.type;
    if (type === "hidden" || type === "color") return;
    if (type === "checkbox") add(i, "checkbox", "checkbox-primary");
    else if (type === "radio") add(i, "radio", "radio-primary");
    else if (type === "file") add(i, "file-input");
    else add(i, "input");
  }],
  ["select:not(.select)", (s) => add(s, "select")],
  ["textarea:not(.textarea)", (x) => add(x, "textarea")],
  ["table:not(.table)", (x) => add(x, "table")],
  [".seg:not(.join)", (x) => add(x, "join")],
  [".badge:not(.badge-soft)", (x) => { add(x, "badge-soft"); const tone = x.classList.contains("ok") ? "badge-success" : x.classList.contains("bad") ? "badge-error" : x.classList.contains("warn") ? "badge-warning" : ""; if (tone) add(x, tone); }],
];
export function skin(root) {
  if (!root || root.nodeType !== 1) return;
  for (const [sel, fn] of RULES) {
    if (root.matches(sel)) fn(root);
    root.querySelectorAll(sel).forEach(fn);
  }
}
skin(document.body);
// Runs before the browser paints, so nothing is ever shown without its styling.
new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach(skin); }).observe(document.body, { childList: true, subtree: true });
