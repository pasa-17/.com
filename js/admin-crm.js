/* Portal admin — menu CRM Kontak (Nama · Email · WhatsApp). */
(function () {
  'use strict';
  var P = window.PASA, U = P.ui, M = P.adm, h = M.h;

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;      // cegah formula injection di Excel/Sheets
    return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    var delim = (text.split('\n')[0] || '').indexOf(';') >= 0 && (text.split('\n')[0] || '').indexOf(',') < 0 ? ';' : ',';
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (q) { if (c === '"') { if (text.charAt(i + 1) === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }

  M.pages.crm = function (el) {
    var F = { cari: '', segmen: '', statusWA: '', emailValid: '', optOut: '', tag: '', duplikat: false, masalah: false, halaman: 1 };
    var D = { items: [], total: 0, per: 50, facet: { segmen: {}, statusWA: {}, tag: {} }, syncAt: 0 }, S = null, sel = {}, alive = true;
    el.innerHTML = '<div class="page-head"><div><h1>CRM Kontak</h1><p class="muted">Nama · Email · WhatsApp seluruh wali santri dan kontak luar, dalam satu layar.</p></div>' +
      '<div class="head-acts"><span class="muted" id="cSync"></span><button type="button" class="btn btn-soft" id="cSyncBtn">' + U.icon('refresh') + ' Sinkron Sekarang</button><button type="button" class="btn btn-soft" id="cImp">' + U.icon('upload') + ' Import CSV</button>' +
      '<button type="button" class="btn btn-soft" id="cDup">' + U.icon('copy') + ' Periksa Duplikat</button><button type="button" class="btn btn-soft" id="cExp">' + U.icon('download') + ' Ekspor CSV</button></div></div>' +
      '<div class="stats kpi6" id="cKpi">' + M.skeleton(1) + '</div>' +
      '<section class="card list-card"><div class="toolbar"><div class="tabs scroll" id="cSeg"></div></div>' +
      '<div class="toolbar"><div class="tb-right"><div class="search">' + U.icon('search') + '<input id="cQ" type="search" placeholder="Cari nama, nomor, email, santri…" aria-label="Cari kontak"></div>' +
      '<select class="select sm" id="cWa" aria-label="Status WA"><option value="">Semua status WA</option><option value="Terdaftar">Terdaftar WA</option><option value="Tidak Terdaftar">Bukan WA</option><option value="belum">Belum dicek</option></select>' +
      '<select class="select sm" id="cEm" aria-label="Email"><option value="">Semua email</option><option value="YA">Email valid</option><option value="TIDAK">Email tidak valid</option></select>' +
      '<select class="select sm" id="cTag" aria-label="Tag"><option value="">Semua tag</option></select></div></div>' +
      '<div id="cBulk"></div><div id="cList">' + M.skeleton(2) + '</div><div class="pager" id="cPager"></div></section>';

    function when(ms) { if (!ms) return 'belum pernah'; var m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : Math.round(m / 60) + ' jam lalu'; }
    function kpi() {
      if (!S) return;
      var k = [['TOTAL KONTAK', S.total, {}, ''], ['WA TERVERIFIKASI', S.waTerdaftar, { statusWA: 'Terdaftar' }, 'sage'], ['EMAIL VALID', S.emailValid, { emailValid: 'YA' }, ''],
        ['BELUM DICEK WA', S.belumDicek, { statusWA: 'belum' }, 'orange'], ['OPT-OUT', S.optOut, { optOut: 'YA' }, ''], ['DUPLIKAT', S.duplikat, { duplikat: true }, 'orange']];
      el.querySelector('#cKpi').innerHTML = k.map(function (x, i) { return '<button type="button" class="card stat kbtn" data-k="' + i + '"><small>' + x[0] + '</small><b>' + x[1] + '</b></button>'; }).join('');
      el.querySelector('#cKpi').kdata = k;
    }
    function segs() {
      var f = D.facet, tot = Object.keys(f.segmen).reduce(function (a, k) { return a + f.segmen[k]; }, 0);
      el.querySelector('#cSeg').innerHTML = '<button type="button" class="tab' + (!F.segmen ? ' on' : '') + '" data-seg="">Semua <span>' + tot + '</span></button>' + Object.keys(f.segmen).map(function (s) {
        return '<button type="button" class="tab' + (F.segmen === s ? ' on' : '') + '" data-seg="' + h(s) + '">' + h(s) + ' <span>' + f.segmen[s] + '</span></button>';
      }).join('');
      var tg = el.querySelector('#cTag'), cur = F.tag;
      tg.innerHTML = '<option value="">Semua tag</option>' + Object.keys(f.tag).sort().map(function (t) { return '<option value="' + h(t) + '"' + (t === cur ? ' selected' : '') + '>' + h(t) + ' (' + f.tag[t] + ')</option>'; }).join('');
    }
    function table() {
      var c = el.querySelector('#cList');
      if (!D.items.length) { c.innerHTML = M.empty('contacts', 'Tidak ada kontak', 'Ubah filter, tekan Sinkron Sekarang, atau impor kontak luar.'); el.querySelector('#cPager').innerHTML = ''; return; }
      var all = D.items.every(function (x) { return sel[x.id]; });
      c.innerHTML = '<div class="tbl-wrap"><table class="tbl crm"><thead><tr><th><input type="checkbox" id="cAll"' + (all ? ' checked' : '') + ' aria-label="Pilih semua di halaman"></th><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Tag</th><th>Terakhir</th><th>Pesan</th><th></th></tr></thead><tbody>' + D.items.map(function (x) {
        return '<tr data-id="' + h(x.id) + '" class="' + (x.masalah || x.duplikat ? 'warnrow' : '') + (x.optOut ? ' off' : '') + '"><td><input type="checkbox" data-sel="' + h(x.id) + '"' + (sel[x.id] ? ' checked' : '') + '></td>' +
          '<td><div class="c-name"><span class="av m">' + h(U.initials(x.nama)) + '</span><div><b>' + h(x.nama) + '</b><small><span class="badge badge-wait">' + h(x.segmen) + '</span>' + (x.info.santri ? ' ' + h(x.info.santri) : '') + (x.optOut ? ' · opt-out' : '') + (x.duplikat ? ' · duplikat' : '') + (x.info.hilang ? ' · data sumber dihapus' : '') + '</small></div></div></td>' +
          '<td>' + (x.email ? h(x.email) + (x.emailValid === 'TIDAK' ? ' <span class="err" title="Email tidak valid">⚠</span>' : ' <span class="okc">✓</span>') : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (x.wa ? '<span class="code">' + h(x.wa) + '</span> ' + (x.waValid ? M.waBadge(x.statusWA) + ' <a class="wl" href="' + h(M.waLink(x.wa)) + '" target="_blank" rel="noopener" aria-label="Buka WhatsApp">' + U.icon('external') + '</a>' : '<span class="err">tidak valid</span>') : '<span class="muted">—</span>') + '</td>' +
          '<td>' + x.tag.map(function (t) { return '<span class="tagc">' + h(t) + '</span>'; }).join('') + '</td><td class="nw">' + (x.terakhir ? h(M.fmtTime(x.terakhir)) : '—') + '</td><td>' + x.jumlahPesan + '</td>' +
          '<td><button type="button" class="btn btn-soft btn-sm" data-detail>Detail</button></td></tr>';
      }).join('') + '</tbody></table></div>';
      var pages = Math.max(1, Math.ceil(D.total / D.per));
      el.querySelector('#cPager').innerHTML = '<span class="pg">' + D.total + ' kontak · halaman ' + D.halaman + ' dari ' + pages + '</span><div><button type="button" class="btn btn-soft btn-sm" data-pg="-1"' + (D.halaman <= 1 ? ' disabled' : '') + '>Sebelumnya</button><button type="button" class="btn btn-soft btn-sm" data-pg="1"' + (D.halaman >= pages ? ' disabled' : '') + '>Berikutnya</button></div>';
    }
    function bulk() {
      var ids = Object.keys(sel), c = el.querySelector('#cBulk');
      c.innerHTML = ids.length ? '<div class="bulk"><b>' + ids.length + ' dipilih</b><button type="button" class="btn btn-soft btn-sm" data-b="det">' + U.icon('phone') + ' Deteksi WA</button><button type="button" class="btn btn-soft btn-sm" data-b="tag">Beri Tag</button><button type="button" class="btn btn-ok btn-sm" data-b="blast">' + U.icon('send') + ' Blast ke Terpilih</button><button type="button" class="btn btn-soft btn-sm" data-b="optout">Opt-out</button><button type="button" class="btn btn-soft btn-sm" data-b="optin">Batalkan opt-out</button><button type="button" class="btn btn-soft btn-sm" data-b="clear">Batal pilih</button></div>' : '';
    }
    function loadList() {
      M.swr('adminListKontak', F, function (r) {
        if (!alive) return;
        if (!r) { el.querySelector('#cList').innerHTML = M.empty('alert', 'Gagal memuat kontak'); return; }
        D = r.data; segs(); table(); bulk();
        el.querySelector('#cSync').textContent = 'Sinkron terakhir: ' + when(D.syncAt);
      });
    }
    function loadStats() { M.swr('adminGetCrmStats', {}, function (r) { if (r && alive) { S = r.data; kpi(); } }); }
    function reload() { loadStats(); loadList(); }
    reload();

    var q = M.debounce(function (v) { F.cari = v.trim(); F.halaman = 1; loadList(); }, 350);
    el.addEventListener('input', function (e) { if (e.target.id === 'cQ') q(e.target.value); });
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'cWa') F.statusWA = t.value; else if (t.id === 'cEm') F.emailValid = t.value; else if (t.id === 'cTag') F.tag = t.value;
      else if (t.id === 'cAll') { D.items.forEach(function (x) { if (t.checked) sel[x.id] = true; else delete sel[x.id]; }); table(); bulk(); return; }
      else if (t.getAttribute && t.getAttribute('data-sel')) { var id = t.getAttribute('data-sel'); if (t.checked) sel[id] = true; else delete sel[id]; bulk(); return; }
      else return;
      F.halaman = 1; loadList();
    });
    el.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest('[data-seg]'))) { F.segmen = x.getAttribute('data-seg'); F.halaman = 1; loadList(); return; }
      if ((x = t.closest('.kbtn'))) { var k = el.querySelector('#cKpi').kdata[Number(x.getAttribute('data-k'))][2]; F = Object.assign({ cari: F.cari, segmen: '', statusWA: '', emailValid: '', optOut: '', tag: '', duplikat: false, masalah: false, halaman: 1 }, k); el.querySelector('#cWa').value = F.statusWA; el.querySelector('#cEm').value = F.emailValid; loadList(); return; }
      if ((x = t.closest('[data-pg]'))) { F.halaman = Math.max(1, D.halaman + Number(x.getAttribute('data-pg'))); loadList(); return; }
      if ((x = t.closest('[data-detail]'))) { detail(x.closest('tr').getAttribute('data-id')); return; }
      if ((x = t.closest('[data-b]'))) { return bulkAct(x.getAttribute('data-b')); }
      if (t.closest('#cSyncBtn')) { var b = t.closest('#cSyncBtn'); M.spinBtn(b, true, 'Sinkron…'); M.run('adminCrmSync', {}, { ok: true, timeout: 90000 }).then(function () { M.spinBtn(b, false); reload(); }); return; }
      if (t.closest('#cImp')) return importModal();
      if (t.closest('#cDup')) return dupModal();
      if (t.closest('#cExp')) return exportCsv(t.closest('#cExp'));
    });

    function bulkAct(a) {
      var ids = Object.keys(sel); if (!ids.length) return;
      if (a === 'clear') { sel = {}; table(); bulk(); return; }
      if (a === 'blast') { M.waPrefill = { ids: ids, label: 'Kontak terpilih (' + ids.length + ')' }; location.hash = '#/wa/blast'; return; }
      if (a === 'det') {
        var todo = ids.slice(), done = 0, fail = false;
        (function step() {
          if (!todo.length || fail) { if (alive) { U.toast(fail ? 'Deteksi dihentikan.' : 'Deteksi selesai (' + done + ' nomor).', fail ? 'err' : 'ok'); reload(); } return; }
          var chunk = todo.splice(0, 50); U.toast('Mengecek ' + done + '/' + ids.length + '…', 'ok');
          M.run('adminAksiKontak', { ids: chunk, aksi: 'deteksiWA' }, { timeout: 90000 }).then(function (r) { if (!r) fail = true; else done += chunk.length; step(); });
        })(); return;
      }
      if (a === 'tag') {
        var m = U.openModal({ title: 'Beri tag', cls: 'confirm', html: '<form id="tg">' + M.fieldHtml('tg_v', 'Nama tag', { ph: 'mis. vip, seminar' }) + '<div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="submit" class="btn btn-primary">Terapkan</button></div></form>' });
        m.body.querySelector('[data-c]').addEventListener('click', m.close);
        m.body.querySelector('#tg').addEventListener('submit', function (ev) { ev.preventDefault(); var v = M.val(m.body, 'tg_v').trim(); if (!v) return; m.close(); M.run('adminAksiKontak', { ids: ids, aksi: 'tag', nilai: v }, { ok: true }).then(function () { sel = {}; reload(); }); });
        return;
      }
      if (a === 'optout' || a === 'optin') {
        // tampilan langsung berubah, dibatalkan bila server menolak
        var old = {}; D.items.forEach(function (x) { if (sel[x.id]) { old[x.id] = x.optOut; x.optOut = a === 'optout'; } }); table();
        M.run('adminAksiKontak', { ids: ids, aksi: a }, { ok: true }).then(function (r) {
          if (!r) { D.items.forEach(function (x) { if (x.id in old) x.optOut = old[x.id]; }); table(); }
          sel = {}; reload();
        });
      }
    }

    function detail(id) {
      var m = U.openModal({ title: 'Detail kontak', cls: 'wide', html: '<div id="dt">' + M.skeleton(2) + '</div>' }), box = m.body.querySelector('#dt');
      M.run('adminGetKontak', { id: id }, { quiet: true }).then(function (r) {
        if (!r) { box.innerHTML = M.empty('alert', 'Gagal memuat kontak'); return; }
        var k = r.data.kontak, tl = r.data.timeline;
        box.innerHTML = '<form id="kf" novalidate><div class="form-grid">' + M.fieldHtml('k_nama', 'Nama', { value: k.nama, cls: 'span2' }) + M.fieldHtml('k_wa', 'WhatsApp', { value: k.wa, type: 'tel' }) + M.fieldHtml('k_em', 'Email', { value: k.email, type: 'email' }) +
          M.fieldHtml('k_tag', 'Tag (pisahkan koma)', { value: k.tag.join(', '), cls: 'span2' }) + M.fieldHtml('k_cat', 'Catatan', { type: 'textarea', rows: 2, value: k.catatan, cls: 'span2' }) +
          '<label class="check span2"><input type="checkbox" id="k_opt"' + (k.optOut ? ' checked' : '') + '><span>Opt-out (tidak diikutkan dalam blast)</span></label></div>' +
          '<p class="help">' + M.waBadge(k.statusWA) + ' · Segmen ' + h(k.segmen) + (k.info.santri ? ' · Santri ' + h(k.info.santri) + ' (' + h(k.info.kode) + ')' : '') + (k.sumber === 'wali' ? '. Perubahan nama/WA/email ikut ditulis ke data pendaftar.' : '') + '</p>' +
          '<div class="acts left"><button type="submit" class="btn btn-primary" id="kOk">Simpan</button>' + (k.wa ? '<a class="btn btn-soft" target="_blank" rel="noopener" href="' + h(M.waLink(k.wa)) + '">' + U.icon('chat') + ' Buka WhatsApp</a><button type="button" class="btn btn-soft" id="kCopy">' + U.icon('copy') + ' Salin nomor</button>' : '') + (k.email ? '<a class="btn btn-soft" href="mailto:' + h(k.email) + '">' + U.icon('mail') + ' Email</a>' : '') + '</div></form>' +
          '<hr><h3>Catat interaksi</h3><div class="inline"><select class="select sm" id="i_k"><option>Telepon</option><option>WA Manual</option><option>Kunjungan</option><option>Catatan</option></select><input class="input" id="i_r" placeholder="Ringkasan…" aria-label="Ringkasan interaksi"><button type="button" class="btn btn-dark" id="iOk">Catat</button></div>' +
          '<h3 class="mt">Riwayat</h3>' + (tl.length ? '<ul class="tl">' + tl.map(function (x) { return '<li><time>' + h(M.fmtTime(x.waktu)) + '</time><div><b>' + h(x.kanal) + (x.status ? ' · ' + h(x.status) : '') + '</b><span>' + h(x.ringkasan) + '</span></div></li>'; }).join('') + '</ul>' : '<p class="muted">Belum ada riwayat.</p>');
        box.querySelector('#kf').addEventListener('submit', function (ev) {
          ev.preventDefault(); var b = box.querySelector('#kOk'); M.spinBtn(b, true, 'Menyimpan…');
          M.run('adminSimpanKontak', { id: id, nama: M.val(box, 'k_nama'), wa: M.val(box, 'k_wa'), email: M.val(box, 'k_em'), tag: M.val(box, 'k_tag').split(','), catatan: M.val(box, 'k_cat'), optOut: box.querySelector('#k_opt').checked }, { ok: true }).then(function (r2) {
            M.spinBtn(b, false); if (r2) { m.close(); reload(); if (M.store.ready()) M.store.load(true).catch(function () { }); }
          });
        });
        var cp = box.querySelector('#kCopy'); if (cp) cp.addEventListener('click', function () { U.copyText(k.wa); });
        box.querySelector('#iOk').addEventListener('click', function () {
          var rr = M.val(box, 'i_r').trim(); if (!rr) return U.toast('Isi ringkasan.', 'err');
          M.run('adminCatatInteraksi', { kontakId: id, kanal: M.val(box, 'i_k'), ringkasan: rr }, { ok: true }).then(function (r3) { if (r3) { m.close(); detail(id); } });
        });
      });
    }

    function importModal() {
      var TPL = 'nama,wa,email,segmen,tag\nBapak Contoh,081234567890,contoh@mail.com,Calon Peserta,seminar\n';
      var m = U.openModal({ title: 'Import kontak (CSV)', cls: 'wide', html: '<p class="help">Kolom: <code>nama</code>, <code>wa</code>, <code>email</code>, <code>segmen</code>, <code>tag</code>. Nomor yang sudah ada dilewati. Maks. 1.000 baris per impor.</p>' +
        '<div class="acts left"><button type="button" class="btn btn-soft btn-sm" id="tpl">' + U.icon('download') + ' Unduh template</button><input type="file" id="ifile" accept=".csv,text/csv,text/plain" aria-label="Pilih berkas CSV"></div>' +
        M.fieldHtml('i_txt', 'Atau tempel isi CSV di sini', { type: 'textarea', rows: 6, ph: TPL }) + '<p class="help" id="ipv"></p><div class="acts"><button type="button" class="btn btn-soft" data-c>Batal</button><button type="button" class="btn btn-primary" id="iGo">Impor</button></div>' });
      var box = m.body, rows = [];
      function parse() {
        var all = parseCsv(M.val(box, 'i_txt')); if (!all.length) { rows = []; box.querySelector('#ipv').textContent = ''; return; }
        var hd = all[0].map(function (x) { return String(x).trim().toLowerCase(); }), has = hd.indexOf('nama') >= 0 || hd.indexOf('wa') >= 0;
        var idx = function (n) { return hd.indexOf(n); }, body = has ? all.slice(1) : all, cols = has ? { nama: idx('nama'), wa: idx('wa'), email: idx('email'), segmen: idx('segmen'), tag: idx('tag') } : { nama: 0, wa: 1, email: 2, segmen: 3, tag: 4 };
        rows = body.map(function (r) { var g = function (c) { return c >= 0 ? String(r[c] || '').trim() : ''; }; return { nama: g(cols.nama), wa: g(cols.wa), email: g(cols.email), segmen: g(cols.segmen), tag: g(cols.tag) }; });
        box.querySelector('#ipv').textContent = rows.length + ' baris terbaca.' + (rows.length > 1000 ? ' Hanya 1.000 pertama yang diimpor.' : '');
      }
      box.querySelector('#i_txt').addEventListener('input', parse);
      box.querySelector('#tpl').addEventListener('click', function () { M.download('template-kontak.csv', TPL); });
      box.querySelector('#ifile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { box.querySelector('#i_txt').value = rd.result; parse(); }; rd.readAsText(f); });
      box.querySelector('[data-c]').addEventListener('click', m.close);
      box.querySelector('#iGo').addEventListener('click', function () {
        if (!rows.length) return U.toast('Belum ada baris untuk diimpor.', 'err'); var b = this; M.spinBtn(b, true, 'Mengimpor…');
        M.run('adminImporKontak', { rows: rows.slice(0, 1000) }, { ok: true, timeout: 90000 }).then(function (r) { M.spinBtn(b, false); if (r) { m.close(); reload(); } });
      });
    }

    function dupModal() {
      var m = U.openModal({ title: 'Kontak duplikat', cls: 'wide', html: '<div id="dp">' + M.skeleton(2) + '</div>' }), box = m.body.querySelector('#dp');
      M.run('adminListDuplikat', {}, { quiet: true }).then(function (r) {
        if (!r) { box.innerHTML = M.empty('alert', 'Gagal memuat duplikat'); return; }
        var g = r.data.grup; if (!g.length) { box.innerHTML = M.empty('check-circle', 'Tidak ada duplikat'); return; }
        box.innerHTML = '<p class="help">Nomor atau email yang sama. Pilih kontak utama; yang lain digabung ke kontak itu (tag & jumlah pesan digabung). Kakak-adik dengan wali yang sama wajar muncul di sini.</p>' + g.map(function (x, i) {
          return '<div class="dgrp" data-g="' + i + '"><b>' + (x.jenis === 'wa' ? 'Nomor ' : 'Email ') + h(x.kunci) + '</b>' + x.kontak.map(function (k, j) {
            return '<label class="check"><input type="radio" name="u' + i + '" value="' + h(k.id) + '"' + (j === 0 ? ' checked' : '') + '><span>' + h(k.nama) + (k.info.santri ? ' — ' + h(k.info.santri) : '') + ' <small>(' + h(k.segmen) + ')</small></span></label>';
          }).join('') + '<button type="button" class="btn btn-primary btn-sm" data-merge>Gabungkan</button></div>';
        }).join('');
        box.addEventListener('click', function (e) {
          var b = e.target.closest('[data-merge]'); if (!b) return; var gi = Number(b.closest('.dgrp').getAttribute('data-g')), grp = g[gi];
          var utama = b.closest('.dgrp').querySelector('input:checked').value;
          M.confirm('Gabungkan kontak?', 'Kontak lain disembunyikan dan digabung ke kontak utama.', 'Gabungkan', false).then(function (ok) {
            if (!ok) return; M.run('adminGabungKontak', { utama: utama, gabung: grp.kontak.map(function (k) { return k.id; }).filter(function (i) { return i !== utama; }) }, { ok: true }).then(function (r2) { if (r2) { b.closest('.dgrp').remove(); reload(); } });
          });
        });
      });
    }

    function exportCsv(btn) {
      M.spinBtn(btn, true, 'Menyiapkan…');
      M.run('adminExportKontak', F, { timeout: 90000 }).then(function (r) {
        M.spinBtn(btn, false); if (!r) return;
        var lines = [r.data.header].concat(r.data.rows).map(function (row) { return row.map(csvCell).join(','); });
        M.download('kontak-pasa17-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\r\n'));
        U.toast(r.data.rows.length + ' kontak diekspor.', 'ok');
      });
    }
    return function () { alive = false; };
  };
})();
