/**
 * Calico - Configuration
 * Tüm sabit değerler bu dosyada tanımlanır.
 * Değişiklik yapmak için sadece bu dosyayı düzenleyin.
 */

const CONFIG = {
  // Storage yapılandırması
  STORAGE: {
    VERSION: 1,                    // Storage şema versiyonu (migration için)
    VERSION_KEY: "storageVersion"  // Version'ın saklandığı key
  },

  // Storage key'leri
  STORAGE_KEYS: {
    COURSE_MAP: "courseMap",
    DETECTED_COURSES: "detectedCourses",
    EXTENSION_ENABLED: "extensionEnabled"
  },

  // DOM Selector'ları - Ders isimlerini bulmak için
  SELECTORS: {
    // Ders isimlerini değiştirmek için kullanılan selector'lar (öncelik sırasına göre)
    COURSE_NAMES: [
      "#topnav .Mrphs-sitesNav__menuitem a.link-container span",
      "#topnav .Mrphs-sitesNav__menuitem a.link-container",
      "#otherSitesMenu .fav-title a span.fullTitle",
      "#selectSite .fav-title a .fullTitle"
    ],
    // Yedek selector'lar (ana selector'lar çalışmazsa)
    COURSE_NAMES_FALLBACK: [
      ".Mrphs-sitesNav__menuitem a span",
      ".Mrphs-sitesNav__menuitem a",
      ".fav-title a span",
      ".fav-title a"
    ],
    // Ders tespiti için kullanılan selector
    COURSE_DETECTION: "#topnav .Mrphs-sitesNav__menuitem a.link-container span",
    // Yedek tespit selector'ı
    COURSE_DETECTION_FALLBACK: ".Mrphs-sitesNav__menuitem a span",
    // MutationObserver hedef elementi (performans için dar scope)
    OBSERVER_TARGET: "#topnav"
  },

  // Zamanlama değerleri (milisaniye)
  TIMEOUTS: {
    DETECT_THROTTLE: 2000,    // Ders tespiti throttle süresi
    MUTATION_THROTTLE: 1000   // DOM değişikliği throttle süresi
  },

  // Filtreleme için kullanılan sabit stringler
  FILTERS: {
    EXCLUDED_NAMES: ["Ana Sayfa"]  // Bu isimler ders listesinden hariç tutulur
  },

  // Input doğrulama limitleri
  INPUT: {
    MAX_COURSE_NAME_LENGTH: 100,   // Özel ders adı maksimum karakter
    MIN_COURSE_NAME_LENGTH: 1,     // Özel ders adı minimum karakter
    WARNING_THRESHOLD: 80,          // Uyarı gösterilecek karakter sayısı (%)
    FORBIDDEN_CHARS: []             // Yasaklı karakterler (şimdilik yok)
  }
};

// Config'i değiştirilemez yap (freeze)
Object.freeze(CONFIG);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.STORAGE_KEYS);
Object.freeze(CONFIG.SELECTORS);
Object.freeze(CONFIG.SELECTORS.COURSE_NAMES);
Object.freeze(CONFIG.SELECTORS.COURSE_NAMES_FALLBACK);
Object.freeze(CONFIG.TIMEOUTS);
Object.freeze(CONFIG.FILTERS);
Object.freeze(CONFIG.FILTERS.EXCLUDED_NAMES);
Object.freeze(CONFIG.INPUT);
Object.freeze(CONFIG.INPUT.FORBIDDEN_CHARS);