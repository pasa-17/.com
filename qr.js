/*
 * Pembuat QR Code mandiri (tanpa pustaka luar) — mode byte, koreksi galat M, versi 1–10.
 * Cukup untuk token tiket pendek (≤ 213 byte). Diuji dengan pembaca QR OpenCV.
 */
(function (root) {
  'use strict';

  // ---- Medan Galois GF(256), polinomial 0x11D ----
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

  function genPoly(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var q = new Array(p.length + 1).fill(0);
      for (var j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); }
      p = q;
    }
    return p;
  }
  function rsRemainder(data, n) {
    var g = genPoly(n), res = new Array(n).fill(0);
    for (var k = 0; k < data.length; k++) {
      var f = data[k] ^ res.shift();
      res.push(0);
      if (f) for (var i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f);
    }
    return res;
  }

  // ---- Tabel versi (level M): ec per blok, [[jumlah blok, kodeword data per blok], ...] ----
  var VER = [null,
    { ec: 10, b: [[1, 16]] }, { ec: 16, b: [[1, 28]] }, { ec: 26, b: [[1, 44]] },
    { ec: 18, b: [[2, 32]] }, { ec: 24, b: [[2, 43]] }, { ec: 16, b: [[4, 27]] },
    { ec: 18, b: [[4, 31]] }, { ec: 22, b: [[2, 38], [2, 39]] },
    { ec: 22, b: [[3, 36], [2, 37]] }, { ec: 26, b: [[4, 43], [1, 44]] }
  ];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  function dataCapacity(v) { return VER[v].b.reduce(function (s, g) { return s + g[0] * g[1]; }, 0); }

  function utf8(str) {
    var out = [], s = unescape(encodeURIComponent(String(str)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function buildCodewords(bytes, v) {
    var cap = dataCapacity(v), bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var maxBits = cap * 8;
    put(0, Math.min(4, maxBits - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b);
    }
    for (var pad = 0xEC; data.length < cap; pad ^= 0xEC ^ 0x11) data.push(pad);

    // pecah menjadi blok + hitung koreksi galat
    var blocks = [], pos = 0;
    VER[v].b.forEach(function (g) {
      for (var k = 0; k < g[0]; k++) { blocks.push(data.slice(pos, pos + g[1])); pos += g[1]; }
    });
    var ecs = blocks.map(function (blk) { return rsRemainder(blk, VER[v].ec); });
    var out = [], maxLen = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (var c = 0; c < maxLen; c++) blocks.forEach(function (blk) { if (c < blk.length) out.push(blk[c]); });
    for (var e = 0; e < VER[v].ec; e++) ecs.forEach(function (ec) { out.push(ec[e]); });
    return out;
  }

  function newGrid(size, val) {
    var g = []; for (var i = 0; i < size; i++) g.push(new Array(size).fill(val)); return g;
  }
  function bit(x, i) { return ((x >>> i) & 1) === 1; }

  function build(text) {
    var bytes = utf8(text), v = 0;
    for (var t = 1; t <= 10; t++) {
      var need = 4 + (t < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= dataCapacity(t) * 8) { v = t; break; }
    }
    if (!v) throw new Error('Teks terlalu panjang untuk QR');
    var size = 17 + 4 * v;
    var m = newGrid(size, false), fn = newGrid(size, false);
    function set(r, c, val) { m[r][c] = !!val; fn[r][c] = true; }

    function finder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        var inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        var dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        set(r, c, dark);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (var i = 8; i <= size - 9; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var ap = ALIGN[v], last = ap[ap.length - 1];
    ap.forEach(function (ar) { ap.forEach(function (ac) {
      if ((ar === ap[0] && ac === ap[0]) || (ar === ap[0] && ac === last) || (ar === last && ac === ap[0])) return;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }); });
    // cadangkan area format (diisi per-mask) + modul gelap
    for (var k = 0; k < 9; k++) { fn[8][k] = true; fn[k][8] = true; }
    for (var k2 = 0; k2 < 8; k2++) { fn[8][size - 1 - k2] = true; fn[size - 1 - k2][8] = true; }
    set(size - 8, 8, true);
    if (v >= 7) {
      var rem = v;
      for (var q = 0; q < 12; q++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vbits = (v << 12) | rem;
      for (var vi = 0; vi < 18; vi++) {
        var a = size - 11 + (vi % 3), b = Math.floor(vi / 3);
        set(b, a, bit(vbits, vi)); set(a, b, bit(vbits, vi));
      }
    }

    // tempatkan data (zig-zag)
    var cw = buildCodewords(bytes, v), idx = 0, total = cw.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < total) { m[y][x] = bit(cw[idx >>> 3], 7 - (idx & 7)); idx++; }
      }
    }

    var MASKS = [
      function (r, c) { return (r + c) % 2 === 0; },
      function (r) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ];

    function withMask(mk) {
      var g = m.map(function (row) { return row.slice(); });
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!fn[r][c] && MASKS[mk](r, c)) g[r][c] = !g[r][c];
      // bit format: level M = 00
      var data = (0 << 3) | mk, rem = data;
      for (var i2 = 0; i2 < 10; i2++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function s(rr, cc, val) { g[rr][cc] = val; }
      for (var i = 0; i <= 5; i++) s(i, 8, bit(bits, i));
      s(7, 8, bit(bits, 6)); s(8, 8, bit(bits, 7)); s(8, 7, bit(bits, 8));
      for (var i3 = 9; i3 < 15; i3++) s(8, 14 - i3, bit(bits, i3));
      for (var i4 = 0; i4 < 8; i4++) s(8, size - 1 - i4, bit(bits, i4));
      for (var i5 = 8; i5 < 15; i5++) s(size - 15 + i5, 8, bit(bits, i5));
      s(size - 8, 8, true);
      return g;
    }

    function penalty(g) {
      var p = 0, r, c, n;
      function runs(get) {
        for (var a = 0; a < size; a++) {
          var run = 1;
          for (var b = 1; b < size; b++) {
            if (get(a, b) === get(a, b - 1)) run++;
            else { if (run >= 5) p += 3 + (run - 5); run = 1; }
          }
          if (run >= 5) p += 3 + (run - 5);
          // pola mirip finder 1:1:3:1:1 dengan 4 modul terang
          var line = ''; for (var b2 = 0; b2 < size; b2++) line += get(a, b2) ? '1' : '0';
          var pos = -1;
          while ((pos = line.indexOf('10111010000', pos + 1)) >= 0) p += 40;
          pos = -1;
          while ((pos = line.indexOf('00001011101', pos + 1)) >= 0) p += 40;
        }
      }
      runs(function (a, b) { return g[a][b]; });
      runs(function (a, b) { return g[b][a]; });
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
        if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
      }
      var dark = 0; for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (g[r][c]) dark++;
      n = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
      return p + Math.max(0, n) * 10;
    }

    var best = null, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var g = withMask(mk), pn = penalty(g);
      if (pn < bestP) { bestP = pn; best = g; }
    }
    return { size: size, version: v, modules: best };
  }

  function svg(text, opts) {
    opts = opts || {};
    var q = build(text), mg = opts.margin == null ? 4 : opts.margin, n = q.size + mg * 2, d = '';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.modules[r][c]) d += 'M' + (c + mg) + ' ' + (r + mg) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' +
      (opts.label || 'QR Code') + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  // Gambar ke kanvas: area px×px mulai (x,y), termasuk margin (quiet zone).
  function draw(ctx, text, x, y, px, margin) {
    var q = build(text), mg = margin == null ? 4 : margin, n = q.size + mg * 2, cell = px / n;
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, px, px);
    ctx.fillStyle = '#000';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.modules[r][c]) {
      ctx.fillRect(Math.floor(x + (c + mg) * cell), Math.floor(y + (r + mg) * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }

  var api = { build: build, svg: svg, draw: draw, _rs: rsRemainder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PASA = root.PASA || {}; root.PASA.qr = api; }
})(typeof window !== 'undefined' ? window : this);
