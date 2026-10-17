/* Portal admin — Ringkasan, Verifikasi Bayar, Data Peserta, Tempat Sampah. */
(function () {
  'use strict';
  var P = window.PASA, U = P.ui, M = P.adm, h = M.h;
  var STATUS = ['Menunggu Bukti', 'Bukti Sedang Dicek', 'Lunas', 'Bukti Ditolak'];

  function pct(a, b) { return b > 0 ? Math.min(100, Math.round(a * 100 / b)) : 0; }
  function num(n) { return Number(n || 0).toLocaleString('id-ID'); }

  // =====================================================================
  // RINGKASAN
  // =====================================================================
  M.pages.dashboard = function (el) {
    el.innerHTML = '<div class="page-head"><div><h1>Portal Panitia</h1><p class="muted" id="dSub">Memuat ringkasan…</p></div><div class="head-acts" id="dActs"></div></div><div id="dBody">' + M.skeleton(3) + '</div>';
    var alive = true;
    function load() {
      M.run('adminDashboard', {}, { quiet: true }).then(function (r) {
        if (!alive) return;
        if (!r) { el.querySelector('#dBody').innerHTML = M.empty('alert', 'Gagal memuat', 'Periksa koneksi lalu muat ulang halaman.'); return; }
        draw(r.data);
      });
    }
    function draw(d) {
      var open = d.pendaftaran && d.pendaftaran.status !== 'tutup';
      var st = d.statusInfaq || {};
      el.querySelector('#dSub').textContent = (d.hitungMundur ? d.hitungMundur.label + ' · ' : '') + 'Pantau kuota, infaq, dan kesiapan acara secara langsung.';
      el.querySelector('#dActs').innerHTML =
        '<div class="reg-toggle"><span>Pendaftaran</span><button type="button" class="switch' + (open ? ' on' : '') + '" role="switch" aria-checked="' + open + '" id="regSw" aria-label="Buka atau tutup pendaftaran"><i></i></button>' +
        '<b id="regLbl">' + (d.pendaftaran.status === 'penuh' ? 'KUOTA PENUH' : open ? 'DIBUKA' : 'DITUTUP') + '</b></div>' +
        '<button type="button" class="btn btn-soft btn-sm" id="csvBtn">' + U.icon('download') + ' Ekspor CSV</button>' +
        '<a class="btn btn-dark btn-sm" href="#/scan">' + U.icon('qr') + ' Buka Scanner</a>';
      var ukr = (d.rekapUkuran || []).map(function (u) {
        return '<div class="size-pill' + (u.aktif ? '' : ' off') + '"><b>' + h(u.label) + '</b><span>' + num(u.jumlah) + '</span><small>' + pct(u.jumlah, d.totalPendaftar) + '%</small></div>';
      }).join('') || '<p class="muted">Belum ada ukuran.</p>';
      var g = d.grafikHarian || [], gmax = g.reduce(function (m, x) { return Math.max(m, x.jumlah); }, 1);
      var chart = g.length ? '<div class="bars" role="img" aria-label="Grafik pendaftar per hari">' + g.slice(-21).map(function (x) {
        return '<div class="bar" title="' + h(x.tanggal) + ': ' + x.jumlah + '"><i style="height:' + Math.max(6, Math.round(x.jumlah * 100 / gmax)) + '%"></i><small>' + h(x.tanggal.slice(8, 10)) + '/' + h(x.tanggal.slice(5, 7)) + '</small></div>';
      }).join('') + '</div>' : M.empty('layers', 'Belum ada pendaftar');
      var tgt = d.infaq.target || 0;
      el.querySelector('#dBody').innerHTML =
        '<div class="stats">' +
        '<div class="stat card"><span class="stat-ic">' + U.icon('users') + '</span><small>TOTAL PENDAFTAR</small><b>' + num(d.totalPendaftar) + ' <em>/ ' + num(d.kuota) + '</em></b>' +
        '<div class="meter"><i style="width:' + pct(d.totalPendaftar, d.kuota) + '%"></i></div><p>Terisi ' + pct(d.totalPendaftar, d.kuota) + '% · sisa kuota <b>' + num(d.sisaKuota) + '</b> santri</p></div>' +
        '<div class="stat card"><span class="stat-ic sage">' + U.icon('wallet') + '</span><small>INFAQ TERVERIFIKASI</small><b>' + U.rupiah(d.infaq.terhimpun) + '</b>' +
        '<div class="meter sage"><i style="width:' + pct(d.infaq.terhimpun, tgt) + '%"></i></div><p>' + (tgt ? 'Target ' + U.rupiah(tgt) + ' (' + pct(d.infaq.terhimpun, tgt) + '%) · ' : '') + 'menunggu verifikasi ' + U.rupiah(d.infaq.pending) + '</p></div>' +
        '<a class="stat card warn" href="#/bayar"><span class="stat-ic orange">' + U.icon('verify') + '</span><small>BUTUH VERIFIKASI</small><b>' + num(st['Bukti Sedang Dicek']) + ' <em>bukti</em></b><p>Menunggu bukti: ' + num(st['Menunggu Bukti']) + ' · ditolak: ' + num(st['Bukti Ditolak']) + '</p><span class="go">Tinjau sekarang ' + U.icon('arrow-right') + '</span></a>' +
        '<a class="stat card" href="#/scan"><span class="stat-ic">' + U.icon('qr') + '</span><small>CHECK-IN KEDATANGAN</small><b>' + num(d.kehadiran.hadir) + ' <em>/ ' + num(d.kehadiran.total) + ' santri</em></b><div class="meter"><i style="width:' + pct(d.kehadiran.hadir, d.kehadiran.total) + '%"></i></div><p>Sesi: ' + h(d.kehadiran.sesi || '—') + '</p></a>' +
        '</div>' +
        '<div class="two-col"><section class="card pad"><div class="sec-h"><div><span class="eyebrow">Logistik peserta</span><h2>Rekap Ukuran Kaos</h2></div><span class="badge">Total ' + num(d.totalPendaftar) + ' kaos</span></div><div class="size-row">' + ukr + '</div></section>' +
        '<section class="card pad dark"><span class="eyebrow on-navy">Email blast</span><h2>Kirim Ulang E-Tiket</h2><p>Kirim ulang e-tiket QR ke wali yang statusnya Lunas dan emailnya belum terkirim. Maksimal 25 email per kiriman; sisa kuota email hari ini: <b>' + (d.sisaKuotaEmail == null ? '—' : num(d.sisaKuotaEmail)) + '</b>.</p>' +
        '<button type="button" class="btn btn-primary" id="blastBtn">' + U.icon('send') + ' Kirim Ulang E-Tiket</button></section></div>' +
        '<section class="card pad"><div class="sec-h"><div><span class="eyebrow">Tren</span><h2>Pendaftar per Hari</h2></div></div>' + chart + '</section>';
      el.querySelector('#regSw').addEventListener('click', function () {
        var want = !open; var sw = this; sw.disabled = true;
        M.confirm(want ? 'Buka pendaftaran?' : 'Tutup pendaftaran?', want ? 'Wali dapat mulai mendaftar lewat situs.' : 'Formulir pendaftaran akan ditutup untuk umum.', want ? 'Buka' : 'Tutup', !want).then(function (ok) {
          if (!ok) { sw.disabled = false; return; }
          M.run('adminSetPendaftaran', { buka: want }, { ok: true }).then(function () { load(); });
        });
      });
      el.querySelector('#csvBtn').addEventListener('click', function () { exportCsv(this); });
      el.querySelector('#blastBtn').addEventListener('click', blast);
    }
    load();
    return function () { alive = false; };
  };

  function exportCsv(btn) {
    M.spinBtn(btn, true, 'Menyiapkan…');
    M.run('adminExportCsv', {}, { timeout: 90000 }).then(function (r) {
      M.spinBtn(btn, false);
      if (!r) return;
      M.download(r.data.filename, r.data.csv);
      U.toast(r.data.jumlah + ' baris diekspor.', 'ok');
    });
  }

  function blast() {
    var m = U.openModal({ title: 'Kirim ulang e-tiket', html: '<div id="bl"><p>Mencari wali yang belum menerima e-tiket…</p></div>' });
    var box = m.body.querySelector('#bl');
    M.run('adminListPeserta', { status: 'Lunas', pageSize: 200 }).then(function (r) {
      if (!r) { m.close(); return; }
      var todo = r.data.items.filter(function (p) { return p.emailStatus !== 'terkirim'; });
      if (!todo.length) { box.innerHTML = M.empty('check-circle', 'Semua sudah terkirim', 'Tidak ada wali berstatus Lunas yang emailnya belum terkirim.'); return; }
      box.innerHTML = '<p><b>' + todo.length + '</b> wali berstatus Lunas belum menerima e-tiket. Kirim sekarang (' + Math.ceil(todo.length / 25) + ' gelombang, 25 email per gelombang)?</p><div class="meter"><i id="blBar" style="width:0"></i></div><p class="help" id="blTxt"></p><div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="button" class="btn btn-primary" id="blGo">Kirim</button></div>';
      box.querySelector('[data-c]').addEventListener('click', function () { m.close(); });
      box.querySelector('#blGo').addEventListener('click', function () {
        var btn = this, sent = 0, fail = 0, i = 0, stop = false;
        btn.disabled = true;
        (function next() {
          if (i >= todo.length || stop) {
            box.querySelector('#blTxt').textContent = 'Selesai: ' + sent + ' terkirim, ' + fail + ' gagal.'; btn.remove(); return;
          }
          var chunk = todo.slice(i, i + 25).map(function (p) { return p.id; });
          M.run('adminKirimUlangEmail', { ids: chunk }, { timeout: 120000 }).then(function (rr) {
            if (!rr) { stop = true; box.querySelector('#blTxt').textContent = 'Berhenti. Terkirim ' + sent + ', gagal ' + fail + '. Coba lagi nanti.'; btn.disabled = false; return; }
            sent += rr.data.terkirim; fail += rr.data.gagal; i += 25;
            box.querySelector('#blBar').style.width = pct(Math.min(i, todo.length), todo.length) + '%';
            box.querySelector('#blTxt').textContent = sent + ' terkirim, ' + fail + ' gagal…';
            next();
          });
        })();
      });
    });
  }

  // =====================================================================
  // DAFTAR PESERTA (dipakai Verifikasi Bayar & Data Peserta)
  // =====================================================================
  var TABS = [['', 'Semua', 'semua'], ['Bukti Sedang Dicek', 'Perlu Verifikasi', 'Bukti Sedang Dicek'], ['Lunas', 'Lunas', 'Lunas'], ['Menunggu Bukti', 'Menunggu Bukti', 'Menunggu Bukti'], ['Bukti Ditolak', 'Ditolak', 'Bukti Ditolak']];
  var ukuranCache = null;

  function listPage(mode) {
    return function (el) {
      var q = { status: mode === 'bayar' ? 'Bukti Sedang Dicek' : '', q: '', ukuran: '', page: 1, pageSize: 25 };
      var sel = {}, rows = [], counts = {}, total = 0, alive = true, seq = 0;
      el.innerHTML = '<div class="page-head"><div><h1>' + (mode === 'bayar' ? 'Verifikasi Pembayaran' : 'Data Peserta') + '</h1><p class="muted">' + (mode === 'bayar' ? 'Periksa bukti transfer lalu setujui (ACC) atau tolak.' : 'Cari, ubah, dan kelola seluruh data santri.') + '</p></div>' +
        '<div class="head-acts"><button type="button" class="btn btn-soft btn-sm" id="csv">' + U.icon('download') + ' Ekspor CSV</button>' +
        (mode === 'peserta' ? '<button type="button" class="btn btn-soft btn-sm" id="trash">' + U.icon('trash') + ' Tempat Sampah</button><button type="button" class="btn btn-primary btn-sm" id="add">' + U.icon('plus') + ' Tambah Peserta</button>' : '') + '</div></div>' +
        '<section class="card list-card"><div class="toolbar"><div class="tabs" id="tabs" role="tablist"></div><div class="tb-right"><div class="search">' + U.icon('search') + '<input type="search" id="q" placeholder="Cari nama, wali, kode, WA…" aria-label="Cari peserta"></div><select class="select sm" id="ukr" aria-label="Filter ukuran kaos"><option value="">Semua kaos</option></select></div></div>' +
        '<div class="bulk" id="bulk" hidden></div><div id="rows" class="rows"></div><div class="pager" id="pager"></div></section>';
      var rowsEl = el.querySelector('#rows');

      function tabs() {
        el.querySelector('#tabs').innerHTML = TABS.map(function (t) {
          var c = t[2] === 'semua' ? counts.semua : counts[t[2]];
          return '<button type="button" role="tab" class="tab' + (q.status === t[0] ? ' on' : '') + '" data-s="' + h(t[0]) + '" aria-selected="' + (q.status === t[0]) + '">' + h(t[1]) + ' <span>' + num(c) + '</span></button>';
        }).join('');
      }
      function load() {
        var my = ++seq;
        rowsEl.innerHTML = M.skeleton(4);
        M.run('adminListPeserta', q, { quiet: true }).then(function (r) {
          if (!alive || my !== seq) return;
          if (!r) { rowsEl.innerHTML = M.empty('alert', 'Gagal memuat data', 'Periksa koneksi, lalu coba lagi.'); return; }
          rows = r.data.items; counts = r.data.counts; total = r.data.total; sel = {};
          tabs(); draw(); bulk();
        });
      }
      function rowHtml(p) {
        var lunas = p.statusInfaq === 'Lunas';
        return '<article class="prow" data-id="' + h(p.id) + '">' +
          '<label class="pk"><input type="checkbox" data-sel aria-label="Pilih ' + h(p.nama) + '"' + (sel[p.id] ? ' checked' : '') + '></label>' +
          '<div class="c-id"><span class="code">' + h(p.kode) + '</span></div>' +
          '<div class="c-name"><span class="av ' + (p.gender === 'P' ? 'f' : 'm') + '">' + h(U.initials(p.nama)) + '</span><div><b>' + h(p.nama) + '</b><small>' + (p.gender === 'P' ? 'Perempuan' : p.gender === 'L' ? 'Laki-laki' : '') + ' · ' + h(p.jenjang) + (p.sekolah ? ' · ' + h(p.sekolah) : '') + '</small></div></div>' +
          '<div class="c-age"><b>' + h(p.usia) + ' th</b></div>' +
          '<div class="c-wali"><b>' + h(p.wali) + '</b><a href="' + h(M.waLink(p.wa)) + '" target="_blank" rel="noopener">' + h(p.wa) + '</a></div>' +
          '<div class="c-size"><span class="size-tag">' + h(p.ukuran) + '</span></div>' +
          '<div class="c-amt"><b>' + U.rupiah(p.infaq) + '</b><small>' + (p.metodeBayar ? h(p.metodeBayar) + ' · ' : '') + h(M.fmtTime(p.dibuat)) + '</small></div>' +
          '<div class="c-proof">' + (p.adaBukti ? '<button type="button" class="btn btn-soft btn-sm" data-bukti>' + U.icon('eye') + ' Bukti</button>' : '<span class="muted">—</span>') + '</div>' +
          '<div class="c-stat"><span class="badge ' + M.statusClass(p.statusInfaq) + '">' + h(M.statusLabel(p.statusInfaq)) + '</span>' + (p.catatanPanitia ? '<small>' + h(p.catatanPanitia) + '</small>' : '') + '</div>' +
          '<div class="c-act">' +
          (!lunas ? '<button type="button" class="btn btn-ok btn-sm" data-acc>' + U.icon('check') + ' ACC</button>' : '') +
          (p.statusInfaq !== 'Bukti Ditolak' && p.adaBukti ? '<button type="button" class="btn btn-no btn-sm" data-tolak aria-label="Tolak bukti">' + U.icon('x') + '</button>' : '') +
          (p.statusInfaq === 'Menunggu Bukti' ? '<a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="' + h(M.waLink(p.wa, 'Assalamu\'alaikum, kami dari panitia PASA 17. Mohon lengkapi bukti transfer infaq untuk ananda ' + p.nama + ' (' + p.kode + ').')) + '">' + U.icon('chat') + ' Ingatkan</a>' : '') +
          '<button type="button" class="icon-btn sm" data-edit aria-label="Ubah data ' + h(p.nama) + '">' + U.icon('edit') + '</button></div>' +
          '</article>';
      }
      function draw() {
        if (!rows.length) { rowsEl.innerHTML = M.empty('users', 'Tidak ada data', q.q || q.ukuran || q.status ? 'Tidak ada peserta yang cocok dengan filter ini.' : 'Belum ada pendaftar.'); }
        else {
          rowsEl.innerHTML = '<div class="prow head" aria-hidden="true"><span></span><span>ID</span><span>Nama santri</span><span>Usia</span><span>Wali &amp; kontak</span><span>Kaos</span><span>Infaq</span><span>Bukti</span><span>Status</span><span>Aksi</span></div>' + rows.map(rowHtml).join('');
        }
        var pages = Math.max(1, Math.ceil(total / q.pageSize));
        el.querySelector('#pager').innerHTML = '<span class="muted">Menampilkan ' + rows.length + ' dari ' + num(total) + ' data</span><div><button type="button" class="btn btn-soft btn-sm" data-pg="-1"' + (q.page <= 1 ? ' disabled' : '') + '>Sebelumnya</button><b class="pg">' + q.page + ' / ' + pages + '</b><button type="button" class="btn btn-soft btn-sm" data-pg="1"' + (q.page >= pages ? ' disabled' : '') + '>Berikutnya</button></div>';
      }
      function bulk() {
        var ids = Object.keys(sel).filter(function (k) { return sel[k]; }), b = el.querySelector('#bulk');
        b.hidden = !ids.length;
        if (!ids.length) return;
        b.innerHTML = '<b>' + ids.length + ' dipilih</b><button type="button" class="btn btn-ok btn-sm" data-b="Lunas">ACC (Lunas)</button><button type="button" class="btn btn-soft btn-sm" data-b="Menunggu Bukti">Menunggu Bukti</button><button type="button" class="btn btn-no btn-sm" data-b="Bukti Ditolak">Tolak</button><button type="button" class="btn btn-soft btn-sm" data-b="__mail">' + U.icon('mail') + ' Kirim ulang email</button><button type="button" class="btn btn-danger btn-sm" data-b="__del">' + U.icon('trash') + ' Hapus</button><button type="button" class="btn btn-soft btn-sm" data-b="__none">Batal pilih</button>';
      }
      function setStatus(ids, status, catatan) {
        var data = { ids: ids, status: status }; if (catatan != null) data.catatan = catatan;
        return M.run('adminSetStatusInfaq', data, { ok: true }).then(function (r) { if (r) load(); return r; });
      }
      function tolak(ids, nama) {
        var m = U.openModal({ title: 'Tolak bukti transfer', html: '<p>' + (nama ? 'Bukti transfer <b>' + h(nama) + '</b> ' : 'Bukti transfer yang dipilih ') + 'akan ditandai Ditolak. Tulis alasan agar wali tahu apa yang perlu diperbaiki (tampil di data panitia).</p>' +
          M.fieldHtml('tAlasan', 'Alasan penolakan', { type: 'textarea', rows: 3, ph: 'Contoh: Nominal tidak sesuai / foto buram' }) +
          '<div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="button" class="btn btn-danger" data-ok>Tolak bukti</button></div>' });
        m.body.querySelector('[data-c]').addEventListener('click', m.close);
        m.body.querySelector('[data-ok]').addEventListener('click', function () { var a = M.val(m.body, 'tAlasan').trim(); m.close(); setStatus(ids, 'Bukti Ditolak', a || 'Bukti tidak sesuai'); });
      }
      function find(id) { return rows.filter(function (p) { return p.id === id; })[0]; }

      // peristiwa
      el.addEventListener('click', function (e) {
        var t = e.target, tab = t.closest('.tab');
        if (tab) { q.status = tab.getAttribute('data-s'); q.page = 1; return load(); }
        var pg = t.closest('[data-pg]');
        if (pg) { q.page += parseInt(pg.getAttribute('data-pg'), 10); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        var bb = t.closest('[data-b]');
        if (bb) {
          var act = bb.getAttribute('data-b'), ids = Object.keys(sel).filter(function (k) { return sel[k]; });
          if (act === '__none') { sel = {}; draw(); return bulk(); }
          if (act === '__mail') {
            if (ids.length > 25) return U.toast('Maksimal 25 email sekali kirim. Kurangi pilihan.', 'err');
            return M.run('adminKirimUlangEmail', { ids: ids }, { ok: true, timeout: 120000 }).then(function () { load(); });
          }
          if (act === '__del') return M.confirm('Hapus ' + ids.length + ' peserta?', 'Data dipindah ke Tempat Sampah dan masih bisa dipulihkan.', 'Pindah ke sampah', true).then(function (ok) {
            if (ok) M.run('adminHapusPeserta', { ids: ids }, { ok: true }).then(function () { load(); });
          });
          if (act === 'Bukti Ditolak') return tolak(ids);
          return M.confirm('Ubah status ' + ids.length + ' peserta?', 'Status infaq menjadi "' + act + '".', 'Ubah').then(function (ok) { if (ok) setStatus(ids, act); });
        }
        var row = t.closest('.prow[data-id]'); if (!row) return;
        var p = find(row.getAttribute('data-id')); if (!p) return;
        if (t.closest('[data-acc]')) {
          if (p.statusInfaq === 'Menunggu Bukti') return M.confirm('ACC tanpa bukti?', p.nama + ' belum mengunggah bukti. Tandai Lunas (mis. bayar tunai)?', 'Tandai Lunas').then(function (ok) { if (ok) setStatus([p.id], 'Lunas', ''); });
          return setStatus([p.id], 'Lunas', '');
        }
        if (t.closest('[data-tolak]')) return tolak([p.id], p.nama);
        if (t.closest('[data-bukti]')) return showBukti(p, load);
        if (t.closest('[data-edit]')) return pesertaForm(p, load);
      });
      el.addEventListener('change', function (e) {
        if (e.target.matches('[data-sel]')) { var id = e.target.closest('.prow').getAttribute('data-id'); sel[id] = e.target.checked; bulk(); }
        if (e.target.id === 'ukr') { q.ukuran = e.target.value; q.page = 1; load(); }
      });
      el.querySelector('#q').addEventListener('input', M.debounce(function (e) { q.q = e.target.value.trim(); q.page = 1; load(); }, 350));
      el.querySelector('#csv').addEventListener('click', function () { exportCsv(this); });
      var add = el.querySelector('#add'); if (add) add.addEventListener('click', function () { pesertaForm(null, load); });
      var tr = el.querySelector('#trash'); if (tr) tr.addEventListener('click', function () { trashModal(load); });

      (ukuranCache ? Promise.resolve(ukuranCache) : M.run('adminListModul', { modul: 'ukuran' }, { quiet: true }).then(function (r) { return r ? (ukuranCache = r.data.items) : []; })).then(function (list) {
        if (!alive) return;
        var s = el.querySelector('#ukr'); (list || []).forEach(function (u) { s.insertAdjacentHTML('beforeend', '<option value="' + h(u.label) + '">Kaos ' + h(u.label) + '</option>'); });
      });
      load();
      return function () { alive = false; };
    };
  }
  M.pages.bayar = listPage('bayar');
  M.pages.peserta = listPage('peserta');

  // ---------- bukti transfer ----------
  function b64Blob(b64, mime) {
    var bin = atob(b64), n = bin.length, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
  }
  function showBukti(p, after) {
    var m = U.openModal({ title: 'Bukti transfer · ' + p.kode, cls: 'wide', html: '<div class="proof"><div class="proof-meta"><b>' + h(p.nama) + '</b><span>' + U.rupiah(p.infaq) + ' · <span class="badge ' + M.statusClass(p.statusInfaq) + '">' + h(M.statusLabel(p.statusInfaq)) + '</span></span></div><div class="proof-view" id="pv"><div class="spin" aria-hidden="true"></div><p>Memuat bukti…</p></div>' +
      '<div class="acts"><button type="button" class="btn btn-no" data-t>' + U.icon('x') + ' Tolak</button><button type="button" class="btn btn-ok" data-a>' + U.icon('check') + ' ACC Lunas</button></div></div>' });
    var url = '';
    function done() { if (url) URL.revokeObjectURL(url); }
    M.run('adminGetBukti', { id: p.id }, { timeout: 90000 }).then(function (r) {
      var pv = m.body.querySelector('#pv'); if (!pv) return;
      if (!r) { pv.innerHTML = M.empty('alert', 'Bukti tidak dapat dimuat'); return; }
      var b = b64Blob(r.data.base64, r.data.mime); url = URL.createObjectURL(b);
      pv.innerHTML = r.data.mime === 'application/pdf'
        ? '<iframe src="' + url + '" title="Bukti transfer PDF"></iframe><a class="btn btn-soft btn-sm" href="' + url + '" target="_blank" rel="noopener">Buka PDF di tab baru</a>'
        : '<img src="' + url + '" alt="Bukti transfer ' + h(p.nama) + '">';
    });
    function act(status) {
      done(); m.close();
      if (status === 'Bukti Ditolak') {
        var t = U.openModal({ title: 'Tolak bukti transfer', html: '<p>Tulis alasan penolakan:</p>' + M.fieldHtml('tAlasan2', 'Alasan', { type: 'textarea', rows: 3, ph: 'Contoh: Nominal tidak sesuai' }) + '<div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="button" class="btn btn-danger" data-ok>Tolak bukti</button></div>' });
        t.body.querySelector('[data-c]').addEventListener('click', t.close);
        t.body.querySelector('[data-ok]').addEventListener('click', function () { var a = M.val(t.body, 'tAlasan2').trim(); t.close(); M.run('adminSetStatusInfaq', { ids: [p.id], status: status, catatan: a || 'Bukti tidak sesuai' }, { ok: true }).then(after); });
        return;
      }
      M.run('adminSetStatusInfaq', { ids: [p.id], status: status, catatan: '' }, { ok: true }).then(after);
    }
    m.body.querySelector('[data-a]').addEventListener('click', function () { act('Lunas'); });
    m.body.querySelector('[data-t]').addEventListener('click', function () { act('Bukti Ditolak'); });
    var origClose = m.close; m.close = function () { done(); origClose(); };
  }

  // ---------- tambah / ubah peserta ----------
  function pesertaForm(p, after) {
    var edit = !!p; p = p || {};
    M.run('adminListModul', { modul: 'ukuran' }, { quiet: true }).then(function (r) {
      var ukr = (r ? r.data.items : []).filter(function (u) { return u.aktif === 'true' || u.label === p.ukuran; });
      var m = U.openModal({ title: edit ? 'Ubah data ' + p.kode : 'Tambah peserta manual', cls: 'wide', html:
        '<form id="pf" novalidate><div class="form-grid">' +
        M.fieldHtml('f_nama', 'Nama lengkap santri', { value: p.nama, req: 1, cls: 'span2' }) +
        M.fieldHtml('f_panggilan', 'Nama panggilan', { value: p.panggilan }) +
        '<div class="field"><label class="lbl" for="f_gender">Jenis kelamin</label><select class="select" id="f_gender"><option value="L"' + (p.gender === 'L' ? ' selected' : '') + '>Laki-laki</option><option value="P"' + (p.gender === 'P' ? ' selected' : '') + '>Perempuan</option></select></div>' +
        M.fieldHtml('f_tgl', 'Tanggal lahir', { type: 'date', value: p.tglLahir, req: 1 }) +
        '<div class="field"><label class="lbl" for="f_jenjang">Jenjang</label><select class="select" id="f_jenjang"><option value="SD"' + (p.jenjang !== 'SMP' ? ' selected' : '') + '>SD</option><option value="SMP"' + (p.jenjang === 'SMP' ? ' selected' : '') + '>SMP</option></select></div>' +
        M.fieldHtml('f_sekolah', 'Asal sekolah & kelas', { value: p.sekolah, cls: 'span2' }) +
        M.fieldHtml('f_wali', 'Nama wali', { value: p.wali, req: 1 }) +
        M.fieldHtml('f_wa', 'WhatsApp wali', { value: p.wa, req: 1, type: 'tel' }) +
        M.fieldHtml('f_email', 'Email wali', { value: p.email, req: 1, type: 'email', cls: 'span2' }) +
        '<div class="field"><label class="lbl" for="f_ukuran">Ukuran kaos</label><select class="select" id="f_ukuran">' + ukr.map(function (u) { return '<option value="' + h(u.label) + '"' + (u.label === p.ukuran ? ' selected' : '') + '>' + h(u.label) + ' (' + h(u.lebar) + '×' + h(u.panjang) + ' cm)</option>'; }).join('') + '</select></div>' +
        M.fieldHtml('f_infaq', 'Infaq (Rp)', { type: 'number', value: p.infaq || '', min: 0, req: 1 }) +
        (edit ? '' : '<div class="field"><label class="lbl" for="f_status">Status infaq</label><select class="select" id="f_status">' + STATUS.map(function (s) { return '<option' + (s === 'Lunas' ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>') +
        M.fieldHtml('f_metode', 'Metode bayar', { value: p.metodeBayar, ph: 'Transfer BSI / Tunai / QRIS' }) +
        M.fieldHtml('f_medis', 'Catatan medis / alergi', { type: 'textarea', rows: 2, value: p.medis, cls: 'span2' }) +
        M.fieldHtml('f_cat', 'Catatan panitia', { value: p.catatanPanitia, cls: 'span2' }) +
        (edit ? '' : '<label class="check span2"><input type="checkbox" id="f_mail" checked> <span>Kirim e-tiket ke email wali</span></label>') +
        '</div><div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="submit" class="btn btn-primary" id="pfOk">' + (edit ? 'Simpan perubahan' : 'Tambah peserta') + '</button></div></form>' });
      var f = m.body.querySelector('#pf');
      m.body.querySelector('[data-c]').addEventListener('click', m.close);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = function (id) { return M.val(m.body, id).trim(); };
        var d = { nama: v('f_nama'), panggilan: v('f_panggilan'), gender: v('f_gender'), jenjang: v('f_jenjang'), sekolah: v('f_sekolah'), wali: v('f_wali'), wa: v('f_wa'), email: v('f_email'),
          ukuran: v('f_ukuran'), infaq: v('f_infaq'), medis: v('f_medis'), metodeBayar: v('f_metode'), catatanPanitia: v('f_cat') };
        var btn = m.body.querySelector('#pfOk'); M.spinBtn(btn, true, 'Menyimpan…');
        var call;
        if (edit) { d.id = p.id; d.tglLahir = v('f_tgl'); call = M.run('adminUbahPeserta', d, { ok: true }); }
        else { d.tgl_lahir = v('f_tgl'); d.statusInfaq = v('f_status'); d.kirimEmail = !!m.body.querySelector('#f_mail').checked; call = M.run('adminTambahPeserta', d, { ok: true, timeout: 90000 }); }
        call.then(function (r) { M.spinBtn(btn, false); if (r) { m.close(); after(); } });
      });
    });
  }

  // ---------- tempat sampah ----------
  function trashModal(after) {
    var m = U.openModal({ title: 'Tempat Sampah', cls: 'wide', html: '<div id="tr">' + M.skeleton(2) + '</div>' });
    var box = m.body.querySelector('#tr');
    function load() {
      M.run('adminListSampah', {}).then(function (r) {
        if (!r) return;
        var it = r.data.items;
        if (!it.length) { box.innerHTML = M.empty('trash', 'Tempat sampah kosong'); return; }
        box.innerHTML = '<p class="help">Pulihkan peserta atau hapus permanen (bukti transfer ikut dihapus dan tidak dapat dikembalikan).</p><ul class="trash-list">' + it.map(function (p) {
          return '<li data-id="' + h(p.id) + '"><div><b>' + h(p.nama) + '</b><small>' + h(p.kode) + ' · dihapus ' + h(M.fmtTime(p.dihapus)) + '</small></div><div><button type="button" class="btn btn-soft btn-sm" data-r>' + U.icon('undo') + ' Pulihkan</button><button type="button" class="btn btn-danger btn-sm" data-x>' + U.icon('trash') + ' Hapus permanen</button></div></li>';
        }).join('') + '</ul>';
      });
    }
    box.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]'); if (!li) return;
      var id = li.getAttribute('data-id');
      if (e.target.closest('[data-r]')) M.run('adminPulihkanPeserta', { ids: [id] }, { ok: true }).then(function () { load(); after(); });
      if (e.target.closest('[data-x]')) M.confirm('Hapus permanen?', 'Data dan bukti transfer akan hilang selamanya.', 'Hapus permanen', true).then(function (ok) {
        if (ok) M.run('adminHapusPermanen', { ids: [id] }, { ok: true }).then(function () { load(); after(); });
      });
    });
    load();
  }
  M.trashModal = trashModal;
})();
