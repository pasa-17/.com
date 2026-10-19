/* Potongan tampilan yang dipakai beberapa halaman. */
(function () {
  'use strict';
  var P = window.PASA = window.PASA || {};
  var U = P.ui;

  function pubPengaturan(pub) { return (pub && pub.pengaturan) || {}; }

  // Kartu rekening resmi + tombol salin
  function rekening(p, opt) {
    opt = opt || {};
    var has = !!(p.bank_rekening);
    var qris = U.safeUrl(p.qris_url);
    return '<div class="' + (opt.cls || 'rek') + '">' +
      '<div class="rek-head"><span>' + U.icon('bank') + ' Rekening pembayaran &amp; infaq</span></div>' +
      (has
        ? '<div class="rek-bank">' + U.esc(p.bank_nama || 'Bank') + '</div>' +
          '<div class="rek-no"><code>' + U.esc(p.bank_rekening) + '</code>' +
          '<button type="button" class="btn btn-soft btn-copy" data-copy="' + U.esc(p.bank_rekening) + '" data-msg="Nomor rekening disalin">' + U.icon('copy') + ' Salin</button></div>' +
          (p.bank_atas_nama ? '<div class="rek-an">a.n. <b>' + U.esc(p.bank_atas_nama) + '</b></div>' : '')
        : '<p class="muted">Nomor rekening resmi akan diumumkan panitia saat pendaftaran dibuka.</p>') +
      (qris ? '<img class="qris" src="' + U.esc(qris) + '" alt="QRIS pembayaran" loading="lazy" referrerpolicy="no-referrer">' : '') +
      '</div>';
  }

  function regBadge(pub) {
    var s = pub && pub.pendaftaran ? pub.pendaftaran.status : '';
    if (s === 'buka') return '<span class="badge badge-live"><span class="dot"></span> Pendaftaran Dibuka</span>';
    if (s === 'penuh') return '<span class="badge badge-warn">' + U.icon('alert') + ' Kuota Penuh</span>';
    if (s === 'tutup') return '<span class="badge badge-glass">' + U.icon('lock') + ' Pendaftaran Ditutup</span>';
    return '';
  }

  function statusBadge(st) {
    if (st === 'Lunas') return '<span class="badge badge-ok">' + U.icon('shield') + ' Lunas · Terverifikasi</span>';
    if (st === 'Bukti Sedang Dicek') return '<span class="badge badge-warn">' + U.icon('clock') + ' Bukti Sedang Dicek</span>';
    if (st === 'Bukti Ditolak') return '<span class="badge badge-err">' + U.icon('alert') + ' Bukti Ditolak</span>';
    return '<span class="badge badge-wait">' + U.icon('wallet') + ' ' + U.esc(st || 'Menunggu Bukti') + '</span>';
  }

  function openSyarat(pub) {
    var p = pubPengaturan(pub), t = String(p.syarat_teks || '').trim();
    U.openModal({
      title: 'Ketentuan & Tata Tertib',
      html: t ? '<div class="preline">' + U.esc(t) + '</div>' : '<p>Teks ketentuan dan tata tertib belum diisi panitia. Silakan hubungi panitia bila ada pertanyaan.</p>'
    });
  }

  function waLink(num, text) {
    var d = String(num || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.charAt(0) === '0') d = '62' + d.slice(1);
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  // Delegasi klik global: salin, gulir ke bagian, buka ketentuan
  function bindGlobal(getPub) {
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-copy]');
      if (c) { e.preventDefault(); U.copyText(c.getAttribute('data-copy'), c.getAttribute('data-msg') || 'Tersalin'); return; }
      var s = e.target.closest('[data-scroll]');
      if (s) {
        e.preventDefault();
        var t = document.getElementById(s.getAttribute('data-scroll'));
        if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (e.target.closest('[data-syarat]')) { e.preventDefault(); openSyarat(getPub()); }
    });
  }

  P.shared = { rekening: rekening, regBadge: regBadge, statusBadge: statusBadge, openSyarat: openSyarat, waLink: waLink, bindGlobal: bindGlobal, pengaturan: pubPengaturan };
})();
