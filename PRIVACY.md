# 🔒 Gizlilik Politikası | Privacy Policy

> **Son Güncelleme | Last Updated:** 2024-12-05  
> **Sürüm | Version:** 1.0.1

---

## 🇹🇷 Türkçe

### 📋 Genel Bakış

**Calico | CATS Ders Yeniden Adlandırıcı** ("Uzantı"), kullanıcı gizliliğine büyük önem verir. Bu gizlilik politikası, uzantının hangi verileri topladığını, nasıl kullandığını ve nasıl koruduğunu açıklar.

**Kısa Özet:**
- ✅ Verileriniz yalnızca tarayıcınızda saklanır
- ✅ Hiçbir veri harici sunuculara gönderilmez
- ✅ Kişisel bilgileriniz toplanmaz
- ✅ Üçüncü taraflarla veri paylaşımı yapılmaz
- ✅ Reklam veya izleme kodu bulunmaz

---

### 1. Toplanan Veriler

#### 1.1 Otomatik Olarak Toplanan Veriler

Bu uzantı **hiçbir kişisel veriyi otomatik olarak toplamaz**. Aşağıdaki veriler toplanmaz:

| Veri Türü | Toplanıyor mu? |
|-----------|----------------|
| IP adresi | ❌ Hayır |
| Konum bilgisi | ❌ Hayır |
| Tarayıcı geçmişi | ❌ Hayır |
| Çerezler | ❌ Hayır |
| Cihaz bilgileri | ❌ Hayır |
| Kullanım istatistikleri | ❌ Hayır |
| Kişisel kimlik bilgileri | ❌ Hayır |

#### 1.2 Kullanıcı Tarafından Girilen Veriler

Uzantının çalışması için aşağıdaki veriler **yalnızca yerel olarak** saklanır:

| Veri | Açıklama | Saklama Yeri |
|------|----------|--------------|
| Ders eşleştirmeleri | Orijinal ders adı → Özel isim | Tarayıcı Storage (Sync) |
| Tespit edilen dersler | CATS'tan algılanan ders listesi | Tarayıcı Storage (Sync) |
| Uzantı durumu | Açık/Kapalı tercihi | Tarayıcı Storage (Sync) |
| Storage versiyonu | Veri yapısı sürümü | Tarayıcı Storage (Sync) |

**Örnek veri yapısı:**
```json
{
  "courseMap": {
    "BLG101 - Introduction to Programming": "💻 Programlama"
  },
  "detectedCourses": ["BLG101 - Introduction to Programming"],
  "extensionEnabled": true,
  "storageVersion": 1
}
```

---

### 2. Verilerin Kullanım Amacı

Saklanan veriler **yalnızca** aşağıdaki amaçlar için kullanılır:

| Amaç | Açıklama |
|------|----------|
| Ders isimlerini değiştirme | CATS sayfasında özel isimlerin gösterilmesi |
| Tercihlerin korunması | Tarayıcı kapatıldığında ayarların kaybolmaması |
| Cihazlar arası senkronizasyon | Aynı hesaptaki farklı cihazlarda aynı ayarların kullanılması |

**Veriler hiçbir zaman:**
- ❌ Analiz veya istatistik için kullanılmaz
- ❌ Reklam hedefleme için kullanılmaz
- ❌ Profil oluşturma için kullanılmaz
- ❌ Üçüncü taraflara satılmaz veya paylaşılmaz

---

### 3. Veri Saklama ve Güvenlik

#### 3.1 Saklama Konumu

| Konum | Açıklama |
|-------|----------|
| **Tarayıcı Storage API** | Chrome: `chrome.storage.sync`, Firefox: `browser.storage.sync` |
| **Senkronizasyon** | Chrome'da Google hesabı, Firefox'ta Firefox Sync ile |
| **Şifreleme** | Tarayıcının yerleşik şifreleme mekanizması kullanılır |

#### 3.2 Veri Güvenliği

- 🔐 Veriler tarayıcının güvenli Storage API'si ile korunur
- 🔐 HTTPS üzerinden senkronize edilir (tarayıcı tarafından)
- 🔐 Uzantı sadece `cats.iku.edu.tr` domaininde çalışır
- 🔐 Content Security Policy (CSP) uygulanır

#### 3.3 Veri Saklama Süresi

- Veriler, kullanıcı silene kadar saklanır
- Uzantı kaldırıldığında yerel veriler otomatik silinir
- Sync verileri tarayıcı hesabında kalabilir (tarayıcı ayarlarından silinebilir)

---

### 4. Uzantı İzinleri

Bu uzantı aşağıdaki izinleri kullanır:

| İzin | Teknik Ad | Neden Gerekli |
|------|-----------|---------------|
| **Storage** | `storage` | Ders eşleştirmelerini ve tercihleri kaydetmek için |
| **Host Permission** | `https://cats.iku.edu.tr/*` | Sadece CATS sayfasında çalışmak için |

#### 4.1 İzin Detayları

