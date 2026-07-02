(function () {
  'use strict';

  var API_BASE = '/api/blog';
  var LIST_CACHE_KEY = 'viva_blog_list_v1';
  var LIST_CACHE_TTL_MS = 2 * 60 * 1000;
  var listRequest = null;

  function apiFetch(path) {
    return fetch(API_BASE + path, {
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok || body.success === false) {
          throw new Error(body.error || 'Erro ao carregar conteúdo');
        }
        return body;
      });
    });
  }

  function readListCache() {
    try {
      var raw = sessionStorage.getItem(LIST_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || Date.now() - parsed.ts > LIST_CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (_e) {
      return null;
    }
  }

  function writeListCache(data) {
    try {
      sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_e) {}
  }

  function fetchBlogList() {
    if (listRequest) return listRequest;
    listRequest = apiFetch('/categories')
      .then(function (body) {
        var data = body.data || [];
        writeListCache(data);
        return data;
      })
      .finally(function () {
        listRequest = null;
      });
    return listRequest;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso));
    } catch (_e) {
      return '';
    }
  }

  function getSlugFromHash() {
    var hash = window.location.hash.replace(/^#/, '').trim();
    return hash || null;
  }

  function articleUrl(slug) {
    return '/blog/#' + encodeURIComponent(slug);
  }

  function renderBlogList(root, categories) {
    if (!categories.length) {
      root.innerHTML = '<p class="blog-empty">Nenhum artigo publicado ainda. Volte em breve.</p>';
      return;
    }

    var html = '';
    categories.forEach(function (cat, catIndex) {
      html += '<section class="content-block blog-category-block" style="animation-delay:' + catIndex * 0.08 + 's">';
      html += '<h2 class="blog-category-title">' + escapeHtml(cat.nome) + '</h2>';

      if (!cat.posts || !cat.posts.length) {
        html += '<p class="blog-empty-inline">Em breve — novos artigos nesta categoria.</p>';
      } else {
        html += '<div class="blog-grid">';
        cat.posts.forEach(function (post, postIndex) {
          var featured = catIndex === 0 && postIndex === 0;
          html += '<article class="blog-card' + (featured ? ' blog-card--featured' : '') + '">';
          if (post.capaUrl) {
            html += '<div class="blog-card-cover" style="background-image:url(' + escapeHtml(post.capaUrl) + ')"></div>';
          }
          html += '<div class="blog-card-body">';
          html += '<span class="blog-chip">' + escapeHtml(cat.nome) + '</span>';
          html += '<h3>' + escapeHtml(post.titulo) + '</h3>';
          if (post.resumo) html += '<p>' + escapeHtml(post.resumo) + '</p>';
          if (post.publicadoEm) {
            html += '<time class="blog-date" datetime="' + escapeHtml(post.publicadoEm) + '">' + formatDate(post.publicadoEm) + '</time>';
          }
          html += '<a class="blog-card-link" href="' + articleUrl(post.slug) + '">Ler artigo →</a>';
          html += '</div></article>';
        });
        html += '</div>';
      }

      html += '</section>';
    });

    root.innerHTML = html;
  }

  function renderComments(listEl, comentarios) {
    if (!comentarios.length) {
      listEl.innerHTML = '<p class="blog-comments-empty">Seja o primeiro a comentar.</p>';
      return;
    }

    listEl.innerHTML = comentarios
      .map(function (c) {
        var html = '<article class="blog-comment">';
        html += '<header class="blog-comment-header">';
        html += '<strong>' + escapeHtml(c.autorNome) + '</strong>';
        html += '<time datetime="' + escapeHtml(c.createdAt) + '">' + formatDate(c.createdAt) + '</time>';
        html += '</header>';
        html += '<p>' + escapeHtml(c.conteudo) + '</p>';
        if (c.resposta) {
          html += '<div class="blog-reply-official" role="note">';
          html += '<span class="blog-reply-badge">Equipe Viva Saúde</span>';
          html += '<p>' + escapeHtml(c.resposta.texto) + '</p>';
          html += '<time datetime="' + escapeHtml(c.resposta.respondidoEm) + '">' + formatDate(c.resposta.respondidoEm) + '</time>';
          html += '</div>';
        }
        html += '</article>';
        return html;
      })
      .join('');
  }

  function setView(mode) {
    var listView = document.getElementById('blog-list-view');
    var articleView = document.getElementById('blog-article-view');
    var hero = document.getElementById('blog-hero');
    var cta = document.getElementById('blog-cta');
    if (!listView || !articleView) return;

    if (mode === 'article') {
      listView.hidden = true;
      articleView.hidden = false;
      if (hero) hero.hidden = true;
      if (cta) cta.hidden = true;
    } else {
      listView.hidden = false;
      articleView.hidden = true;
      if (hero) hero.hidden = false;
      if (cta) cta.hidden = false;
    }
  }

  function loadArticle(slug) {
    var articleRoot = document.getElementById('blog-article-root');
    var commentsList = document.getElementById('blog-comments-list');
    var commentForm = document.getElementById('blog-comment-form');
    var feedback = document.getElementById('blog-comment-feedback');
    if (!articleRoot) return;

    setView('article');
    articleRoot.innerHTML = '<p class="blog-loading" aria-live="polite">Carregando artigo…</p>';

    apiFetch('/posts/' + encodeURIComponent(slug))
      .then(function (body) {
        var post = body.data.post;
        var comentarios = body.data.comentarios || [];

        document.title = (post.seoTitle || post.titulo) + ' | Blog Viva Saúde';

        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && (post.seoDescription || post.resumo)) {
          metaDesc.setAttribute('content', post.seoDescription || post.resumo);
        }

        var html = '';
        html += '<p class="blog-back"><a href="/blog/">← Voltar ao blog</a></p>';
        html += '<p class="blog-article-category">' + escapeHtml(post.categoria.nome) + '</p>';
        html += '<h1 class="blog-article-title">' + escapeHtml(post.titulo) + '</h1>';
        if (post.publicadoEm) {
          html += '<time class="blog-article-date" datetime="' + escapeHtml(post.publicadoEm) + '">' + formatDate(post.publicadoEm) + '</time>';
        }
        html += '<div class="blog-article-body">' + (post.conteudoHtml || '') + '</div>';

        articleRoot.innerHTML = html;

        if (commentsList) renderComments(commentsList, comentarios);

        if (commentForm && !commentForm.dataset.bound) {
          commentForm.dataset.bound = '1';
          commentForm.addEventListener('submit', function (ev) {
            ev.preventDefault();
            if (!feedback) return;

            var currentSlug = getSlugFromHash();
            if (!currentSlug) return;

            var nome = commentForm.querySelector('[name="autorNome"]');
            var email = commentForm.querySelector('[name="autorEmail"]');
            var conteudo = commentForm.querySelector('[name="conteudo"]');
            var lgpd = commentForm.querySelector('[name="consentimentoLgpd"]');
            var submitBtn = commentForm.querySelector('[type="submit"]');

            feedback.hidden = false;
            feedback.className = 'blog-comment-feedback';
            feedback.textContent = 'Enviando…';
            if (submitBtn) submitBtn.disabled = true;

            fetch(API_BASE + '/posts/' + encodeURIComponent(currentSlug) + '/comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                autorNome: nome && nome.value,
                autorEmail: email && email.value,
                conteudo: conteudo && conteudo.value,
                consentimentoLgpd: !!(lgpd && lgpd.checked),
              }),
            })
              .then(function (res) {
                return res.json().then(function (body) {
                  if (!res.ok || body.success === false) {
                    throw new Error(body.error || 'Não foi possível enviar o comentário');
                  }
                  return body;
                });
              })
              .then(function (body) {
                feedback.className = 'blog-comment-feedback is-success';
                feedback.textContent = body.message || 'Comentário recebido. Ele aparecerá após moderação.';
                commentForm.reset();
              })
              .catch(function (err) {
                feedback.className = 'blog-comment-feedback is-error';
                feedback.textContent = err.message;
              })
              .finally(function () {
                if (submitBtn) submitBtn.disabled = false;
              });
          });
        }
      })
      .catch(function () {
        articleRoot.innerHTML =
          '<p class="blog-error" role="alert">Artigo não encontrado. <a href="/blog/">Voltar ao blog</a></p>';
        if (commentsList) commentsList.innerHTML = '';
      });
  }

  function loadList() {
    var root = document.getElementById('blog-root');
    if (!root) return;

    setView('list');
    document.title = 'Blog | Viva Saúde';

    var cached = readListCache();
    if (cached) {
      renderBlogList(root, cached);
    } else {
      root.innerHTML = '<p class="blog-loading" aria-live="polite">Carregando artigos…</p>';
    }

    fetchBlogList()
      .then(function (data) {
        renderBlogList(root, data);
      })
      .catch(function (err) {
        if (!cached) {
          root.innerHTML =
            '<p class="blog-error" role="alert">Não foi possível carregar os artigos. ' + escapeHtml(err.message) + '</p>';
        }
      });
  }

  function route() {
    var slug = getSlugFromHash();
    if (slug) loadArticle(decodeURIComponent(slug));
    else loadList();
  }

  if (document.getElementById('blog-root')) {
    window.addEventListener('hashchange', route);
    // Legado: ?artigo=slug → #slug
    var legacy = new URLSearchParams(window.location.search).get('artigo');
    if (legacy && !window.location.hash) {
      window.location.replace('/blog/#' + encodeURIComponent(legacy.trim()));
      return;
    }
    route();
  }
})();
