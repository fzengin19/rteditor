# RTEditor — Bug & Issue Raporu

> Tarih: 2025-02-10
> Versiyon: 0.1.0

---

## P0 — Kritik (Memory Leak & Kırık Testler)

### BUG-001: Memory Leak — `selectionchange` listener temizlenmiyor

**Dosya:** `src/editor.js`
**Satır:** `#init()` metodu

```js
this._selectionHandler = () => { ... };
document.addEventListener('selectionchange', this._selectionHandler);
```

`destroy()` metodu bu listener'i **kaldirmamaktadir**. Her editor instance olusturulup destroy edildiginde eski listener bellekte kaliyor ve calismaya devam ediyor.

**Etki:** SPA'larda ve coklu instance senaryolarinda ciddi memory leak. Destroy edilen editor'un toolbar'i hala guncelleniyor.

**Cozum:** `destroy()` metoduna `document.removeEventListener('selectionchange', this._selectionHandler)` eklenmeli.

---

### BUG-002: Memory Leak — Dropdown `closeOnOutside` listener temizlenmiyor

**Dosya:** `src/toolbar.js`
**Metod:** `#createDropdown()`

```js
const closeOnOutside = (e) => { ... };
document.addEventListener('click', closeOnOutside);
```

Bu listener lokal degiskende sakli, `destroy()` metodundan erisilemez ve hic kaldirilmaz. Her toolbar destroy edildiginde document'a bagli orphan listener kalir.

**Etki:** Memory leak + destroy edilen toolbar'in dropdown logic'i document click'lerde calismaya devam eder.

**Cozum:** `closeOnOutside` referansini instance field olarak sakla, `destroy()` icinde kaldir.

---

### BUG-003: Memory Leak — `_resizerCleanup` listener temizlenmiyor

**Dosya:** `src/editor.js`
**Metod:** `#setupResizer()`

Resizer cleanup icin eklenen event listener'lar `destroy()` sirasinda remove edilmiyor.

**Etki:** Destroy sonrasi click listener'lari calismaya devam eder.

**Cozum:** `destroy()` icinde resizer ile ilgili tum listener'lari kaldir.

---

### BUG-004: Global `<style>` element her instance'da tekrar ekleniyor

**Dosya:** `src/engine.js`
**Satir:** Constructor

```js
const style = document.createElement('style');
style.textContent = `[contenteditable] img { ... }`;
document.head.appendChild(style);
```

Placeholder CSS'de (`editor.js#setupPlaceholder`) dedup kontrolu yapiliyor (`getElementById` ile), ama engine'deki bu style ekleme **hic kontrol edilmiyor**. 10 editor instance = 10 duplicate `<style>` element.

**Etki:** Gereksiz DOM kirliligi, potansiyel CSS specificity sorunlari.

**Cozum:** Placeholder CSS'deki gibi ID bazli dedup kontrolu ekle.

---

### BUG-005: `pre` ve `code` tag inconsistency — 2 test failing

**Dosyalar:**
- `src/selection.js` → `BLOCK_TAGS` listesinde `pre` var, `INLINE_TAGS`'da `code` var
- `src/class-map.js` → `CLASS_MAP` icinde `pre` ve `code` **yok**
- `src/normalizer.js` → `ALLOWED_TAGS` icinde `pre` ve `code` **yok**

**Etki:** `class-map.test.js` icinde 2 test basarisiz. Moduller arasi tutarsizlik.

**Cozum:** Ya `pre`/`code` destegi tum modullere eklenmeli (CLASS_MAP, ALLOWED_TAGS, normalizer logic) ya da `selection.js`'den kaldirilmali.

---

### BUG-006: TypeScript declaration'lari yanlis

**Dosya:** `types/index.d.ts`

```ts
// Mevcut (yanlis):
export function getClassFor(tagName: string): string;
export function normalizeHTML(html: string): string;
export function sanitizeHTML(html: string): string;

// Olmasi gereken:
export function getClassFor(tagName: string, classMap?: Record<string, string>): string;
export function normalizeHTML(html: string, classMap?: Record<string, string>): string;
export function sanitizeHTML(html: string, classMap?: Record<string, string>): string;
```

**Etki:** TypeScript kullanicilari yanlis parametre sayisiyla cagri yapar, runtime'da beklenmedik davranis gorur.

---

## P1 — Yuksek (Stabilite & Dogruluk)

### BUG-007: `toggleInline` ZWS ve normalizer cakismasi

**Dosya:** `src/commands.js` + `src/normalizer.js`

Collapsed cursor'da inline format toggle edildiginde `\u200B` (zero-width space) karakteri insert ediliyor:

```js
// commands.js - toggleInline
const zwsp = document.createTextNode('\u200B');
wrapper.appendChild(zwsp);
```

Ama `normalizer.js`'deki `stripZWS()` bu karakterleri siliyor:

```js
// normalizer.js
const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
// ... node.textContent = node.textContent.replace(/\u200B/g, '');
```