**Storage İzni:**
- Ders isim eşleştirmelerini saklar
- Kullanıcı tercihlerini (açık/kapalı) saklar
- Maksimum 100 KB veri saklayabilir
- Tarayıcı hesabıyla senkronize edilebilir

**Host Permission (cats.iku.edu.tr):**
- Uzantı SADECE bu domaine erişebilir
- Başka hiçbir web sitesine erişim yoktur
- Bu domain dışında uzantı tamamen pasiftir

#### 4.2 Kullanılmayan İzinler

Bu uzantı aşağıdaki izinleri **kullanmaz**:

| İzin | Durum |
|------|-------|
| `tabs` | ❌ Kullanılmıyor |
| `history` | ❌ Kullanılmıyor |
| `bookmarks` | ❌ Kullanılmıyor |
| `cookies` | ❌ Kullanılmıyor |
| `webRequest` | ❌ Kullanılmıyor |
| `geolocation` | ❌ Kullanılmıyor |
| `notifications` | ❌ Kullanılmıyor |
| `clipboardRead/Write` | ❌ Kullanılmıyor |
| `<all_urls>` | ❌ Kullanılmıyor |

---

### 5. Üçüncü Taraf Hizmetleri

Bu uzantı **hiçbir üçüncü taraf hizmeti kullanmaz**:

| Hizmet Türü | Kullanılıyor mu? |
|-------------|------------------|
| Analitik (Google Analytics vb.) | ❌ Hayır |
| Reklam ağları | ❌ Hayır |
| İzleme pikselleri | ❌ Hayır |
| Sosyal medya entegrasyonları | ❌ Hayır |
| Harici API'ler | ❌ Hayır |
| CDN'ler | ❌ Hayır |
| Hata raporlama servisleri | ❌ Hayır |

**Tüm kod yerel olarak çalışır ve dış dünyayla iletişim kurmaz.**

---

### 6. Kullanıcı Hakları

#### 6.1 Verilerinize Erişim

Saklanan tüm verilerinizi görmek için:

**Chrome:**
1. `chrome://extensions` adresine gidin
2. Calico uzantısının "Ayrıntılar" seçeneğine tıklayın
3. "Uzantı seçenekleri" veya geliştirici araçlarından storage'ı inceleyin

**Firefox:**
1. `about:debugging#/runtime/this-firefox` adresine gidin
2. Calico uzantısını bulun ve "İncele" tıklayın
3. Storage sekmesinden verileri görüntüleyin

#### 6.2 Verilerinizi Silme

**Tek bir dersi silmek için:**
- Uzantı popup'ında dersin yanındaki ✕ butonuna tıklayın

**Tüm verileri silmek için:**
- Uzantı popup'ında "Tümünü Sil" butonuna tıklayın

**Uzantıyı tamamen kaldırmak için:**
- Tarayıcı uzantı yöneticisinden uzantıyı kaldırın
- Bu işlem tüm yerel verileri siler

#### 6.3 Veri Taşınabilirliği

Şu anda verilerinizi dışa aktarma özelliği bulunmamaktadır. Bu özellik gelecek sürümlerde planlanmaktadır (bkz. [ROADMAP.md](ROADMAP.md)).

---

### 7. Çocukların Gizliliği

Bu uzantı:
- 13 yaş altı çocuklara yönelik değildir
- Yaş doğrulaması yapmaz
- Çocuklardan bilerek veri toplamaz

Uzantı, İstanbul Kültür Üniversitesi öğrencileri (18 yaş üstü) için tasarlanmıştır.

---

### 8. Politika Değişiklikleri

Bu gizlilik politikası güncellenebilir. Değişiklikler:

- Bu sayfada yayınlanacaktır
- Önemli değişiklikler CHANGELOG.md'de belirtilecektir
- "Son Güncelleme" tarihi güncellenecektir

Uzantıyı kullanmaya devam etmeniz, güncel politikayı kabul ettiğiniz anlamına gelir.

---

### 9. İletişim

Gizlilik ile ilgili sorularınız için:

