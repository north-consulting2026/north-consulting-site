(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var page = document.body.getAttribute('data-page');

  /* Header：スクロール後に影 */
  var header = document.getElementById('siteHeader');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Mobile menu */
  var menuBtn = document.getElementById('menuBtn');
  var mobileNav = document.getElementById('mobileNav');
  function setMenu(open) {
    mobileNav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }
  menuBtn.addEventListener('click', function () { setMenu(!mobileNav.classList.contains('is-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); } });

  /* Active nav：開いているページ（＋URLのハッシュ）で決定。スクロール連動はしない */
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav-page]'));
  function markActive() {
    var own = links.filter(function (a) { return a.getAttribute('data-nav-page') === page; });
    var hash = location.hash.slice(1);
    var hit = own.filter(function (a) { return a.getAttribute('data-nav-sec') === hash; });
    var current = hit.length ? hash : (own[0] && own[0].getAttribute('data-nav-sec'));
    links.forEach(function (a) {
      var on = a.getAttribute('data-nav-page') === page && a.getAttribute('data-nav-sec') === current;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
  }
  markActive();
  window.addEventListener('hashchange', function () { markActive(); setMenu(false); });

  /* Reveal */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var rvObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        en.target.style.transitionDelay = (parseInt(en.target.getAttribute('data-delay') || '0', 10)) + 'ms';
        en.target.classList.add('is-in'); rvObs.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    items.forEach(function (el) { rvObs.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('is-in'); }); }

  /* Contact form */
  var form = document.getElementById('contactForm');
  if (!form) { return; }
  var alertBox = document.getElementById('formError');
  var alertText = document.getElementById('formErrorText');
  var doneBox = document.getElementById('formDone');
  var submitted = false;

  function isIndividual() {
    var c = form.querySelector('input[name="kind"]:checked');
    return !!c && c.value.indexOf('稼働メンバー') === 0;
  }
  function setError(key, on) {
    var wrap = form.querySelector('[data-field="' + key + '"]');
    if (!wrap) { return; }
    wrap.classList.toggle('is-error', on);
    var input = wrap.querySelector('input, textarea, select');
    if (input) { input.setAttribute('aria-invalid', on ? 'true' : 'false'); }
  }
  function syncCompany() {
    var badge = document.getElementById('companyReq');
    var field = document.getElementById('company');
    var indiv = isIndividual();
    badge.textContent = indiv ? '任意' : '必須';
    badge.className = indiv ? 'opt' : 'req';
    field.placeholder = indiv ? '例）フリーランス／在籍企業名（任意）' : '例）株式会社ノース商事';
    if (indiv) { setError('company', false); }
  }
  form.querySelectorAll('input[name="kind"]').forEach(function (r) { r.addEventListener('change', syncCompany); });
  var kindMap = { indiv: '稼働メンバーとして働きたい', outsourcing: 'North Outsourcing' };
  var want = kindMap[new URLSearchParams(location.search).get('kind')];
  if (want) {
    form.querySelectorAll('input[name="kind"]').forEach(function (r) { r.checked = (r.value === want); });
  }
  syncCompany();

  var rules = {
    company: function () { return isIndividual() || form.company.value.trim() !== ''; },
    name:    function () { return form.name.value.trim() !== ''; },
    email:   function () { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()); },
    message: function () { return form.message.value.trim() !== ''; },
    agree:   function () { return document.getElementById('agree').checked; }
  };
  var labels = { company: '貴社名', name: 'お名前', email: 'メールアドレス', message: 'お問い合わせ内容', agree: '個人情報の取り扱いへの同意' };
  function validate(key) { var ok = rules[key](); setError(key, !ok); return ok; }
  function refreshAlert() {
    var missing = Object.keys(rules).filter(function (k) { return !rules[k](); });
    if (missing.length) {
      alertText.textContent = missing.length + '件の項目をご確認ください：' + missing.map(function (k) { return labels[k]; }).join('／');
      alertBox.classList.add('is-show');
    } else { alertBox.classList.remove('is-show'); }
    return missing;
  }
  Object.keys(rules).forEach(function (key) {
    var el = key === 'agree' ? document.getElementById('agree') : form[key];
    el.addEventListener(key === 'agree' ? 'change' : 'blur', function () { if (submitted || el.value) { validate(key); } });
    el.addEventListener('input', function () {
      var wrap = form.querySelector('[data-field="' + key + '"]');
      if (wrap && wrap.classList.contains('is-error')) { validate(key); }
      if (submitted) { refreshAlert(); }
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submitted = true;
    Object.keys(rules).forEach(validate);
    var missing = refreshAlert();
    if (missing.length) {
      var first = missing[0] === 'agree' ? document.getElementById('agree') : form[missing[0]];
      first.focus({ preventScroll: true });
      first.scrollIntoView({ block: 'center' });
      return;
    }
    sendForm();
  });

  /* 送信：data-endpoint があればそこへ送信。未設定なら、記入済みのメール作成画面を開く */
  function collect() {
    var kind = form.querySelector('input[name="kind"]:checked');
    var v = function (n) { return form[n] && form[n].value ? form[n].value.trim() : ''; };
    return [
      ['お問い合わせ種別', kind ? kind.value : ''], ['貴社名', v('company')], ['お名前', v('name')],
      ['部署・役職', v('dept')], ['メールアドレス', v('email')], ['電話番号', v('tel')],
      ['従業員規模', v('size')], ['想定する体制（人数）', v('headcount')], ['お問い合わせ内容', v('message')]
    ];
  }
  function showDone(title, text) {
    document.getElementById('formDoneTitle').textContent = title;
    document.getElementById('formDoneText').textContent = text;
    form.classList.add('hidden');
    doneBox.classList.remove('hidden');
    doneBox.focus({ preventScroll: true });
    doneBox.scrollIntoView({ block: 'center' });
  }
  function showSendError() {
    alertText.textContent = '送信できませんでした。お手数ですが ' + (form.getAttribute('data-mailto') || '') + ' まで直接ご連絡ください。';
    alertBox.classList.add('is-show');
  }
  function sendForm() {
    var rows = collect();
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    var btn = form.querySelector('button[type="submit"]');
    var honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) { showDone('送信が完了しました', ''); return; }   // 迷惑送信対策
    // ネット上に公開したページからのみ送信サービスを使う（パソコン上のファイルを開いた場合はメール作成画面へ）
    if (endpoint && /^https?:$/.test(location.protocol)) {
      var fd = new FormData();
      rows.forEach(function (r) { fd.append(r[0], r[1]); });
      fd.append('email', rows[4][1]);                       // 返信先（Reply-To）
      fd.append('_subject', '【Webお問い合わせ】' + rows[0][1] + '（' + (rows[1][1] || rows[2][1]) + '）');
      fd.append('_template', 'table');
      fd.append('_captcha', 'false');
      btn.disabled = true;
      fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok || String(r.j.success) !== 'true') { throw new Error('not sent'); }
          showDone('送信が完了しました', 'ありがとうございます。原則1営業日以内に、ご記入のメールアドレス宛に返信します。');
        })
        .catch(function () { openMail(rows); })
        .then(function () { btn.disabled = false; });
      return;
    }
    openMail(rows);
  }
  function openMail(rows) {
    var to = form.getAttribute('data-mailto') || '';
    var body = rows.map(function (r) { return '■' + r[0] + '\n' + (r[1] || '（未記入）'); }).join('\n\n');
    var href = 'mailto:' + to + '?subject=' + encodeURIComponent('【Webお問い合わせ】' + rows[0][1] + '（' + (rows[1][1] || rows[2][1]) + '）') + '&body=' + encodeURIComponent(body);
    window.location.href = href;
    showDone('メール作成画面を開きました', 'ご入力内容を記入したメールを作成しました。メールソフトで内容をご確認のうえ、送信してください。画面が開かない場合は ' + to + ' まで直接ご連絡ください。');
  }
})();