**Etki:** Collapsed cursor'da format toggle edildikten sonra normalizer calisiyor ve format kaybolabiliyor. Cursor jump'larina neden olur.

**Cozum:** ZWS'yi normalization sirasinda koruma mekanizmasi ekle (ornegin parent inline tag varsa silme) veya farkli bir cursor placeholder stratejisi kullan.

---

### BUG-008: `onChange` callback raw (normalize edilmemis) HTML donduruyor

**Dosya:** `src/editor.js` + `src/engine.js`

```js
// engine.js - exec() icinde:
this.#onChange?.(this.getHTML()); // engine.getHTML() = raw innerHTML

// editor.js - kullanicinin cagirdigi:
getHTML() { return normalizeHTML(this.#engine.getHTML(), this.#classMap); }
```

`onChange` callback'i engine'in raw HTML'ini alirken, `editor.getHTML()` normalize edilmis HTML donduruyor. Kullanici `onChange`'den aldigi HTML ile `getHTML()`'den aldigi **farkli**.

**Etki:** `onChange` ile state sync yapan uygulamalarda tutarsiz veri. React/Vue entegrasyonlarinda bug kaynagi.

**Cozum:** `onChange` callback'inin de normalize edilmis HTML gondermesi saglanmali.

---

### BUG-009: `getHTML()` double normalization

**Dosya:** `src/editor.js`

```js
getHTML() {
  return normalizeHTML(this.#engine.getHTML(), this.#classMap);
}
```

`engine.getHTML()` zaten DOM clone yapip innerHTML donduruyor. Sonra `normalizeHTML()` tekrar DOMParser ile parse edip isliyor. Her `getHTML()` cagrisinda 2 kez DOM olusturma maliyeti.

**Etki:** Performans kaybi, ozellikle buyuk icerikli editorlerde ve sik `onChange` cagrilarinda belirgin.

**Cozum:** Normalization'i tek bir noktada yap. Ya engine.getHTML() normalize etsin, ya da editor seviyesinde tek seferde yapilsin.

---

### BUG-010: `setBlockType` sadece root.children kontrol ediyor

**Dosya:** `src/commands.js`

```js
for (const child of root.children) {
  if (sel.containsNode(child, true)) { ... }
}
```

Sadece birinci seviye cocuklar taraniyor. Nested block'lar (ornegin `<blockquote>` icindeki `<p>`) `setBlockType` ile donusturulemiyor.

**Etki:** Blockquote icindeki paragrafi heading'e cevirme gibi islemler calismaz.

---

### BUG-011: `toggleList` coklu blok seciminde calismaz

**Dosya:** `src/commands.js`

Sadece tek bir blok'u listeye ceviriyor. Birden fazla paragraf secili oldugunda sadece ilkini donusturuyor.

**Etki:** Kullanici 3 paragraf secer ve "liste yap" tiklar → sadece birincisi listeye donusur.

---

### BUG-012: `blockquote` coklu blok seciminde calismaz

**Dosya:** `src/commands.js`

Ayni sorun — sadece tek blok ile calisiyor.

**Etki:** Kullanici birden fazla paragraf secip blockquote yapmak istediginde sadece birincisi donusur.

---

### BUG-013: Link komutu — URL validasyonu yok

**Dosya:** `src/commands.js` + `src/toolbar.js`

```js
// commands.js - link komutu
a.href = url; // Herhangi bir string kabul ediliyor
```

`javascript:` scheme normalizer seviyesinde engelleniyor ama command seviyesinde kontrol yok. Gecersiz URL'ler de kabul ediliyor (bosluk, random string vs).

**Etki:** Bozuk link'ler olusturulabilir. Normalizer sonradan temizlese de UX olarak kullaniciya geri bildirim yok.

**Cozum:** Command veya prompt seviyesinde temel URL validation ekle.

---

## P2 — Orta (Performans & Kod Kalitesi)

### BUG-014: Resizer `#aspectRatio` hesaplaniyor ama kullanilmiyor

**Dosya:** `src/resizer.js`

```js
this.#aspectRatio = this.#img.naturalHeight / this.#img.naturalWidth;
```

Hesaplanan deger hicbir yerde kullanilmiyor. Resize sirasinda `height: auto` set ediliyor.

**Etki:** Dead code. `height: auto` CSS ile oran korunuyor ama explicit kontrol yok.

---

### BUG-015: Resizer `#attachListeners()` bos method (dead code)

**Dosya:** `src/resizer.js`

Tanimli ama bos — hic cagrilmiyor bile.

---

### BUG-016: Resizer — Touch event destegi yok

**Dosya:** `src/resizer.js`

Sadece `mousedown`, `mousemove`, `mouseup` event'leri dinleniyor.

**Etki:** Mobil cihazlarda ve tablet'lerde gorsel boyutlandirma yapilamiyor.

---

### BUG-017: Resizer — 4 handle var ama hepsi ayni sekilde calisiyor

