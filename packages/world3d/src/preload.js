// The page's first script: build.mjs inlines it into index.html (ES5, an iife, before any module),
// so a bar moves from the first byte instead of a bare "Loading…" while main.js and its chunks
// (~1 MB) come down. It fetches every module file the page starts with (their sizes written in at
// build time: the bar is exact), counting bytes as they stream in, then adds the
// <script type="module" src="./main.js"> itself: the module graph then comes from the HTTP cache the
// fetches just filled (no modulepreload links: they would download each file a second time).
//
//   stall      no byte for 15 s: "Slow connection, still loading…" under the bar; 45 s: the fetches
//              are aborted and the failure below shows
//   failure    a fetch that rejects or isn't 200 (a stale page naming chunks that are gone: a 404,
//              within a second), the module script's error, any error or unhandled rejection before
//              main.ts says it booted (window.__stBooted): "Couldn't load the game. Check your
//              connection." with Retry (the fetches again), Reload after a second failure or once
//              the module script has run (a module graph that failed can't be imported again), the
//              error in small type; the browser coming back online retries once by itself
//   file://    the fetches can't work: the message says to serve the folder instead
//
// Once main.ts runs, its LoadingScreen (ui/loading.ts) takes the same #loading over, with the same
// Watchdog and retryAction (exported here; main.ts imports them). Pure parts exported for the
// tests (test/preload.test.ts); boot() is the runner. Plain ES5: esbuild's es5 target rejects anything newer.

/** "0.9": bytes as MB, one decimal. */
export function mb(n) {
  return (n / 1048576).toFixed(1);
}

/**
 * The bar's numbers: `files` [[url, bytes]] as the build measured them, `got` bytes received per
 * url, `done` the urls finished. A file bigger than the build said (a stale page) counts at its
 * real size, a finished one at what came: loaded never passes total, and all done is 100 %.
 */
export function tally(files, got, done) {
  var loaded = 0;
  var total = 0;
  for (var i = 0; i < files.length; i++) {
    var url = files[i][0];
    var have = got[url] || 0;
    loaded += have;
    total += done[url] ? have : Math.max(files[i][1], have);
  }
  return { loaded: loaded, total: total, fraction: total > 0 ? loaded / total : 1 };
}

/**
 * No progress for `slowMs`: onSlow(true) (and onSlow(false) at the next progress); none for
 * `failMs`: onFail(), once, and the watchdog stops. start() arms it, poke() is progress, stop()
 * disarms. `o` is read at each arm: its failMs may change between pokes.
 */
export function Watchdog(o) {
  var self = this;
  var t1;
  var t2;
  var set = function (v) {
    if (self.slow !== v) {
      self.slow = v;
      o.onSlow(v);
    }
  };
  var clear = function () {
    clearTimeout(t1);
    clearTimeout(t2);
  };
  var arm = function () {
    clear();
    t1 = setTimeout(function () {
      set(true);
    }, o.slowMs);
    t2 = setTimeout(function () {
      self.stop();
      o.onFail();
    }, o.failMs);
  };
  self.slow = self.on = false;
  self.start = function () {
    self.on = true;
    arm();
  };
  self.poke = function () {
    if (self.on) {
      set(false);
      arm();
    }
  };
  self.stop = function () {
    self.on = false;
    clear();
    set(false);
  };
}

/**
 * What the failure screen's button does after a step's `failures`-th failure: "retry" (run the
 * step again) while it can be run again and at most `retries` failures came before, else "reload".
 */
export function retryAction(failures, rerunnable, retries) {
  return rerunnable && failures <= retries ? "retry" : "reload";
}

/**
 * The loading screen's language: the first `tables` has of ?ui= in `search`, the reading language
 * remembered in `settings` (the shared settings JSON's "learner"), then `languages` (the
 * browser's, "bn-BD" matching "bn"); else `fallback`.
 */
export function pickLocale(tables, search, settings, languages, fallback) {
  var ui = /[?&]ui=([^&]+)/.exec(search);
  var learner = /"learner":"([^"]+)"/.exec(settings);
  var c = [ui && ui[1], learner && learner[1]].concat(languages);
  for (var i = 0; i < c.length; i++) {
    var l = String(c[i] || "").toLowerCase();
    if (tables[l] || tables[(l = l.split("-")[0])]) return l;
  }
  return fallback;
}

/**
 * The runner, on the loading card build.mjs writes into #loading (.ld-fill, .ld-pct, .ld-bytes,
 * .ld-item, .ld-slow, .ld-retry, .ld-err). `cfg` (index.html's #ld-text JSON when not given):
 * { files: [[url, bytes]], entry: "./main.js", s: { <ui>: strings }, fallback, key (the shared
 * settings key), slowMs, failMs, moduleMs (no boot this long after the module script went in: the
 * failure, with Reload) }.
 */
