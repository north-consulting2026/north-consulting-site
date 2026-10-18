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
    form.classList.add('hidden');
    doneBox.classList.remove('hidden');
    doneBox.focus({ preventScroll: true });
    doneBox.scrollIntoView({ block: 'center' });
  });
})();