**Dosya:** `src/resizer.js`

Kose handle'larinin hepsi ayni resize davranisina sahip. Sol taraftaki handle'lar da saga dogru genisletiyor.

**Etki:** Kullanici sol handle'dan sola dogru cektiginde ters yone genisleme beklentisi karsilanmaz.

---

### BUG-018: `updateState()` her `selectionchange`'de calisiyor (throttle yok)

**Dosya:** `src/toolbar.js`

`selectionchange` global bir event — editorle ilgisi olmayan selection degisikliklerinde bile tum toolbar state guncelleniyor. `isSelectionInEditor()` kontrolu var ama fonksiyon cagrisi maliyeti devam ediyor.

**Etki:** Performans — ozellikle sayfada birden fazla editor varsa, her biri diger editordeki degisikliklerde de yanit veriyor.

**Cozum:** `requestAnimationFrame` veya debounce ile throttle et.

---

### BUG-019: History — Typing icin grouping/batching yok

**Dosya:** `src/history.js`

Her 500ms input'ta yeni snapshot. "hello world" yazmak 2-4 undo adimi.

**Etki:** UX — kullanicilar kelime/cumle bazinda undo bekler, karakter grubu bazinda degil.

**Cozum:** Bosluk, Enter veya eylemsizlik bazli gruplama stratejisi ekle.

---

### BUG-020: `#normalizeContent()` ve `normalizeHTML()` duplicated logic

**Dosya:** `src/engine.js` + `src/normalizer.js`

`engine.js#normalizeContent()` basitlestirilmis bir normalization yapiyor (bare text → `<p>`, `<div>` → `<p>`). `normalizer.js#normalizeHTML()` ise cok daha kapsamli. Input sirasinda calisan ve setHTML sirasinda calisan logic uyumsuz.

**Etki:** Farkli normalization yollari farkli sonuclar uretebilir.

---

### BUG-021: Silent failure — Empty catch block

**Dosya:** `src/engine.js`, constructor

```js
try {
  document.execCommand('enableObjectResizing', false, 'false');
} catch (e) { /* ignore */ }
```

**Etki:** Debugging zorlugu. Hata durumu tamamen yutulur.

**Cozum:** En azindan `console.debug` ile logla.

---

### BUG-022: `dev/index.html` typo

**Dosya:** `dev/index.html`

```js
console.log(explorer.getHTML()); // explorer → editor olmali
```

---

## P3 — Dusuk (A11y & Gelistirme)

### BUG-023: Prompt overlay'de ARIA rolleri eksik

**Dosya:** `src/toolbar.js`, `#showPrompt()`

Prompt overlay'de `role="dialog"`, `aria-modal="true"`, `aria-label` yok.

**Etki:** Screen reader kullanicilari prompt'un acildigini farkedemez.

---

### BUG-024: Editor alaninda ARIA rolleri eksik

**Dosya:** `src/editor.js`

Editore `role="textbox"` ve `aria-multiline="true"` atanmiyor.

---

### BUG-025: Heading dropdown'da ARIA rolleri eksik

**Dosya:** `src/toolbar.js`

Dropdown menu'de `role="listbox"` / `role="option"` yok.

---

### BUG-026: Image resizer'da keyboard alternatifi yok

**Dosya:** `src/resizer.js`

Sadece mouse ile boyutlandirma yapilabiliyor. Keyboard kullanicilari icin alternatif yok.

---

### BUG-027: `handleEnter` monolitik ve edge case'lere acik

**Dosya:** `src/engine.js`, `#handleEnter()`

~60 satirlik tek fonksiyon. Nested list'ler, blockquote ici enter, mixed content gibi edge case'lerde beklenmedik davranislar uretebilir:
- Bos `<li>` kontrolu `textContent.trim() === ''` ile yapiliyor — ZWS karakteri bu kontrolu gecebilir
- `splitBlock` sonrasi cursor placement text node'un var oldugunu varsayiyor

---

## Test Coverage Gap'leri

| Modul | Mevcut | Eksik |
|-------|--------|-------|
| `commands.js` — inline | bold | italic, underline, strikethrough toggle |
| `commands.js` — block | h2 | h1, h3, h4, paragraph toggle |
| `commands.js` — list | - | `toggleList` hic test edilmemis |
| `commands.js` — blockquote | - | Hic test yok |
| `commands.js` — link | - | Command logic test yok (sadece toolbar prompt) |
| `commands.js` — image | - | Hic test yok |
| `commands.js` — clearFormatting | - | Hic test yok |
| `engine.js` — paste | basit HTML | Plain text paste, mixed content |
| `engine.js` — Enter | basit | List ici enter, blockquote ici enter, split |
| `resizer.js` | temel | Boundary (min width), overlay positioning |
| `editor.js` — destroy | var | selectionchange leak kontrolu yok |
| Memory leak | - | Destroy sonrasi listener kontrolu yok |