export function boot(win, doc, cfg) {
  cfg = cfg || JSON.parse(doc.querySelector("#ld-text").textContent);
  var nav = win.navigator;
  var loc = win.location;
  var settings = "";
  try {
    settings = win.localStorage.getItem(cfg.key);
  } catch (e) {
    // blocked storage
  }
  var S = cfg.s[pickLocale(cfg.s, loc.search, settings, nav.languages || [nav.language], cfg.fallback)];
  var root = doc.querySelector("#loading");
  var q = function (c) {
    return root.querySelector(".ld-" + c);
  };
  var fill = q("fill");
  var pct = q("pct");
  var bytes = q("bytes");
  var item = q("item");
  var slow = q("slow");
  var btn = q("retry");
  var err = q("err");
  var failures = 0;
  var cur = null;
  slow.textContent = S.slow;

  function render(a) {
    var t = tally(cfg.files, a.got, a.done);
    var f = t.fraction; // 0..1: tally's loaded never passes its total
    fill.style.width = f * 100 + "%";
    pct.textContent = Math.floor(f * 100) + "%";
    bytes.textContent = mb(t.loaded) + " / " + mb(t.total) + " MB";
  }

  /** Attempt `a` failed (the current one if not given; a stale attempt's news is dropped): the message, the button, the error small under it. */
  function fail(e, a) {
    a = a || cur;
    if (a !== cur || !a.live || win.__stBooted) return;
    a.live = false;
    a.dog.stop();
    if (a.ctrl) a.ctrl.abort();
    var retry = retryAction(++failures, a.phase < 1, 1) === "retry";
    root.className = "error";
    item.textContent = loc.protocol === "file:" ? S.file : S.failed;
    btn.textContent = retry ? S.retry : S.reload; // page.css shows the button, the error, no slow line, in .error
    err.textContent = (e && e.message) || e || "";
    // the button, or the connection coming back (once)
    a.go = btn.onclick = function () {
      a.go = null;
      if (retry) run();
      else loc.reload();
    };
  }

  function get(url, a) {
    return win.fetch(url, { signal: a.ctrl && a.ctrl.signal }).then(function (r) {
      if (!r.ok) throw url + ": " + r.status;
      var add = function (n) {
        if (!a.live) return;
        a.got[url] = (a.got[url] || 0) + n;
        a.dog.poke();
        render(a);
      };
      var rd = r.body.getReader(); // every browser with module scripts streams a body (bar Firefox 60-64)
      var pump = function () {
        return rd.read().then(function (x) {
          if (x.done) return;
          add(x.value.length);
          return pump();
        });
      };
      return pump();
    });
  }

  /** Every file, in parallel (phase 0); then the module script (phase 1). */
  function run() {
    var a = { live: true, phase: 0, got: {}, done: {}, ctrl: win.AbortController ? new win.AbortController() : null };
    var left = cfg.files.length;
    root.className = "";
    item.textContent = S.loading;
    slow.hidden = true;
    a.o = {
      slowMs: cfg.slowMs,
      failMs: cfg.failMs,
      onSlow: function (on) {
        if (a.live) slow.hidden = !on;
      },
      onFail: function () {
        fail(a.phase ? cfg.entry + " didn't start" : "stalled", a);
      },
    };
    a.dog = new Watchdog(a.o);
    cur = a;
    a.dog.start();
    render(a);
    var one = function (f) {
      get(f[0], a).then(
        function () {
          a.done[f[0]] = true;
          render(a);
          if (!--left) modules(a);
        },
        function (e) {
          fail(e, a);
        },
      );
    };
    for (var i = 0; i < cfg.files.length; i++) one(cfg.files[i]);
  }

  function modules(a) {
    if (!a.live) return;
    a.phase = 1;
    a.o.failMs = cfg.moduleMs;
    a.dog.poke();
    var s = doc.createElement("script");
    s.type = "module";
    s.src = cfg.entry;
    s.onerror = function () {
      fail(cfg.entry + " didn't start", a);
    };
    doc.body.appendChild(s);
  }

  run(); // first: `cur` is set for the listeners below
  var on = function (type, f) {
    win.addEventListener(type, f);
  };
  on("error", function (e) {
    fail(e.error || e.message);
  });
  on("unhandledrejection", function (e) {
    fail(e.reason);
  });
  on("online", function () {
    if (cur.go && !win.__stBooted) cur.go();
  });
}
