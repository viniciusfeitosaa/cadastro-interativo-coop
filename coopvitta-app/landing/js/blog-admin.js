(function () {
  'use strict';

  var TOKEN_KEY = 'blogAdminToken';
  var API = '/api';
  var state = {
    categories: [],
    editingId: null,
    commentStatus: 'PENDENTE',
    publishOnSave: false,
  };

  function $(sel) { return document.querySelector(sel); }

  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function adminFetch(path, options) {
    var opts = options || {};
    opts.headers = opts.headers || {};
    opts.headers.Accept = 'application/json';
    var token = getToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(API + path, opts).then(function (res) {
      return res.json().then(function (body) {
        if (res.status === 401) {
          logout();
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        if (!res.ok || body.success === false) {
          throw new Error(body.error || 'Erro na operação');
        }
        return body;
      });
    });
  }

  function showFeedback(el, msg, type) {
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = 'blog-admin-feedback' + (type ? ' is-' + type : '');
  }

  function showLogin() {
    document.body.classList.remove('blog-admin-page--panel');
    document.body.classList.add('blog-admin-page--login');
    var loginShell = document.getElementById('blog-admin-login-shell');
    var panel = document.getElementById('blog-admin-panel');
    if (loginShell) {
      loginShell.hidden = false;
      loginShell.setAttribute('aria-hidden', 'false');
    }
    if (panel) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  function showPanel(userLabel) {
    document.body.classList.remove('blog-admin-page--login');
    document.body.classList.add('blog-admin-page--panel');
    var loginShell = document.getElementById('blog-admin-login-shell');
    var panel = document.getElementById('blog-admin-panel');
    var userEl = document.getElementById('blog-admin-user');
    if (loginShell) {
      loginShell.hidden = true;
      loginShell.setAttribute('aria-hidden', 'true');
    }
    if (panel) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
    }
    if (userEl) userEl.textContent = userLabel ? 'Conectado como ' + userLabel : 'Administrador';
  }

  function logout() {
    setToken(null);
    showLogin();
  }

  function switchTab(tab) {
    document.querySelectorAll('.blog-admin-tab').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var workspace = $('#blog-admin-workspace');
    var sidebar = $('#blog-admin-sidebar');
    var viewPosts = $('#blog-admin-view-posts');
    var viewComments = $('#blog-admin-view-comments');
    var isComments = tab === 'comments';

    if (workspace) workspace.classList.toggle('is-comments-mode', isComments);
    if (sidebar) sidebar.hidden = isComments;
    if (viewPosts) viewPosts.hidden = isComments;
    if (viewComments) viewComments.hidden = !isComments;

    if (isComments) loadComments();
    else loadPosts();
  }

  function resetPostForm() {
    state.editingId = null;
    var form = $('#blog-admin-post-form');
    if (!form) return;
    form.reset();
    form.querySelector('[name="id"]').value = '';
    var title = $('#blog-admin-form-title');
    if (title) title.textContent = 'Novo artigo';
    var cancel = $('#blog-admin-post-cancel');
    if (cancel) cancel.hidden = true;
    if (state.categories.length) {
      form.querySelector('[name="categoryId"]').value = state.categories[0].id;
    }
    document.querySelectorAll('.blog-admin-post-item').forEach(function (el) {
      el.classList.remove('is-selected');
    });
  }

  function fillCategoriesSelect(preferredId) {
    var sel = document.querySelector('#blog-admin-post-form [name="categoryId"]');
    if (!sel) return;
    var current = preferredId || sel.value;
    sel.innerHTML = state.categories
      .map(function (c) {
        return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.nome) + '</option>';
      })
      .join('');
    if (current && state.categories.some(function (c) { return c.id === current; })) {
      sel.value = current;
    } else if (state.categories.length) {
      sel.value = state.categories[0].id;
    }
  }

  function renderCategoryManage() {
    var list = $('#blog-admin-category-list');
    if (!list) return;
    if (!state.categories.length) {
      list.innerHTML = '<li class="blog-admin-category-empty">Nenhuma categoria cadastrada.</li>';
      return;
    }
    list.innerHTML = state.categories
      .map(function (c) {
        var hasPosts = (c.postsCount || 0) > 0;
        var meta = hasPosts
          ? c.postsCount + (c.postsCount === 1 ? ' artigo' : ' artigos')
          : 'Sem artigos';
        var html = '<li class="blog-admin-category-item">';
        html += '<div class="blog-admin-category-item-info">';
        html += '<span class="blog-admin-category-item-name">' + escapeHtml(c.nome) + '</span>';
        html += '<span class="blog-admin-category-item-meta">' + escapeHtml(meta) + '</span>';
        html += '</div>';
        if (hasPosts) {
          html += '<button type="button" class="btn btn-ghost btn-sm" disabled title="Exclua ou mova os artigos antes">Excluir</button>';
        } else {
          html += '<button type="button" class="btn btn-ghost btn-sm blog-admin-category-delete" data-category-id="' + escapeHtml(c.id) + '">Excluir</button>';
        }
        html += '</li>';
        return html;
      })
      .join('');
  }

  function loadCategories() {
    return adminFetch('/admin/blog/categories').then(function (body) {
      state.categories = body.data || [];
      fillCategoriesSelect();
      renderCategoryManage();
    });
  }

  function createCategory(nome) {
    var feedback = $('#blog-admin-category-feedback');
    if (feedback) feedback.hidden = true;
    return adminFetch('/admin/blog/categories', {
      method: 'POST',
      body: { nome: nome },
    })
      .then(function (body) {
        var created = body.data;
        if (feedback) {
          showFeedback(feedback, 'Categoria "' + created.nome + '" criada.', 'success');
        }
        var form = $('#blog-admin-category-form');
        if (form) {
          var nomeInput = form.querySelector('[name="nome"]');
          if (nomeInput) nomeInput.value = '';
        }
        return loadCategories().then(function () {
          if (created && created.id) {
            fillCategoriesSelect(created.id);
          }
        });
      })
      .catch(function (err) {
        if (feedback) showFeedback(feedback, err.message, 'error');
      });
  }

  function deleteCategory(id) {
    var cat = state.categories.find(function (c) { return c.id === id; });
    if (!cat) return;
    if (!window.confirm('Excluir a categoria "' + cat.nome + '"?')) return;
    var feedback = $('#blog-admin-category-feedback');
    if (feedback) feedback.hidden = true;
    adminFetch('/admin/blog/categories/' + id, { method: 'DELETE' })
      .then(function () {
        if (feedback) showFeedback(feedback, 'Categoria excluída.', 'success');
        return loadCategories();
      })
      .catch(function (err) {
        if (feedback) showFeedback(feedback, err.message, 'error');
      });
  }

  function renderPostsList(posts) {
    var list = $('#blog-admin-posts-list');
    if (!list) return;
    if (!posts.length) {
      list.innerHTML = '<p class="blog-admin-muted">Nenhum artigo ainda.</p>';
      return;
    }
    list.innerHTML = posts
      .map(function (p) {
        var statusClass =
          p.status === 'PUBLICADO' ? 'is-published' : p.status === 'RASCUNHO' ? 'is-draft' : 'is-archived';
        var statusLabel =
          p.status === 'PUBLICADO' ? 'Publicado' : p.status === 'RASCUNHO' ? 'Rascunho' : 'Arquivado';
        var html = '<article class="blog-admin-post-item ' + statusClass + '" data-post-id="' + escapeHtml(p.id) + '">';
        html += '<div class="blog-admin-post-item-main">';
        html += '<span class="blog-admin-status-pill ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>';
        html += '<strong class="blog-admin-post-item-title">' + escapeHtml(p.titulo) + '</strong>';
        html += '<span class="blog-admin-post-meta">' + escapeHtml(p.categoria.nome) + '</span>';
        html += '</div>';
        html += '<div class="blog-admin-post-actions">';
        html += '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + escapeHtml(p.id) + '">Editar</button>';
        if (p.status !== 'PUBLICADO') {
          html += '<button type="button" class="btn btn-primary btn-sm" data-publish="' + escapeHtml(p.id) + '">Publicar</button>';
        } else {
          html += '<a class="btn btn-ghost btn-sm" href="/blog/#' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Ver</a>';
        }
        if (p.status !== 'ARQUIVADO') {
          html += '<button type="button" class="btn btn-ghost btn-sm" data-archive="' + escapeHtml(p.id) + '">Arquivar</button>';
        }
        html += '</div></article>';
        return html;
      })
      .join('');
  }

  function loadPosts() {
    var list = $('#blog-admin-posts-list');
    if (!list) return;
    var hasItems = list.querySelector('.blog-admin-post-item');
    if (!hasItems) {
      list.innerHTML = '<p class="blog-admin-muted">Carregando…</p>';
    }
    adminFetch('/admin/blog/posts?limit=50')
      .then(function (body) {
        renderPostsList(body.data || []);
      })
      .catch(function (err) {
        list.innerHTML = '<p class="blog-admin-feedback is-error">' + escapeHtml(err.message) + '</p>';
      });
  }

  function editPost(id) {
    adminFetch('/admin/blog/posts/' + id).then(function (body) {
      var p = body.data;
      state.editingId = p.id;
      var form = $('#blog-admin-post-form');
      if (!form) return;
      form.querySelector('[name="id"]').value = p.id;
      form.querySelector('[name="titulo"]').value = p.titulo;
      form.querySelector('[name="slug"]').value = p.slug;
      form.querySelector('[name="categoryId"]').value = p.categoryId;
      form.querySelector('[name="resumo"]').value = p.resumo;
      form.querySelector('[name="conteudo"]').value = p.conteudo;
      form.querySelector('[name="capaUrl"]').value = p.capaUrl || '';
      var title = $('#blog-admin-form-title');
      if (title) title.textContent = 'Editar artigo';
      var cancel = $('#blog-admin-post-cancel');
      if (cancel) cancel.hidden = false;
      var editor = document.querySelector('.blog-admin-editor-panel');
      if (editor) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function savePost(status) {
    var form = $('#blog-admin-post-form');
    var feedback = $('#blog-admin-post-feedback');
    if (!form) return;

    var payload = {
      titulo: form.querySelector('[name="titulo"]').value.trim(),
      slug: form.querySelector('[name="slug"]').value.trim() || undefined,
      categoryId: form.querySelector('[name="categoryId"]').value,
      resumo: form.querySelector('[name="resumo"]').value.trim(),
      conteudo: form.querySelector('[name="conteudo"]').value.trim(),
      capaUrl: form.querySelector('[name="capaUrl"]').value.trim() || null,
      status: status,
    };

    var req = state.editingId
      ? adminFetch('/admin/blog/posts/' + state.editingId, { method: 'PUT', body: payload })
      : adminFetch('/admin/blog/posts', { method: 'POST', body: payload });

    req
      .then(function () {
        showFeedback(feedback, status === 'PUBLICADO' ? 'Artigo publicado.' : 'Rascunho salvo.', 'success');
        resetPostForm();
        loadPosts();
      })
      .catch(function (err) {
        showFeedback(feedback, err.message, 'error');
      });
  }

  function updatePendingBadge() {
    adminFetch('/admin/blog/comments?status=PENDENTE&limit=1').then(function (body) {
      var badge = $('#blog-admin-pending-badge');
      var n = body.pendentes || 0;
      if (!badge) return;
      if (n > 0) {
        badge.hidden = false;
        badge.textContent = String(n);
      } else {
        badge.hidden = true;
      }
    }).catch(function () {});
  }

  function loadComments() {
    var list = $('#blog-admin-comments-list');
    if (!list) return;
    list.innerHTML = '<p class="blog-admin-muted">Carregando…</p>';
    adminFetch('/admin/blog/comments?status=' + encodeURIComponent(state.commentStatus) + '&limit=50')
      .then(function (body) {
        updatePendingBadge();
        var items = body.data || [];
        if (!items.length) {
          list.innerHTML = '<p class="blog-admin-muted">Nenhum comentário nesta aba.</p>';
          return;
        }
        list.innerHTML = items.map(renderCommentItem).join('');
        bindCommentActions(list);
      })
      .catch(function (err) {
        list.innerHTML = '<p class="blog-admin-feedback is-error">' + escapeHtml(err.message) + '</p>';
      });
  }

  function renderCommentItem(c) {
    var html = '<article class="blog-admin-comment-item" data-id="' + escapeHtml(c.id) + '">';
    html += '<header><strong>' + escapeHtml(c.autorNome) + '</strong> · ' + escapeHtml(c.autorEmail);
    html += '<span class="blog-admin-post-meta"> · ' + escapeHtml(c.post.titulo) + '</span></header>';
    html += '<p>' + escapeHtml(c.conteudo) + '</p>';
    if (c.respostaTexto) {
      html += '<div class="blog-reply-official"><span class="blog-reply-badge">Equipe Viva Saúde</span><p>' + escapeHtml(c.respostaTexto) + '</p></div>';
    }
    html += '<div class="blog-admin-post-actions">';
    if (c.status === 'PENDENTE') {
      html += '<button type="button" class="btn btn-primary btn-sm" data-approve="' + escapeHtml(c.id) + '">Aprovar</button>';
      html += '<button type="button" class="btn btn-ghost btn-sm" data-reject="' + escapeHtml(c.id) + '">Rejeitar</button>';
    }
    html += '<button type="button" class="btn btn-ghost btn-sm" data-reply-toggle="' + escapeHtml(c.id) + '">' + (c.respostaTexto ? 'Editar resposta' : 'Responder') + '</button>';
    html += '</div>';
    html += '<div class="blog-admin-reply-box" hidden><textarea rows="3" placeholder="Resposta oficial…">' + escapeHtml(c.respostaTexto || '') + '</textarea>';
    html += '<button type="button" class="btn btn-primary btn-sm" data-reply-send="' + escapeHtml(c.id) + '">Publicar resposta</button></div>';
    html += '</article>';
    return html;
  }

  function bindCommentActions(list) {
    list.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        adminFetch('/admin/blog/comments/' + btn.getAttribute('data-approve') + '/aprovar', { method: 'PATCH' })
          .then(loadComments)
          .catch(function (err) { alert(err.message); });
      });
    });
    list.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('Rejeitar comentário?')) return;
        adminFetch('/admin/blog/comments/' + btn.getAttribute('data-reject') + '/rejeitar', { method: 'PATCH' })
          .then(loadComments)
          .catch(function (err) { alert(err.message); });
      });
    });
    list.querySelectorAll('[data-reply-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.blog-admin-comment-item');
        var box = item && item.querySelector('.blog-admin-reply-box');
        if (box) box.hidden = !box.hidden;
      });
    });
    list.querySelectorAll('[data-reply-send]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.blog-admin-comment-item');
        var textarea = item && item.querySelector('textarea');
        if (!textarea || !textarea.value.trim()) return;
        adminFetch('/admin/blog/comments/' + btn.getAttribute('data-reply-send') + '/responder', {
          method: 'POST',
          body: { respostaTexto: textarea.value.trim() },
        })
          .then(loadComments)
          .catch(function (err) { alert(err.message); });
      });
    });
  }

  function initPanel() {
    switchTab('posts');
    return loadCategories()
      .then(function () {
        loadPosts();
        updatePendingBadge();
      })
      .catch(function (err) {
        alert(err.message || 'Não foi possível carregar o painel.');
        logout();
      });
  }

  function bootstrapSession() {
    var token = getToken();
    if (!token) {
      showLogin();
      return;
    }

    adminFetch('/admin/blog/categories')
      .then(function (body) {
        state.categories = body.data || [];
        fillCategoriesSelect();
        renderCategoryManage();
        showPanel('Administrador');
        switchTab('posts');
        loadPosts();
        updatePendingBadge();
      })
      .catch(function () {
        setToken(null);
        showLogin();
      });
  }

  function bindEvents() {
    var loginForm = $('#blog-admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var errEl = $('#blog-admin-login-error');
        var email = loginForm.querySelector('[name="email"]').value.trim().toLowerCase();
        var password = loginForm.querySelector('[name="password"]').value;
        if (errEl) errEl.hidden = true;

        fetch(API + '/auth/login-master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email: email, password: password }),
        })
          .then(function (res) {
            return res.json().then(function (body) {
              if (!res.ok || body.success === false) {
                throw new Error(body.error || 'Credenciais inválidas');
              }
              return body;
            });
          })
          .then(function (body) {
            var token = body.data && body.data.accessToken;
            if (!token) throw new Error('Resposta de login inválida');
            setToken(token);
            showPanel(email);
            initPanel();
          })
          .catch(function (err) {
            if (errEl) {
              errEl.hidden = false;
              errEl.textContent = err.message;
            }
          });
      });
    }

    var logoutBtn = $('#blog-admin-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    document.querySelectorAll('.blog-admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    document.querySelectorAll('.blog-admin-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.blog-admin-filter').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        state.commentStatus = btn.getAttribute('data-status') || 'PENDENTE';
        loadComments();
      });
    });

    var postForm = $('#blog-admin-post-form');
    if (postForm) {
      postForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        savePost('RASCUNHO');
      });
      postForm.querySelector('[data-action="publish"]').addEventListener('click', function () {
        savePost('PUBLICADO');
      });
    }

    var cancelBtn = $('#blog-admin-post-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', resetPostForm);

    var postsList = $('#blog-admin-posts-list');
    if (postsList) {
      postsList.addEventListener('click', function (ev) {
        var editBtn = ev.target.closest('[data-edit]');
        if (editBtn && postsList.contains(editBtn)) {
          postsList.querySelectorAll('.blog-admin-post-item').forEach(function (el) {
            el.classList.remove('is-selected');
          });
          var item = editBtn.closest('.blog-admin-post-item');
          if (item) item.classList.add('is-selected');
          editPost(editBtn.getAttribute('data-edit'));
          return;
        }
        var publishBtn = ev.target.closest('[data-publish]');
        if (publishBtn && postsList.contains(publishBtn)) {
          adminFetch('/admin/blog/posts/' + publishBtn.getAttribute('data-publish') + '/publicar', { method: 'PATCH' })
            .then(function () { loadPosts(); updatePendingBadge(); })
            .catch(function (err) { alert(err.message); });
          return;
        }
        var archiveBtn = ev.target.closest('[data-archive]');
        if (archiveBtn && postsList.contains(archiveBtn)) {
          if (!window.confirm('Arquivar este artigo?')) return;
          adminFetch('/admin/blog/posts/' + archiveBtn.getAttribute('data-archive') + '/arquivar', { method: 'PATCH' })
            .then(loadPosts)
            .catch(function (err) { alert(err.message); });
        }
      });
    }

    var newPostBtn = $('#blog-admin-new-post');
    if (newPostBtn) {
      newPostBtn.addEventListener('click', function () {
        resetPostForm();
        var titulo = document.querySelector('#blog-admin-post-form [name="titulo"]');
        if (titulo) titulo.focus();
        document.querySelectorAll('.blog-admin-post-item').forEach(function (el) {
          el.classList.remove('is-selected');
        });
      });
    }

    var categoryToggle = $('#blog-admin-category-toggle');
    var categoryManage = $('#blog-admin-category-manage');
    if (categoryToggle && categoryManage) {
      categoryToggle.addEventListener('click', function () {
        var opening = categoryManage.hidden;
        categoryManage.hidden = !opening;
        categoryToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
        categoryToggle.textContent = opening ? 'Fechar' : 'Gerenciar';
        if (opening) renderCategoryManage();
      });
    }

    var categoryForm = $('#blog-admin-category-form');
    var categoryAddBtn = $('#blog-admin-category-add-btn');
    function submitNewCategory() {
      if (!categoryForm) return;
      var input = categoryForm.querySelector('[name="nome"]');
      if (!input) return;
      var nome = input.value.trim();
      if (nome.length < 2) return;
      createCategory(nome);
    }
    if (categoryForm) {
      categoryForm.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          submitNewCategory();
        }
      });
    }
    if (categoryAddBtn) {
      categoryAddBtn.addEventListener('click', submitNewCategory);
    }

    var categoryList = $('#blog-admin-category-list');
    if (categoryList) {
      categoryList.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.blog-admin-category-delete');
        if (btn && categoryList.contains(btn)) {
          deleteCategory(btn.getAttribute('data-category-id'));
        }
      });
    }
  }

  bindEvents();
  bootstrapSession();
})();
