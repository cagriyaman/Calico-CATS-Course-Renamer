# 📋 Changelog

Calico için tüm önemli değişiklikler bu dosyada belgelenir.

Bu dosya [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) formatını takip eder
ve [Semantic Versioning](https://semver.org/spec/v2.0.0.html) kullanır.

---

## [1.2.0] - 2026-04-08

### 🛡️ Yedekleme, Olay Kayıtları & Hata Düzeltmesi

Bu sürüm; ders adlarının durduk yere silinmesi sorununu tespit edip düzeltir, kapsamlı bir olay kayıt altyapısı ekler, ders yedekleri sistemi ile yedekleme/geri yükleme imkanı sunar ve `.calico` dosya formatı ile dışa/içe aktarım desteği getirir. Popup arayüzü iki sekmeli yapıya (Dersler | Ayarlar) geçirilmiştir.

---

### 🐛 Düzeltilen

#### Ders Adı Silinme Sorunu (Kritik)
- **cleanOrphanMappings() Kısmi Tespit Koruması:** Sayfa tam yüklenmeden çalışan orphan temizleme, tüm courseMap'i siliyordu. Artık tespit edilen ders sayısı courseMap'ten azsa temizleme atlanır ve durum loglanır
  - Birden fazla kullanıcının bildirdiği "ders adları durduk yere siliniyor" sorununun kök nedeni
  - `detectedCourses.length < courseMapKeys.length` → orphan temizleme yapılmaz
  - `document.readyState` bilgisi log'a eklenir

---

### ✨ Eklenen

#### Olay Kayıtları Sistemi (Debug Logging)
- **Logger Modülü:** `storage.local` üzerinde çalışan kapsamlı loglama altyapısı (sync quota'yı etkilemez)
  - Varsayılan olarak **açık** — kullanıcı sorun fark etmeden önce veriler yakalanır
  - 10 kategori: INIT, ST_R, ST_W, ST_D, DOM_D, DOM_A, ORPH, USER, ERR, WARN
  - Kritik kategoriler (ORPH, ST_W, ST_D, ERR, WARN) anında persist edilir (5s debounce atlanır)
  - Milisaniye hassasiyetinde zaman damgası (HH:MM:SS.mmm)
  - Maksimum 500 kayıt, 1000 byte veri limiti, otomatik truncation
  - JSON olarak dışa aktarma, tarih ayırıcılarıyla görüntüleme, kategori filtreleme

#### Sekme Tabanlı Arayüz (Dersler | Ayarlar)
- **Tab Navigation:** Popup arayüzü iki sekmeye ayrıldı
  - **Dersler:** Mevcut ders listesi, kaydet/sil butonları (eski ana ekran)
  - **Ayarlar:** Ders yedekleri, dışa/içe aktar, olay kayıtları, depolama bilgisi
- **Veri Modalı Kaldırıldı:** Eski "Veri" butonu ve modal'ı tamamen kaldırıldı

#### Ders Yedekleri Sistemi (3 Yuva)
- **Kaydet:** Mevcut ders adlarını isimlendirerek 3 yuvadan birine kaydedin
  - Inline isim girişi (Enter/Escape/blur ile onay/iptal)
  - Ders sayısı ve tarih bilgisi ile yedek kartları
- **Yükle:** Kaydedilmiş yedeği tek tıkla geri yükleyin
  - Yüklemeden önce mevcut durum otomatik yedeklenir
  - Onay diyalogu ile güvenli geri yükleme
- **Temizle:** Yuvayı boşaltın
- **`storage.local`** üzerinde saklanır (sync quota'yı etkilemez)

#### .calico Dosya Formatı (Dışa / İçe Aktar)
- **Dışa Aktar:** Mevcut ders adlarını `.calico` uzantılı dosya olarak indirin
  - JSON tabanlı özel format: `{ calico: "1.0", type: "course-preset", courseMap: {...} }`
  - Farklı tarayıcılar arasında ders adlarını taşıma imkanı
- **İçe Aktar:** `.calico` dosyasını yükleyerek ders adlarını geri getirin
  - Dosya boyutu (512 KB), ders sayısı (200), karakter limiti kontrolü
  - Geçersiz dosya formatı ve uzantı kontrolü
  - İçe aktarmadan önce mevcut durum otomatik yedeklenir
- **Firefox Uyumluluğu:** Firefox'ta popup içinde dosya seçici açılamadığı için `windows.create()` ile bağımsız import penceresi açılır (dosya seç + sürükle-bırak destekli)

#### Otomatik Yedekleme
- **Yıkıcı İşlem Koruması:** "Tümünü Sil", yedek yükleme ve .calico import işlemlerinden önce mevcut courseMap otomatik yedeklenir
- **Tek Yuva Yedek:** `storage.local` üzerinde `autoBackup` key'i ile saklanır
- **Geri Yükleme (Ayarlar):** Ayarlar sekmesinde yedek barı üzerinden geri yükleme
- **Geri Yükleme (Ana Ekran):** courseMap boşken ve yedek varken, Kaydet butonunun yanında "Geri Yükle" butonu otomatik belirir
  - Onay diyalogunda ders sayısı ve yedek tarihi gösterilir
  - Geri yükleme sonrası buton otomatik kaybolur

---

### 🔧 Değiştirilen

#### Storage Mimarisi
- **storage.local Kullanımı:** Logger, PresetStorage ve AutoBackup artık `storage.local` (5 MB) üzerinde çalışır — `storage.sync` (100 KB) quota'sı korunur
- **Storage.get/set/remove:** Logger.log() çağrıları eklendi (ST_R, ST_W, ST_D kategorileri)
- **Storage.onChanged:** courseMap diff loglaması (eklenen/silinen key'ler)

#### Content Script Loglaması
- **doDetectCourses():** DOM_D kategorisiyle element sayısı, documentReady durumu loglanır
- **applyAll():** ST_R ile courseMap key'leri ve sayısı loglanır
- **handleVisibilityChange():** INIT ile görünürlük değişiklikleri loglanır
- **cleanup():** WARN ile timer/observer durumu loglanır

#### Config Genişletmeleri
- `CONFIG.LOGGER`: MAX_ENTRIES, PERSIST_INTERVAL, CRITICAL_CATEGORIES, DATA_MAX_LENGTH
- `CONFIG.PRESET`: MAX_SLOTS, STORAGE_KEY, AUTO_BACKUP_KEY, DEFAULT_NAMES, MAX_NAME_LENGTH
- `CONFIG.FILE`: EXTENSION, VERSION, TYPE_PRESET, MAX_IMPORT_SIZE, MAX_COURSE_ENTRIES
- Tüm yeni bloklar `Object.freeze()` ile korunur

#### Firefox AMO Uyumluluğu (Güvenlik Hardening)
- **innerHTML → DOM API:** `options.js` içindeki tüm `innerHTML` atamaları kaldırıldı ve güvenli DOM API çağrılarıyla (`createElement`, `textContent`, `appendChild`) değiştirildi
  - Firefox AMO linter'ının "Unsafe assignment to innerHTML" uyarıları tamamen giderildi
  - XSS saldırı yüzeyi daraltıldı (kullanıcı verisi artık `textContent` ile otomatik escape ediliyor)
- **`createSvgIcon()` Helper:** SVG ikonları için `DOMParser` (`image/svg+xml` modu) tabanlı güvenli fabrika fonksiyonu eklendi
- **`createLogEmpty()` Helper:** Log viewer boş durum mesajı için DOM helper
- **`renderLogEntry` / `formatLogData` Refactor:** Artık HTML string yerine DOM elementi döndürüyor/üretiyor; `DocumentFragment` ile toplu ekleme sayesinde performans da korunuyor
- **`escapeHtml()` Kaldırıldı:** `textContent` kullanımı nedeniyle gereksizleşti

---

### 📁 Yeni Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `import.html` | Firefox için bağımsız import penceresi HTML |
| `import.js` | Import penceresi mantığı (dosya seç + sürükle-bırak + validation) |

---

### 📊 Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `config.js` | LOGGER, PRESET, FILE blokları eklendi (~+40 satır) |
| `storage.js` | Logger IIFE yeniden yazıldı, PresetStorage IIFE eklendi (~+700 satır) |
| `content.js` | cleanOrphanMappings guard + kapsamlı loglama (~+50 satır) |
| `options.html` | Tab nav, preset/export/import/restore bölümleri (~+80 satır) |
| `options.css` | Tab, preset, backup, export/import, restore stilleri (~+180 satır) |
| `options.js` | Preset, export/import, auto-backup, tab mantığı + DOM API refactor (~+520 satır) |
| `import.html` | Yeni dosya (~120 satır) |
| `import.js` | Yeni dosya (~170 satır) |
| `manifest.json` | Versiyon 1.2.0 |

---

## [1.0.3] - 2024-12-17

### 🧹 Otomatik Orphan Temizleme

---

### ✨ Eklenen

- **Orphan Mapping Temizleme:** Favorilerden kaldırılan derslerin özel adları otomatik siliniyor
  - Ders unfavorite edildiğinde courseMap'ten otomatik temizlenir
  - otherSitesMenu'de orijinal isim geri döner
  - Manuel müdahale gerektirmez

---

### 🐛 Düzeltilen

- **Boş Array Koruması:** Sayfa yüklenirken ders listesi boşken tüm eşleştirmelerin silinmesi engellendi

---

## [1.0.2] - 2024-12-17

### 🎨 UI/UX İyileştirmeleri & Hata Düzeltmeleri

Bu sürüm, kullanıcı arayüzünde önemli iyileştirmeler ve ders tespit mekanizmasında kritik bir hata düzeltmesi içerir.

---

### 🐛 Düzeltilen

#### Ders Tespit Sorunu
- **Retry Mekanizması:** "Ders bulunamadı" ekranında takılma sorunu düzeltildi
- **Akıllı Yeniden Deneme:** Ders bulunamazsa 1 saniye aralıklarla 10 kez tekrar dener
- **Çoklu Tetikleme Noktaları:** `DOMContentLoaded`, `window.load` ve `MutationObserver` ile çoklu tespit
- **Hızlı İlk Tespit:** İlk deneme artık throttle olmadan anında çalışır

---

### ✨ Eklenen

#### Kullanıcı Arayüzü
- **Toggle Durum Yazısı:** Açma/kapama toggle'ının altında "Açık" / "Kapalı" yazısı
- **Emoji Butonu + İkonu:** Emoji ekleme butonunun sağ üstünde + işareti (ne için olduğu daha anlaşılır)
- **Destek Ol Linki:** Footer'a GitHub Sponsors bağlantısı eklendi

#### Görsel Geri Bildirim
- **Kaydedilmiş İsim Rengi:** Kaydedilen özel isimler turuncu renkte gösterilir
- **Değişiklik Takibi:** Kullanıcı ismi değiştirdiğinde renk siyaha döner (kaydedilmemiş değişiklik)
- **Silme Sonrası Uyarı:** Tekli ders silme işleminde "Temizlendi, sayfayı yenileyin" mesajı

---

### 🔧 Değiştirilen

#### Görsel İyileştirmeler
- **Tekli Silme Butonu:** ✕ ikonu çöp kutusu ikonuyla değiştirildi (Tümünü Sil ile tutarlılık)
- **Scrollbar Rengi:** Tüm scrollbar'lar turuncu renge güncellendi (tema ile uyum)
- **Toggle Text Pozisyonu:** Açık/Kapalı yazısı toggle'ın yanından altına taşındı

#### Teknik
- **content.js:** Retry mekanizması ve `coursesFound` flag'i eklendi
- **options.js:** Toggle text güncelleme, input-saved class yönetimi
- **options.css:** Yeni stiller (toggle-text, input-saved, plus-icon, scrollbar)

---

### 📊 Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `content.js` | Retry mekanizması (+138 satır) |
| `options.js` | UI güncellemeleri (+19 satır) |
| `options.css` | Yeni stiller (+47 satır) |
| `options.html` | Toggle text span (+1 satır) |
| `manifest.json` | Versiyon 1.0.2 |

---

## [1.0.1] - 2024-12-05

### 🦊 Firefox & Cross-Browser Desteği

Bu sürüm, uzantıyı Firefox (Desktop ve Android) ile uyumlu hale getirir ve tek kod tabanıyla çoklu tarayıcı desteği sağlar.

---

### ✨ Eklenen

#### Cross-Browser Uyumluluk
- **Firefox Desktop Desteği:** Firefox 128+ tam uyumluluk
- **Firefox Android Desteği:** Firefox Mobile 128+ tam mobil deneyim
- **browser-polyfill.js:** Chrome/Firefox API farklarını gizleyen uyumluluk katmanı
- **Birleşik Manifest:** Tek `manifest.json` ile Chrome ve Firefox desteği

#### Teknik İyileştirmeler
- **Promise/Callback Wrapper:** Firefox'un Promise tabanlı API'sini callback formatına çevirme
- **Tarayıcı Algılama:** Otomatik Chrome/Firefox tespiti ve uygun API kullanımı
- **Runtime Error Handling:** Her iki tarayıcıda tutarlı hata yönetimi

---

### 🔧 Değiştirilen

#### Manifest Güncellemeleri
- **minimum_chrome_version:** Chrome 88+ için minimum sürüm tanımı eklendi
- **browser_specific_settings:** Firefox Gecko ayarları eklendi
  - `gecko.id`: `calico-cats@extension`
  - `gecko.strict_min_version`: `128.0`
  - `gecko_android.strict_min_version`: `128.0`
- **data_collection_permissions:** Firefox gizlilik beyanı (`required: none`)
- **icon96.png:** Firefox için 96x96 icon desteği eklendi

#### Storage API Güncellemeleri
- `storage.js` dosyası `browserAPI` wrapper'ı kullanacak şekilde güncellendi
- `_browserAPI` ve `_getLastError` yardımcı fonksiyonları eklendi
- Tüm `chrome.storage.*` çağrıları polyfill üzerinden yapılacak şekilde değiştirildi

#### Content Scripts
- `browser-polyfill.js` content scripts listesine eklendi (ilk sırada yüklenir)
- `options.html` script sıralaması güncellendi

---

### 📁 Yeni Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `browser-polyfill.js` | Chrome/Firefox API uyumluluk katmanı (7.9 KB) |
| `icons/icon96.png` | Firefox için 96x96 icon (kullanıcı sağlamalı) |

---

### 📊 Tarayıcı Uyumluluk Matrisi

| Tarayıcı | Minimum Sürüm | Test Edildi | Durum |
|----------|---------------|-------------|-------|
| Chrome | 88 | 131 | ✅ Tam Destek |
| Edge | 88 | 131 | ✅ Tam Destek |
| Brave | 88 | - | ✅ Beklenen |
| Opera | 88 | - | ✅ Beklenen |
| Firefox Desktop | 128 | 133 | ✅ Tam Destek |
| Firefox Android | 128 | 133 | ✅ Tam Destek |
| Firefox ESR | 128 | 128 | ✅ Tam Destek |

---

### 📝 Kurulum Notları

#### Chrome/Chromium Tabanlı Tarayıcılar
1. `chrome://extensions` sayfasını aç
2. "Geliştirici modu" aktif et
3. "Paketlenmemiş öğe yükle" ile klasörü seç

#### Firefox Desktop
1. `about:debugging#/runtime/this-firefox` sayfasını aç
2. "Geçici Eklenti Yükle" tıkla
3. `manifest.json` dosyasını seç

#### Firefox Android
1. Firefox Android 128+ gerekli
2. AMO üzerinden yükle veya
3. Koleksiyon yöntemi ile sideload

---

## [1.0.0] - 2024-12-04

### 🎉 İlk Sürüm

CATS portalında ders isimlerini kişiselleştirmenizi sağlayan Chrome uzantısının ilk kararlı sürümü.

---

### ✨ Eklenen Özellikler

#### Temel Özellikler
- **Ders Yeniden Adlandırma:** Uzun ve karmaşık ders kodlarını anlamlı isimlerle değiştirme
- **Emoji Desteği:** 120+ emoji ile derslerinizi görsel olarak kategorize etme (7 kategori)
- **Anında Uygulama:** Değişiklikler kaydettiğiniz anda CATS sayfasına yansıma
- **Orijinale Dönüş:** Tek tıkla özel isimleri temizleme, orijinal isme dönme
- **Açma/Kapama Toggle:** Uzantıyı geçici olarak devre dışı bırakma

#### Kullanıcı Arayüzü
- **Modern Popup Tasarımı:** Calico temalı gradient header ve kedi logosu
- **Emoji Picker Modal:** Kategorize edilmiş emoji seçici (7 kategori, 120+ emoji)
- **Hakkında Modal:** Yasal uyarı, gizlilik bilgisi ve versiyon detayları
- **Durum Mesajları:** Kaydetme, silme ve hata durumlarında görsel geri bildirim
- **Karakter Sayacı:** Input alanlarında 100 karakter limiti gösterimi
- **Loading Spinner:** Dersler yüklenirken animasyonlu gösterge

---

### 🏗️ Teknik Altyapı

#### Mimari
- **Manifest V3:** Modern extension API kullanımı
- **Modüler Yapı:** Ayrılmış config, storage, content ve UI modülleri
- **Merkezi Konfigürasyon:** Tüm sabitler `config.js`'te tanımlı
- **Storage Wrapper:** Chrome Storage API için güvenli abstraction layer

#### Performans Optimizasyonları
- **Tab Visibility API:** Gizli tab'larda işlem yapmama
- **MutationObserver Scope:** Sadece `#topnav` elementi izleme (tüm sayfa yerine)
- **Throttle Mekanizması:** Ders tespiti ve DOM değişiklikleri için throttling
- **DocumentFragment:** Liste render'larında tek seferde DOM yazımı

#### Güvenlik
- **XSS Koruması:** `textContent` kullanımı, `innerHTML` minimizasyonu
- **Input Validation:** Karakter limiti (100), yasaklı karakter kontrolü
- **Content Security Policy:** Strict CSP tanımı
- **Host Permission:** Sadece `cats.iku.edu.tr` domaininde çalışma

#### Hata Yönetimi
- **ErrorHandler Modülü:** Merkezi hata yakalama ve loglama
- **Context Invalidation:** Extension güncellendiğinde graceful degradation
- **Storage Quota Kontrolü:** 100KB limit aşımı uyarısı
- **Fallback Selector Sistemi:** Ana selector çalışmazsa yedek selector'lar

#### Veri Yönetimi
- **Chrome Storage Sync:** Ayarların Google hesabıyla senkronizasyonu
- **Migration Sistemi:** Gelecek veri yapısı değişiklikleri için altyapı
- **Otomatik Ders Tespiti:** Sayfa değişikliklerinde yeni dersleri algılama

---

### 🔧 Geliştirici Özellikleri

#### Kod Kalitesi
- **JSDoc Yorumları:** Tüm fonksiyonlar için detaylı dokümantasyon
- **Object.freeze:** Config ve sabit objelerin değiştirilemezliği
- **DRY Prensibi:** Storage key'leri için merkezi CONFIG kullanımı
- **Defensive Coding:** Null/undefined kontrolleri

#### Extensibility
- **Selector Fallback:** CATS arayüzü değişse bile çalışmaya devam etme
- **Migration Framework:** Versiyonlar arası veri dönüşümü altyapısı
- **Kategorize Emoji Data:** Yeni emoji ekleme kolaylığı

---

### 📁 Dosya Yapısı

```
calico/
├── manifest.json          # Extension manifest (V3)
├── config.js              # Merkezi konfigürasyon
├── storage.js             # Storage API wrapper + ErrorHandler
├── content.js             # CATS DOM manipülasyonu
├── options.html           # Popup HTML
├── options.css            # Popup stilleri (Calico teması)
├── options.js             # Popup JavaScript
├── emojis.js              # Kategorize emoji veritabanı
├── logo.png               # Popup header logosu
├── icons/                 # Extension ikonları
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md              # Kullanıcı ve geliştirici dokümantasyonu
├── CHANGELOG.md           # Bu dosya
├── PRIVACY.md             # Gizlilik politikası
└── LICENSE                # MIT Lisansı
```

---

### 📊 Teknik Detaylar

#### Storage Kullanımı

| Limit | Değer |
|-------|-------|
| Toplam Alan | 100 KB |
| Item Başına | 8 KB |
| Maksimum Item | 512 |

#### Input Limitleri

| Limit | Değer |
|-------|-------|
| Ders Adı Maksimum | 100 karakter |
| Ders Adı Minimum | 1 karakter |
| Uyarı Eşiği | %80 doluluk |

---

### 🔒 Gizlilik

- ✅ Veriler sadece tarayıcı storage'ında tutulur
- ✅ Tarayıcı ayarlarına bağlı olarak hesabınızla senkronize edilebilir
- ✅ Geliştirici tarafından harici sunucuya veri gönderilmez
- ✅ Sadece `cats.iku.edu.tr` domaininde çalışır

---

### 📝 Geliştirme Fazları

Bu sürüm, kapsamlı bir geliştirme sürecinin sonucudur:

| Faz | Açıklama |
|-----|----------|
| **Faz 1** | Temizlik - Kullanılmayan kodların kaldırılması |
| **Faz 2** | Konfigürasyon - Merkezi CONFIG yapısı |
| **Faz 3** | Modülerleştirme - Dosya ve fonksiyon ayrımı |
| **Faz 4** | Güvenlik - XSS koruması, input validation |
| **Faz 5** | Stabilite - Selector fallback, migration, error handling |
| **Faz 6** | Dokümantasyon - README, CHANGELOG, LICENSE |

External code review sonrası ek optimizasyonlar:
- Toggle kapalıyken tüm işlemleri durdurma
- MutationObserver scope daraltma (#topnav hedefleme)
- DocumentFragment kullanımı (Reflow optimizasyonu)
- Bilgilendirme log'larının temizlenmesi
- DRY violation düzeltmeleri (CONFIG.STORAGE_KEYS)

---

## [Unreleased]

### 🔮 Planlanıyor (v2.0.0)
- ES6+ modernizasyonu (var → const/let)
- Promise/async-await geçişi
- Kod tabanı refactoring

---

## 🙏 Teşekkürler

- İstanbul Kültür Üniversitesi öğrencilerine
- Beta test sürecinde geri bildirim sağlayan kullanıcılara
- Kod review yapan geliştiricilere
- Açık kaynak topluluğuna

---

## Sürüm Geçmişi

| Sürüm | Tarih | Öne Çıkan |
|-------|-------|-----------|
| [1.2.0](#120---2026-04-08) | 2026-04-08 | 🛡️ Yedekleme, Olay Kayıtları & Hata Düzeltmesi |
| [1.0.3](#103---2024-12-17) | 2024-12-17 | 🧹 Otomatik Orphan Temizleme |
| [1.0.2](#102---2024-12-17) | 2024-12-17 | 🎨 UI/UX İyileştirmeleri & Hata Düzeltmeleri |
| [1.0.1](#101---2024-12-05) | 2024-12-05 | 🦊 Firefox & Cross-Browser Desteği |
| [1.0.0](#100---2024-12-04) | 2024-12-04 | 🎉 İlk Sürüm (Chrome) |

---

<p align="center">
  <sub>
    Bu changelog <a href="https://keepachangelog.com">Keep a Changelog</a> formatını takip eder
    ve <a href="https://semver.org">Semantic Versioning</a> kullanır.
  </sub>
</p>