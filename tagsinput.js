/*!
 * TagsInput.js v1.0.0
 * Vanilla JS tag input field — zero dependencies
 * https://github.com/your-org/tagsinput
 * MIT License
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory()
    : typeof define === 'function' && define.amd
      ? define(factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TagsInput = factory());
}(this, function () {
  'use strict';

  /**
   * @typedef {Object} TagsInputOptions
   * @property {string[]}  [initialTags=[]]       - Tags pré-remplis au démarrage
   * @property {string[]}  [separators=[',']]      - Caractères déclenchant l'ajout (en plus de Entrée)
   * @property {number}    [maxTags=Infinity]      - Nombre maximum de tags autorisés
   * @property {number}    [minLength=1]           - Longueur minimale d'un tag
   * @property {number}    [maxLength=Infinity]    - Longueur maximale d'un tag
   * @property {boolean}   [allowDuplicates=false] - Autoriser les valeurs dupliquées
   * @property {boolean}   [caseSensitive=true]    - Comparaison sensible à la casse pour les doublons
   * @property {Function}  [validate]              - Fonction de validation : (value: string) => boolean
   * @property {Function}  [transform]             - Normalisation avant validation : (value: string) => string
   * @property {string[]}  [suggestions=[]]        - Valeurs pour l'autocomplete
   * @property {number}    [suggestionsLimit=6]    - Nombre max de suggestions affichées
   * @property {string}    [theme='']              - Thème CSS : '' | 'blue' | 'red'
   * @property {string}    [placeholder='']        - Placeholder de l'input interne
   * @property {boolean}   [readonly=false]        - Mode lecture seule (tags visibles, pas d'édition)
   * @property {boolean}   [disabled=false]        - Mode désactivé (opacité réduite, aucune interaction)
   */

  /**
   * @typedef {Object} TagsInputEvent
   * @property {string}   [value]  - Valeur concernée (events: add, remove, invalid, max)
   * @property {string[]} tags     - Tableau courant de tags au moment de l'événement
   */

  class TagsInput {
    /**
     * Crée une instance TagsInput.
     * @param {HTMLInputElement|string} el - Élément input cible ou sélecteur CSS
     * @param {TagsInputOptions} [options={}]
     */
    constructor(el, options = {}) {
      this._el = typeof el === 'string' ? document.querySelector(el) : el;

      if (!this._el || this._el.tagName !== 'INPUT') {
        throw new Error('[TagsInput] L\'élément cible doit être un <input>.');
      }

      this._opts = Object.assign({
        initialTags:      [],
        separators:       [','],
        maxTags:          Infinity,
        minLength:        1,
        maxLength:        Infinity,
        allowDuplicates:  false,
        caseSensitive:    true,
        validate:         null,
        transform:        v => v.trim(),
        suggestions:      [],
        suggestionsLimit: 6,
        theme:            '',
        placeholder:      this._el.placeholder || '',
        readonly:         false,
        disabled:         false,
      }, options);

      /** @type {string[]} */
      this._tags = [];

      /** @type {string[]} Tags initiaux (pour reset()) */
      this._initialTags = [...this._opts.initialTags];

      /** @type {Object.<string, Function[]>} */
      this._listeners = {};

      /** @type {number} Index de la suggestion courante au clavier */
      this._suggestionIndex = -1;

      /** @type {string[]} Suggestions actuellement visibles */
      this._visibleSuggestions = [];

      /**
       * Quand true, _emit() ne déclenche aucun listener.
       * Utilisé en interne par fill() et reset() pour éviter
       * les boucles infinies lors d'appels programmatiques.
       * @type {boolean}
       */
      this._silent = false;

      this._build();
      this._initialTags.forEach(t => this.add(t));

      if (this._opts.readonly) this.setReadonly(true);
      if (this._opts.disabled) this.setDisabled(true);
    }

    /* ================================================================
       CONSTRUCTION DU DOM
    ================================================================ */

    /** @private */
    _build() {
      // Conteneur principal
      this._wrapper = document.createElement('div');
      this._wrapper.className = [
        'tags-input-wrapper',
        this._opts.theme ? 'theme-' + this._opts.theme : '',
      ].filter(Boolean).join(' ');

      // Input de saisie
      this._input = document.createElement('input');
      this._input.type         = 'text';
      this._input.className    = 'tags-real-input';
      this._input.placeholder  = this._opts.placeholder;
      this._input.autocomplete = 'off';
      this._input.spellcheck   = false;

      this._wrapper.appendChild(this._input);

      // Insérer le wrapper avant l'input original, puis masquer celui-ci
      this._el.parentNode.insertBefore(this._wrapper, this._el);
      this._el.style.display = 'none';
      // Conserver l'input original dans le DOM pour la soumission de formulaire
      this._wrapper.appendChild(this._el);

      // Dropdown suggestions
      if (this._opts.suggestions.length) {
        this._suggBox = document.createElement('div');
        this._suggBox.className    = 'tags-suggestions';
        this._suggBox.style.display = 'none';
        // Positionné par rapport au parent relatif (.tags-wrapper-rel)
        this._wrapper.parentNode.appendChild(this._suggBox);
      }

      this._bindEvents();
    }

    /** @private */
    _bindEvents() {
      // Clic sur le wrapper → focus sur l'input
      this._wrapper.addEventListener('click', e => {
        if (!e.target.classList.contains('tag-remove')) {
          this._input.focus();
        }
      });

      this._input.addEventListener('keydown', e => this._onKeydown(e));
      this._input.addEventListener('input',   () => this._onInput());

      // Masquer les suggestions quand le focus quitte l'input
      this._input.addEventListener('blur', () => {
        // Délai pour laisser le mousedown sur une suggestion se déclencher d'abord
        setTimeout(() => this._hideSuggestions(), 150);
      });
    }

    /* ================================================================
       GESTION CLAVIER
    ================================================================ */

    /** @private */
    _onKeydown(e) {
      const val = this._input.value;

      // Séparateurs personnalisés (ex : virgule, espace…)
      if (this._opts.separators.includes(e.key)) {
        e.preventDefault();
        this.add(val);
        this._input.value = '';
        this._hideSuggestions();
        return;
      }

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          // Priorité à la suggestion active
          if (this._suggestionIndex >= 0 && this._visibleSuggestions.length) {
            this.add(this._visibleSuggestions[this._suggestionIndex]);
          } else {
            this.add(val);
          }
          this._input.value = '';
          this._hideSuggestions();
          break;

        case 'Backspace':
          // Supprimer le dernier tag si l'input est vide
          if (!val && this._tags.length) {
            this.removeAt(this._tags.length - 1);
          }
          break;

        case 'Escape':
          this._hideSuggestions();
          break;

        case 'ArrowDown':
          e.preventDefault();
          this._moveSuggestion(1);
          break;

        case 'ArrowUp':
          e.preventDefault();
          this._moveSuggestion(-1);
          break;
      }
    }

    /** @private */
    _onInput() {
      const val = this._input.value;

      // Détecter si un séparateur a été collé / tapé au milieu de la valeur
      for (const sep of this._opts.separators) {
        if (val.includes(sep)) {
          const parts = val.split(sep);
          parts.slice(0, -1).forEach(p => this.add(p));
          this._input.value = parts[parts.length - 1];
          return;
        }
      }

      this._showSuggestions(val);
    }

    /* ================================================================
       SUGGESTIONS / AUTOCOMPLETE
    ================================================================ */

    /** @private */
    _showSuggestions(query) {
      if (!this._suggBox || !query) {
        this._hideSuggestions();
        return;
      }

      const q = query.toLowerCase();
      const matches = this._opts.suggestions
        .filter(s => s.toLowerCase().includes(q) && !this._hasExact(s))
        .slice(0, this._opts.suggestionsLimit);

      if (!matches.length) {
        this._hideSuggestions();
        return;
      }

      this._visibleSuggestions = matches;
      this._suggestionIndex    = -1;
      this._suggBox.innerHTML  = '';

      matches.forEach(m => {
        const item = document.createElement('div');
        item.className = 'tags-suggestion-item';

        // Mettre en évidence la partie correspondante
        const idx = m.toLowerCase().indexOf(q);
        item.innerHTML =
          this._escHtml(m.slice(0, idx)) +
          '<mark>' + this._escHtml(m.slice(idx, idx + q.length)) + '</mark>' +
          this._escHtml(m.slice(idx + q.length));

        item.addEventListener('mousedown', () => {
          this.add(m);
          this._input.value = '';
          this._hideSuggestions();
        });

        this._suggBox.appendChild(item);
      });

      this._suggBox.style.display = 'block';
    }

    /** @private */
    _hideSuggestions() {
      if (this._suggBox) {
        this._suggBox.style.display = 'none';
        this._suggestionIndex = -1;
        this._visibleSuggestions = [];
      }
    }

    /** @private */
    _moveSuggestion(dir) {
      if (!this._suggBox || this._suggBox.style.display === 'none') return;

      const items = this._suggBox.querySelectorAll('.tags-suggestion-item');
      if (!items.length) return;

      if (this._suggestionIndex >= 0) {
        items[this._suggestionIndex].classList.remove('active');
      }

      this._suggestionIndex = Math.max(
        -1,
        Math.min(items.length - 1, this._suggestionIndex + dir)
      );

      if (this._suggestionIndex >= 0) {
        items[this._suggestionIndex].classList.add('active');
      }
    }

    /* ================================================================
       VALIDATION INTERNE
    ================================================================ */

    /** @private */
    _normalize(value) {
      return this._opts.transform ? this._opts.transform(String(value)) : String(value).trim();
    }

    /** @private */
    _hasExact(value) {
      const cmp = this._opts.caseSensitive
        ? v => v
        : v => v.toLowerCase();
      return this._tags.some(t => cmp(t) === cmp(value));
    }

    /** @private */
    _isDuplicate(value) {
      if (this._opts.allowDuplicates) return false;
      return this._hasExact(value);
    }

    /**
     * Valide une valeur normalisée.
     * @private
     * @param {string} value
     * @returns {boolean}
     */
    _validate(value) {
      if (value.length < this._opts.minLength)  return false;
      if (value.length > this._opts.maxLength)   return false;
      if (this._isDuplicate(value))              return false;

      if (typeof this._opts.validate === 'function') {
        const result = this._opts.validate(value);
        if (result === false || typeof result === 'string') return false;
      }

      return true;
    }

    /** Anime le champ pour signaler une saisie invalide. @private */
    _shake() {
      this._wrapper.classList.add('tags-invalid');
      setTimeout(() => this._wrapper.classList.remove('tags-invalid'), 400);
    }

    /* ================================================================
       RENDU
    ================================================================ */

    /** @private */
    _renderTag(value) {
      const tag = document.createElement('span');
      tag.className   = 'tag-item';
      tag.textContent = value;

      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'tag-remove';
      btn.innerHTML = '&times;';
      btn.setAttribute('aria-label', 'Supprimer ' + value);

      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.remove(value);
      });

      tag.appendChild(btn);
      this._wrapper.insertBefore(tag, this._input);
    }

    /** Synchronise la valeur de l'input caché (soumission formulaire). @private */
    _syncHidden() {
      this._el.value = this._tags.join(',');
    }

    /** Échappe le HTML pour éviter les injections dans les suggestions. @private */
    _escHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ================================================================
       ÉMISSION D'ÉVÉNEMENTS
    ================================================================ */

    /**
     * Émet un événement interne.
     * @private
     * @param {string} event
     * @param {TagsInputEvent} data
     */
    _emit(event, data) {
      if (this._silent) return;
      (this._listeners[event] || []).forEach(fn => {
        try { fn(data); } catch (err) { console.error('[TagsInput] Erreur dans le handler "' + event + '":', err); }
      });
    }

    /* ================================================================
       API PUBLIQUE
    ================================================================ */

    /**
     * Ajoute un tag.
     * Lance les événements `invalid` ou `max` si le tag est rejeté,
     * `add` et `change` s'il est accepté.
     * @param {string} value
     * @returns {boolean} true si le tag a été ajouté.
     */
    add(value) {
      if (this._opts.readonly || this._opts.disabled) return false;

      const v = this._normalize(value);
      if (!v) return false;

      if (this._tags.length >= this._opts.maxTags) {
        this._shake();
        this._emit('max', { value: v, tags: this.getTags() });
        return false;
      }

      if (!this._validate(v)) {
        this._shake();
        this._emit('invalid', { value: v, tags: this.getTags() });
        return false;
      }

      this._tags.push(v);
      this._renderTag(v);
      this._syncHidden();
      this._emit('add', { value: v, tags: this.getTags() });
      this._emit('change', { tags: this.getTags() });
      return true;
    }

    /**
     * Supprime un tag par sa valeur exacte.
     * @param {string} value
     * @returns {boolean} true si le tag a été trouvé et supprimé.
     */
    remove(value) {
      const idx = this._tags.indexOf(value);
      if (idx === -1) return false;
      return this.removeAt(idx);
    }

    /**
     * Supprime un tag par son index (0-based).
     * @param {number} index
     * @returns {boolean} true si l'index était valide.
     */
    removeAt(index) {
      if (this._opts.readonly || this._opts.disabled) return false;
      if (index < 0 || index >= this._tags.length)   return false;

      const value = this._tags[index];
      this._tags.splice(index, 1);

      const tagEls = this._wrapper.querySelectorAll('.tag-item');
      if (tagEls[index]) {
        tagEls[index].classList.add('removing');
        setTimeout(() => tagEls[index] && tagEls[index].remove(), 160);
      }

      this._syncHidden();
      this._emit('remove', { value, tags: this.getTags() });
      this._emit('change', { tags: this.getTags() });
      return true;
    }

    /**
     * Retourne une copie du tableau de tags courant.
     * @returns {string[]}
     */
    getTags() {
      return [...this._tags];
    }

    /**
     * Teste si un tag est présent (comparaison exacte).
     * @param {string} value
     * @returns {boolean}
     */
    has(value) {
      return this._tags.includes(value);
    }

    /**
     * Retourne le nombre de tags courants.
     * @returns {number}
     */
    count() {
      return this._tags.length;
    }

    /**
     * Vide le champ puis ajoute les tags du tableau (validation appliquée).
     * N'émet qu'un seul événement `change` à la fin de l'opération,
     * ce qui évite toute boucle infinie si fill() est appelé depuis
     * un handler `add` ou `change`.
     * @param {string[]} arr
     */
    fill(arr) {
      this._silent = true;
      try {
        this.clear();
        arr.forEach(v => this.add(v));
      } finally {
        this._silent = false;
      }
      this._emit('change', { tags: this.getTags() });
    }

    /**
     * Alias de fill(). Remplace tous les tags.
     * @param {string[]} arr
     */
    replace(arr) {
      this.fill(arr);
    }

    /**
     * Supprime tous les tags. Émet `clear` puis `change`.
     */
    clear() {
      this._tags = [];
      this._wrapper.querySelectorAll('.tag-item').forEach(el => el.remove());
      this._syncHidden();
      this._emit('clear',  { tags: [] });
      this._emit('change', { tags: [] });
    }

    /**
     * Remet le champ à son état initial (tags passés dans les options).
     */
    reset() {
      this.fill(this._initialTags);
    }

    /**
     * Met le focus sur l'input de saisie.
     */
    focus() {
      this._input.focus();
    }

    /**
     * Active ou désactive le mode lecture seule.
     * En mode readonly : les tags sont affichés mais ne peuvent pas être ajoutés/supprimés.
     * @param {boolean} bool
     */
    setReadonly(bool) {
      this._opts.readonly         = bool;
      this._input.style.display   = bool ? 'none' : '';
      this._wrapper.querySelectorAll('.tag-remove').forEach(b => {
        b.style.display = bool ? 'none' : '';
      });
    }

    /**
     * Active ou désactive le champ (aucune interaction possible).
     * @param {boolean} bool
     */
    setDisabled(bool) {
      this._opts.disabled               = bool;
      this._wrapper.style.opacity       = bool ? '0.45' : '';
      this._wrapper.style.pointerEvents = bool ? 'none'  : '';
    }

    /**
     * Souscrit à un événement.
     * Événements disponibles : `add` | `remove` | `invalid` | `max` | `clear` | `change`
     * @param {string}   event - Nom de l'événement
     * @param {Function} fn    - Callback(data: TagsInputEvent)
     */
    on(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
    }

    /**
     * Désabonne un handler d'un événement.
     * @param {string}   event
     * @param {Function} fn
     */
    off(event, fn) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }

    /**
     * Détruit l'instance : supprime le wrapper et restaure l'input original.
     */
    destroy() {
      this._el.style.display = '';
      this._wrapper.parentNode.insertBefore(this._el, this._wrapper);
      this._wrapper.remove();
      if (this._suggBox) this._suggBox.remove();
      this._listeners = {};
    }
  }

  return TagsInput;
}));