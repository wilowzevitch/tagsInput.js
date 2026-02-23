# TagsInput.js

Champ de saisie de tags en **vanilla JS**, sans aucune dépendance. Validation personnalisable, autocomplete, API complète et thèmes CSS via custom properties.

---

## Fichiers

| Fichier | Usage |
|---|---|
| `tagsinput.js` | Source commentée (développement) |
| `tagsinput.min.js` | Minifiée (production) |
| `tagsinput.css` | Styles source (développement) |
| `tagsinput.min.css` | Styles minifiés (production) |

---

## Installation

### Via `<script>` classique

```html
<link rel="stylesheet" href="tagsinput.min.css">
<script src="tagsinput.min.js"></script>
```

### Via CommonJS / Node

```js
const TagsInput = require('./tagsinput.js');
```

### Via AMD (RequireJS)

```js
define(['tagsinput'], function (TagsInput) { ... });
```

---

## Usage minimal

```html
<div class="tags-wrapper-rel">
  <input type="text" id="my-tags" name="tags">
</div>

<script>
  const instance = new TagsInput('#my-tags', {
    placeholder: 'Ajouter un tag…',
  });
</script>
```

> Le `<div class="tags-wrapper-rel">` est requis pour le positionnement du dropdown de suggestions. Sans lui, les suggestions fonctionnent mais peuvent mal se positionner.

---

## Options

