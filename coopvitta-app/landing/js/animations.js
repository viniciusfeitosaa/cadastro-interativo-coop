/**
 * animations.js
 * Animações ao scroll usando Intersection Observer
 */
(function () {
  'use strict';

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { root: null, rootMargin: '0px', threshold: 0.12 }
  );

  document.addEventListener('DOMContentLoaded', function () {
    function revealIfVisible(el) {
      var rect = el.getBoundingClientRect();
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < viewH * 0.92 && rect.bottom > 0) {
        el.classList.add('is-visible');
        observer.unobserve(el);
      }
    }

    document.querySelectorAll('[data-animate], .steps-timeline').forEach(function (el) {
      revealIfVisible(el);
      observer.observe(el);
    });
  });
})();
