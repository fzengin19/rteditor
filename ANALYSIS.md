# RTEditor - Kapsamli Kod Analizi ve Bug Raporu

> **Tarih**: 10 Subat 2026  
> **Versiyon**: 0.1.0  
> **Analiz Kapsamı**: Tüm kaynak dosyaları (11 modül, ~2200 satır), 15 test dosyası (92 test)  
> **Tüm testler geçiyor**: ✅ 92/92

---

## İçindekiler

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Kritik Buglar (Yüksek Öncelik)](#2-kritik-buglar-yüksek-öncelik)
3. [Orta Seviye Buglar](#3-orta-seviye-buglar)
4. [Düşük Seviye Buglar / Edge Case'ler](#4-düşük-seviye-buglar--edge-caseler)
5. [Performans Sorunları](#5-performans-sorunları)
6. [UX İyileştirmeleri](#6-ux-iyileştirmeleri)
7. [Stabilite İyileştirmeleri](#7-stabilite-iyileştirmeleri)
8. [Güvenlik Değerlendirmesi](#8-güvenlik-değerlendirmesi)
9. [Kod Kalitesi ve Mimari](#9-kod-kalitesi-ve-mimari)
10. [Test Kapsamı Boşlukları](#10-test-kapsamı-boşlukları)
11. [Özet ve Önceliklendirme](#11-özet-ve-önceliklendirme)

---

## 1. Proje Genel Bakış

RTEditor, Tailwind CSS v4 sınıfları üreten, bağımlılık gerektirmeyen (zero-dependency) bir WYSIWYG zengin metin editörüdür. Mimari olarak temiz bir modüler yapıya sahiptir:

| Modül | Satır | Sorumluluk |
|-------|-------|------------|
| `editor.js` | 245 | Ana RichTextEditor sınıfı, UI orchestration |
| `engine.js` | 484 | ContentEditable yönetimi, event handling |
| `commands.js` | 426 | Inline/block/list/link/image formatting komutları |
| `selection.js` | 120 | Selection serialization, DOM traversal |
| `history.js` | 145 | Delta-compressed undo/redo |
| `toolbar.js` | 347 | Toolbar UI, keyboard navigation, dropdown |
| `normalizer.js` | 230 | HTML sanitization, tag normalization |
| `resizer.js` | 193 | Image resize (mouse/touch/keyboard) |
| `class-map.js` | ~40 | Tailwind CSS class mappings |
| `icons.js` | ~80 | SVG icon definitions |
| `index.js` | ~15 | Public API exports |

---

## 2. Kritik Buglar (Yüksek Öncelik)

### BUG-001: `getRawHTML()` Aslında Raw HTML Döndürmüyor

**Dosya**: `src/editor.js`, satır 197-199  
**Ciddiyet**: 🔴 Yüksek — API kontratı ihlali

```javascript
// Mevcut kod - HER İKİSİ DE AYNI ŞEYİ YAPIYOR
getHTML() {
  return this.#engine.getHTML(); // normalize edilmiş
}
getRawHTML() {
  return this.#engine.getHTML(); // Bu da normalize edilmiş! BUG!
}
```

**Sorun**: `getRawHTML()` metodu `getHTML()` ile birebir aynı çıktıyı üretiyor. Her ikisi de `engine.getHTML()` çağırıyor, bu da `normalizeHTML(this.#root.innerHTML)` döndürüyor. Kullanıcı raw (normalize edilmemiş) HTML'e erişemiyor.

**Beklenen davranış**: 
```javascript
getRawHTML() {
  return this.#engine.contentEl.innerHTML;
}
```

**Etki**: API'yi kullanan geliştiriciler raw HTML'e ihtiyaç duyduğunda yanıltıcı veri alıyor. TypeScript type tanımında (`types/index.d.ts`) `getRawHTML()` ayrı bir metot olarak belgelenmiş.

---

### BUG-002: Liste Elemanlarını Çıkarırken Sıra Tersine Dönüyor

**Dosya**: `src/commands.js`, satır 145-160  
**Ciddiyet**: 🔴 Yüksek — Veri bozulması

```javascript
if (isInTargetList) {
  leafBlocks.forEach(li => {
    if (li.tagName !== 'LI') return;
    const p = document.createElement('p');
    // ...
    const list = li.parentElement;
    if (list) {
      list.parentNode.insertBefore(p, list.nextSibling); // HER ZAMAN listenin hemen sonrasına
      li.remove();
      if (list.children.length === 0) list.remove();
    }
  });
}
```

**Sorun**: Birden fazla liste elemanı seçilip listeyi kaldırdığında, her eleman `list.nextSibling` konumuna ekleniyor. İlk eleman listenin arkasına gider, ikinci eleman da listenin arkasına gider (ama birincinin önüne), üçüncü birincinin önüne... Sonuç: **elementlerin sırası tersine dönüyor**.

**Senaryo**:
```
Başlangıç: [Liste: LI-A, LI-B, LI-C]
İterasyon 1: LI-A → P-A listenin arkasına. [Liste(LI-B, LI-C), P-A]
İterasyon 2: LI-B → P-B listenin arkasına. [Liste(LI-C), P-B, P-A]
İterasyon 3: LI-C → P-C listenin arkasına. [P-C, P-B, P-A]  ← TERS SIRA!
```

**Düzeltme**: Ekleme referans noktasını takip etmek gerekiyor:
```javascript
let insertRef = list.nextSibling;
leafBlocks.forEach(li => {
  // ...
  list.parentNode.insertBefore(p, insertRef);
  // insertRef değişmez, her yeni p bunun ÖNÜNE eklenir
});
```

---

### BUG-003: Blockquote Çıkarırken Aynı Sıra Terslenme Sorunu

**Dosya**: `src/commands.js`, satır 224-238  
**Ciddiyet**: 🔴 Yüksek — BUG-002 ile aynı pattern

```javascript
if (isInBlockquote) {
  leafBlocks.forEach(block => {
    const bq = findParentTag(block, 'blockquote', root);
    if (!bq) return;
    const p = document.createElement('p');
    // ...
    bq.parentNode.insertBefore(p, bq.nextSibling); // Aynı bug!
    block.remove();
    if (bq.children.length === 0) bq.remove();
  });
}
```

**Sorun**: BUG-002 ile birebir aynı mantık hatası. Birden fazla paragraf içeren bir blockquote'tan çıkarıldığında paragrafların sırası tersine dönüyor.

---

### BUG-004: Placeholder Event Listener'ları `destroy()` Sırasında Temizlenmiyor

**Dosya**: `src/editor.js`, satır 158-189 vs 230-243  
**Ciddiyet**: 🔴 Yüksek — Memory leak

```javascript
#setupPlaceholder() {
  const updatePlaceholder = () => { /* ... */ };  // Anonim fonksiyon
  
  contentEl.addEventListener('input', updatePlaceholder);   // ❌ Referans kayboluyor
  contentEl.addEventListener('focus', updatePlaceholder);   // ❌ Referans kayboluyor
  contentEl.addEventListener('blur', updatePlaceholder);    // ❌ Referans kayboluyor
}

destroy() {
  // ... placeholder listener'ları TEMİZLENMİYOR!
  this.#engine.destroy();
  this.#toolbar.destroy();
  this.#wrapper.remove();
}
```

**Sorun**: `updatePlaceholder` fonksiyonu `#setupPlaceholder` metodunun local scope'unda tanımlı. Sınıf düzeyinde referans tutulmadığı için `destroy()` sırasında `removeEventListener` çağrılamıyor. Bu, özellikle SPA'larda tekrarlanan editor oluşturma/yok etme döngülerinde memory leak'e neden olur.

**Düzeltme**: `updatePlaceholder` referansını sınıf düzeyinde saklamak:
```javascript
this._placeholderHandler = updatePlaceholder;
// destroy() içinde:
contentEl.removeEventListener('input', this._placeholderHandler);
// ...
```

---

### BUG-005: `clearFormatting` Komutu Linkleri ve Görselleri Siliyor

**Dosya**: `src/commands.js`, satır 384-397  
**Ciddiyet**: 🔴 Yüksek — Veri kaybı

```javascript
const clearInline = (node, target) => {
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(child.cloneNode());
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') {
        target.appendChild(child.cloneNode());
      } else {
        clearInline(child, target); // Link (<a>), image (<img>) dahil HER element siliniyor
      }
    }
  });
};
```

**Sorun**: `clearInline` fonksiyonu BR hariç tüm element node'larını özyinelemeli olarak çözüyor. Bu şu anlama geliyor:
- `<a href="...">link text</a>` → sadece "link text" kalıyor (link kaybolur)
- `<img src="...">` → tamamen siliniyor (boş children)
- `<code>snippet</code>` → sadece text kalıyor

**Beklenen**: clearFormatting yalnızca inline stil etiketlerini (strong, em, u, s) temizlemeli; linkler, görseller ve code etiketleri korunmalıdır.

---

## 3. Orta Seviye Buglar

### BUG-006: Engine'deki `on('change')` Listener'ı Kaldırılamıyor

**Dosya**: `src/engine.js`, satır 61-64  
**Ciddiyet**: 🟡 Orta

```javascript
on(event, callback) {
  if (!this.#listeners[event]) this.#listeners[event] = [];
  this.#listeners[event].push(callback);
}
// off() metodu YOK!
```

**Sorun**: `EditorEngine` sınıfında `on()` metodu var ama `off()` metodu yok. `editor.js` içindeki `#setupResizer` bölümünde `this.#engine.on('change', ...)` ile eklenen listener asla kaldırılamıyor. `destroy()` sırasında `this.#listeners = {}` ile toplu temizlik yapılıyor ama bu yalnızca Engine'in kendi destroy'unda gerçekleşiyor.

**Etki**: Event listener yönetimi eksik. Dış bileşenlerin engine event'lerine subscribe olup unsubscribe olması mümkün değil.

---

### BUG-007: Paste İşleminde Cursor Pozisyonu Doğru Ayarlanmıyor

**Dosya**: `src/engine.js`, satır 251-257  
**Ciddiyet**: 🟡 Orta

```javascript
// Plain text paste
const sel = window.getSelection();
if (sel && sel.rangeCount) {
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(fragment);    // Fragment'in tüm children'ları range'e eklenir
  range.collapse(false);         // BUG: Range'in sonu fragment'in sonuna gitmeyebilir
}
```

**Sorun**: `range.insertNode(fragment)` çağrıldıktan sonra range'in boundary'leri güncellenmez. `range.collapse(false)` range'in end boundary'sine collapse eder, ama bu eklenen içeriğin sonuna denk gelmeyebilir. Sonuç: cursor yapıştırılan metnin başında veya ortasında kalabilir.

**Düzeltme**: Fragment'in son child'ını takip edip, collapse'tan sonra cursor'ı ona taşımak:
```javascript
const lastNode = fragment.lastChild; // fragment boşalacak, önceden al
range.insertNode(fragment);
if (lastNode) {
  range.setStartAfter(lastNode);
  range.collapse(true);
}
```

---

### BUG-008: `toggleInline` Multi-Node Selection'da Tutarsız Davranıyor

**Dosya**: `src/commands.js`, satır 15-59  
**Ciddiyet**: 🟡 Orta

```javascript
function toggleInline(tagName) {
  // ...
  const existing = findParentTag(range.startContainer, tagName, root);
  // ↑ Sadece range.startContainer kontrol ediliyor!
}
```

**Sorun**: `findParentTag` yalnızca selection'ın başlangıç container'ını kontrol ediyor. Eğer selection birden fazla node'u kapsıyor ve bazılarında ilgili format var bazılarında yoksa, davranış tutarsız olur.

**Senaryo**:
```html
<p><strong>bold text</strong> normal text</p>
<!-- Tüm satır seçilip Bold uygulandığında: -->
<!-- "bold text" zaten strong içinde olduğu için unwrap oluyor -->
<!-- ama "normal text" wrap EDİLMİYOR -->
```

**Beklenen**: Tüm seçili metnin durumuna bakarak toggle kararı verilmeli (tamamı formatted ise unwrap, değilse wrap).

---

### BUG-009: İlk Yükleme Sırasında Gereksiz History Girişi

**Dosya**: `src/engine.js`, satır 48-49 ve `src/editor.js`, satır 92-94  
**Ciddiyet**: 🟡 Orta — UX sorunu

```javascript
// engine.js constructor:
this.#history.push(); // Boş editör durumu kaydedilir (<p><br></p>)

// editor.js #init:
if (this.#options.initialHTML) {
  this.setHTML(this.#options.initialHTML); // Bu da history.push() çağırır
}
```

**Sorun**: `initialHTML` sağlandığında, history stack'inde iki giriş oluşuyor:
1. `[0]`: Boş editör (`<p><br></p>`)
2. `[1]`: Initial content

İlk undo yapıldığında kullanıcı **boş editöre** düşer, ki bu genellikle istenmeyen bir davranıştır. Kullanıcı initial content'e ilk undo'da geri döneceğini bekler.

---

### BUG-010: Heading Dropdown Escape Tuşuyla Kapanmıyor

**Dosya**: `src/toolbar.js`, satır 230-235  
**Ciddiyet**: 🟡 Orta — Erişilebilirlik

```javascript
btn.addEventListener('click', (e) => {
  e.preventDefault();
  const isHidden = dropdown.classList.toggle('hidden');
  btn.setAttribute('aria-expanded', (!isHidden).toString());
});
// Escape tuşu dinlenmiyor!
```

**Sorun**: Heading dropdown'u açıldığında, kapatmak için tek yol dışarı tıklamak. Escape tuşu desteklenmiyor. WAI-ARIA Menubutton pattern'ine göre Escape tuşu dropdown'u kapatmalı ve focus'u trigger button'a döndürmelidir.

---

### BUG-011: Resizer Overlay Pozisyonu Scroll'da Güncellenmesi Gerekiyor

**Dosya**: `src/resizer.js`, satır 70-89  
**Ciddiyet**: 🟡 Orta

```javascript
#updateOverlayPosition() {
  // offsetTop/offsetLeft tabanlı pozisyonlama
  while (current && current !== root) {
    top += current.offsetTop;
    left += current.offsetLeft;
    current = current.offsetParent;
  }
}
```

**Sorun**: Overlay pozisyonu sadece oluşturulduğunda ve resize sırasında güncelleniyor. Editör içerik alanı scroll edildiğinde overlay güncellenmiyor, bu da overlay'in görselden kaymasına neden olur.

**Eksik**: `scroll` event listener eklenmesi gerekiyor. Ayrıca pencere `resize` event'i de göz ardı ediliyor.

---

### BUG-012: `normalizeElement` li/pre Etiketlerini Root-Level Block Olarak Tanımıyor

**Dosya**: `src/normalizer.js`, satır 35  
**Ciddiyet**: 🟡 Orta

```javascript
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote']);
// 'li' ve 'pre' yok!
```

`selection.js` dosyasındaki `BLOCK_TAGS` array'i `li` ve `pre` içeriyor, ancak normalizer'daki `BLOCK_TAGS` set'i içermiyor. Bu tutarsızlık, normalizer'ın `ensureBlockWrappers` fonksiyonunda `<li>` veya `<pre>` root-level'da kalırsa bunları `<p>` içine sarmaya çalışmasına neden olabilir.

---

## 4. Düşük Seviye Buglar / Edge Case'ler

### BUG-013: Global CSS Stilleri Tüm Instance'lar Yok Edildikten Sonra Kalıyor

**Dosyalar**: `src/editor.js` satır 168-184, `src/engine.js` satır 34-43  
**Ciddiyet**: 🟢 Düşük

İki global `<style>` elementi (`rt-editor-placeholder-styles`, `rt-editor-engine-styles`) `document.head`'e ekleniyor ama hiçbir zaman kaldırılmıyor. Tüm editor instance'ları yok edildikten sonra bile bu stiller DOM'da kalıyor.

**Etki**: Minimal. Stil çakışma riski düşük ama SPA'larda temiz olmayan DOM bırakıyor.

---

### BUG-014: Image Komutu src URL'ini Doğrulamıyor

**Dosya**: `src/commands.js`, satır 332-354  
**Ciddiyet**: 🟢 Düşük (normalizer sonradan temizler)

```javascript
commands.set('image', (src, alt = '') => {
  if (!src) return;
  // ...
  img.src = src; // Doğrudan atama, sanitizasyon yok
});
```

**Sorun**: `img.src` doğrudan atanıyor, hiçbir URL validasyonu yok. `javascript:` veya `vbscript:` gibi zararlı scheme'ler kullanılabilir. Normalizer `getHTML()` çağrıldığında temizler, ama DOM'da geçici olarak zararlı URL bulunur ve tarayıcı bunu yüklemeye çalışabilir.

---

### BUG-015: `#justResized` Flag'i Race Condition'a Açık

**Dosya**: `src/editor.js`, satır 132-135  
**Ciddiyet**: 🟢 Düşük

```javascript
this.#justResized = true;
setTimeout(() => { this.#justResized = false; }, 100);
```

**Sorun**: 100ms sabit timeout sihirli bir sayı (magic number). Yavaş cihazlarda 100ms yetmeyebilir, hızlı cihazlarda gereksiz yere uzun kalabilir. `requestAnimationFrame` veya event-driven bir mekanizma daha güvenilir olurdu.

---

### BUG-016: `restoreSelection` Offset Sınır Kontrolü `length` vs `childNodes.length` Karışıklığı

**Dosya**: `src/selection.js`, satır 102-103  
**Ciddiyet**: 🟢 Düşük

```javascript
range.setStart(startNode, Math.min(saved.startOffset, startNode.length || startNode.childNodes.length));
range.setEnd(endNode, Math.min(saved.endOffset, endNode.length || endNode.childNodes.length));
```

**Sorun**: `startNode.length` text node'lar için `textContent.length` döner, element node'lar için `undefined`. `undefined || childNodes.length` doğru çalışır. Ama `startNode.length === 0` olduğunda (boş text node), `0 || childNodes.length` çalışır ki boş text node'un `childNodes` yoktur → `undefined` döner. Bu edge case try/catch ile yakalanıyor ama sessizce başarısız oluyor.

---

### BUG-017: `style` Attribute'u img Etiketinde İçerik Validasyonu Yok

**Dosya**: `src/normalizer.js`, satır 26  
**Ciddiyet**: 🟢 Düşük (CSS injection)

```javascript
const ALLOWED_ATTRS = {
  img: ['src', 'alt', 'title', 'style'], // style gerekli: resize boyutları için
};
```

**Sorun**: `style` attribute'u img'de izin veriliyor (resize width/height için gerekli) ama içeriği hiç valide edilmiyor. Kötü niyetli bir kullanıcı yapıştırmayla `style="background:url(tracking-pixel.gif)"` gibi değerler enjekte edebilir.

**Önerilen düzeltme**: Style attribute'unu whitelist'lemek (sadece `width` ve `height` izin):
```javascript
if (name === 'style') {
  const sanitized = attr.value.replace(/[^;:\s\w\d%px(auto)]/g, '');
  el.setAttribute('style', sanitized);
}
```

---

## 5. Performans Sorunları

### PERF-001: Her Input'ta Tüm DOM Normalize Ediliyor (KRİTİK)

**Dosya**: `src/engine.js`, satır 156-158  
**Ciddiyet**: 🔴 Yüksek performans etkisi

```javascript
#onInput = (e) => {
  this.#handleInput(e);
  this.#normalizeContent(); // ← HER TUŞA BASIMDA ÇALIŞIYOR
};
```

`#normalizeContent()` → `normalizeElement(this.#root)` → `processNodes` → `container.querySelectorAll('*')` çağrı zinciri:

1. Tüm DOM elemanlarını toplar
2. Her birini kontrol eder (blocked tag, alias, allowed)
3. Class'ları uygular
4. Attribute'ları sanitize eder
5. ZWS temizliği yapar
6. `ensureBlockWrappers` çalıştırır

**Büyük dokümanlarda** (100+ element), her tuşa basımda bu tam traversal yapılıyor.

**Önerilen çözümler**:
- Normalizasyonu debounce etmek (300ms+)
- Sadece değişen bölümü normalize etmek (MutationObserver ile)
- Input sırasında lightweight check, idle'da full normalization

---

### PERF-002: `emitChange()` Her Çağrıda Tam HTML Normalizasyonu Yapıyor

**Dosya**: `src/engine.js`, satır 464-468  
**Ciddiyet**: 🟡 Orta performans etkisi

```javascript
#emitChange() {
  const html = this.getHTML();         // normalizeHTML(innerHTML) — full DOMParser parse
  this.#onChange(html);
  this.#emit('change', html);
}
```

`getHTML()` her çağrıda:
1. `new DOMParser().parseFromString(html, 'text/html')` — tam HTML dokümanı parse
2. `normalizeElement(container)` — tam traversal
3. `container.innerHTML` — serialization

Bu fonksiyon her input event'inde çağrılıyor (`#handleInput` → `#emitChange`).

**Önerilen**: onChange callback'ini debounce etmek veya dirty flag ile lazy evaluation yapmak.

---

### PERF-003: History Duplicate Check'te Gereksiz HTML Reconstruction

**Dosya**: `src/history.js`, satır 34-38  
**Ciddiyet**: 🟢 Düşük performans etkisi

```javascript
if (this.#stack.length > 0 && this.#index >= 0) {
  const lastEntry = this.#stack[this.#index];
  const lastHTML = lastEntry.fullHTML || this.#reconstructHTML(this.#index);
  if (lastHTML === html) return;
}
```

Son giriş delta ise, her push'ta `#reconstructHTML` çağrılıyor. Bu fonksiyon geriye doğru en yakın fullHTML'e yürür ve tüm delta'ları sırayla uygular. 19 delta biriktiğinde (fullHTML her 20 girişte bir), bu 19 string operasyonu demek.

**Önerilen**: Son reconstruct edilen HTML'i cache'lemek:
```javascript
this._lastReconstructedHTML = html; // push sonunda güncelle
```

---

### PERF-004: `selectionchange` Listener'ı Document Seviyesinde

**Dosya**: `src/editor.js`, satır 102-108  
**Ciddiyet**: 🟢 Düşük performans etkisi

```javascript
this._selectionHandler = () => {
  if (this._selectionRaf) cancelAnimationFrame(this._selectionRaf);
  this._selectionRaf = requestAnimationFrame(() => {
    this.#toolbar.updateState(this.#engine.contentEl);
  });
};
document.addEventListener('selectionchange', this._selectionHandler);
```

rAF throttling iyi bir pratik. Ancak `selectionchange` event'i doküman genelinde her selection değişikliğinde tetikleniyor — editör dışındaki selection'lar için de. `updateState` içinde `editorRoot.contains(node)` kontrolü var ama event handler yine de her seferinde çalışıyor.

**Önerilen**: Handler'ın başında editör focus kontrolü eklemek:
```javascript
if (document.activeElement !== this.#engine.contentEl) return;
```

---

## 6. UX İyileştirmeleri

### UX-001: Shift+Enter Soft Line Break Desteği Eksik

**Dosya**: `src/engine.js`, satır 178-181  
**Öncelik**: 🔴 Yüksek

```javascript
if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  this.#handleEnter();
}
// Shift+Enter tamamen işlenmiyor!
```

**Mevcut**: Shift+Enter'a basıldığında tarayıcı varsayılan davranışını uygular (genellikle `<div>` veya naked `<br>` ekler). Bu, editörün normalize ettiği yapıyla tutarsız olabilir.

**Beklenen**: Shift+Enter `<br>` elemanı eklemelidir (soft line break / satır sonu).

---

### UX-002: Tab/Shift+Tab Liste Girintileme Desteği Yok

**Dosya**: `src/engine.js`  
**Öncelik**: 🟡 Orta

Liste elemanlarında Tab tuşuna basıldığında alt liste (nested list) oluşturma ve Shift+Tab ile bir seviye yukarı çıkma işlevi mevcut değil. Çoğu WYSIWYG editör bu davranışı destekler.

---

### UX-003: Ctrl+Y Redo Kısayolu Eksik (Windows Konvansiyonu)

**Dosya**: `src/engine.js`, satır 171-175  
**Öncelik**: 🟡 Orta

```javascript
if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
  switch (e.key.toLowerCase()) {
    case 'z': e.preventDefault(); this.exec('redo'); return;
    // Ctrl+Y eksik!
  }
}
```

**Sorun**: Windows kullanıcıları Ctrl+Y'ye alışıktır ama sadece Ctrl+Shift+Z destekleniyor.

---

### UX-004: Heading Dropdown Mevcut Seçili Seviyeyi Göstermiyor

**Dosya**: `src/toolbar.js`  
**Öncelik**: 🟡 Orta

Heading dropdown butonu her zaman aynı ikonu gösteriyor. Aktif heading seviyesi sadece dropdown açıldığında arka plan rengiyle belirtiliyor. Kullanıcı dropdown'u açmadan mevcut heading seviyesini göremez.

**Önerilen**: Buton metninde/ikonunda mevcut heading seviyesini yansıtmak (ör. "H1", "H2", "P").

---

### UX-005: Link Prompt'unda Mevcut Link Bilgileri Gösterilmiyor

**Dosya**: `src/toolbar.js`, satır 136-188  
**Öncelik**: 🟡 Orta

Kullanıcı bir linkin üzerine tıklayıp "Link" butonuna bastığında, prompt boş açılıyor. Mevcut linkin URL'i input'a doldurulmuyor. Düzenleme yerine yeni link oluşturma izlenimi veriyor.

---

### UX-006: Image Eklerken Önizleme Yok

**Dosya**: `src/toolbar.js` (prompt mekanizması)  
**Öncelik**: 🟢 Düşük

URL girildikten sonra "Apply" butonuna basılmadan önce görselin bir önizlemesi gösterilmiyor. Yanlış URL girildiğinde kırık görsel ekleniyor.

---

### UX-007: Resizer'da Maksimum Genişlik Sınırı Yok

**Dosya**: `src/resizer.js`, satır 143-144  
**Öncelik**: 🟢 Düşük

```javascript
const newWidth = Math.max(50, this.#startWidth + delta);
// Minimum var (50px), ama maksimum YOK
```

Görsel, editör alanının genişliğini aşacak şekilde büyütülebilir, bu da yatay scrollbar oluşturabilir ve layout'u bozabilir.

---

### UX-008: Boş Editörde İlk Tıklamada Cursor Görünmeyebilir

**Dosya**: `src/engine.js` ve placeholder CSS  
**Öncelik**: 🟢 Düşük

Placeholder CSS'te `position: absolute` kullanılıyor ama `left` ve `top` değerleri belirtilmemiyor. Bazı tarayıcılarda (özellikle padding'li editör alanlarında) placeholder metni beklenmedik konumda görünebilir.

---

### UX-009: Toolbar Prompt'unda Focus Trap Yok

**Dosya**: `src/toolbar.js`, satır 136-188  
**Öncelik**: 🟢 Düşük — Erişilebilirlik

`aria-modal="true"` ayarlanmış ama gerçek bir focus trap implementasyonu yok. Tab tuşuyla prompt dışına çıkılabilir. Modal semantiği ile gerçek davranış uyuşmuyor.

---

## 7. Stabilite İyileştirmeleri

### STAB-001: `destroy()` Çift Çağrılma Durumunda Güvenli Değil

**Dosya**: `src/editor.js`, satır 230-243  
**Öncelik**: 🟡 Orta

`destroy()` iki kez çağrılırsa:
- `this.#engine.destroy()` ikinci çağrıda event listener'ları tekrar kaldırmaya çalışır (zararsız)
- `this.#wrapper.remove()` ikinci çağrıda zaten DOM'dan çıkartılmış element üzerinde çalışır (zararsız)
- Ama `this.#currentResizer?.destroy()` ikinci çağrıda overlay zaten kaldırılmışsa sorun yok

**Önerilen**: `#destroyed` flag'i eklemek:
```javascript
destroy() {
  if (this.#destroyed) return;
  this.#destroyed = true;
  // ...
}
```

---

### STAB-002: Event Listener'larda Error Handling Eksik

**Dosya**: `src/engine.js` — `#onKeydown`, `#onPaste`, `#onInput`  
**Öncelik**: 🟡 Orta

Event handler'lar try/catch ile sarılmamış. Eğer bir handler hata fırlatırsa, diğer listener'lar çalışmaz ve editör yanıt vermez hale gelebilir.

**Özellikle riskli yerler**:
- `#handleEnter()` — DOM manipülasyonu yoğun
- `#handlePaste()` — Dış veri (clipboard) işleme
- `#normalizeContent()` — Beklenmeyen DOM yapısı

---

### STAB-003: `EditorEngine.destroy()` `aria-label` Attribute'unu Kaldırmıyor

**Dosya**: `src/engine.js`, satır 470-482  
**Öncelik**: 🟢 Düşük

```javascript
destroy() {
  // ...
  this.#root.removeAttribute('contenteditable');
  this.#root.removeAttribute('role');
  this.#root.removeAttribute('aria-multiline');
  // aria-label kaldırılmıyor!
}
```

---

### STAB-004: `off()` Metodu Olmaması Nedeniyle Dış Event Yönetimi İmkansız

**Dosya**: `src/engine.js`  
**Öncelik**: 🟡 Orta

`on()` metodu public ama `off()` metodu yok. Bu, EditorEngine'i kullanan dış bileşenlerin event listener'larını temizleyememesi anlamına geliyor. Bu API eksikliği, entegrasyon senaryolarında memory leak'lere yol açabilir.

---

## 8. Güvenlik Değerlendirmesi

### Genel Durum: ✅ İYİ

Güvenlik mimarisi genel olarak sağlam. `normalizer.js` XSS ve injection vektörlerinin çoğunu doğru şekilde ele alıyor.

### Güçlü Yönler:

| Kontrol | Durum | Açıklama |
|---------|-------|----------|
| Script tag engelleme | ✅ | BLOCKED_TAGS set'inde |
| Event handler attribute'ları | ✅ | `on*` prefix kontrolü |
| javascript: scheme | ✅ | BLOCKED_PROTOCOLS ve BLOCKED_LINK_PROTOCOLS |
| data: URI (linkler) | ✅ | BLOCKED_LINK_PROTOCOLS'da |
| data: URI (görseller) | ✅ İzin veriliyor | Paste edilen görseller için gerekli |
| HTML entity bypass | ✅ | DOMParser otomatik decode eder |
| Tag aliasing (b→strong) | ✅ | Semantik doğruluk |
| iframe/embed/object | ✅ | BLOCKED_TAGS'da |
| Attribute whitelist | ✅ | Tag bazında whitelist |

### Potansiyel Zayıf Noktalar:

| Risk | Ciddiyet | Açıklama |
|------|----------|----------|
| CSS injection via `style` attr | 🟢 Düşük | img etiketinde style izin veriliyor, içerik valide edilmiyor (BUG-017) |
| Komut çalıştırma öncesi sanitizasyon | 🟡 Orta | Image src doğrudan DOM'a set ediliyor (BUG-014) |
| `rel="noopener noreferrer"` | ✅ | Link komutunda doğru ayarlanmış |
| `target="_blank"` | ✅ | Dış linkler yeni sekmede açılıyor |

---

## 9. Kod Kalitesi ve Mimari

### Güçlü Yönler:

1. **Modüler mimari**: Her modül tek sorumluluk prensibine uygun
2. **Private field kullanımı**: `#` prefix ile gerçek kapsülleme
3. **Zero dependency**: Hiçbir dış bağımlılık yok (sadece devDeps: vite, vitest)
4. **Delta compression**: History modülünde akıllı delta sıkıştırma
5. **ARIA desteği**: Role, aria-label, aria-pressed, roving tabindex
6. **Touch desteği**: Resizer'da mouse + touch + keyboard desteği
7. **Tailwind class mapping**: Konfigüre edilebilir class map

### İyileştirme Alanları:

#### QUAL-001: BLOCK_TAGS Tanımı Çift Yerde ve Tutarsız

**Dosyalar**: `src/selection.js` satır 6, `src/normalizer.js` satır 35

```javascript
// selection.js
export const BLOCK_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre'];

// normalizer.js
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote']);
// 'li' ve 'pre' EKSİK!
```

İki farklı `BLOCK_TAGS` tanımı var ve listeleri farklı. Bu DRY prensibinin ihlali ve hatalara davetiye çıkarıyor.

---

#### QUAL-002: Tekrarlanan "Leaf Block" Bulma Kodu

**Dosya**: `src/commands.js` — 5 kez tekrarlanıyor (satır 77-90, 126-138, 206-218, 367-376 ve toggleList)

```javascript
// Bu pattern 5 kez birebir copy-paste edilmiş:
const allBlocks = Array.from(root.querySelectorAll(BLOCK_TAGS.join(',')));
const selectedBlocks = allBlocks.filter(block => range.intersectsNode(block));
const leafBlocks = selectedBlocks.filter(block => {
  return !selectedBlocks.some(other => block !== other && block.contains(other));
});
```

**Önerilen**: Bu mantığı yardımcı fonksiyona çıkarmak:
```javascript
function getSelectedLeafBlocks(root, range) { /* ... */ }
```

---

#### QUAL-003: Duplicated JSDoc Comment

**Dosya**: `src/commands.js`, satır 4-9

```javascript
/**
 * Create a command registry bound to an editor root element.
 */
/**
 * Create a command registry bound to an editor root element.
 */
export function createCommandRegistry(root, classMap = CLASS_MAP) {
```

Aynı JSDoc yorumu iki kez yazılmış.

---

#### QUAL-004: `#dropdown` Private Field'ı Kullanılmıyor

**Dosya**: `src/toolbar.js`, satır 53

```javascript
#dropdown = null; // Bu field ASLA güncellenmıyor
```

`#dropdown` tanımlı ama `#createDropdown` içinde kullanılmıyor. Dropdown referansı `wrapper` değişkeninde tutuluyor, `#dropdown`'a atanmıyor. `destroy()` içinde `this.#dropdown` kontrol ediliyor ama her zaman `null`.

---

#### QUAL-005: Tutarsız Event Listener Pattern'leri

**Dosya**: Tüm kaynak dosyaları

Engine'de arrow function class field pattern'i kullanılıyor:
```javascript
#onKeydown = (e) => { /* ... */ };
```

Editor'da bazı handler'lar bound function, bazıları arrow:
```javascript
this._selectionHandler = () => { /* ... */ };   // Tanımlanmış
this.#onClick = (e) => { /* ... */ };            // Arrow class field
this._resizerCleanup = (e) => { /* ... */ };     // Tanımlanmış ama _ prefix
```

Naming convention tutarsız: Bazı listener'lar `_prefix` (semi-private), bazıları `#prefix` (tam private).

---

## 10. Test Kapsamı Boşlukları

### Mevcut durum: 92 test, 15 test dosyası — temel işlevler iyi kapsanmış.

### Eksik Test Senaryoları:

| Alan | Eksik Test | Öncelik |
|------|-----------|---------|
| **BUG-002 testi** | Multi-LI list unwrap sıra testi | 🔴 Yüksek |
| **BUG-003 testi** | Multi-block blockquote unwrap sıra testi | 🔴 Yüksek |
| **BUG-005 testi** | clearFormatting link/image koruma testi | 🔴 Yüksek |
| **getRawHTML()** | getRawHTML vs getHTML farkı testi | 🔴 Yüksek |
| **Paste cursor** | Paste sonrası cursor pozisyon testi | 🟡 Orta |
| **Multi-node toggle** | Karışık formatlı selection'da toggle testi | 🟡 Orta |
| **Shift+Enter** | Soft line break oluşturma testi | 🟡 Orta |
| **History maxSize** | maxSize aşıldığında davranış testi | 🟡 Orta |
| **destroy() çift çağrı** | İkinci destroy çağrısında hata olmama testi | 🟢 Düşük |
| **Scroll + resizer** | Scroll sonrası overlay pozisyon testi | 🟢 Düşük |
| **CSS injection** | img style attribute injection testi | 🟢 Düşük |
| **Escape key** | Dropdown'da Escape tuşu testi | 🟢 Düşük |
| **Ctrl+Y** | Windows redo kısayol testi | 🟢 Düşük |

---

## 11. Özet ve Önceliklendirme

### Kritik (Hemen Düzeltilmeli):

| # | Bug | Etki | Dosya |
|---|-----|------|-------|
| BUG-001 | getRawHTML() normalize dönüyor | API ihlali | editor.js:198 |
| BUG-002 | Liste elemanları ters sıra | Veri bozulması | commands.js:145 |
| BUG-003 | Blockquote elemanları ters sıra | Veri bozulması | commands.js:224 |
| BUG-004 | Placeholder listener'lar temizlenmiyor | Memory leak | editor.js:158 |
| BUG-005 | clearFormatting link/image siliyor | Veri kaybı | commands.js:384 |
| PERF-001 | Her input'ta tam DOM normalizasyonu | Performans | engine.js:156 |

### Yüksek Öncelik:

| # | Konu | Tür | Dosya |
|---|------|-----|-------|
| UX-001 | Shift+Enter desteği yok | UX | engine.js:178 |
| BUG-006 | off() metodu eksik | Stabilite | engine.js |
| BUG-008 | toggleInline tutarsız davranış | Bug | commands.js:15 |
| BUG-010 | Heading dropdown Escape yok | A11y | toolbar.js:230 |
| PERF-002 | emitChange tam normalizasyon | Performans | engine.js:464 |

### Orta Öncelik:

| # | Konu | Tür |
|---|------|-----|
| UX-002 | Tab indentation desteği yok | UX |
| UX-003 | Ctrl+Y redo eksik | UX |
| UX-004 | Heading seviyesi göstergesi yok | UX |
| UX-005 | Link prompt mevcut URL göstermiyor | UX |
| BUG-007 | Paste cursor pozisyonu | Bug |
| BUG-009 | İlk yükleme çift history | Bug |
| BUG-011 | Resizer scroll problemi | Bug |
| BUG-012 | BLOCK_TAGS tutarsızlığı | Bug |
| STAB-001 | Çift destroy güvenliği | Stabilite |
| STAB-002 | Event handler error handling | Stabilite |
| QUAL-001 | BLOCK_TAGS tekrarı | Kod kalitesi |
| QUAL-002 | Leaf block kodu tekrarı | Kod kalitesi |

### Düşük Öncelik:

| # | Konu | Tür |
|---|------|-----|
| BUG-013 | Global CSS stili temizlenmiyor | Bug |
| BUG-014 | Image src doğrulama eksik | Güvenlik |
| BUG-015 | justResized race condition | Bug |
| BUG-016 | Selection offset edge case | Bug |
| BUG-017 | Style attr validasyonu yok | Güvenlik |
| UX-006 | Image önizleme yok | UX |
| UX-007 | Resizer max width yok | UX |
| UX-008 | Placeholder pozisyon sorunu | UX |
| UX-009 | Focus trap eksik | A11y |
| QUAL-003 | Duplicate JSDoc | Kod kalitesi |
| QUAL-004 | Kullanılmayan #dropdown field | Kod kalitesi |
| QUAL-005 | Tutarsız event pattern | Kod kalitesi |

---

> **Toplam Tespit**: 17 Bug + 9 UX İyileştirme + 4 Stabilite + 4 Performans + 5 Kod Kalitesi + 8 Güvenlik Kontrolü = **47 madde**
