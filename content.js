/**
 * Calico - Content Script
 * CATS portalında ders isimlerini yeniden adlandırır.
 */

/**
 * Metni normalize eder (fazla boşlukları temizler)
 * @param {string} txt - Normalize edilecek metin
 * @returns {string} Normalize edilmiş metin
 */
function normalize(txt) {
  return (txt || "").trim().replace(/\s+/g, " ");
}

// ============================================
// Selector Fallback Sistemi
// ============================================

// Fallback kullanıldı mı? (bilgilendirme için, tekrar eden log'ları önler)
var fallbackUsed = {
  courseNames: false,
  courseDetection: false
};

/**
 * Birden fazla selector grubundan element bulmaya çalışır.
 * Önce primary selector'ları dener, bulamazsa fallback'lere geçer.
 * @param {string[]} primarySelectors - Ana selector dizisi
 * @param {string[]} fallbackSelectors - Yedek selector dizisi
 * @param {string} logKey - Log flag'i için key
 * @returns {Element[]} Bulunan elementler
 */
function findElements(primarySelectors, fallbackSelectors, logKey) {
  // Önce primary selector'ları dene
  var elements = primarySelectors.flatMap(function(sel) {
    return Array.from(document.querySelectorAll(sel));
  });
  
  // Primary'de element bulduysa döndür
  if (elements.length > 0) {
    return elements;
  }
  
  // Primary'de bulamadı, fallback'leri dene
  elements = fallbackSelectors.flatMap(function(sel) {
    return Array.from(document.querySelectorAll(sel));
  });
  
  // Fallback kullanıldığını işaretle (tekrar denemeyi önler)
  if (elements.length > 0 && !fallbackUsed[logKey]) {
    fallbackUsed[logKey] = true;
  }
  
  // Element bulunamadıysa sessizce boş dizi döndür
  return elements;
}

/**
 * Ders tespiti için selector'dan elementleri bulur.
 * Önce primary, sonra fallback dener.
 * @param {string} primarySelector - Ana selector
 * @param {string} fallbackSelector - Yedek selector
 * @returns {NodeList|Element[]} Bulunan elementler
 */
function findDetectionElements(primarySelector, fallbackSelector) {
  // Önce primary selector'ı dene
  var items = document.querySelectorAll(primarySelector);
  
  if (items.length > 0) {
    return items;
  }
  
  // Primary'de bulamadı, fallback'i dene
  items = document.querySelectorAll(fallbackSelector);
  
  // Fallback kullanıldığını işaretle
  if (items.length > 0 && !fallbackUsed.courseDetection) {
    fallbackUsed.courseDetection = true;
  }
  
  // Element bulunamadıysa sessizce boş dizi döndür
  return items;
}

/**
 * Ders isimlerini courseMap'e göre değiştirir
 * @param {Object} courseMap - Orijinal isim -> yeni isim eşleştirmesi
 */
function renameCourses(courseMap) {
  courseMap = courseMap || {};
  // courseMap boşsa işlem yapma
  var keys = Object.keys(courseMap);
  if (!keys.length) return;

  // Fallback destekli element bulma
  var elements = findElements(
    CONFIG.SELECTORS.COURSE_NAMES,
    CONFIG.SELECTORS.COURSE_NAMES_FALLBACK,
    "courseNames"
  );

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    // Önce data-original-name'e bak, yoksa mevcut innerText'i al
    var original = normalize(el.dataset.originalName || el.innerText);
    if (!original) continue;

    if (courseMap[original]) {
      // Orijinal adı kaydet (sadece ilk kez)
      if (!el.dataset.originalName) {
        el.dataset.originalName = original;
      }
      el.innerText = courseMap[original];
    } else if (el.dataset.originalName) {
      // courseMap'te yok ama data-original-name var = silindi, orijinale dön
      el.innerText = el.dataset.originalName;
    }
  }
}

// ============================================
// Ders Tespiti (Throttled + Retry)
// ============================================

var lastDetectedCourses = null;
var detectTimeout = null;
var retryTimeout = null;
var retryCount = 0;
var coursesFound = false;  // Ders bulundu mu flag'i

// Retry konfigürasyonu
var RETRY_CONFIG = {
  MAX_RETRIES: 10,         // Maksimum retry sayısı
  RETRY_INTERVAL: 1000,    // Retry aralığı (ms) - 1 saniye
  INITIAL_DELAY: 100       // İlk deneme gecikmesi (ms) - çok kısa
};

/**
 * Sayfadaki dersleri tespit eder (iç fonksiyon).
 * @returns {string[]} Tespit edilen dersler
 */
