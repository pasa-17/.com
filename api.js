/* Komunikasi dengan backend Google Apps Script (JSON via fetch). */
(function () {
  'use strict';
  var P = window.PASA = window.PASA || {};
  var cfg = window.PASA_CONFIG || {};
  var CACHE_KEY = 'pasa17.pub.v1';
  var current = null, listeners = [], inflight = null, lastError = null;

  function configured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(cfg.GAS_URL || '')) && !/XXXX/.test(cfg.GAS_URL);
  }

  function netError(msg, cause) { var e = new Error(msg); e.network = true; e.cause = cause; return e; }

  function fetchJson(url, init, timeoutMs) {
    if (!configured()) return Promise.reject(netError('Alamat server (GAS_URL) belum diisi di js/config.js.'));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 30000) : null;
    if (ctl) init.signal = ctl.signal;
    return fetch(url, init).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw netError('Server menjawab kode ' + res.status + '.');
      return res.text();
    }).then(function (txt) {
      try { return JSON.parse(txt); }
      catch (e) { throw netError('Jawaban server tidak dikenali. Pastikan penerapan Web App diset "Siapa saja" dan URL berakhiran /exec.'); }
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.network) throw err;
      if (err && err.name === 'AbortError') throw netError('Server terlalu lama menjawab. Coba lagi.', err);
      throw netError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', err);
    });
  }

  function get(action) {
    return fetchJson(cfg.GAS_URL + '?action=' + encodeURIComponent(action), { method: 'GET', redirect: 'follow' }, 25000);
  }

  // text/plain WAJIB agar tidak memicu preflight CORS (tidak didukung GAS).
  function post(action, data, timeoutMs, token) {
    return fetchJson(cfg.GAS_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(token ? { action: action, data: data || {}, token: token } : { action: action, data: data || {} })
    }, timeoutMs || 45000);
  }

  function readCache() {
    try {
      var s = localStorage.getItem(CACHE_KEY); if (!s) return null;
      var o = JSON.parse(s); return o && o.data ? o.data : null;
    } catch (e) { return null; }
  }
  function writeCache(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: d })); } catch (e) { /* abaikan */ } }

  function getCached() { return current || (current = readCache()); }

  function refreshPublic() {
    if (inflight) return inflight;
    inflight = get('getPublic').then(function (r) {
      if (!r || !r.success) throw netError((r && r.message) || 'Gagal memuat data.');
      current = r.data; lastError = null; writeCache(r.data);
      listeners.slice().forEach(function (fn) { try { fn(current); } catch (e) { console.error(e); } });
      return current;
    }).catch(function (err) { lastError = err; throw err; })
      .then(function (v) { inflight = null; return v; }, function (e) { inflight = null; throw e; });
    return inflight;
  }

  P.api = {
    configured: configured, get: get, post: post,
    getCached: getCached, refreshPublic: refreshPublic,
    onPublic: function (fn) { listeners.push(fn); },
    lastError: function () { return lastError; }
  };
})();