| Option | Type | Défaut | Description |
|---|---|---|---|
| `initialTags` | `string[]` | `[]` | Tags pré-remplis au démarrage |
| `separators` | `string[]` | `[',']` | Caractères déclenchant l'ajout (en plus de `Entrée`) |
| `maxTags` | `number` | `Infinity` | Nombre maximum de tags autorisés |
| `minLength` | `number` | `1` | Longueur minimale d'un tag |
| `maxLength` | `number` | `Infinity` | Longueur maximale d'un tag |
| `allowDuplicates` | `boolean` | `false` | Autoriser les valeurs dupliquées |
| `caseSensitive` | `boolean` | `true` | Comparaison sensible à la casse pour les doublons |
| `validate` | `Function` | `null` | Fonction de validation personnalisée (voir ci-dessous) |
| `transform` | `Function` | `v => v.trim()` | Normalisation appliquée avant validation |
| `suggestions` | `string[]` | `[]` | Liste de valeurs pour l'autocomplete |
| `suggestionsLimit` | `number` | `6` | Nombre maximum de suggestions affichées |
| `theme` | `string` | `''` | Thème CSS : `''` \| `'blue'` \| `'red'` \| `'green'` \| `'amber'` |
| `placeholder` | `string` | `''` | Placeholder de l'input interne |
| `readonly` | `boolean` | `false` | Mode lecture seule (tags affichés, pas d'édition) |
| `disabled` | `boolean` | `false` | Mode désactivé (aucune interaction) |

### Option `validate`

Fonction appelée après les contrôles internes (longueur, doublons). Reçoit la valeur normalisée, doit retourner `true` pour accepter ou `false` pour rejeter.

```js
new TagsInput('#my-tags', {
  validate(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); // emails uniquement
  },
});
```

### Option `transform`

Appliquée avant toute validation. Utile pour normaliser la casse ou supprimer des caractères.

```js
new TagsInput('#my-tags', {
  transform: v => v.trim().toLowerCase(),
});
```

---

## API

### Méthodes de mutation

#### `add(value)` → `boolean`
Ajoute un tag. Retourne `true` si le tag a été accepté et ajouté, `false` s'il a été rejeté (validation, doublon, max atteint).

```js
instance.add('javascript'); // → true
instance.add('');           // → false
```

#### `remove(value)` → `boolean`
Supprime un tag par sa valeur exacte. Retourne `true` si trouvé et supprimé.

```js
instance.remove('javascript');
```

#### `removeAt(index)` → `boolean`
Supprime un tag par son index (0-based). Retourne `true` si l'index était valide.

```js
instance.removeAt(0); // supprime le premier tag
```

#### `fill(arr)`
Vide le champ puis ajoute les tags du tableau (validation appliquée sur chacun). N'émet qu'un seul événement `change` à la fin, ce qui évite les boucles infinies lors d'appels depuis un handler.

```js
instance.fill(['html', 'css', 'javascript']);
```

#### `replace(arr)`
Alias de `fill()`.

#### `clear()`
Supprime tous les tags. Émet `clear` puis `change`.

```js
instance.clear();
```

#### `reset()`
Remet le champ à son état initial (tags passés dans `initialTags`).

```js
instance.reset();
```

---

### Méthodes de lecture

#### `getTags()` → `string[]`
Retourne une copie du tableau de tags courant.

```js
const tags = instance.getTags(); // ['html', 'css']
```

#### `has(value)` → `boolean`
Teste si un tag est présent (comparaison exacte).

```js
instance.has('css'); // → true
```

#### `count()` → `number`
Retourne le nombre de tags courants.

```js
instance.count(); // → 2
```

---

### Méthodes d'état

#### `focus()`
Met le focus sur l'input de saisie.

#### `setReadonly(bool)`
Active ou désactive le mode lecture seule. En mode readonly, les tags sont affichés mais ne peuvent pas être ajoutés ni supprimés.

```js
instance.setReadonly(true);
instance.setReadonly(false);
```

#### `setDisabled(bool)`
Active ou désactive le champ (opacité réduite, aucune interaction).

```js
instance.setDisabled(true);
instance.setDisabled(false);
```

---

### Événements

#### `on(event, fn)`
Souscrit à un événement.

```js
instance.on('change', ({ tags }) => {
  console.log('tags:', tags);
});
```

#### `off(event, fn)`
Désabonne un handler.

```js
const handler = ({ tags }) => console.log(tags);
instance.on('change', handler);
instance.off('change', handler);
```

#### Événements disponibles

| Événement | Données | Déclenchement |
|---|---|---|
| `add` | `{ value, tags }` | Un tag vient d'être ajouté |
| `remove` | `{ value, tags }` | Un tag vient d'être supprimé |
| `invalid` | `{ value, tags }` | Une saisie a été rejetée par la validation |
| `max` | `{ value, tags }` | Une saisie a été rejetée car `maxTags` est atteint |
| `clear` | `{ tags: [] }` | Tous les tags ont été supprimés |
| `change` | `{ tags }` | L'état a changé (après tout ajout, suppression ou `fill()`) |

---

### Cycle de vie

#### `destroy()`
Détruit l'instance, supprime le wrapper du DOM et restaure l'input original dans son état initial.

```js
instance.destroy();
```

---

## Comportement des événements et `fill()`

`fill()` suspend tous les événements pendant son exécution (via un flag interne `_silent`) et n'émet qu'un seul `change` à la fin. Cela permet de l'appeler sans risque depuis n'importe quel handler.

### Cas d'usage : tri depuis un handler

Si vous combinez `on('add')` et `on('change')`, sachez que `add()` émet successivement `add` puis `change`. Appeler `fill()` dans un handler `add` produit donc deux `change` au total : celui natif de `add()` et celui final de `fill()`.

**La solution recommandée** est de brancher la logique sur `change` uniquement, avec un garde de comparaison pour éviter les appels inutiles :

```js
// Tri numérique automatique
instance.on('change', ({ tags }) => {
  const sorted = [...tags].sort((a, b) => Number(a) - Number(b));
  if (JSON.stringify(sorted) !== JSON.stringify(tags)) {
    instance.fill(sorted);
    return;
  }
  // État stable : traitement final ici
  console.log('tags triés :', tags);
});
```

Le flux est alors : `change (non trié)` → `fill()` → `change (trié)` → garde false → arrêt. Exactement deux appels au handler, dont le second est l'état final stable.

---

## Personnalisation CSS

Tous les aspects visuels sont contrôlables via des **CSS custom properties** sans modifier le fichier source.

```css
:root {
  --ti-bg:           #ffffff;   /* fond du champ */
  --ti-border:       #d1d5db;   /* bordure au repos */
  --ti-border-focus: #6366f1;   /* bordure au focus */
  --ti-border-invalid: #ef4444; /* bordure invalide */
  --ti-text:         #111827;   /* couleur du texte saisi */
  --ti-placeholder:  #9ca3af;   /* couleur du placeholder */
  --ti-radius:       6px;       /* border-radius du champ */

  --ti-tag-bg:       rgba(99, 102, 241, 0.1);  /* fond des tags */
  --ti-tag-border:   rgba(99, 102, 241, 0.35); /* bordure des tags */
  --ti-tag-color:    #4338ca;                  /* texte des tags */
  --ti-tag-radius:   4px;                      /* border-radius des tags */

  --ti-remove-hover: #ef4444;   /* couleur du × au survol */

  --ti-sugg-bg:      #ffffff;   /* fond du dropdown */
  --ti-sugg-border:  #e5e7eb;   /* bordure du dropdown */
  --ti-sugg-shadow:  0 8px 24px rgba(0,0,0,0.12);
}
```

### Thèmes intégrés

Passez l'option `theme` à la construction ou ajoutez la classe manuellement sur le wrapper.

```js
new TagsInput('#my-tags', { theme: 'blue' });
```

| Valeur | Couleur dominante |
|---|---|
| *(vide)* | Indigo (défaut) |
| `'blue'` | Bleu ciel |
| `'red'` | Rouge rosé |
| `'green'` | Vert |
| `'amber'` | Ambre |

### Mode sombre

Activé automatiquement via `prefers-color-scheme: dark`, ou manuellement en ajoutant la classe `.dark` (ou l'attribut `data-theme="dark"`) sur n'importe quel élément parent.

```html
<body class="dark">
  ...
</body>
```

### Accessibilité

Les animations sont automatiquement désactivées si l'utilisateur a activé `prefers-reduced-motion` dans ses préférences système.

---

## Exemples complets

### Champ basique avec tags initiaux

```js
const tags = new TagsInput('#tags', {
  initialTags: ['html', 'css'],
  placeholder: 'Ajouter un tag…',
});
```

### Validation d'emails

```js
const emails = new TagsInput('#emails', {
  placeholder: 'email@exemple.com',
  caseSensitive: false,
  transform: v => v.trim().toLowerCase(),
  validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
});

emails.on('invalid', ({ value }) => {
  console.warn(value, 'n\'est pas un email valide');
});
```

### Autocomplete avec liste de suggestions

```js
const langs = new TagsInput('#languages', {
  suggestions: ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go'],
  suggestionsLimit: 5,
  separators: [',', ' '],
});
```

### Maximum de tags avec thème

```js
const limited = new TagsInput('#skills', {
  maxTags: 5,
  theme: 'blue',
});

limited.on('max', () => {
  alert('Maximum de 5 tags atteint.');
});
```

### Contrôle programmatique complet

```js
const ctrl = new TagsInput('#ctrl', {
  initialTags: ['foo', 'bar'],
});

ctrl.add('baz');               // ajoute un tag
ctrl.remove('foo');            // supprime par valeur
ctrl.removeAt(0);              // supprime par index
ctrl.fill(['a', 'b', 'c']);    // remplace tout
ctrl.clear();                  // vide
ctrl.reset();                  // revient à ['foo', 'bar']
ctrl.setReadonly(true);        // lecture seule
ctrl.setDisabled(false);       // réactive

console.log(ctrl.getTags());   // ['foo', 'bar']
console.log(ctrl.has('foo'));  // true
console.log(ctrl.count());     // 2
```

---

## Compatibilité

- Navigateurs modernes (Chrome, Firefox, Safari, Edge) — ES2018+
- Aucune dépendance
- Compatible CommonJS, AMD et chargement via `<script>`
- Formulaires HTML natifs : la valeur soumise est une chaîne de tags séparés par des virgules

---

## Licence

MIT