function doDetectCourses() {
  // Extension kapalıysa işlem yapma
  if (!extensionEnabled) {
    return [];
  }

  if (!Storage.isContextValid()) {
    cleanup();
    return [];
  }

  // Fallback destekli element bulma
  var items = findDetectionElements(
    CONFIG.SELECTORS.COURSE_DETECTION,
    CONFIG.SELECTORS.COURSE_DETECTION_FALLBACK
  );
  
  var courses = Array.from(items)
    .map(function(el) {
      // Önce data-original-name'e bak (değiştirilmiş olabilir)
      // Yoksa mevcut innerText'i al (orijinal)
      return normalize(el.dataset.originalName || el.innerText);
    })
    .filter(function(t) {
      return t && !CONFIG.FILTERS.EXCLUDED_NAMES.includes(t);
    });
  
  var uniqueCourses = [];
  for (var i = 0; i < courses.length; i++) {
    if (uniqueCourses.indexOf(courses[i]) === -1) {
      uniqueCourses.push(courses[i]);
    }
  }
  
  var coursesString = JSON.stringify(uniqueCourses);
  
  // Sadece değişiklik varsa storage'a yaz
  if (coursesString !== lastDetectedCourses) {
    lastDetectedCourses = coursesString;
    Storage.set({ [CONFIG.STORAGE_KEYS.DETECTED_COURSES]: uniqueCourses });
  }
  
  return uniqueCourses;
}

/**
 * Sayfadaki dersleri tespit eder ve storage'a kaydeder.
 * Throttle mekanizması ile gereksiz yazmaları önler.
 * @param {boolean} immediate - true ise throttle olmadan hemen çalışır
 */
function detectCourses(immediate) {
  // Extension kapalıysa işlem yapma
  if (!extensionEnabled) {
    return;
  }

  if (!Storage.isContextValid()) {
    cleanup();
    return;
  }

  // Immediate mod - throttle olmadan hemen çalış
  if (immediate) {
    doDetectCourses();
    return;
  }

  // Throttled mod
  if (detectTimeout) {
    clearTimeout(detectTimeout);
  }
  
  detectTimeout = setTimeout(function() {
    doDetectCourses();
  }, CONFIG.TIMEOUTS.DETECT_THROTTLE);
}

/**
 * Ders bulunamazsa retry mekanizması.
 * Belirli aralıklarla tekrar dener.
 */
function retryDetection() {
  // Zaten ders bulunduysa veya max retry'a ulaşıldıysa dur
  if (coursesFound || retryCount >= RETRY_CONFIG.MAX_RETRIES) {
    return;
  }

  if (!Storage.isContextValid()) {
    cleanup();
    return;
  }

  // Extension kapalıysa dur
  if (!extensionEnabled) {
    return;
  }

  retryCount++;
  
  // Immediate modda tespit yap
  var courses = doDetectCourses();
  
  if (courses.length > 0) {
    // Ders bulundu, retry'ı durdur
    coursesFound = true;
    // Rename işlemini de uygula
    loadAndApply();
  } else if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
    // Hala bulunamadı, tekrar dene
    retryTimeout = setTimeout(retryDetection, RETRY_CONFIG.RETRY_INTERVAL);
  }
}

/**
 * Retry mekanizmasını başlatır
 */
function startRetryMechanism() {
  // Önceki retry'ı temizle
  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }
  
  retryCount = 0;
  coursesFound = false;
  
  // İlk denemeyi hemen yap
  var courses = doDetectCourses();
  
  if (courses.length > 0) {
    coursesFound = true;
  } else {
    // Bulunamadı, retry başlat
    retryTimeout = setTimeout(retryDetection, RETRY_CONFIG.RETRY_INTERVAL);
  }
}

// ============================================
// Storage'dan Yükleme ve Uygulama
// ============================================

// Extension açık mı?
var extensionEnabled = true;

/**
 * Storage'dan gelen veriyi uygular
 * @param {Object} data - Storage'dan okunan veri
 */
function applyAll(data) {
  // Extension enabled state'i güncelle
  extensionEnabled = data[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] !== false;
  
  if (extensionEnabled) {
    // Extension açık - özel isimleri uygula
    renameCourses(data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {});
  } else {
    // Extension kapalı - orijinal isimlere dön
    restoreOriginalNames();
  }
}

/**
 * Tüm ders isimlerini orijinallerine döndürür
 */
function restoreOriginalNames() {
  // Fallback destekli element bulma (renameCourses ile aynı mantık)
  var elements = findElements(
    CONFIG.SELECTORS.COURSE_NAMES,
    CONFIG.SELECTORS.COURSE_NAMES_FALLBACK,
    "courseNamesRestore"
  );
  
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    // data-original-name varsa orijinale dön
    if (el.dataset.originalName) {
      el.innerText = el.dataset.originalName;
    }
  }
}

/**
 * Storage'dan courseMap ve enabled state'i yükler ve uygular
 */
function loadAndApply() {
  if (!Storage.isContextValid()) {
    cleanup();
    return;
  }
  Storage.get([
    CONFIG.STORAGE_KEYS.COURSE_MAP,
    CONFIG.STORAGE_KEYS.EXTENSION_ENABLED
  ], applyAll);
}

// ============================================
// Cleanup (Extension Context Invalidation)
// ============================================

var observer = null;
var mutationTimeout = null;
var isCleanedUp = false;

/**
 * Extension context geçersiz olduğunda tüm listener'ları temizler.
 * Bir kez çağrıldıktan sonra tekrar çalışmaz.
 */