/* =========================================================
   トップ：ロゴそのものを地球に見立てる
   ロゴの球体の上を大陸がゆっくり自転し、横縞は緯線、中央の穴はロゴのまま。
   札幌から各地へ、光の弧が伸びる。
   大陸データ：Natural Earth（パブリックドメイン）を 1°×1° に変換したもの
   ========================================================= */
(function () {
  'use strict';
  var cv = document.getElementById('globeCanvas');
  if (!cv || !cv.getContext) { return; }
  var stage = cv.parentNode;
  var ctx = cv.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEG = Math.PI / 180;
  var VIEW_LAT = 22 * DEG;      // 少し北から見下ろす（日本が見えやすい）
  var TILT = 23.4 * DEG;        // 地軸の傾き
  var LAND_RLE = 'a0;a0;a0;a0;a0;a0;3x,d,5q;2m,o,f,p,5m;2h,p,3,15,1,8,5d;2c,q,3,1f,y,8,l,3,16,7,29;2c,9,1,c,8,1b,u,f,1v,7,28;1w,1,6,5,2,2,2,i,3,1i,u,8,3,1,25,5,23;1p,3,3,2,e,1,8,9,8,1g,x,4,3,2,28,2,23;1m,6,1,1,4,2,7,3,1,6,2,a,8,1f,2c,4,v,e,1v;1r,b,5,3,2,2,1,d,l,13,25,7,q,o,n,7,3,1,w;1l,2,8,2,g,1,3,a,n,12,24,3,r,o,1y;1k,8,a,1,4,3,2,5,3,2,2,7,l,z,23,3,n,13,4,5,c,3,11;1i,h,1,3,3,5,1,3,3,9,1,4,l,w,23,4,d,4,8,1c,a,8,x;0,2,1h,5,1,e,5,3,1,3,3,g,1,1,h,x,22,4,c,4,1,1l,2,k,s;j,d,k,1,9,g,5,5,3,l,d,u,1,2,19,7,11,6,1,2e,k;h,p,3,f,3,g,2,8,5,5,4,a,c,3,1,r,16,g,r,4,2,6,1,2n,1,9,1;0,2,c,1f,1,2,3,4,7,2,1,7,2,5,4,a,e,p,18,n,5,2,6,2,2,c,1,4,2,2x;0,5,a,2c,4,2,2,9,a,l,1b,r,3,2,2,p,1,2y;0,a,5,1,1,28,9,c,8,j,j,1,s,s,1,u,1,2z;1,8,4,2a,a,8,1,3,a,e,f,a,q,a,3,a,5,3w;5,3,6,4,1,21,2,4,4,d,d,c,h,8,p,b,3,b,2,3y,1;a,1,7,20,3,3,1,2,9,7,d,b,l,2,r,b,2,4d,1;f,21,8,2,2,1,1,2,2,1,3,4,g,8,1c,c,3,4f;e,21,f,7,m,7,1b,d,3,3t,1,3,2,9,7;f,h,1,1h,g,9,n,3,1c,e,2,3r,6,9,9;i,8,2,2,9,1a,h,9,3,2,1x,e,6,3g,1,5,5,4,g;k,1,1,4,g,19,f,f,1m,2,9,3,2,6,7,39,i,4,h;m,2,1,3,i,16,f,f,1k,4,e,5,5,1,1,38,g,7,h;k,2,p,19,b,g,1j,4,a,3,1,4,5,39,i,7,h;h,2,t,1b,7,j,1i,3,a,2,1,3,7,38,i,7,i;1d,1d,3,m,1c,3,2,4,9,2,5,3d,j,5,j;1b,1,2,1c,3,n,1a,4,2,4,6,3r,1,1,d,4,k;1f,1c,2,n,1a,4,1,6,3,3v,d,3,l;1g,1c,1,n,1f,6,2,3u,1,1,d,2,m;1g,1x,1,2,1e,4,3,3w,1,2,10;1h,1o,4,1,4,3,1i,3y,1,2,10;1j,1,1,1i,1,4,5,6,1c,41,2,1,11;1k,1n,6,6,1d,3z,3,1,11;1k,1o,3,1,1m,12,2,c,3,2e,3,1,11;1k,1s,1n,v,3,3,1,b,4,2e,16;1k,1k,2,2,1r,e,2,e,8,a,4,2d,5,3,10;1j,1j,1p,g,3,4,2,d,a,9,3,2c,6,5,y;1k,1h,1q,c,5,2,1,4,3,a,d,7,4,27,9,4,10;1k,1i,1p,c,9,5,2,a,3,5,4,8,5,24,a,1,13;1k,1e,1t,a,7,2,4,4,1,5,2,o,3,1w,1,7,b,2,12;1k,1e,1s,a,8,2,6,1,3,3,3,o,3,1v,1,2,2,3,c,2,12;1k,1d,1u,9,g,1,4,3,2,n,5,1s,7,4,a,3,12;1l,1c,1u,8,e,2,6,3,3,n,4,1t,1,2,4,3,9,3,13;1m,1a,1y,1,6,9,c,1,5,2l,5,4,6,5,13;1n,19,1y,3,1,d,d,2,7,1,2,2c,6,4,3,8,13;1n,18,1y,i,p,2c,b,6,17;1q,13,1z,j,o,2e,9,6,18;1r,11,1y,p,5,3,c,2e,9,2,1c;1r,10,1z,q,4,8,2,2,2,2g,8,2,1c;1s,1,2,w,1z,3o,1m;1s,2,1,j,1,4,5,3,1z,1m,2,20,1m;1u,1,1,g,d,2,1x,1o,3,1z,1m;1t,3,1,e,e,3,1u,1c,1,e,3,1x,1n;1u,2,2,d,f,2,2,1,1r,1c,2,e,4,1,2,1r,1o;1w,1,2,c,f,2,1t,1e,2,f,3,2,1,1q,1o;1w,2,2,b,2a,1e,2,f,2,3,a,1g,1,2,1m;1x,1,3,9,2a,1g,2,l,9,1d,3,2,1m;22,8,e,1,1,4,1p,1i,2,l,9,1a,5,1,1n;23,8,8,2,7,4,1n,1i,2,l,a,h,5,g,1,3,1w;22,9,6,4,9,4,1l,1i,3,i,f,e,5,f,3,1,1x;o,1,1e,9,5,4,e,4,1h,1h,4,h,f,c,8,d,3,2,1x;24,a,1,5,a,2,3,4,2,1,1e,1i,3,g,g,b,a,c,3,1,b,1,1m;26,e,20,1j,3,e,h,a,b,d,d,2,1m;28,c,1z,1k,4,a,k,9,c,e,c,3,1l;2e,b,1u,1l,3,9,m,6,i,b,b,2,1m;2g,9,1u,1m,2,7,o,6,i,b,b,2,1m;2i,7,1u,1n,1,4,s,5,i,b,c,3,1k;2k,5,1u,1p,v,5,i,2,1,8,c,1,1m;2m,2,b,1,1,2,1h,1n,6,2,o,5,j,1,3,6,d,1,2,1,1i;2m,3,7,a,1,2,1,1,1a,1u,p,4,i,2,3,5,b,1,3,1,1k;2n,3,3,1,2,4,1,a,1b,1t,p,3,1,1,h,2,5,2,g,1,1k;2p,3,1,k,1a,1s,q,1,2,1,h,2,n,3,1i;2r,1,2,j,1a,1r,u,2,h,2,l,1,1,3,1h;2v,k,19,1q,u,2,i,2,e,2,6,2,1i;2u,p,17,a,5,18,1b,1,3,3,c,4,1p;2u,r,16,2,c,17,1c,2,3,2,b,5,1p;2u,r,1o,12,1e,3,1,2,a,5,1q;2t,s,1o,11,1g,2,1,3,7,7,1q;2t,t,1n,10,1i,5,5,a,8,2,1f;2s,u,1n,z,1j,5,5,9,2,5,2,2,1f;2r,w,1m,y,1l,4,5,9,1,1,c,2,1a;2r,10,1i,x,1n,4,5,7,2,4,8,3,1a;2r,13,1g,v,1o,5,4,7,2,3,a,2,2,5,a,1,s;2r,17,1c,u,1q,4,7,3,3,1,1,2,5,2,3,b,10;2r,18,1c,t,1r,3,d,2,1,1,c,b,5,2,r;2r,1a,1b,r,1t,2,g,1,f,9,2,3,s;2r,1a,1b,r,1v,3,2,1,q,a,7,1,o;2s,19,1c,r,1u,8,o,a,w;2t,18,1c,q,22,2,2,2,1,1,5,1,b,1,1,4,2,2,b,1,k;2t,18,1c,r,27,2,3,1,m,3,a,1,j;2u,16,1d,r,31,2,t;2u,15,1f,r,2j,2,8,1,11;2v,13,1f,s,8,1,29,6,5,1,11;2v,12,1f,t,7,2,28,6,5,3,10;2w,11,1f,t,6,3,23,b,6,3,z;2x,10,1f,t,5,5,21,d,4,4,z;2y,z,1f,s,4,6,22,e,3,5,x,1;30,x,1f,q,6,6,20,o,w,1,1;31,w,1f,p,7,6,20,o,y;32,u,1h,m,9,5,20,r,w;32,u,1h,m,9,5,1x,v,f,1,f;32,t,1j,l,8,5,1v,y,g,2,d;32,t,1j,m,7,5,1u,11,t;31,q,1n,m,8,4,1t,12,t;31,o,1q,k,9,4,1u,12,s;31,n,1r,i,c,1,1w,13,r;31,n,1r,i,29,13,r;31,n,1r,i,29,13,r;30,n,1t,h,29,14,q;30,n,1u,f,2b,13,q;30,m,1v,e,2c,12,r;30,l,1x,c,2e,11,r;30,k,1y,b,2f,a,7,k,r;30,j,1z,9,2g,9,b,h,s;30,i,20,3,2m,4,g,1,1,e,t;2z,g,5g,c,m,1,6;2z,g,5h,a,o,1,5;2y,h,5h,a,p,2,3;2z,e,5l,2,1,2,r,5,1;2y,c,6k,3,3;2y,c,6l,2,3;2y,9,5u,3,o,2,6;2y,a,5t,3,n,3,6;2z,8,5v,1,n,3,7;2x,a,6h,4,8;2x,8,6h,5,9;2x,8,6j,2,a;2x,9,6u;2w,9,6v;2w,9,3s,2,31;2x,6,6x;2x,6,8,3,6m;2x,7,6w;2z,5,6w;2z,8,6t;32,2,6w;a0;a0;a0;a0;a0;a0;a0;3d,1,6m;3a,1,6p;37,3,4l,1,v,1,18;35,4,36,7,t,2,c,5,5,5,7,2,1,2,2,7,17;34,3,35,d,3,1,h,1s,y;34,3,2r,1,7,s,9,20,t;30,9,2n,12,7,2a,l;30,a,1v,6,1,1k,5,2h,i;2x,e,1e,28,2,2s,9;26,5,o,2,3,7,1c,54,9;1m,2,h,l,1,4,4,c,19,56,a;17,r,9,13,1a,52,e;y,29,1a,53,g;x,25,16,5c,g;m,2c,16,5g,g;h,3,2,28,s,6,8,5m,e;i,2,a,21,q,8,7,3,3,5b,j;x,23,7,2,1,2,6,9,f,5b,j;q,2i,m,5o,i;r,2m,4,64,f;r,8z,a;0,e,h,95;0,a0;0,a0;0,a0;0,a0;0,a0';
  // 1°×1° の陸地マスク
  var land = new Uint8Array(360 * 180);
  LAND_RLE.split(';').forEach(function (row, y) {
    var x = 0, v = 0;
    row.split(',').forEach(function (t) { var n = parseInt(t, 36); if (v) { for (var k = 0; k < n; k++) { land[y * 360 + x + k] = 1; } } x += n; v ^= 1; });
  });
  var logo = new Image();
  logo.src = 'assets/logo-globe.webp';
  var SPHERE = 0.4912;          // ロゴ画像の幅に対する球の半径
  var S = 0, L = 0, R = 0, cx = 0, cy = 0, dpr = 1;
  var N = 0, lat0 = null, lon0 = null, inDisc = null;
  var landCv = document.createElement('canvas'), landCtx = landCv.getContext('2d'), landImg = null;
  var maskCv = document.createElement('canvas'), maskCtx = maskCv.getContext('2d'), logoAlpha = null;
  var tmpCv = document.createElement('canvas'), tmpCtx = tmpCv.getContext('2d');

  function size() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    S = cv.width; cx = S / 2; cy = cv.height / 2;
    L = S * 0.80; R = L * SPHERE;
    // 大陸レイヤー（軽くするため最大 360px で計算して拡大）
    N = Math.min(520, Math.round(2 * R));
    landCv.width = landCv.height = N; landImg = landCtx.createImageData(N, N);
    lat0 = new Int16Array(N * N); lon0 = new Float32Array(N * N); inDisc = new Float32Array(N * N);
    var ca = Math.cos(VIEW_LAT), sa = Math.sin(VIEW_LAT), ct = Math.cos(TILT), st = Math.sin(TILT);
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var x3 = (i + 0.5) / N * 2 - 1, y3 = 1 - (j + 0.5) / N * 2, rr = x3 * x3 + y3 * y3, k = j * N + i;
        if (rr >= 1) { inDisc[k] = 0; continue; }
        var z2 = Math.sqrt(1 - rr);
        var x = x3 * ct + y3 * st, y2 = -x3 * st + y3 * ct;
        var y = y2 * ca + z2 * sa, z = -y2 * sa + z2 * ca;
        lat0[k] = Math.round((90 - Math.asin(y) / DEG) * 16);   // 1/16°単位
        lon0[k] = Math.atan2(x, z) / DEG;
        inDisc[k] = z2;   // 縁ほど暗くするための値
      }
    }
    maskCv.width = maskCv.height = tmpCv.width = tmpCv.height = Math.round(L);
    if (logo.complete && logo.naturalWidth) { prepLogo(); }
  }
  function prepLogo() {
    maskCtx.clearRect(0, 0, maskCv.width, maskCv.height);
    maskCtx.drawImage(logo, 0, 0, maskCv.width, maskCv.height);
    try { logoAlpha = maskCtx.getImageData(0, 0, maskCv.width, maskCv.height).data; } catch (e) { logoAlpha = null; }  // パソコン上のファイルを直接開いた場合は判定を省略
  }
  logo.onload = function () { if (S) { prepLogo(); } stage.classList.add('globe-live'); };

  function proj(lat, lon, rot) {
    var l = lon * DEG + rot, x = Math.cos(lat * DEG) * Math.sin(l), y = Math.sin(lat * DEG), z = Math.cos(lat * DEG) * Math.cos(l);
    var y2 = y * Math.cos(VIEW_LAT) - z * Math.sin(VIEW_LAT), z2 = y * Math.sin(VIEW_LAT) + z * Math.cos(VIEW_LAT);
    var x3 = x * Math.cos(TILT) - y2 * Math.sin(TILT), y3 = x * Math.sin(TILT) + y2 * Math.cos(TILT);
    return { x: cx + x3 * R, y: cy - y3 * R, z: z2 };
  }
  function onLogo(p) { // ロゴの塗り（縞・穴を除く）の上にあるか
    if (!logoAlpha) { return true; }
    var lx = Math.round(p.x - (cx - L / 2)), ly = Math.round(p.y - (cy - L / 2)), w = maskCv.width;
    if (lx < 0 || ly < 0 || lx >= w || ly >= w) { return false; }
    return logoAlpha[(ly * w + lx) * 4 + 3] > 140;
  }
  function slerp(p, q, t) {
    var a1 = p[0] * DEG, o1 = p[1] * DEG, a2 = q[0] * DEG, o2 = q[1] * DEG;
    var ax = Math.cos(a1) * Math.cos(o1), ay = Math.cos(a1) * Math.sin(o1), az = Math.sin(a1);
    var bx = Math.cos(a2) * Math.cos(o2), by = Math.cos(a2) * Math.sin(o2), bz = Math.sin(a2);
    var d = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))) || 1e-6;
    var s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    var x = s1 * ax + s2 * bx, y = s1 * ay + s2 * by, z = s1 * az + s2 * bz;
    return [Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG, Math.atan2(y, x) / DEG];
  }
  // 拠点：札幌（本社）を起点に
  var nodes = [[43.06, 141.35], [35.68, 139.69], [34.69, 135.50], [33.59, 130.40], [26.21, 127.68], [37.57, 126.98], [25.03, 121.56],
               [22.32, 114.17], [1.35, 103.82], [13.75, 100.5], [-33.87, 151.21], [37.77, -122.42], [40.71, -74.0], [51.51, -0.13], [48.86, 2.35], [25.2, 55.27]];
  var arcs = [], last = 0, t0 = performance.now();

  function drawLand(rot) {
    var d = landImg.data, r0 = rot / DEG;
    for (var k = 0, n = N * N; k < n; k++) {
      var e = inDisc[k], o = k * 4;
      if (!e) { d[o + 3] = 0; continue; }
      var lon = lon0[k] - r0; lon = ((lon + 180) % 360 + 360) % 360 - 0.5;
      var la = lat0[k] / 16 - 0.5;
      // 近傍4点をなめらかに補間して、海岸線のギザギザをなくす
      var x0 = Math.floor(lon), y0 = Math.floor(la), fx = lon - x0, fy = la - y0;
      var xa = (x0 + 360) % 360, xb = (x0 + 1) % 360, ya = Math.max(0, Math.min(179, y0)), yb = Math.max(0, Math.min(179, y0 + 1));
      var v = (land[ya * 360 + xa] * (1 - fx) + land[ya * 360 + xb] * fx) * (1 - fy) + (land[yb * 360 + xa] * (1 - fx) + land[yb * 360 + xb] * fx) * fy;
      var isLand = Math.max(0, Math.min(1, (v - 0.5) * 3 + 0.5));
      // 陸：明るい緑、海：ロゴの深緑をそのまま見せる（透明）
      d[o] = 168; d[o + 1] = 214; d[o + 2] = 188;
      d[o + 3] = Math.round(255 * isLand * (0.20 + 0.42 * e));
    }
    landCtx.putImageData(landImg, 0, 0);
  }
  function frame(now) {
    var t = (now - t0) / 1000;
    var rot = (-150 * DEG) + (reduced ? 0 : t * (2 * Math.PI / 80));   // 約80秒で1回転
    ctx.clearRect(0, 0, S, cv.height);
    if (!logo.complete || !logo.naturalWidth) { requestAnimationFrame(frame); return; }
    var ox = cx - L / 2, oy = cy - L / 2;
    // 大気の光
    var g = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.16);
    g.addColorStop(0, 'rgba(74,123,100,.16)'); g.addColorStop(1, 'rgba(74,123,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.fill();
    // ロゴ（海）
    ctx.drawImage(logo, ox, oy, L, L);
    // 大陸：ロゴの形（縞・穴）で切り抜いて重ねる
    drawLand(rot);
    tmpCtx.clearRect(0, 0, tmpCv.width, tmpCv.height);
    tmpCtx.globalCompositeOperation = 'source-over';
    tmpCtx.imageSmoothingEnabled = true;
    tmpCtx.drawImage(landCv, L / 2 - R, L / 2 - R, 2 * R, 2 * R);
    tmpCtx.globalCompositeOperation = 'destination-in';
    tmpCtx.drawImage(logo, 0, 0, L, L);
    ctx.drawImage(tmpCv, ox, oy);
    // 光の弧（手前を向いている拠点同士）
    if (!reduced && now - last > 1100 && arcs.length < 4) {
      var vis = nodes.map(function (n, i) { return proj(n[0], n[1], rot).z > 0.3 ? i : -1; }).filter(function (i) { return i >= 0; });
      if (vis.length >= 2) {
        var a = vis.indexOf(0) >= 0 && Math.random() < 0.65 ? 0 : vis[Math.floor(Math.random() * vis.length)];
        var b = vis[Math.floor(Math.random() * vis.length)]; if (a === b) { b = vis[(vis.indexOf(b) + 1) % vis.length]; }
        arcs.push({ a: a, b: b, t: 0 });
      }
      last = now;
    }
    arcs = arcs.filter(function (a) { return a.t < 1.6; });
    ctx.lineCap = 'round';
    arcs.forEach(function (arc) {
      arc.t += 0.009;
      var head = Math.min(arc.t, 1), tail = Math.max(0, arc.t - 0.6), fade = arc.t > 1 ? Math.max(0, 1 - (arc.t - 1) / 0.6) : 1;
      var pts = [];
      for (var k = 0; k <= 36; k++) {
        var u = tail + (head - tail) * (k / 36), q = slerp(nodes[arc.a], nodes[arc.b], u), p = proj(q[0], q[1], rot);
        var lift = 1 + 0.10 * Math.sin(Math.PI * u);
        pts.push({ x: cx + (p.x - cx) * lift, y: cy + (p.y - cy) * lift, z: p.z, on: onLogo(p) });
      }
      for (var i = 1; i < pts.length; i++) {
        if (pts[i].z < 0 || !pts[i].on || !pts[i - 1].on) { continue; }   // 穴の上には描かない
        ctx.strokeStyle = 'rgba(235,245,239,' + (0.85 * fade).toFixed(3) + ')';
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      if (arc.t < 1 && pts[pts.length - 1].on) {
        var h = pts[pts.length - 1], hg = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 8 * dpr);
        hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(h.x, h.y, 8 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    });
    // 拠点（ロゴの塗りの上にあるものだけ）
    nodes.forEach(function (n, i) {
      var p = proj(n[0], n[1], rot);
      if (p.z < 0.05 || !onLogo(p)) { return; }
      ctx.fillStyle = 'rgba(255,255,255,' + (i === 0 ? 0.98 : 0.55 + 0.4 * p.z).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, (i === 0 ? 3 : 1.8) * dpr, 0, Math.PI * 2); ctx.fill();
      if (i === 0) {
        var ph = (t % 2.4) / 2.4;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.arc(p.x, p.y, (4 + 12 * ph) * dpr, 0, Math.PI * 2); ctx.stroke();
      }
    });
    if (!reduced) { requestAnimationFrame(frame); }
  }
  size(); window.addEventListener('resize', size);
  requestAnimationFrame(frame);
})();
