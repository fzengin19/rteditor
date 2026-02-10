# RTEditor - Kapsamli Analiz Raporu

> **Amaç:** Cilalama, bugfix ve stability improvement  
> **Kapsam:** Mevcut toolbar özelliklerine dokunulmadan, var olan kodun iyileştirilmesi  
> **Tarih:** 10 Şubat 2026

---

## İçindekiler

1. [Kritik Bug'lar (Hemen Düzeltilmeli)](#1-kritik-buglar)
2. [Memory Leak'ler](#2-memory-leakler)
3. [Veri Bütünlüğü Sorunları](#3-veri-bütünlüğü-sorunları)
4. [Stability İyileştirmeleri](#4-stability-iyileştirmeleri)
5. [Cilalama / Polish](#5-cilalama--polish)
6. [Test Altyapısı](#6-test-altyapısı)
7. [Dev Ortamı / DX](#7-dev-ortamı--dx)
8. [Öncelik Sıralaması](#8-öncelik-sıralaması)

---

## 1. Kritik Bug'lar

### 1.1 ❌ `editor.js` — Duplicate `focus()` Metodu

**Dosya:** `src/editor.js`  
**Sorun:** İki ayrı `focus()` metodu tanımlanmış. İkincisi birincisini sessizce override ediyor.

```js
// İlk tanım (~satır 215): 
focus() { this.#engine.contentEl.focus(); }

// İkinci tanım (~satır 225):
focus() { this.#engine.focus(); }
```

**Etki:** İlk `focus()` asla çalışmaz. JS class'larda ikinci method birincisini ezer, hata vermez.  
**Çözüm:** İlk `focus()` tanımını silin, sadece `this.#engine.focus()` çağıran versiyonu bırakın.

---

### 1.2 ❌ `engine.js` — Paste Handler'da Gereksiz Dynamic Import

**Dosya:** `src/engine.js`, `#handlePaste()` metodu  
**Sorun:** `normalizeHTML` dosyanın en başında statik olarak zaten import ediliyor, ama paste handler'da tekrar `import('./normalizer.js')` ile dinamik import yapılıyor.

```js
// Satır 5: import { normalizeHTML } from './normalizer.js';
// ...
// Satır ~277: import('./normalizer.js').then(({ normalizeHTML }) => { ... })
```

**Etki:**
- Paste işlemi async oluyor → cursor paste bitmeden hareket edebilir
- `.then()` callback içinde `this.#history.push()` çağrılıyor → timing race condition
- Gereksiz network round-trip (modül cache'den gelir ama yine de async)

**Çözüm:** Zaten import edilmiş olan `normalizeHTML`'i doğrudan kullanın:

```js
const clean = normalizeHTML(html, this.#classMap);
this.#root.innerHTML = clean;
this.#history.push(this.#root.innerHTML);
this.#emit('change');
```

---

### 1.3 ❌ `engine.js` — `#handleEnter()` ClassMap Tutarsızlığı

**Dosya:** `src/engine.js`, `#handleEnter()` metodu  
**Sorun:** `getClassFor('p')` çağrılıyor ama `this.#classMap` parametre olarak geçirilmiyor. Diğer tüm çağrılarda `getClassFor('p', this.#classMap)` şeklinde instance classMap kullanılıyor.

**Etki:** Kullanıcı `classMap` override verdiyse, Enter tuşuyla oluşturulan yeni paragraflar default class'ları alır, kullanıcının özel class'larını değil.  
**Çözüm:** `getClassFor('p', this.#classMap)` olarak düzeltin.

---

### 1.4 ❌ `commands.js` — Zero-Width Space (ZWS) Birikimi

**Dosya:** `src/commands.js`, `toggleInline()` fonksiyonu  
**Sorun:** Collapsed cursor'da inline format uygulanırken `\u200B` (zero-width space) ekleniyor ama bu karakterler hiçbir zaman temizlenmiyor.

```js
// satır ~35
const zws = document.createTextNode('\u200B');
wrapper.appendChild(zws);
```

**Etki:**
- `getHTML()` çıktısında görünmez `\u200B` karakterler birikir
- Backend'e gönderilen HTML kirli olur
- Copy-paste'te beklenmeyen davranışlar
- Kelime sayımı yanlış çıkar

**Çözüm:** 
1. `getHTML()` çağrılmadan önce ZWS temizliği yapılmalı
2. Veya daha iyisi: `normalizeHTML()` içinde `\u200B` strip edilmeli
3. En iyi yaklaşım: Kullanıcı yazmaya başladığında, boş ZWS-only text node'ları temizlenmeli (input event'inde)

---

### 1.5 ❌ `dev/index.html` — Typo: `explorer.getHTML()`

**Dosya:** `dev/index.html`, satır ~87  
**Sorun:** `explorer.getHTML()` yazıyor, doğrusu `editor.getHTML()`.

**Etki:** HTML çıktı paneli çalışmaz (console error).  
**Çözüm:** `explorer` → `editor` olarak düzeltin.

---

## 2. Memory Leak'ler

### 2.1 🔴 `editor.js` — `selectionchange` Listener Temizlenmiyor

**Dosya:** `src/editor.js`, `destroy()` metodu  
**Sorun:** `#init()` içinde `document.addEventListener('selectionchange', this._selectionHandler)` ekleniyor ama `destroy()` içinde bu listener kaldırılmıyor.

**Etki:** Editor destroy edildikten sonra bile her selection değişikliğinde callback çalışmaya devam eder. SPA'larda sayfa değişikliğinde birikir.  
**Çözüm:** `destroy()` içine ekleyin:
```js
document.removeEventListener('selectionchange', this._selectionHandler);
```

---

### 2.2 🔴 `engine.js` — Global Style Element Birikimi

**Dosya:** `src/engine.js`, constructor  
**Sorun:** Her `EditorEngine` instance'ı `document.head`'e yeni bir `<style>` elementi ekliyor. Hiçbir zaman kaldırılmıyor.

```js
const style = document.createElement('style');
style.textContent = `[contenteditable] ...`;
document.head.appendChild(style);
```

**Etki:** Multi-instance kullanımda (veya SPA'da mount/unmount döngülerinde) duplicate style elementleri birikir.  
**Çözüm:** 
1. Statik bir flag ile tek seferlik enjeksiyon: `if (!EditorEngine._styleInjected) { ... }`
2. Veya: Eklenen style elementini referans tutup `destroy()`'da kaldırın

---

### 2.3 🔴 `toolbar.js` — Dropdown `closeOnOutside` Listener Temizlenmiyor

**Dosya:** `src/toolbar.js`, `#createDropdown()` ve `destroy()`  
**Sorun:** Dropdown açıldığında `document.addEventListener('click', closeOnOutside)` ekleniyor. `destroy()` bu listener'ı kaldırmıyor.

**Etki:** Her dropdown açılışında kalıcı document listener eklenir, hiç kaldırılmaz.  
**Çözüm:** 
1. `closeOnOutside` referansını instance'da saklayın
2. `destroy()`'da `document.removeEventListener('click', closeOnOutside)` çağırın

---

### 2.4 🔴 `toolbar.js` — `#promptOverlay` Cleanup Eksik

**Dosya:** `src/toolbar.js`, `destroy()`  
**Sorun:** Kullanıcı link/image prompt açıkken `destroy()` çağrılırsa, overlay DOM'da kalır.

**Çözüm:** `destroy()` içinde:
```js
const overlay = document.querySelector('.rte-prompt-overlay');
if (overlay) overlay.remove();
```

---

### 2.5 🟡 `editor.js` — Placeholder Style Temizlenmiyor

**Dosya:** `src/editor.js`  
**Sorun:** Placeholder CSS global olarak bir kez enjekte ediliyor, `destroy()` ile kaldırılmıyor.

**Etki:** Küçük leak, tek instance'da sorun değil ama SPA'larda birikim yapabilir.

---

## 3. Veri Bütünlüğü Sorunları

### 3.1 🔴 `commands.js` — `setBlockType` Çoklu Blok Seçiminde Çalışmıyor

**Dosya:** `src/commands.js`, `setBlockType()` fonksiyonu  
**Sorun:** Sadece `selection.anchorNode`'un parent block'unu dönüştürüyor. Kullanıcı birden fazla paragrafı seçip "H2" yaptığında sadece ilk paragraf dönüşür.

**Çözüm:** Selection'daki tüm block elementlerini iterate edip her birini dönüştürün.

---

### 3.2 🔴 `commands.js` — `toggleList` Sonrası Cursor Kaybı

**Dosya:** `src/commands.js`, `toggleList()` fonksiyonu  
**Sorun:** Liste kaldırılırken (unwrap), oluşturulan paragraflar DOM'a ekleniyor ama cursor pozisyonu restore edilmiyor.

**Etki:** Kullanıcı liste toggle'ladığında cursor kaybolur, yeniden tıklamak gerekir.  
**Çözüm:** Unwrap sonrasında `sel.removeAllRanges()` + `sel.addRange(newRange)` ile cursor'ı son eklenen paragrafın sonuna yerleştirin.

---

### 3.3 🟡 `commands.js` — Image Komutu Block Wrapper Eksik

**Dosya:** `src/commands.js`, `image` komutu  
**Sorun:** `<img>` raw olarak ekleniyor, `<p>` veya `<figure>` ile sarılmıyor. Normalizer block wrapper ekler ama canlı DOM'da bir süre wrapsız kalır.

**Çözüm:** Image insert edilirken hemen bir `<p>` içine sarın.

---

### 3.4 🟡 `history.js` — Duplicate Snapshot'lar

**Dosya:** `src/history.js`, `push()` metodu  
**Sorun:** Aynı HTML içeriği art arda push edildiğinde (değişiklik yapmayan komutlar) yine yeni history entry oluşuyor.

**Etki:** Undo stack'te "hiçbir şey olmayan" adımlar birikir. Kullanıcı 5 kez Ctrl+Z basmalıyken 15 kez basmak zorunda kalabilir.  
**Çözüm:** Push'tan önce son entry ile karşılaştırın:
```js
if (this.currentHTML() === html) return;
```

---

### 3.5 🟡 `engine.js` — Debounce Timer Undo/Redo ile Çakışıyor

**Dosya:** `src/engine.js`  
**Sorun:** Kullanıcı yazar → debounce timer başlar → kullanıcı hemen Ctrl+Z yapar → debounce timer fire olur → undo'dan sonra yeni bir snapshot push eder → undo etkisiz kalır.

**Çözüm:** `undo()` ve `redo()` metotlarında `clearTimeout(this.#debounceTimer)` çağırın.

---

### 3.6 🟡 `normalizer.js` — Standalone `<li>` Invalid HTML Üretir

**Dosya:** `src/normalizer.js`  
**Sorun:** `<li>` ALLOWED_TAGS'da var ama BLOCK_TAGS'da yok. Bir `<li>` parent `<ul>/<ol>` olmadan gelirse, `<p>` ile sarılır → `<p><li>...</li></p>` = invalid HTML.

**Çözüm:** `ensureBlockWrappers()` içinde orphan `<li>`'ları `<ul>` ile sarın, veya `<li>`'yı `<p>`'ye dönüştürün.

---

## 4. Stability İyileştirmeleri

### 4.1 `engine.js` — `document.execCommand` Global Side Effects

**Dosya:** `src/engine.js`, constructor  
**Sorun:** `enableObjectResizing`, `enableInlineTableEditing`, `enableAbsolutePositionEditor` document-global olarak disable ediliyor. Sayfada başka editörler veya contenteditable alanlar varsa onları da etkiler.

**Risk:** Düşük ama multi-editor veya 3rd party integration senaryolarında sorun çıkabilir.  
**Not:** Tamamen çözmek zor (browser API'si global), ama en azından dokümante edilmeli.

---

### 4.2 `selection.js` — `restoreSelection` Sessiz Hata Yutma

**Dosya:** `src/selection.js`, `restoreSelection()` fonksiyonu  
**Sorun:** `catch(e) {}` — boş catch bloğu hataları tamamen yutar.

**Etki:** Selection restore başarısız olduğunda kullanıcı cursor kaybeder ama neden olduğu anlaşılamaz.  
**Çözüm:** En azından `console.warn` ile loglamak, veya daha iyisi fallback olarak editor sonuna cursor koymak.

---

### 4.3 `resizer.js` — Sol Handle'lar Yanlış Çalışıyor

**Dosya:** `src/resizer.js`  
**Sorun:** 4 handle (nw, ne, sw, se) tanımlı ama hepsi aynı `#onMouseDown` handler'ı kullanıyor. Bu handler sadece sağa-doğru resize hesaplıyor (`e.clientX - this.#startX`).

**Etki:** Sol handle'lardan (nw, sw) resize yapıldığında ters yönde çalışır.  
**Çözüm:** Handle pozisyonuna göre delta'yı ters çevirin:
```js
const delta = isLeftHandle ? -(e.clientX - this.#startX) : (e.clientX - this.#startX);
```

---

### 4.4 `resizer.js` — Touch Event Desteği Yok

**Dosya:** `src/resizer.js`  
**Sorun:** Sadece `mousedown/mousemove/mouseup` dinleniyor. Mobil cihazlarda `touchstart/touchmove/touchend` yok.

**Etki:** Mobil kullanıcılar image resize yapamaz.  
**Çözüm:** Touch event'leri ekleyin veya Pointer Events API'sine geçin (hem mouse hem touch'ı kapsar).

---

### 4.5 `resizer.js` — `#attachListeners()` Dead Code

**Dosya:** `src/resizer.js`, satır ~23-25  
**Sorun:** Boş method tanımlanmış, hiçbir yerden çağrılmıyor.

**Çözüm:** Silin veya gerçek işlevsellik ekleyin.

---

### 4.6 `resizer.js` — Scroll Sırasında Overlay Desync

**Sorun:** Overlay pozisyonu `getBoundingClientRect()` ile hesaplanıyor ama scroll listener yok.  
**Etki:** Editor scroll edildiğinde resize handle'ları image'dan kayar.  
**Çözüm:** Scroll event dinleyip overlay pozisyonunu güncelleyin.

---

### 4.7 `toolbar.js` — `#dropdown` Field Kullanılmıyor

**Dosya:** `src/toolbar.js`, satır ~53  
**Sorun:** `#dropdown` private field tanımlanıyor ama hiç atanmıyor. `destroy()` içinde kontrol ediliyor ama her zaman `undefined`.

**Çözüm:** Ya düzgün şekilde atanmasını sağlayın, ya da dead code olarak temizleyin.

---

## 5. Cilalama / Polish

### 5.1 `toolbar.js` — Heading Dropdown Aktif Durum Gösterimi

**Sorun:** Cursor bir `<h2>` içindeyken heading dropdown butonu görsel olarak değişmiyor. Kullanıcı hangi heading seviyesinde olduğunu bilemez.

**Çözüm:** `updateState()` içinde mevcut blok tipini kontrol edip dropdown trigger'ının text'ini veya stilini güncelleyin.

---

### 5.2 `toolbar.js` — Link Aktif Durum Gösterimi

**Sorun:** Cursor bir `<a>` tag'i içindeyken link butonu highlight olmaz.

**Çözüm:** `updateState()` içinde `findParentTag('a', ...)` kontrolü ekleyin.

---

### 5.3 `toolbar.js` — Prompt Overlay Animasyon Class'ları

**Sorun:** `animate-in`, `fade-in`, `slide-in-from-top-1` class'ları `tailwindcss-animate` eklentisine bağımlı. Bu eklenti projede dependency olarak yok.

**Etki:** Prompt animasyonsuz açılır (işlevsel sorun yok ama cilalanmamış görünür).  
**Çözüm:** Ya `tailwindcss-animate` dependency ekleyin, ya da inline `@keyframes` ile basit bir fade-in yapın.

---

### 5.4 `toolbar.js` — Dropdown Keyboard Navigation Eksik

**Sorun:** Toolbar butonları arasında keyboard navigation var ama dropdown açıldığında içindeki itemlar arasında arrow key ile gezilemez.

**Çözüm:** Dropdown açıkken ArrowDown/ArrowUp ile itemlar arasında focus geçişi ekleyin.

---

### 5.5 `resizer.js` — Resize Sırasında Cursor Geri Bildirimi

**Sorun:** Resize başladığında body cursor'ı değişmiyor. Kullanıcı handle'ı tutup sürüklerken normal cursor görünüyor.

**Çözüm:**
```js
document.body.style.cursor = 'nwse-resize'; // onMouseDown
document.body.style.cursor = '';             // onMouseUp
```

---

### 5.6 `resizer.js` — Maximum Genişlik Sınırı Yok

**Sorun:** Minimum 50px var ama maximum yok. Image, editor container'dan taşabilir.

**Çözüm:** `Math.min(newWidth, this.#img.parentElement.clientWidth)` ile parent genişliğe sınırlayın.

---

### 5.7 `commands.js` — `link` Komutu URL Doğrulaması

**Sorun:** Link komutu hiçbir URL doğrulaması yapmıyor. `javascript:` protokolü ile XSS mümkün (normalizer output'ta temizliyor ama canlı DOM'da bir süre var olabiliyor).

**Çözüm:** URL girişinde `javascript:`, `data:`, `vbscript:` protokollerini engelleyin.

---

### 5.8 `commands.js` — `clearFormatting` Sonrası Block Normalization

**Sorun:** `clearFormatting` plain text çıkarıp tekrar insert ediyor ama eğer sonuçta çıplak text node kalırsa (block wrapper olmadan), DOM geçersiz olabilir.

**Çözüm:** `clearFormatting` sonrasında `#ensureDefaultBlock()` çağrılmalı.

---

## 6. Test Altyapısı

### 6.1 🔴 4 Başarısız Test (Pre-existing)

```
FAIL tests/class-map.test.js — missing `pre` and `code` in CLASS_MAP
FAIL tests/icons.test.js — missing `codeBlock` icon  
FAIL tests/commands.test.js — missing `codeBlock` command
```

**Durum:** Bu testler henüz implement edilmemiş `code`/`codeBlock` özelliği için yazılmış.  
**Çözüm Seçenekleri:**
1. Testleri `test.skip()` ile işaretleyin + TODO comment
2. Veya `code`/`codeBlock` özelliğini implement edin (ama bu "yeni toolbar özelliği" kapsamında değil)

**Öneri:** `test.skip()` + açıklayıcı comment en uygun, çünkü bu rapor "yeni özellik eklenmeyecek" diyor.

---

### 6.2 🟡 Eksik Test Coverage

Şu senaryolar test edilmiyor:
- Multi-block selection ile heading değiştirme
- Paste handler davranışı
- Image resize (mouse event simulation)
- Undo/redo sonrası cursor pozisyonu
- `destroy()` sonrası memory leak kontrolü (listener count)
- ZWS cleanup
- `initialHTML` ile başlatma sonrası normalziation

---

## 7. Dev Ortamı / DX

### 7.1 `dev/index.html` — Typo

**Satır ~87:** `explorer.getHTML()` → `editor.getHTML()`

### 7.2 TypeScript Types — Eksik Tipler

**Dosya:** `types/index.d.ts`  
- `destroy()` return tipi belirtilmemiş (void olmalı)
- `classMap` option tipi `Record<string, string>` olarak verilmiş, ama nested yapıyı (`{ p: string, h1: string, ... }`) daha iyi temsil edecek explicit interface olmalı

### 7.3 Build Hedefi

- `package.json` hem UMD hem ESM export ediyor — doğru
- Source map config yok — production debugging zorlaşır
- `types` field `package.json`'da var — doğru

---

## 8. Öncelik Sıralaması

### 🔴 P0 — Hemen (Fonksiyonel Bug'lar)

| # | Sorun | Dosya | Etki |
|---|-------|-------|------|
| 1 | Paste handler dynamic import → race condition | `engine.js` | Paste bazen bozuk çalışır |
| 2 | ZWS birikimi → kirli HTML output | `commands.js` | Backend'e bozuk veri gider |
| 3 | `selectionchange` listener leak | `editor.js` | SPA'larda memory leak |
| 4 | Global style birikimi | `engine.js` | Multi-instance'da performans |
| 5 | Duplicate `focus()` method | `editor.js` | Sessiz override bug |
| 6 | `handleEnter` classMap tutarsızlığı | `engine.js` | Kullanıcı classMap override'ı bozuk |
| 7 | `dev/index.html` typo | `dev/index.html` | Dev playground çalışmaz |

### 🟠 P1 — Kısa Vadede (Stabilite)

| # | Sorun | Dosya | Etki |
|---|-------|-------|------|
| 8 | Dropdown listener leak | `toolbar.js` | Memory leak |
| 9 | Prompt overlay cleanup | `toolbar.js` | Destroy sonrası DOM kalıntısı |
| 10 | Debounce timer + undo çakışması | `engine.js` | Undo bazen çalışmaz |
| 11 | History duplicate snapshot | `history.js` | Gereksiz undo adımları |
| 12 | `toggleList` cursor kaybı | `commands.js` | UX bozuk |
| 13 | `setBlockType` multi-block | `commands.js` | Kısmi format uygulama |
| 14 | `restoreSelection` boş catch | `selection.js` | Debug zorlaşır |
| 15 | Resizer sol handle'lar | `resizer.js` | Ters yönde resize |
| 16 | Orphan `<li>` invalid HTML | `normalizer.js` | Bozuk çıktı |

### 🟡 P2 — Cilalama (UX & Polish)

| # | Sorun | Dosya | Etki |
|---|-------|-------|------|
| 17 | Heading dropdown aktif durum | `toolbar.js` | UX feedback eksik |
| 18 | Link aktif durum gösterimi | `toolbar.js` | UX feedback eksik |
| 19 | Touch event desteği (resizer) | `resizer.js` | Mobil kullanılamaz |
| 20 | Resize cursor feedback | `resizer.js` | UX polish |
| 21 | Image max genişlik sınırı | `resizer.js` | Image taşması |
| 22 | Link URL doğrulaması | `commands.js` | Güvenlik hardening |
| 23 | Dropdown keyboard navigation | `toolbar.js` | A11y |
| 24 | Başarısız testleri skip'le | `tests/*` | CI yeşil olsun |
| 25 | Dead code temizliği | `resizer.js`, `toolbar.js` | Kod temizliği |
| 26 | Scroll sırasında overlay sync | `resizer.js` | Edge case |

### 🔵 P3 — Nice-to-Have

| # | Sorun | Dosya | Etki |
|---|-------|-------|------|
| 27 | Prompt animasyon class'ları | `toolbar.js` | Görsel polish |
| 28 | Source map config | `vite.config.js` | Debug DX |
| 29 | TypeScript tip iyileştirme | `types/index.d.ts` | DX |
| 30 | `clearFormatting` block norm. | `commands.js` | Edge case |
| 31 | Image block wrapper | `commands.js` | DOM consistency |
| 32 | `execCommand` global etki doc | `engine.js` | Dokümantasyon |

---

## Toplam Özet

| Kategori | Sayı |
|----------|------|
| Kritik Bug (P0) | 7 |
| Stabilite (P1) | 9 |
| Cilalama (P2) | 10 |
| Nice-to-Have (P3) | 6 |
| **Toplam** | **32** |

---

*Bu rapor toolbar'a yeni özellik eklenmeyecek şekilde, mevcut kodun kalitesini ve güvenilirliğini artırmaya yönelik bulguları içerir.*
