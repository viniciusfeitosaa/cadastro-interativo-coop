(function () {
  'use strict';

  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  function normalizeNavPath(path) {
    if (!path) return '/';
    var normalized = path.split('?')[0].split('#')[0];
    if (normalized.length > 1 && normalized.charAt(normalized.length - 1) === '/') {
      normalized = normalized.slice(0, -1);
    }
    if (normalized === '/index.html') return '/';
    return normalized;
  }

  function highlightCurrentNav() {
    if (!mainNav) return;
    var currentPath = normalizeNavPath(window.location.pathname);
    mainNav.querySelectorAll('.nav-links a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '/') return;
      var linkPath = normalizeNavPath(href);
      var isActive = linkPath === currentPath
        || (linkPath !== '/' && currentPath.indexOf(linkPath + '/') === 0);
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  highlightCurrentNav();

  if (mainNav && window.matchMedia('(max-width: 1280px)').matches) {
    mainNav.setAttribute('aria-hidden', mainNav.classList.contains('is-open') ? 'false' : 'true');
  }

  function setNavOpen(open) {
    if (!mainNav || !navToggle) return;
    mainNav.classList.toggle('is-open', open);
    navToggle.classList.toggle('is-active', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('nav-open', open);
    mainNav.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (navBackdrop) {
      navBackdrop.hidden = !open;
      navBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    document.documentElement.style.overflow = open ? 'hidden' : '';
    document.body.style.overflow = open ? 'hidden' : '';
  }

  var navBackdrop = document.getElementById('navBackdrop');
  if (!navBackdrop) {
    navBackdrop = document.createElement('button');
    navBackdrop.type = 'button';
    navBackdrop.id = 'navBackdrop';
    navBackdrop.className = 'nav-backdrop';
    navBackdrop.hidden = true;
    navBackdrop.setAttribute('aria-label', 'Fechar menu');
    navBackdrop.setAttribute('tabindex', '-1');
    document.body.appendChild(navBackdrop);
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setNavOpen(!mainNav.classList.contains('is-open'));
    });

    navBackdrop.addEventListener('click', function () {
      setNavOpen(false);
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setNavOpen(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
        setNavOpen(false);
        navToggle.focus();
      }
    });
  }

  fetch('design.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.site || !data.site.stats) return;
      var stats = data.site.stats;
      var map = {
        institutions: stats.institutions,
        professionals: stats.professionals,
        shifts: stats.shifts,
        states: stats.states
      };
      Object.keys(map).forEach(function (key) {
        document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) {
          if (map[key]) el.textContent = map[key];
        });
      });
    })
    .catch(function () {});

  // FAQ accordion: apenas um item aberto por vez na página (briefing)
  var faqItems = document.querySelectorAll('details.faq-item');
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item && other.open) other.open = false;
      });
    });
  });

  // Banner de cookies (LGPD)
  var cookieBanner = document.getElementById('cookieBanner');
  if (cookieBanner) {
    var CONSENT_KEY = 'viva_cookie_consent';
    var stored = null;
    try { stored = localStorage.getItem(CONSENT_KEY); } catch (e) {}

    function syncCookieBannerLayout() {
      if (cookieBanner.hidden) {
        document.documentElement.style.removeProperty('--cookie-banner-height');
        return;
      }
      var height = cookieBanner.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--cookie-banner-height', height + 'px');
    }

    function syncCookieBannerState() {
      var visible = !cookieBanner.hidden;
      document.body.classList.toggle('has-cookie-banner', visible);
      if (visible) {
        requestAnimationFrame(syncCookieBannerLayout);
      } else {
        document.documentElement.style.removeProperty('--cookie-banner-height');
      }
    }

    if (!stored) cookieBanner.hidden = false;
    syncCookieBannerState();

    window.addEventListener('resize', function () {
      if (!cookieBanner.hidden) syncCookieBannerLayout();
    });

    if (typeof ResizeObserver !== 'undefined') {
      var cookieResizeObserver = new ResizeObserver(syncCookieBannerLayout);
      cookieResizeObserver.observe(cookieBanner);
    }

    function setConsent(value) {
      try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
      cookieBanner.hidden = true;
      syncCookieBannerState();
    }
    document.getElementById('cookieAccept')?.addEventListener('click', function () {
      setConsent('all');
    });
    document.getElementById('cookieEssential')?.addEventListener('click', function () {
      setConsent('essential');
    });
  }

  var exitPopup = document.getElementById('exitPopup');
  var exitClose = document.getElementById('exitPopupClose');
  var exitShown = false;

  function showExitPopup() {
    if (exitShown || !exitPopup || sessionStorage.getItem('viva_exit_popup')) return;
    exitShown = true;
    sessionStorage.setItem('viva_exit_popup', '1');
    exitPopup.hidden = false;
  }

  if (exitPopup) {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) showExitPopup();
    });
    if (exitClose) {
      exitClose.addEventListener('click', function () {
        exitPopup.hidden = true;
      });
    }
    exitPopup.querySelector('.exit-popup-backdrop')?.addEventListener('click', function () {
      exitPopup.hidden = true;
    });
    var exitCta = document.getElementById('exitPopupCta');
    if (exitCta) {
      exitCta.addEventListener('click', function () {
        exitPopup.hidden = true;
      });
    }
  }

  var waScript = document.createElement('script');
  waScript.src = (function () {
    var current = document.currentScript;
    if (current && current.src) {
      return current.src.replace(/landing-ui\.js(\?.*)?$/, 'whatsapp-widget.js');
    }
    return document.querySelector('script[src*="landing-ui.js"]')
      ? document.querySelector('script[src*="landing-ui.js"]').src.replace(/landing-ui\.js(\?.*)?$/, 'whatsapp-widget.js')
      : 'js/whatsapp-widget.js';
  })();
  waScript.async = false;
  document.body.appendChild(waScript);
})();