function cleanup() {
  if (isCleanedUp) return;
  isCleanedUp = true;

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (detectTimeout) {
    clearTimeout(detectTimeout);
    detectTimeout = null;
  }
  
  if (mutationTimeout) {
    clearTimeout(mutationTimeout);
    mutationTimeout = null;
  }
  
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
}

// ============================================
// Tab Visibility Kontrolü
// ============================================

// Tab görünür mü?
var isTabVisible = !document.hidden;

/**
 * Tab visibility değişikliğini dinler.
 * Tab görünür olduğunda güncel veriyi uygular.
 */
function handleVisibilityChange() {
  if (!Storage.isContextValid()) {
    cleanup();
    return;
  }
  
  isTabVisible = !document.hidden;
  
  if (isTabVisible && extensionEnabled) {
    // Tab görünür oldu ve extension açık, güncel veriyi uygula
    loadAndApply();
    
    // Eğer henüz ders bulunmadıysa retry başlat
    if (!coursesFound) {
      startRetryMechanism();
    } else {
      detectCourses(true);  // Immediate mod
    }
  }
}

// Visibility change listener
try {
  document.addEventListener("visibilitychange", handleVisibilityChange);
} catch (e) {
  ErrorHandler.handle("UNKNOWN", "content.visibilitychange", e);
}

// ============================================
// Initialization
// ============================================

/**
 * Extension başlatma fonksiyonu.
 * Migration kontrolü yapar, sonra normal işlemleri başlatır.
 */
function initialize() {
  // Önce migration kontrolü
  Storage.migrate(function() {
    // Normal başlatma işlemleri
    loadAndApply();
    
    // Retry mekanizmasını başlat (immediate detection dahil)
    startRetryMechanism();
  });
}

// İlk yükleme (microtask olarak)
try {
  Promise.resolve().then(function() {
    if (Storage.isContextValid()) {
      initialize();
    }
  });
} catch (e) {
  ErrorHandler.handle("UNKNOWN", "content.init.microtask", e);
}

// DOM hazır olduğunda (yedek)
document.addEventListener("DOMContentLoaded", function() {
  try {
    // Tab görünürse uygula
    if (isTabVisible) {
      loadAndApply();
      
      // DOMContentLoaded'da da retry başlat (henüz başlamadıysa)
      if (!coursesFound && retryCount === 0) {
        startRetryMechanism();
      }
    }
  } catch (e) {
    ErrorHandler.handle("UNKNOWN", "content.DOMContentLoaded", e);
  }
});

// Window load olduğunda son bir deneme daha (CATS geç yüklenebilir)
window.addEventListener("load", function() {
  try {
    if (isTabVisible && extensionEnabled && !coursesFound) {
      // Son bir retry turu daha başlat
      retryCount = 0;
      startRetryMechanism();
    }
  } catch (e) {
    ErrorHandler.handle("UNKNOWN", "content.window.load", e);
  }
});

// ============================================
// DOM Değişiklik Gözlemcisi (MutationObserver)
// ============================================

try {
  observer = new MutationObserver(function(mutations) {
    if (!Storage.isContextValid()) {
      cleanup();
      return;
    }

    // Tab gizliyse veya extension kapalıysa işlem yapma
    if (!isTabVisible || !extensionEnabled) {
      return;
    }

    // addedNodes varsa işlem yap
    var hasNewNodes = mutations.some(function(mut) { 
      return mut.addedNodes.length > 0; 
    });
    
    if (hasNewNodes) {
      // Direkt loadAndApply çağır (gecikme olmasın)
      loadAndApply();
      
      // Henüz ders bulunamadıysa immediate detection yap
      if (!coursesFound) {
        var courses = doDetectCourses();
        if (courses.length > 0) {
          coursesFound = true;
          // Retry'ı durdur
          if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
          }
        }
      } else {
        // Ders zaten bulundu, throttled detection
        if (!mutationTimeout) {
          mutationTimeout = setTimeout(function() {
            if (isTabVisible && extensionEnabled) {
              detectCourses(true);  // Immediate mod
            }
            mutationTimeout = null;
          }, CONFIG.TIMEOUTS.MUTATION_THROTTLE);
        }
      }
    }
  });
  
  // Gözlem alanını belirle
  // #topnav varsa onu izle, yoksa document.documentElement
  var observeTarget = document.querySelector(CONFIG.SELECTORS.OBSERVER_TARGET) || document.documentElement;
  
  observer.observe(observeTarget, { 
    childList: true, 
    subtree: true 
  });
} catch (e) {
  ErrorHandler.handle("UNKNOWN", "content.MutationObserver", e);
}

// ============================================
// Storage Değişiklik Dinleyicisi
// ============================================

Storage.onChanged(function(changes, areaName) {
  // COURSE_MAP veya EXTENSION_ENABLED değişikliklerinde güncelle
  if (changes[CONFIG.STORAGE_KEYS.COURSE_MAP] || 
      changes[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED]) {
    loadAndApply();
  }
});