// Runs before first paint: skip the opening animation when it already played in this tab.
try { if (sessionStorage.getItem("iddi.splash") === "1") document.documentElement.classList.add("no-splash"); } catch (e) { /* storage blocked: play it */ }
