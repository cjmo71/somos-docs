/* Somos InControl — "Ask the manual" chat helper.
 * One self-contained file, no libraries. Mintlify runs every .js file in the docs folder on every page;
 * the same file is served by the Worker at /widget.js for its /test page.
 * Answers come from https://somos-docs-helper.somos-poll.workers.dev/ask (Claude Haiku, manual-only). */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.__somosAskHelper) return;
  window.__somosAskHelper = true;

  var API = "https://somos-docs-helper.somos-poll.workers.dev/ask";
  var STORE = "somos-ask-helper-v1";
  var MAX_KEEP = 20; // last ~10 turns
  var MAX_CHARS = 1000;
  var WELCOME = "Hi! Ask me anything about using Somos InControl and I'll answer from this manual. " +
    "If an answer doesn't work, just tell me and I'll try another way.";

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]") || []; } catch (e) { history = []; }
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_KEEP))); } catch (e) {} }

  var css = "" +
    "#sah-root{--sah-accent:#2563eb;--sah-accent-fg:#fff;--sah-bg:#fff;--sah-fg:#111827;--sah-muted:#6b7280;" +
    "--sah-border:rgba(17,24,39,.12);--sah-bot:#f3f4f6;--sah-shadow:0 12px 40px rgba(0,0,0,.18);" +
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--sah-fg)}" +
    "#sah-root[data-theme=dark]{--sah-accent:#3b82f6;--sah-bg:#111827;--sah-fg:#e5e7eb;--sah-muted:#9ca3af;" +
    "--sah-border:rgba(255,255,255,.12);--sah-bot:#1f2937;--sah-shadow:0 12px 40px rgba(0,0,0,.55)}" +
    "#sah-root *{box-sizing:border-box}" +
    "#sah-btn{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 16px;cursor:pointer;" +
    "background:var(--sah-accent);color:var(--sah-accent-fg);font:600 15px/1 inherit;font-family:inherit;box-shadow:var(--sah-shadow)}" +
    "#sah-btn:focus-visible,#sah-send:focus-visible,#sah-x:focus-visible,#sah-new:focus-visible{outline:3px solid var(--sah-accent);outline-offset:2px}" +
    "#sah-btn svg{width:18px;height:18px;flex:none}" +
    "#sah-panel{display:none;flex-direction:column;position:absolute;right:0;bottom:0;width:380px;height:560px;max-height:calc(100vh - 40px);" +
    "background:var(--sah-bg);border:1px solid var(--sah-border);border-radius:16px;box-shadow:var(--sah-shadow);overflow:hidden}" +
    "#sah-root.sah-open #sah-panel{display:flex}#sah-root.sah-open #sah-btn{display:none}" +
    "#sah-head{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--sah-border)}" +
    "#sah-head b{flex:1;font-size:15px}" +
    "#sah-head button{border:0;background:transparent;color:var(--sah-muted);cursor:pointer;border-radius:8px;padding:6px 8px;font:13px/1 inherit;font-family:inherit}" +
    "#sah-head button:hover{background:var(--sah-bot);color:var(--sah-fg)}" +
    "#sah-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}" +
    ".sah-m{max-width:88%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}" +
    ".sah-u{align-self:flex-end;background:var(--sah-accent);color:var(--sah-accent-fg);border-bottom-right-radius:4px}" +
    ".sah-a{align-self:flex-start;background:var(--sah-bot);color:var(--sah-fg);border-bottom-left-radius:4px}" +
    ".sah-a a{color:var(--sah-accent);text-decoration:underline;word-break:break-all}" +
    "#sah-root[data-theme=dark] .sah-a a{color:#93c5fd}" +
    ".sah-typing{color:var(--sah-muted);font-style:italic}" +
    "#sah-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--sah-border)}" +
    "#sah-in{flex:1;resize:none;min-height:40px;max-height:120px;padding:9px 11px;border-radius:10px;border:1px solid var(--sah-border);" +
    "background:var(--sah-bg);color:var(--sah-fg);font:15px/1.4 inherit;font-family:inherit}" +
    "#sah-in:focus{outline:2px solid var(--sah-accent);outline-offset:0;border-color:transparent}" +
    "#sah-send{border:0;border-radius:10px;padding:0 14px;background:var(--sah-accent);color:var(--sah-accent-fg);font:600 14px/1 inherit;font-family:inherit;cursor:pointer}" +
    "#sah-send:disabled{opacity:.5;cursor:default}" +
    "#sah-foot{padding:0 12px 8px;font-size:11.5px;color:var(--sah-muted);text-align:center}" +
    "@media (max-width:520px){#sah-root{right:12px;bottom:12px}" +
    "#sah-root.sah-open{left:0;right:0;bottom:0;top:auto}" +
    "#sah-panel{position:fixed;left:8px;right:8px;bottom:8px;width:auto;height:min(80vh,620px);max-height:calc(100dvh - 16px)}" +
    "#sah-in{font-size:16px}}";

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  // Safe rendering: text nodes only; links become <a>, **bold** becomes <strong>.
  function render(target, text) {
    var re = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|\*\*([^*\n]{1,200})\*\*/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) target.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[4]) {
        target.appendChild(el("strong", null, m[4]));
      } else {
        var href = m[2] || m[3], label = m[1] || m[3];
        var a = el("a", { href: href, target: "_blank", rel: "noopener noreferrer" }, label);
        target.appendChild(a);
      }
      last = re.lastIndex;
    }
    if (last < text.length) target.appendChild(document.createTextNode(text.slice(last)));
  }

  function build() {
    var root = el("div", { id: "sah-root" });
    var style = el("style");
    style.textContent = css;
    root.appendChild(style);

    var btn = el("button", { id: "sah-btn", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" });
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    btn.appendChild(document.createTextNode("Ask the manual"));

    var panel = el("div", { id: "sah-panel", role: "dialog", "aria-label": "Ask the manual" });
    var head = el("div", { id: "sah-head" });
    head.appendChild(el("b", null, "Ask the manual"));
    var newBtn = el("button", { id: "sah-new", type: "button", title: "Start a new chat" }, "New chat");
    var xBtn = el("button", { id: "sah-x", type: "button", "aria-label": "Close" }, "✕");
    head.appendChild(newBtn);
    head.appendChild(xBtn);

    var log = el("div", { id: "sah-log", "aria-live": "polite" });
    var form = el("form", { id: "sah-form" });
    var input = el("textarea", { id: "sah-in", rows: "1", maxlength: String(MAX_CHARS), placeholder: "Ask a question…", "aria-label": "Your question" });
    var send = el("button", { id: "sah-send", type: "submit" }, "Send");
    form.appendChild(input);
    form.appendChild(send);
    var foot = el("div", { id: "sah-foot" }, "Answers come only from this manual and can be wrong. Still stuck? Contact Somos Support.");

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(foot);
    root.appendChild(btn);
    root.appendChild(panel);
    document.body.appendChild(root);

    function bubble(role, text) {
      var b = el("div", { "class": "sah-m " + (role === "user" ? "sah-u" : "sah-a") });
      if (role === "user") b.textContent = text; else render(b, text);
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
      return b;
    }
    function redraw() {
      log.textContent = "";
      bubble("assistant", WELCOME);
      for (var i = 0; i < history.length; i++) bubble(history[i].role, history[i].content);
    }
    redraw();

    function open() { root.classList.add("sah-open"); btn.setAttribute("aria-expanded", "true"); setTimeout(function () { input.focus(); }, 30); log.scrollTop = log.scrollHeight; }
    function close() { root.classList.remove("sah-open"); btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    btn.addEventListener("click", open);
    xBtn.addEventListener("click", close);
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    newBtn.addEventListener("click", function () { history = []; save(); redraw(); input.focus(); });

    input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); }
    });

    var busy = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q || busy) return;
      if (q.length > MAX_CHARS) q = q.slice(0, MAX_CHARS);
      busy = true; send.disabled = true;
      input.value = ""; input.style.height = "auto";
      history.push({ role: "user", content: q });
      history = history.slice(-MAX_KEEP);
      save();
      bubble("user", q);
      var wait = bubble("assistant", "");
      wait.classList.add("sah-typing");
      wait.textContent = "Looking in the manual…";

      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (data) {
          var answer = (data && data.answer) || "Sorry, the helper couldn't answer just now. Please try again, or contact Somos Support: https://somosincontrol.com/somos-incontrol/support.html";
          wait.classList.remove("sah-typing");
          wait.textContent = "";
          render(wait, answer);
          if (data && data.answer && !data.limited) { history.push({ role: "assistant", content: answer }); }
          else { history.pop(); } // don't send a failed turn back as context
          save();
        })
        .catch(function () {
          wait.classList.remove("sah-typing");
          wait.textContent = "";
          render(wait, "Couldn't reach the helper. Check your connection and try again, or contact Somos Support: https://somosincontrol.com/somos-incontrol/support.html");
          history.pop(); save();
        })
        .then(function () { busy = false; send.disabled = false; log.scrollTop = log.scrollHeight; });
    });

    // Theme: follow Mintlify's light/dark switch (class on <html>), else the OS setting.
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function theme() {
      var h = document.documentElement, cs = "";
      try { cs = getComputedStyle(h).colorScheme || ""; } catch (e) {}
      var dark;
      if (h.classList.contains("dark")) dark = true;
      else if (h.classList.contains("light")) dark = false;
      else if (cs === "dark") dark = true;
      else if (cs === "light") dark = false;
      else dark = !!(mq && mq.matches);
      root.setAttribute("data-theme", dark ? "dark" : "light");
    }
    theme();
    if (mq && mq.addEventListener) mq.addEventListener("change", theme);
    if (window.MutationObserver) new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });

    // Mintlify is a single-page app; if a page change ever drops our node, put it back.
    setInterval(function () { if (!document.body.contains(root)) document.body.appendChild(root); }, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
