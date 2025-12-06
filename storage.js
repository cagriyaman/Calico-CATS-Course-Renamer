/**
 * Calico - Storage Helper
 * Chrome/Firefox Storage API için güvenli wrapper fonksiyonları.
 * Context invalidation koruması içerir.
 * 
 * Tarayıcı Uyumluluğu:
 * - Chrome: chrome.* API (callback tabanlı)
 * - Firefox: browser.* API (Promise tabanlı) - polyfill ile callback'e çevrilir
 */

// ============================================
// Browser API Uyumluluk Katmanı
// ============================================

/**
 * Tarayıcı API referansı
 * browserAPI.js yüklüyse onu kullan, değilse chrome'u kullan
 */
var _browserAPI = (function() {
  // browserAPI polyfill yüklüyse onu kullan
  if (typeof browserAPI !== "undefined") {
    return {
      storage: browserAPI.storage,
      runtime: browserAPI.runtime,
      isPolyfill: true
    };
  }
  
  // Polyfill yoksa doğrudan chrome API kullan
  if (typeof chrome !== "undefined" && chrome.storage && chrome.runtime) {
    return {
      storage: {
        sync: chrome.storage.sync,
        local: chrome.storage.local,
        onChanged: chrome.storage.onChanged
      },
      runtime: chrome.runtime,
      isPolyfill: false
    };
  }
  
  // Hiçbiri yoksa hata ver
  console.error("[Calico] Tarayıcı API bulunamadı!");
  return null;
})();

/**
 * Runtime lastError kontrolü - Chrome ve Firefox uyumlu
 * @returns {Object|null} Hata objesi veya null
 */
function _getLastError() {
  try {
    // Chrome API'de lastError doğrudan runtime'da
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
      return chrome.runtime.lastError;
    }
    // Firefox'ta lastError genelde null (Promise rejection ile gelir)
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.lastError) {
      return browser.runtime.lastError;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================
// Error Handler
// ============================================

/**
 * Merkezi hata yönetim modülü.
 * Tüm hatalar bu modül üzerinden işlenir.
 */
const ErrorHandler = {
  /**
   * Hata türleri ve kullanıcı dostu mesajları
   */
  TYPES: {
    CONTEXT_INVALID: {
      code: "CONTEXT_INVALID",
      message: "Extension yeniden yüklendi. Sayfayı yenileyin.",
      severity: "warning"
    },
    STORAGE_READ: {
      code: "STORAGE_READ",
      message: "Veriler okunamadı. Tekrar deneyin.",
      severity: "error"
    },
    STORAGE_WRITE: {
      code: "STORAGE_WRITE",
      message: "Veriler kaydedilemedi. Tekrar deneyin.",
      severity: "error"
    },
    STORAGE_QUOTA: {
      code: "STORAGE_QUOTA",
      message: "Depolama alanı dolu. Bazı dersleri silin.",
      severity: "error"
    },
    VALIDATION: {
      code: "VALIDATION",
      message: "Geçersiz giriş. Lütfen kontrol edin.",
      severity: "warning"
    },
    NETWORK: {
      code: "NETWORK",
      message: "Bağlantı hatası. İnternet bağlantınızı kontrol edin.",
      severity: "error"
    },
    UNKNOWN: {
      code: "UNKNOWN",
      message: "Beklenmeyen bir hata oluştu.",
      severity: "error"
    }
  },

  /**
   * Hata loglar (development için)
   * @param {string} context - Hatanın oluştuğu yer
   * @param {Error|string} error - Hata objesi veya mesajı
   * @param {Object} [data] - Ek veri (opsiyonel)
   */
  log: function(context, error, data) {
    // Production'da console.log'ları kapatmak için bu satırı yoruma al
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : error;
    
    console.warn(
      `[Calico] ${timestamp}\n` +
      `  Context: ${context}\n` +
      `  Error: ${errorMessage}` +
      (data ? `\n  Data: ${JSON.stringify(data)}` : "")
    );
  },

  /**
   * Hata türüne göre kullanıcı dostu mesaj döndürür
   * @param {string} typeCode - Hata türü kodu (TYPES'dan)
   * @param {string} [customMessage] - Özel mesaj (opsiyonel)
   * @returns {string} Kullanıcı dostu mesaj
   */
  getMessage: function(typeCode, customMessage) {
    var errorType = this.TYPES[typeCode] || this.TYPES.UNKNOWN;
    return customMessage || errorType.message;
  },

  /**
   * Hatayı işler: loglar ve kullanıcı dostu mesaj döndürür
   * @param {string} typeCode - Hata türü kodu
   * @param {string} context - Hatanın oluştuğu yer
   * @param {Error|string|Object} error - Hata objesi
   * @param {Object} [data] - Ek veri
   * @returns {Object} {code, message, severity}
   */
  handle: function(typeCode, context, error, data) {
    // Hata logla
    this.log(context, error, data);
    
    // Hata türünü al
    var errorType = this.TYPES[typeCode] || this.TYPES.UNKNOWN;
    
    return {
      code: errorType.code,
      message: errorType.message,
      severity: errorType.severity
    };
  },

  /**
   * Try-catch wrapper fonksiyonu
   * @param {Function} fn - Çalıştırılacak fonksiyon
   * @param {string} context - Hata context'i
   * @param {string} [errorType] - Hata türü (varsayılan: UNKNOWN)
   * @returns {Function} Wrapped fonksiyon
   */
  wrap: function(fn, context, errorType) {
    var self = this;
    return function() {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        self.handle(errorType || "UNKNOWN", context, e);
        return null;
      }
    };
  },

  /**
   * Runtime hatasını kontrol eder (Chrome/Firefox uyumlu)
   * @returns {{hasError: boolean, error: Object|null}}
   */
  checkRuntimeError: function() {
    var error = _getLastError();
    if (error) {
      return {
        hasError: true,
        error: error
      };
    }
    return { hasError: false, error: null };
  }
};

