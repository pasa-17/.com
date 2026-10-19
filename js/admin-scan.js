/* Portal admin — Scan QR / input kode manual untuk check-in.
   Cepat: QR dikenali dari data yang sudah ada di browser, hasil tampil seketika, lalu dicatat ke server
   di latar belakang (dengan antrean ulang otomatis bila sinyal putus). */
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

  // Bunyi umpan balik (tanpa berkas audio). Dibuat saat ada sentuhan pengguna agar diizinkan browser.
  var audio = null;
  function beep(ok) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t = audio.currentTime, seq = ok ? [[880, 0, 0.09], [1320, 0.1, 0.12]] : [[220, 0, 0.16], [180, 0.19, 0.2]];
      seq.forEach(function (n) {
        var o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = n[0]; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(0.25, t + n[1] + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + n[2]);
        o.connect(g); g.connect(audio.destination); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.02);
      });
    } catch (e) { /* abaikan */ }
  }
  function nowIso() {
    var d = new Date(), z = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
  }

  M.pages.scan = function (el) {
    var alive = true, stream = null, raf = 0, detector = null, last = { code: '', t: 0 }, flying = {}, queue = [], retryT = 0, off = null;
    el.innerHTML = '<div class="page-head"><div><h1>Scan QR / Masuk</h1><p class="muted">Pindai QR e-tiket santri, atau ketik kode tiket sebagai cadangan.</p></div><div class="head-acts"><span class="badge" id="net" hidden></span></div></div>' +
      '<div class="scan-grid"><section class="card pad"><div class="field"><label class="lbl" for="sesi">Sesi check-in</label><select class="select" id="sesi"><option>Memuat sesi…</option></select></div>' +
      '<div class="cam" id="cam"><video id="vid" playsinline muted></video><div class="cam-ph" id="camPh">' + U.icon('camera') + '<p>Kamera belum aktif</p></div><div class="reticle" hidden></div></div>' +
      '<div class="acts left"><button type="button" class="btn btn-primary" id="camBtn">' + U.icon('camera') + ' Nyalakan kamera</button></div><p class="help" id="camMsg"></p>' +
      '<form id="man" class="man" novalidate><div class="field"><label class="lbl" for="kode">Kode manual (mis. PASA-001)</label><div class="inline"><input class="input" id="kode" autocomplete="off" autocapitalize="characters" placeholder="PASA-001"><button type="submit" class="btn btn-dark">Check-in</button></div></div></form></section>' +
      '<section class="card pad"><div id="res" class="result idle">' + U.icon('qr') + '<b>Menunggu pemindaian</b><p>Hasil check-in akan tampil di sini.</p></div></section></div>' +
      '<section class="card pad"><div class="sec-h"><div><span class="eyebrow">Riwayat</span><h2>Check-in Terakhir</h2></div><button type="button" class="btn btn-soft btn-sm" id="hRef">' + U.icon('refresh') + ' Muat ulang</button></div><div id="hist">' + (M.store.ready() ? '' : M.skeleton(1)) + '</div></section>';
    var sel = el.querySelector('#sesi'), res = el.querySelector('#res'), netEl = el.querySelector('#net');

    function sesiAktif() { return M.store.data.sesi.filter(function (s) { return s.aktif === 'true'; }); }
    function sesiId() { return sel.value; }
    function sesiById(id) { return sesiAktif().filter(function (s) { return s.id === id; })[0]; }
    function showRes(cls, icon, title, lines, extra) {
      res.className = 'result ' + cls;
      res.innerHTML = U.icon(icon) + '<b>' + h(title) + '</b>' + (lines || []).map(function (l) { return '<p>' + h(l) + '</p>'; }).join('') + (extra || '');
      beep(cls === 'ok');
      if (navigator.vibrate) { try { navigator.vibrate(cls === 'ok' ? 60 : [80, 60, 80]); } catch (e) { /* abaikan */ } }
    }
    function netBadge() {
      var n = queue.length;
      netEl.hidden = !n; netEl.className = 'badge badge-warn';
      netEl.textContent = n ? n + ' check-in menunggu terkirim (sinyal bermasalah)' : '';
    }
    function localDup(pid, sid) {
      return M.store.data.checkin.filter(function (c) { return c.pid === pid && c.sesiId === sid; })[0];
    }
    function hhmm(w) { return String(w || '').slice(11, 16); }

    // ---- kirim ke server (dengan antrean ulang bila jaringan putus) ----
    function send(job) {
      return M.call('adminCheckin', { kode: job.kode, sesiId: job.sid }, 30000).then(function (r) {
        flying[job.kode] = 0;
        if (r.success) {
          // ganti catatan sementara dengan catatan resmi dari server
          if (job.tmp) { job.tmp.id = r.data.id; job.tmp.waktu = r.data.waktu; job.tmp.tunda = false; M.store.removeCheckin(job.tmp); M.store.addCheckin(job.tmp); }
          else { M.store.addCheckin({ id: r.data.id, pid: r.data.pid, kode: r.data.kode, nama: r.data.nama, sesiId: job.sid, sesi: r.data.sesi, waktu: r.data.waktu, petugas: M.session().nama }); }
          if (!job.local) show(r);
          return;
        }
        if (job.tmp) M.store.removeCheckin(job.tmp);
        if (r.code === 'ganda') showRes('warn', 'alert', 'Sudah check-in', [r.message]);
        else showRes('err', 'x-circle', r.code === 'tak_dikenal' ? 'Kode tidak dikenali' : 'Gagal', [r.message]);
      }).catch(function (e) {
        flying[job.kode] = 0;
        if (e && e.auth) return;
        // jaringan: tahan dan coba lagi otomatis
        if (job.tmp) job.tmp.tunda = true;
        if (queue.indexOf(job) < 0) queue.push(job);
        flying[job.kode] = 1;
        netBadge(); renderHist(); scheduleRetry();
        if (!job.local) showRes('err', 'x-circle', 'Gagal terhubung', [e.message, 'Akan dicoba lagi otomatis.']);
      });
    }
    function scheduleRetry() {
      if (retryT || !alive) return;
      retryT = setTimeout(function () {
        retryT = 0; if (!alive || !queue.length) return;
        var jobs = queue.slice(); queue = [];
        Promise.all(jobs.map(function (j) { return send(j); })).then(function () { netBadge(); if (alive) renderHist(); if (queue.length) scheduleRetry(); });
      }, 4000);
    }
    function show(r) {
      var d = r.data;
      showRes(d.peringatan ? 'warn' : 'ok', d.peringatan ? 'alert' : 'check-circle', d.nama, ['Kode ' + d.kode + ' · kaos ' + (d.ukuran || '-') + ' · ' + d.sesi + ' · ' + hhmm(d.waktu)]
        .concat(d.peringatan ? [d.peringatan] : []).concat(d.catatanMedis ? ['Catatan medis: ' + d.catatanMedis] : []));
    }

    function submit(code) {
      code = String(code || '').trim();
      if (!code) return;
      var key = code.toUpperCase(), sid = sesiId();
      if (!sid) { showRes('err', 'alert', 'Belum ada sesi aktif', ['Tambahkan sesi di menu Konten → Sesi check-in.']); return; }
      if (flying[key]) return;                         // kode yang sama sedang dikirim
      var p = M.store.find(key);
      if (!p) {                                        // belum ada di data lokal (mis. baru daftar): tanya server
        flying[key] = 1;
        res.className = 'result idle'; res.innerHTML = '<span class="spin" aria-hidden="true"></span><b>Memeriksa…</b><p>' + h(code) + '</p>';
        send({ kode: key, sid: sid, local: false }).then(function () { M.store.load(true).catch(function () { }); });
        return;
      }
      var dup = localDup(p.id, sid);
      if (dup) { showRes('warn', 'alert', 'Sudah check-in', [p.nama + ' sudah check-in di sesi ' + dup.sesi + ' pukul ' + hhmm(dup.waktu) + '.']); return; }
      // Tampilkan SEKETIKA, simpan ke server di latar belakang.
      var ses = sesiById(sid), warn = p.statusInfaq === 'Lunas' ? '' : 'Infaq belum lunas (' + p.statusInfaq + ').';
      var tmp = { id: 'tmp' + Date.now(), pid: p.id, kode: p.kode, nama: p.nama, sesiId: sid, sesi: ses ? ses.nama : '', waktu: nowIso(), petugas: M.session().nama, tunda: true };
      M.store.addCheckin(tmp);
      showRes(warn ? 'warn' : 'ok', warn ? 'alert' : 'check-circle', p.nama, ['Kode ' + p.kode + ' · kaos ' + (p.ukuran || '-') + ' · ' + tmp.sesi + ' · ' + hhmm(tmp.waktu)]
        .concat(warn ? [warn] : []).concat(p.medis && p.medis !== '-' ? ['Catatan medis: ' + p.medis] : []));
      flying[key] = 1;
      M.store.track(send({ kode: key, sid: sid, tmp: tmp, local: true }));
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
      try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* abaikan */ }
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
    var reading = false;
    function loop() {
      if (!stream || !alive) return;
      var v = el.querySelector('#vid');
      if (v.readyState >= 2 && !reading) {
        var p;
        reading = true;
        if (detector) p = detector.detect(v).then(function (c) { return c && c[0] ? c[0].rawValue : ''; }).catch(function () { return ''; });
        else {
          var cv = loop.cv || (loop.cv = document.createElement('canvas')), w = 480, ratio = v.videoHeight / (v.videoWidth || 1);
          cv.width = w; cv.height = Math.round(w * ratio);
          var cx = loop.cx || (loop.cx = cv.getContext('2d', { willReadFrequently: true })); cx.drawImage(v, 0, 0, cv.width, cv.height);
          var img = cx.getImageData(0, 0, cv.width, cv.height), q = window.jsQR && window.jsQR(img.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
          p = Promise.resolve(q ? q.data : '');
        }
        p.then(function (code) {
          reading = false;
          var now = Date.now();
          if (code && !(code === last.code && now - last.t < 5000)) { last = { code: code, t: now }; submit(code); }
        });
      }
      setTimeout(function () { raf = requestAnimationFrame(loop); }, 90);
    }
    el.querySelector('#camBtn').addEventListener('click', startCam);

    // ---- sesi & riwayat (dari data lokal) ----
    function fillSesi() {
      var keep = sel.value, list = sesiAktif();
      sel.innerHTML = list.length ? list.map(function (s) { return '<option value="' + h(s.id) + '">' + h(s.nama) + '</option>'; }).join('') : '<option value="">Belum ada sesi aktif</option>';
      if (keep && sesiById(keep)) sel.value = keep;
    }
    function renderHist() {
      var box = el.querySelector('#hist'); if (!box || !M.store.ready()) return;
      var sid = sesiId(), list = M.store.data.checkin.filter(function (c) { return !sid || c.sesiId === sid; });
      if (!list.length) { box.innerHTML = M.empty('history', 'Belum ada check-in', 'Check-in sesi ini akan muncul di sini.'); return; }
      box.innerHTML = '<p class="help">' + list.length + ' check-in pada sesi ini.</p><ul class="trash-list">' + list.slice(0, 50).map(function (c) {
        var tmp = String(c.id).indexOf('tmp') === 0;
        return '<li data-id="' + h(c.id) + '"><div><b>' + h(c.nama) + '</b><small>' + h(c.kode) + ' · ' + h(c.sesi) + ' · ' + h(hhmm(c.waktu)) + ' · ' + h(c.petugas) + (c.tunda ? ' · <em>mengirim…</em>' : '') + '</small></div>' +
          (tmp ? '' : '<button type="button" class="btn btn-soft btn-sm" data-undo>' + U.icon('undo') + ' Batalkan</button>') + '</li>';
      }).join('') + '</ul>';
    }
    function refresh() { fillSesi(); renderHist(); }
    sel.addEventListener('change', renderHist);
    el.querySelector('#hist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-undo]'); if (!b) return;
      var id = b.closest('li').getAttribute('data-id');
      M.confirm('Batalkan check-in?', 'Check-in ini akan dibatalkan dan santri dapat dipindai lagi.', 'Batalkan check-in', true).then(function (ok) {
        if (!ok) return;
        var c = M.store.data.checkin.filter(function (x) { return x.id === id; })[0]; if (!c) return;
        var undo = M.store.removeCheckin(c);
        M.store.track(M.run('adminBatalkanCheckin', { id: id }, { ok: true }).then(function (r) { if (!r) undo(); }));
      });
    });
    el.querySelector('#hRef').addEventListener('click', function () { M.store.load(true).then(refresh, function () { }); });

    off = M.store.on(function () { if (alive) refresh(); });
    if (M.store.ready()) refresh();
    M.store.load().then(refresh, function (e) {
      if (!e.auth && !M.store.ready()) { sel.innerHTML = '<option value="">Gagal memuat sesi</option>'; el.querySelector('#hist').innerHTML = M.empty('alert', 'Gagal memuat data', 'Periksa koneksi, lalu muat ulang halaman. Input kode manual tetap bisa dicoba.'); }
    });
    return function () { alive = false; clearTimeout(retryT); if (off) off(); stopCam(); };
  };
})();
