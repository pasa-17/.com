/* Portal admin — Scan QR / input kode manual untuk check-in. */
(function () {
  'use strict';
  var P = window.PASA, U = P.ui, M = P.adm, h = M.h;
  var JSQR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';

  function loadJsQr() {
    return new Promise(function (res, rej) {
      if (window.jsQR) return res();
      var s = document.createElement('script'); s.src = JSQR_SRC; s.onload = function () { res(); }; s.onerror = function () { rej(new Error('Pustaka pemindai gagal dimuat. Gunakan input kode manual.')); };
      document.head.appendChild(s);
    });
  }

  M.pages.scan = function (el) {
    var alive = true, stream = null, raf = 0, detector = null, busy = false, last = { code: '', t: 0 }, sesi = [];
    el.innerHTML = '<div class="page-head"><div><h1>Scan QR / Masuk</h1><p class="muted">Pindai QR e-tiket santri, atau ketik kode tiket sebagai cadangan.</p></div></div>' +
      '<div class="scan-grid"><section class="card pad"><div class="field"><label class="lbl" for="sesi">Sesi check-in</label><select class="select" id="sesi"><option>Memuat sesi…</option></select></div>' +
      '<div class="cam" id="cam"><video id="vid" playsinline muted></video><div class="cam-ph" id="camPh">' + U.icon('camera') + '<p>Kamera belum aktif</p></div><div class="reticle" hidden></div></div>' +
      '<div class="acts left"><button type="button" class="btn btn-primary" id="camBtn">' + U.icon('camera') + ' Nyalakan kamera</button></div><p class="help" id="camMsg"></p>' +
      '<form id="man" class="man" novalidate><div class="field"><label class="lbl" for="kode">Kode manual (mis. PASA-001)</label><div class="inline"><input class="input" id="kode" autocomplete="off" autocapitalize="characters" placeholder="PASA-001"><button type="submit" class="btn btn-dark">Check-in</button></div></div></form></section>' +
      '<section class="card pad"><div id="res" class="result idle">' + U.icon('qr') + '<b>Menunggu pemindaian</b><p>Hasil check-in akan tampil di sini.</p></div></section></div>' +
      '<section class="card pad"><div class="sec-h"><div><span class="eyebrow">Riwayat</span><h2>Check-in Terakhir</h2></div><button type="button" class="btn btn-soft btn-sm" id="hRef">' + U.icon('refresh') + ' Muat ulang</button></div><div id="hist">' + M.skeleton(1) + '</div></section>';
    var sel = el.querySelector('#sesi'), res = el.querySelector('#res');

    function sesiId() { return sel.value; }
    function showRes(cls, icon, title, lines, extra) {
      res.className = 'result ' + cls;
      res.innerHTML = U.icon(icon) + '<b>' + h(title) + '</b>' + (lines || []).map(function (l) { return '<p>' + h(l) + '</p>'; }).join('') + (extra || '');
      if (navigator.vibrate) { try { navigator.vibrate(cls === 'ok' ? 60 : [80, 60, 80]); } catch (e) { /* abaikan */ } }
    }
    function submit(code) {
      code = String(code || '').trim();
      if (!code || busy) return;
      if (!sesiId()) { showRes('err', 'alert', 'Belum ada sesi aktif', ['Tambahkan sesi di menu Konten → Sesi check-in.']); return; }
      busy = true;
      M.call('adminCheckin', { kode: code, sesiId: sesiId() }, 30000).then(function (r) {
        if (r.success) {
          var d = r.data;
          showRes(d.peringatan ? 'warn' : 'ok', d.peringatan ? 'alert' : 'check-circle', d.nama, ['Kode ' + d.kode + ' · kaos ' + (d.ukuran || '-') + ' · ' + d.sesi + ' · ' + String(d.waktu).slice(11, 16)]
            .concat(d.peringatan ? [d.peringatan] : []).concat(d.catatanMedis ? ['Catatan medis: ' + d.catatanMedis] : []));
          loadHist();
        } else if (r.code === 'ganda') showRes('warn', 'alert', 'Sudah check-in', [r.message]);
        else showRes('err', 'x-circle', r.code === 'tak_dikenal' ? 'Kode tidak dikenali' : 'Gagal', [r.message]);
      }).catch(function (e) { if (!e.auth) showRes('err', 'x-circle', 'Gagal terhubung', [e.message]); })
        .then(function () { setTimeout(function () { busy = false; }, 600); });
    }
    el.querySelector('#man').addEventListener('submit', function (e) { e.preventDefault(); var i = el.querySelector('#kode'); submit(i.value); i.value = ''; i.focus(); });

    // ---- kamera ----
    function stopCam() {
      cancelAnimationFrame(raf); raf = 0;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      var v = el.querySelector('#vid'); if (v) v.srcObject = null;
    }
    function startCam() {
      var btn = el.querySelector('#camBtn'), msg = el.querySelector('#camMsg');
      if (stream) { stopCam(); btn.innerHTML = U.icon('camera') + ' Nyalakan kamera'; el.querySelector('#camPh').hidden = false; el.querySelector('.reticle').hidden = true; return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'Browser ini tidak mendukung kamera. Gunakan input kode manual.'; return; }
      msg.textContent = 'Meminta izin kamera…';
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(function (s) {
        if (!alive) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s;
        var v = el.querySelector('#vid'); v.srcObject = s; v.play();
        el.querySelector('#camPh').hidden = true; el.querySelector('.reticle').hidden = false;
        btn.innerHTML = U.icon('x') + ' Matikan kamera'; msg.textContent = 'Arahkan kamera ke QR e-tiket.';
        return prepDetector();
      }).then(function () { if (stream) loop(); }).catch(function (e) {
        msg.textContent = e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai input kode manual.' : (e && e.message) || 'Kamera tidak dapat dibuka.';
        stopCam();
      });
    }
    function prepDetector() {
      if (detector || window.jsQR) return Promise.resolve();
      if ('BarcodeDetector' in window) {
        try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); return Promise.resolve(); } catch (e) { detector = null; }
      }
      return loadJsQr();
    }
    function loop() {
      if (!stream || !alive) return;
      var v = el.querySelector('#vid');
      var now = Date.now();
      if (v.readyState >= 2 && !busy) {
        var p;
        if (detector) p = detector.detect(v).then(function (c) { return c && c[0] ? c[0].rawValue : ''; }).catch(function () { return ''; });
        else {
          var cv = loop.cv || (loop.cv = document.createElement('canvas')), w = 480, ratio = v.videoHeight / (v.videoWidth || 1);
          cv.width = w; cv.height = Math.round(w * ratio);
          var cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(v, 0, 0, cv.width, cv.height);
          var img = cx.getImageData(0, 0, cv.width, cv.height), q = window.jsQR && window.jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
          p = Promise.resolve(q ? q.data : '');
        }
        p.then(function (code) {
          if (code && !(code === last.code && now - last.t < 4000)) { last = { code: code, t: now }; submit(code); }
        });
      }
      setTimeout(function () { raf = requestAnimationFrame(loop); }, 220);
    }
    el.querySelector('#camBtn').addEventListener('click', startCam);

    // ---- sesi & riwayat ----
    function loadSesi() {
      M.run('adminListModul', { modul: 'sesi' }, { quiet: true }).then(function (r) {
        if (!alive) return;
        sesi = r ? r.data.items.filter(function (s) { return s.aktif === 'true'; }) : [];
        sel.innerHTML = sesi.length ? sesi.map(function (s) { return '<option value="' + h(s.id) + '">' + h(s.nama) + '</option>'; }).join('') : '<option value="">Belum ada sesi aktif</option>';
        sel.addEventListener('change', loadHist);
        loadHist();
      });
    }
    function loadHist() {
      M.run('adminRiwayatCheckin', { sesiId: sesiId(), limit: 50 }, { quiet: true }).then(function (r) {
        if (!alive) return;
        var box = el.querySelector('#hist'); if (!box) return;
        if (!r || !r.data.items.length) { box.innerHTML = M.empty('history', 'Belum ada check-in', 'Check-in sesi ini akan muncul di sini.'); return; }
        box.innerHTML = '<p class="help">' + r.data.total + ' check-in pada sesi ini.</p><ul class="trash-list">' + r.data.items.map(function (c) {
          return '<li data-id="' + h(c.id) + '"><div><b>' + h(c.nama) + '</b><small>' + h(c.kode) + ' · ' + h(c.sesi) + ' · ' + h(String(c.waktu).slice(11, 16)) + ' · ' + h(c.petugas) + '</small></div><button type="button" class="btn btn-soft btn-sm" data-undo>' + U.icon('undo') + ' Batalkan</button></li>';
        }).join('') + '</ul>';
      });
    }
    el.querySelector('#hist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-undo]'); if (!b) return;
      var id = b.closest('li').getAttribute('data-id');
      M.confirm('Batalkan check-in?', 'Check-in ini akan dibatalkan dan santri dapat dipindai lagi.', 'Batalkan check-in', true).then(function (ok) {
        if (ok) M.run('adminBatalkanCheckin', { id: id }, { ok: true }).then(loadHist);
      });
    });
    el.querySelector('#hRef').addEventListener('click', loadHist);
    loadSesi();
    return function () { alive = false; stopCam(); };
  };
})();