// ErrorHandler'ı değiştirilemez yap
Object.freeze(ErrorHandler);
Object.freeze(ErrorHandler.TYPES);

// ============================================
// Storage Helper
// ============================================

const Storage = {
  /**
   * Extension context'in geçerli olup olmadığını kontrol eder.
   * Extension güncellendiğinde veya devre dışı bırakıldığında false döner.
   * @returns {boolean} Context geçerliyse true
   */
  isContextValid: function() {
    try {
      // Chrome kontrolü
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
        return true;
      }
      // Firefox kontrolü
      if (typeof browser !== "undefined" && browser.runtime && browser.runtime.id) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  /**
   * Storage'dan güvenli veri okuma.
   * Context geçersizse veya hata oluşursa sessizce başarısız olur.
   * @param {string|string[]} keys - Okunacak key veya key dizisi
   * @param {Function} callback - Veri alındığında çağrılacak fonksiyon: callback(data)
   * @param {Function} [onError] - Hata durumunda çağrılacak fonksiyon (opsiyonel)
   * @returns {boolean} İşlem başlatıldıysa true, context geçersizse false
   */
  get: function(keys, callback, onError) {
    try {
      if (!this.isContextValid()) {
        ErrorHandler.log("Storage.get", "Context invalid");
        return false;
      }
      
      // browserAPI polyfill kullan
      if (_browserAPI && _browserAPI.storage && _browserAPI.storage.sync) {
        _browserAPI.storage.sync.get(keys, function(data) {
          try {
            var lastError = _getLastError();
            if (lastError) {
              ErrorHandler.handle("STORAGE_READ", "Storage.get", lastError, { keys: keys });
              if (onError) onError(lastError);
              return;
            }
            callback(data || {});
          } catch (e) {
            ErrorHandler.handle("STORAGE_READ", "Storage.get.callback", e);
            if (onError) onError(e);
          }
        });
        return true;
      }
      
      return false;
    } catch (e) {
      ErrorHandler.handle("STORAGE_READ", "Storage.get", e, { keys: keys });
      if (onError) onError(e);
      return false;
    }
  },

  /**
   * Storage'a güvenli veri yazma.
   * Context geçersizse veya hata oluşursa sessizce başarısız olur.
   * @param {Object} data - Kaydedilecek veri objesi
   * @param {Function} [callback] - Kayıt tamamlandığında çağrılacak fonksiyon (opsiyonel)
   * @param {Function} [onError] - Hata durumunda çağrılacak fonksiyon (opsiyonel)
   * @returns {boolean} İşlem başlatıldıysa true, context geçersizse false
   */
  set: function(data, callback, onError) {
    try {
      if (!this.isContextValid()) {
        ErrorHandler.log("Storage.set", "Context invalid");
        return false;
      }
      
      // browserAPI polyfill kullan
      if (_browserAPI && _browserAPI.storage && _browserAPI.storage.sync) {
        _browserAPI.storage.sync.set(data, function() {
          try {
            var lastError = _getLastError();
            if (lastError) {
              // Quota hatası kontrolü
              var errorMsg = lastError.message || "";
              var errorType = errorMsg.includes("QUOTA") ? "STORAGE_QUOTA" : "STORAGE_WRITE";
              ErrorHandler.handle(errorType, "Storage.set", lastError);
              if (onError) onError(lastError);
              return;
            }
            if (callback) callback();
          } catch (e) {
            ErrorHandler.handle("STORAGE_WRITE", "Storage.set.callback", e);
            if (onError) onError(e);
          }
        });
        return true;
      }
      
      return false;
    } catch (e) {
      ErrorHandler.handle("STORAGE_WRITE", "Storage.set", e);
      if (onError) onError(e);
      return false;
    }
  },

  /**
   * Storage'dan güvenli veri silme.
   * @param {string|string[]} keys - Silinecek key veya key dizisi
   * @param {Function} [callback] - Silme tamamlandığında çağrılacak fonksiyon (opsiyonel)
   * @param {Function} [onError] - Hata durumunda çağrılacak fonksiyon (opsiyonel)
   * @returns {boolean} İşlem başlatıldıysa true, context geçersizse false
   */
  remove: function(keys, callback, onError) {
    try {
      if (!this.isContextValid()) {
        ErrorHandler.log("Storage.remove", "Context invalid");
        return false;
      }
      
      // browserAPI polyfill kullan
      if (_browserAPI && _browserAPI.storage && _browserAPI.storage.sync) {
        _browserAPI.storage.sync.remove(keys, function() {
          try {
            var lastError = _getLastError();
            if (lastError) {
              ErrorHandler.handle("STORAGE_WRITE", "Storage.remove", lastError, { keys: keys });
              if (onError) onError(lastError);
              return;
            }
            if (callback) callback();
          } catch (e) {
            ErrorHandler.handle("STORAGE_WRITE", "Storage.remove.callback", e);
            if (onError) onError(e);
          }
        });
        return true;
      }
      
      return false;
    } catch (e) {
      ErrorHandler.handle("STORAGE_WRITE", "Storage.remove", e, { keys: keys });
      if (onError) onError(e);
      return false;
    }
  },

  /**
   * Storage değişikliklerini dinlemek için güvenli listener.
   * @param {Function} callback - Değişiklik olduğunda çağrılacak fonksiyon: callback(changes, areaName)
   * @returns {boolean} Listener eklendiyse true, context geçersizse false
   */
  onChanged: function(callback) {
    try {
      if (!this.isContextValid()) {
        ErrorHandler.log("Storage.onChanged", "Context invalid");
        return false;
      }
      
      // browserAPI polyfill kullan
      if (_browserAPI && _browserAPI.storage && _browserAPI.storage.onChanged) {
        _browserAPI.storage.onChanged.addListener(function(changes, areaName) {
          // Her çağrıda context kontrolü
          if (!Storage.isContextValid()) {
            return;
          }
          
          try {
            callback(changes, areaName);
          } catch (e) {
            ErrorHandler.handle("UNKNOWN", "Storage.onChanged.callback", e);
          }
        });
        return true;
      }
      
      return false;
    } catch (e) {
      ErrorHandler.handle("UNKNOWN", "Storage.onChanged", e);
      return false;
    }
  },

  /**
   * Storage versiyon kontrolü ve migration işlemi.
   * Eski versiyondan yeni versiyona veri dönüşümü yapar.
   * @param {Function} [callback] - Migration tamamlandığında çağrılır: callback(migrated)
   * @returns {boolean} İşlem başlatıldıysa true
   */
  migrate: function(callback) {
    var self = this;
    
    if (!this.isContextValid()) {
      ErrorHandler.log("Storage.migrate", "Context invalid");
      if (callback) callback(false);
      return false;
    }

    try {
      // browserAPI polyfill kullan
      if (!_browserAPI || !_browserAPI.storage || !_browserAPI.storage.sync) {
        if (callback) callback(false);
        return false;
      }

      // Mevcut versiyonu oku
      _browserAPI.storage.sync.get([CONFIG.STORAGE.VERSION_KEY], function(data) {
        var lastError = _getLastError();
        if (lastError) {
          ErrorHandler.handle("STORAGE_READ", "Storage.migrate", lastError);
          if (callback) callback(false);
          return;
        }

        var currentVersion = (data && data[CONFIG.STORAGE.VERSION_KEY]) || 0;
        var targetVersion = CONFIG.STORAGE.VERSION;

        // Versiyon güncel, migration gerekmez
        if (currentVersion >= targetVersion) {
          if (callback) callback(false);
          return;
        }

        // Migration fonksiyonlarını sırayla çalıştır
        self._runMigrations(currentVersion, targetVersion, function(success) {
          if (success) {
            // Yeni versiyonu kaydet
            var updateData = {};
            updateData[CONFIG.STORAGE.VERSION_KEY] = targetVersion;
            
            _browserAPI.storage.sync.set(updateData, function() {
              var setError = _getLastError();
              if (setError) {
                ErrorHandler.handle("STORAGE_WRITE", "Storage.migrate.saveVersion", setError);
                if (callback) callback(false);
                return;
              }
              
              if (callback) callback(true);
            });
          } else {
            if (callback) callback(false);
          }
        });
      });

      return true;
    } catch (e) {
      ErrorHandler.handle("UNKNOWN", "Storage.migrate", e);
      if (callback) callback(false);
      return false;
    }
  },

  /**
   * Migration fonksiyonlarını sırayla çalıştırır (internal)
   * @param {number} fromVersion - Başlangıç versiyonu
   * @param {number} toVersion - Hedef versiyon
   * @param {Function} callback - Tamamlandığında çağrılır: callback(success)
   * @private
   */
  _runMigrations: function(fromVersion, toVersion, callback) {
    var self = this;
    var currentVersion = fromVersion;

    // Migration tanımları (versiyon -> migration fonksiyonu)
    var migrations = {
      // v0 -> v1: İlk kurulum, sadece versiyon kaydı
      0: function(done) {
        // Mevcut veriyi koru, sadece versiyon ekle
        done(true);
      }
      
      // Gelecek migration'lar buraya eklenecek:
      // 1: function(done) { ... done(true); }
      // 2: function(done) { ... done(true); }
    };

    // Recursive migration çalıştırıcı
    function runNext() {
      if (currentVersion >= toVersion) {
        callback(true);
        return;
      }

      var migrationFn = migrations[currentVersion];
      if (!migrationFn) {
        // Bu versiyon için migration yok, atla
        currentVersion++;
        runNext();
        return;
      }

      try {
        migrationFn(function(success) {
          if (success) {
            currentVersion++;
            runNext();
          } else {
            ErrorHandler.handle("STORAGE_WRITE", "Storage._runMigrations", 
              "Migration v" + currentVersion + " başarısız");
            callback(false);
          }
        });
      } catch (e) {
        ErrorHandler.handle("UNKNOWN", "Storage._runMigrations", e);
        callback(false);
      }
    }

    runNext();
  },

  // ============================================
  // Quota Yönetimi
  // ============================================

  /**
   * Chrome sync storage limitleri
   * Firefox'ta bu limitler farklı olabilir ama benzer şekilde çalışır
   */
  QUOTA: {
    TOTAL_BYTES: 102400,      // 100 KB toplam
    ITEM_BYTES: 8192,         // 8 KB per item
    MAX_ITEMS: 512,           // Maksimum item sayısı
    MAX_WRITE_OPS: 120,       // Dakikada maksimum yazma (burst)
    MAX_WRITE_OPS_HOUR: 1800  // Saatte maksimum yazma
  },

  /**
   * Veri boyutunu hesaplar (byte cinsinden)
   * @param {*} data - Boyutu hesaplanacak veri
   * @returns {number} Byte cinsinden boyut
   */
  calculateByteSize: function(data) {
    try {
      var str = typeof data === "string" ? data : JSON.stringify(data);
      // UTF-8 byte hesaplama
      return new Blob([str]).size;
    } catch (e) {
      // Fallback: Basit karakter sayısı
      return typeof data === "string" ? data.length : JSON.stringify(data).length;
    }
  },

  /**
   * Mevcut storage kullanımını hesaplar
   * @param {Function} callback - Sonuç callback'i: callback({used, total, percentage, items})
   */
  getUsage: function(callback) {
    var self = this;
    
    if (!this.isContextValid()) {
      ErrorHandler.log("Storage.getUsage", "Context invalid");
      callback({ used: 0, total: self.QUOTA.TOTAL_BYTES, percentage: 0, items: 0 });
      return;
    }

    try {
      // browserAPI polyfill kullan
      if (!_browserAPI || !_browserAPI.storage || !_browserAPI.storage.sync) {
        callback({ used: 0, total: self.QUOTA.TOTAL_BYTES, percentage: 0, items: 0 });
        return;
      }

      _browserAPI.storage.sync.get(null, function(data) {
        var lastError = _getLastError();
        if (lastError) {
          ErrorHandler.handle("STORAGE_READ", "Storage.getUsage", lastError);
          callback({ used: 0, total: self.QUOTA.TOTAL_BYTES, percentage: 0, items: 0 });
          return;
        }

        var totalBytes = 0;
        var itemCount = 0;

        for (var key in data) {
          if (data.hasOwnProperty(key)) {
            // Key + value boyutu
            totalBytes += self.calculateByteSize(key);
            totalBytes += self.calculateByteSize(data[key]);
            itemCount++;
          }
        }

        var percentage = Math.round((totalBytes / self.QUOTA.TOTAL_BYTES) * 100);

        callback({
          used: totalBytes,
          total: self.QUOTA.TOTAL_BYTES,
          percentage: Math.min(percentage, 100),
          items: itemCount
        });
      });
    } catch (e) {
      ErrorHandler.handle("UNKNOWN", "Storage.getUsage", e);
      callback({ used: 0, total: self.QUOTA.TOTAL_BYTES, percentage: 0, items: 0 });
    }
  },

  /**
   * Yeni veri eklendiğinde quota'yı aşıp aşmayacağını kontrol eder
   * @param {Object} newData - Eklenecek yeni veri
   * @param {Function} callback - Sonuç callback'i: callback({canSave, currentUsage, newUsage, overflow})
   */
  checkQuota: function(newData, callback) {
    var self = this;

    this.getUsage(function(usage) {
      var newDataSize = self.calculateByteSize(newData);
      var projectedUsage = usage.used + newDataSize;
      var overflow = projectedUsage - self.QUOTA.TOTAL_BYTES;

      callback({
        canSave: projectedUsage <= self.QUOTA.TOTAL_BYTES,
        currentUsage: usage,
        newDataSize: newDataSize,
        projectedUsage: projectedUsage,
        overflow: Math.max(0, overflow)
      });
    });
  },

  /**
   * Byte değerini okunabilir formata çevirir
   * @param {number} bytes - Byte değeri
   * @returns {string} Okunabilir format (örn: "45.2 KB")
   */
  formatBytes: function(bytes) {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(1) + " KB";
  }
};

// Storage objesini değiştirilemez yap
Object.freeze(Storage);
Object.freeze(Storage.QUOTA);