- **GitHub Issues:** [https://github.com/cagriyaman/Calico-CATS-Course-Renamer/issues]
- **E-posta:** [calico.extension@gmail.com]

---

### 10. Yasal Uyarı

Bu uzantı:
- İstanbul Kültür Üniversitesi ile resmi bir bağlantıya sahip **değildir**
- CATS sistemi tarafından onaylanmış veya desteklenmiş **değildir**
- Bağımsız bir öğrenci projesidir

---

---

## 🇬🇧 English

### 📋 Overview

**Calico | CATS Course Renamer** ("Extension") values user privacy. This privacy policy explains what data the extension collects, how it uses it, and how it protects it.

**Quick Summary:**
- ✅ Your data is stored only in your browser
- ✅ No data is sent to external servers
- ✅ No personal information is collected
- ✅ No data sharing with third parties
- ✅ No ads or tracking code

---

### 1. Data Collection

#### 1.1 Automatically Collected Data

This extension **does not automatically collect any personal data**:

| Data Type | Collected? |
|-----------|------------|
| IP address | ❌ No |
| Location | ❌ No |
| Browsing history | ❌ No |
| Cookies | ❌ No |
| Device information | ❌ No |
| Usage statistics | ❌ No |
| Personal identifiers | ❌ No |

#### 1.2 User-Provided Data

The following data is stored **locally only** for the extension to function:

| Data | Description | Storage Location |
|------|-------------|------------------|
| Course mappings | Original name → Custom name | Browser Storage (Sync) |
| Detected courses | Course list from CATS | Browser Storage (Sync) |
| Extension state | Enabled/Disabled preference | Browser Storage (Sync) |
| Storage version | Data structure version | Browser Storage (Sync) |

---

### 2. Purpose of Data Use

Stored data is used **only** for:

| Purpose | Description |
|---------|-------------|
| Renaming courses | Displaying custom names on CATS page |
| Preserving preferences | Keeping settings when browser closes |
| Cross-device sync | Using same settings on different devices |

**Data is never:**
- ❌ Used for analytics
- ❌ Used for advertising
- ❌ Used for profiling
- ❌ Sold or shared with third parties

---

### 3. Data Storage and Security

#### 3.1 Storage Location

| Location | Description |
|----------|-------------|
| **Browser Storage API** | Chrome: `chrome.storage.sync`, Firefox: `browser.storage.sync` |
| **Synchronization** | Via Google account (Chrome) or Firefox Sync |
| **Encryption** | Uses browser's built-in encryption |

#### 3.2 Data Security

- 🔐 Data is protected by browser's secure Storage API
- 🔐 Synchronized over HTTPS (by browser)
- 🔐 Extension only runs on `cats.iku.edu.tr` domain
- 🔐 Content Security Policy (CSP) is enforced

#### 3.3 Data Retention

- Data is retained until user deletes it
- Local data is automatically deleted when extension is removed
- Sync data may remain in browser account (can be deleted from browser settings)

---

### 4. Extension Permissions

| Permission | Technical Name | Why Required |
|------------|----------------|--------------|
| **Storage** | `storage` | To save course mappings and preferences |
| **Host Permission** | `https://cats.iku.edu.tr/*` | To run only on CATS website |

#### 4.1 Unused Permissions

This extension **does NOT use**:

- `tabs`, `history`, `bookmarks`, `cookies`
- `webRequest`, `geolocation`, `notifications`
- `clipboardRead/Write`, `<all_urls>`

---

### 5. Third-Party Services

This extension uses **no third-party services**:

| Service Type | Used? |
|--------------|-------|
| Analytics | ❌ No |
| Ad networks | ❌ No |
| Tracking pixels | ❌ No |
| Social media integrations | ❌ No |
| External APIs | ❌ No |
| CDNs | ❌ No |
| Error reporting services | ❌ No |

**All code runs locally and does not communicate with the outside world.**

---

### 6. User Rights

#### 6.1 Access Your Data

You can view all stored data through browser developer tools (Storage tab).

#### 6.2 Delete Your Data

- **Single course:** Click ✕ button next to the course
- **All data:** Click "Clear All" button in popup
- **Complete removal:** Uninstall the extension

#### 6.3 Data Portability

Export feature is not currently available. Can be planned for future releases.

---

### 7. Children's Privacy

This extension:
- Is not intended for children under 13
- Does not perform age verification
- Does not knowingly collect data from children

The extension is designed for Istanbul Kultur University students (18+).

---

### 8. Policy Changes

This privacy policy may be updated. Changes will be:
- Published on this page
- Noted in CHANGELOG.md for significant changes
- Reflected in "Last Updated" date

Continued use of the extension means acceptance of the current policy.

---

### 9. Contact

For privacy-related questions:

- **GitHub Issues:** [https://github.com/cagriyaman/Calico-CATS-Course-Renamer/issues]
- **Email:** [calico.extension@gmail.com]

---

### 10. Legal Disclaimer

This extension:
- Is **not** affiliated with Istanbul Kultur University
- Is **not** endorsed by or associated with CATS system
- Is an independent student project

---

---

## 📊 Özet Tablo | Summary Table

| Konu / Topic | Durum / Status |
|--------------|----------------|
| Kişisel veri toplama / Personal data collection | ❌ Yok / None |
| Harici sunucu iletişimi / External server communication | ❌ Yok / None |
| Üçüncü taraf paylaşımı / Third-party sharing | ❌ Yok / None |
| Reklam / Advertising | ❌ Yok / None |
| İzleme / Tracking | ❌ Yok / None |
| Analitik / Analytics | ❌ Yok / None |
| Çerezler / Cookies | ❌ Yok / None |
| Yerel depolama / Local storage | ✅ Var / Yes |
| Senkronizasyon / Synchronization | ✅ Tarayıcı hesabı / Browser account |
| Açık kaynak / Open source | ✅ MIT Lisansı / MIT License |

---

<p align="center">
  <sub>
    Bu gizlilik politikası en son <strong>2024-12-05</strong> tarihinde güncellenmiştir.<br>
    This privacy policy was last updated on <strong>2024-12-05</strong>.
  </sub>
</p>
