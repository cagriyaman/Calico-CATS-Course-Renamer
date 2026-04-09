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
              Logger.log('ERR', 'Storage okuma hatası', { keys: keys, error: lastError.message || String(lastError) });
              if (onError) onError(lastError);
              return;
            }
            Logger.log('ST_R', 'Storage okuma', {
              keys: keys,
              resultKeys: Object.keys(data || {}),
              hasData: Object.keys(data || {}).length > 0
            });
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
        Logger.log('ST_W', 'Storage yazma', {
          keys: Object.keys(data),
          courseMapKeys: data[CONFIG.STORAGE_KEYS.COURSE_MAP]
            ? Object.keys(data[CONFIG.STORAGE_KEYS.COURSE_MAP])
            : undefined,
          courseMapCount: data[CONFIG.STORAGE_KEYS.COURSE_MAP]
            ? Object.keys(data[CONFIG.STORAGE_KEYS.COURSE_MAP]).length
            : undefined
        });
        _browserAPI.storage.sync.set(data, function() {
          try {
            var lastError = _getLastError();
            if (lastError) {
              // Quota hatası kontrolü
              var errorMsg = lastError.message || "";
              var errorType = errorMsg.includes("QUOTA") ? "STORAGE_QUOTA" : "STORAGE_WRITE";
              ErrorHandler.handle(errorType, "Storage.set", lastError);
              Logger.log('ERR', 'Storage yazma hatası', { keys: Object.keys(data), error: errorMsg });
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
        Logger.log('ST_D', 'Storage silme', { keys: keys });
        _browserAPI.storage.sync.remove(keys, function() {
          try {
            var lastError = _getLastError();
            if (lastError) {
              ErrorHandler.handle("STORAGE_WRITE", "Storage.remove", lastError, { keys: keys });
              Logger.log('ERR', 'Storage silme hatası', { keys: keys, error: (lastError.message || String(lastError)) });
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
            // Detaylı değişiklik logu
            var changeDetails = {};
            for (var key in changes) {
              if (changes.hasOwnProperty(key)) {
                var change = changes[key];
                changeDetails[key] = {
                  hasOld: change.oldValue !== undefined,
                  hasNew: change.newValue !== undefined
                };
                // courseMap değişikliklerinde detaylı diff
                if (key === CONFIG.STORAGE_KEYS.COURSE_MAP) {
                  var oldKeys = change.oldValue ? Object.keys(change.oldValue) : [];
                  var newKeys = change.newValue ? Object.keys(change.newValue) : [];
                  var added = newKeys.filter(function(k) { return oldKeys.indexOf(k) === -1; });
                  var removed = oldKeys.filter(function(k) { return newKeys.indexOf(k) === -1; });
                  changeDetails[key].diff = {
                    oldCount: oldKeys.length,
                    newCount: newKeys.length,
                    added: added,
                    removed: removed
                  };
                }
              }
            }
            Logger.log('ST_W', 'Storage onChanged', { area: areaName, changes: changeDetails });

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

// ============================================
// Debug Logger
// ============================================

/**
 * Debug Logger Modülü
 * Storage değişikliklerini, DOM olaylarını ve hataları takip eder.
 * storage.local kullanır (5MB limit, sync quota'sını yemez).
 * Varsayılan olarak açıktır.
 * Kritik kategoriler anında persist edilir.
 */
var Logger = (function() {
  // CONFIG'ten sabitleri al
  var MAX_ENTRIES = CONFIG.LOGGER.MAX_ENTRIES;
  var PERSIST_INTERVAL = CONFIG.LOGGER.PERSIST_INTERVAL;
  var STORAGE_KEY_ENABLED = CONFIG.LOGGER.STORAGE_KEY_ENABLED;
  var STORAGE_KEY_ENTRIES = CONFIG.LOGGER.STORAGE_KEY_ENTRIES;
  var DATA_MAX_LENGTH = CONFIG.LOGGER.DATA_MAX_LENGTH;
  var CRITICAL_CATEGORIES = CONFIG.LOGGER.CRITICAL_CATEGORIES;

  // Durum - varsayılan olarak açık
  var _enabled = true;
  var _buffer = [];
  var _persistTimer = null;
  var _initialized = false;
  var _persistPending = false;

  /**
   * storage.local referansını döndürür
   * @returns {Object|null} storage.local API
   */
  function _getLocalStorage() {
    if (_browserAPI && _browserAPI.storage && _browserAPI.storage.local) {
      return _browserAPI.storage.local;
    }
    return null;
  }

  /**
   * Logger'ı başlatır, storage.local'dan mevcut durumu yükler.
   * İlk kurulumda eski sync verilerini migrate eder.
   * @param {Function} callback - Başlatma tamamlandığında çağrılır
   */
  function init(callback) {
    if (!Storage.isContextValid()) {
      _initialized = true;
      if (callback) callback();
      return;
    }

    var local = _getLocalStorage();
    if (!local) {
      _initialized = true;
      if (callback) callback();
      return;
    }

    try {
      // storage.local'dan oku
      local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_ENTRIES], function(data) {
        var lastError = _getLastError();
        if (lastError) {
          _initialized = true;
          if (callback) callback();
          return;
        }

        // Enabled: undefined ise varsayılan true
        _enabled = data[STORAGE_KEY_ENABLED] !== undefined ? data[STORAGE_KEY_ENABLED] : true;
        _buffer = data[STORAGE_KEY_ENTRIES] || [];

        // One-time migration: local boşsa sync'ten eski veriyi al
        if (_buffer.length === 0 && _browserAPI.storage.sync) {
          _browserAPI.storage.sync.get([STORAGE_KEY_ENABLED, STORAGE_KEY_ENTRIES], function(syncData) {
            var syncError = _getLastError();
            if (!syncError && syncData[STORAGE_KEY_ENTRIES] && syncData[STORAGE_KEY_ENTRIES].length > 0) {
              _buffer = syncData[STORAGE_KEY_ENTRIES];
              // Sync'teki eski log verilerini temizle
              _browserAPI.storage.sync.remove([STORAGE_KEY_ENABLED, STORAGE_KEY_ENTRIES]);
              persist();
            }
            _initialized = true;
            if (callback) callback();
          });
        } else {
          _initialized = true;
          if (callback) callback();
        }
      });
    } catch (e) {
      _initialized = true;
      if (callback) callback();
    }
  }

  /**
   * Log kaydı ekler
   * @param {string} category - Log kategorisi (INIT, ST_R, ST_W, ST_D, DOM_D, DOM_A, ORPH, USER, ERR, WARN)
   * @param {string} message - Log mesajı
   * @param {Object} data - Ek veri (opsiyonel)
   */
  function log(category, message, data) {
    if (!_enabled || !_initialized) return;

    var entry = {
      t: Date.now(),
      c: category,
      m: message
    };

    if (data !== undefined && data !== null) {
      try {
        var dataStr = JSON.stringify(data);
        if (dataStr.length <= DATA_MAX_LENGTH) {
          entry.d = data;
        } else {
          entry.d = { _truncated: true, _size: dataStr.length };
        }
      } catch (e) {
        entry.d = { _error: "serialize failed" };
      }
    }

    _buffer.push(entry);

    // Circular buffer
    if (_buffer.length > MAX_ENTRIES) {
      _buffer = _buffer.slice(-MAX_ENTRIES);
    }

    // Kritik kategoriler anında persist edilir (debounce atlanır)
    if (CRITICAL_CATEGORIES.indexOf(category) !== -1) {
      persist();
    } else {
      schedulePersist();
    }
  }

  /**
   * Storage'a yazımı zamanlar (debounce)
   */
  function schedulePersist() {
    if (_persistTimer || _persistPending) return;

    _persistTimer = setTimeout(function() {
      _persistTimer = null;
      persist();
    }, PERSIST_INTERVAL);
  }

  /**
   * Buffer'ı storage.local'a yazar
   * @param {Function} callback - Yazım tamamlandığında çağrılır
   */
  function persist(callback) {
    if (!_initialized || _persistPending) {
      if (callback) callback();
      return;
    }

    if (!Storage.isContextValid()) {
      if (callback) callback();
      return;
    }

    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback();
      return;
    }

    _persistPending = true;

    try {
      var saveData = {};
      saveData[STORAGE_KEY_ENTRIES] = _buffer;

      local.set(saveData, function() {
        _persistPending = false;
        if (callback) callback();
      });
    } catch (e) {
      _persistPending = false;
      if (callback) callback();
    }
  }

  /**
   * Logger'ı açar
   * @param {Function} callback - İşlem tamamlandığında çağrılır
   */
  function enable(callback) {
    if (!Storage.isContextValid()) {
      if (callback) callback(false);
      return;
    }

    _enabled = true;

    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback(false);
      return;
    }

    try {
      var saveData = {};
      saveData[STORAGE_KEY_ENABLED] = true;

      local.set(saveData, function() {
        var lastError = _getLastError();
        if (lastError) {
          if (callback) callback(false);
          return;
        }

        log('INIT', 'Logger aktif edildi');
        if (callback) callback(true);
      });
    } catch (e) {
      if (callback) callback(false);
    }
  }

  /**
   * Logger'ı kapatır
   * @param {Function} callback - İşlem tamamlandığında çağrılır
   */
  function disable(callback) {
    if (!Storage.isContextValid()) {
      _enabled = false;
      if (callback) callback(false);
      return;
    }

    log('INIT', 'Logger devre dışı bırakıldı');

    // Önce son logu kaydet
    persist(function() {
      _enabled = false;

      var local = _getLocalStorage();
      if (!local) {
        if (callback) callback(false);
        return;
      }

      try {
        var saveData = {};
        saveData[STORAGE_KEY_ENABLED] = false;

        local.set(saveData, function() {
          var lastError = _getLastError();
          if (callback) callback(!lastError);
        });
      } catch (e) {
        if (callback) callback(false);
      }
    });
  }

  /**
   * Tüm logları döndürür (kopya)
   * @returns {Array} Log dizisi
   */
  function getLogs() {
    return _buffer.slice();
  }

  /**
   * Log sayısını döndürür
   * @returns {number} Log sayısı
   */
  function getLogCount() {
    return _buffer.length;
  }

  /**
   * Logları temizler
   * @param {Function} callback - İşlem tamamlandığında çağrılır
   */
  function clearLogs(callback) {
    _buffer = [];

    if (!Storage.isContextValid()) {
      if (callback) callback(false);
      return;
    }

    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback(false);
      return;
    }

    try {
      var saveData = {};
      saveData[STORAGE_KEY_ENTRIES] = [];

      local.set(saveData, function() {
        var lastError = _getLastError();
        if (callback) callback(!lastError);
      });
    } catch (e) {
      if (callback) callback(false);
    }
  }

  /**
   * Logları JSON formatında export eder
   * @returns {Object} Export objesi
   */
  function exportLogs() {
    var oldest = _buffer.length > 0 ? _buffer[0].t : null;
    var newest = _buffer.length > 0 ? _buffer[_buffer.length - 1].t : null;

    return {
      calico: '1.0',
      type: 'debug-logs',
      exportedAt: new Date().toISOString(),
      entries: _buffer,
      summary: {
        total: _buffer.length,
        oldest: oldest ? new Date(oldest).toISOString() : null,
        newest: newest ? new Date(newest).toISOString() : null
      }
    };
  }

  /**
   * Logger durumunu döndürür
   * @returns {boolean} Logger açık mı
   */
  function isEnabled() {
    return _enabled;
  }

  /**
   * Logger başlatıldı mı kontrol eder
   * @returns {boolean} Başlatıldı mı
   */
  function isInitialized() {
    return _initialized;
  }

  /**
   * Log istatistiklerini döndürür
   * @returns {Object} İstatistikler
   */
  function getStats() {
    if (_buffer.length === 0) {
      return {
        total: 0,
        oldest: null,
        newest: null,
        byCategory: {}
      };
    }

    var byCategory = {};
    for (var i = 0; i < _buffer.length; i++) {
      var cat = _buffer[i].c;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      total: _buffer.length,
      oldest: new Date(_buffer[0].t).toISOString(),
      newest: new Date(_buffer[_buffer.length - 1].t).toISOString(),
      byCategory: byCategory
    };
  }

  /**
   * Timestamp'i okunabilir formata çevirir (milisaniye dahil)
   * @param {number} timestamp - Unix timestamp (ms)
   * @returns {string} Formatlanmış tarih/saat (HH:MM:SS.mmm)
   */
  function formatTimestamp(timestamp) {
    var d = new Date(timestamp);
    var hours = String(d.getHours()).padStart(2, '0');
    var mins = String(d.getMinutes()).padStart(2, '0');
    var secs = String(d.getSeconds()).padStart(2, '0');
    var ms = String(d.getMilliseconds()).padStart(3, '0');
    return hours + ':' + mins + ':' + secs + '.' + ms;
  }

  /**
   * Tarih formatı (gün dahil)
   * @param {number} timestamp - Unix timestamp (ms)
   * @returns {string} Formatlanmış tarih
   */
  function formatDate(timestamp) {
    var d = new Date(timestamp);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '.' + month + '.' + year;
  }

  return {
    init: init,
    log: log,
    enable: enable,
    disable: disable,
    getLogs: getLogs,
    getLogCount: getLogCount,
    clearLogs: clearLogs,
    exportLogs: exportLogs,
    isEnabled: isEnabled,
    isInitialized: isInitialized,
    getStats: getStats,
    persist: persist,
    formatTimestamp: formatTimestamp,
    formatDate: formatDate
  };
})();

// ============================================
// Preset Storage (storage.local)
// ============================================

/**
 * Preset Storage Modülü
 * Ders adı preset'lerini ve otomatik yedekleri yönetir.
 * storage.local kullanır (sync quota'sını etkilemez).
 */
var PresetStorage = (function() {
  var STORAGE_KEY = CONFIG.PRESET.STORAGE_KEY;
  var AUTO_BACKUP_KEY = CONFIG.PRESET.AUTO_BACKUP_KEY;
  var MAX_SLOTS = CONFIG.PRESET.MAX_SLOTS;

  /**
   * storage.local referansını döndürür
   * @returns {Object|null}
   */
  function _getLocalStorage() {
    if (_browserAPI && _browserAPI.storage && _browserAPI.storage.local) {
      return _browserAPI.storage.local;
    }
    return null;
  }

  /**
   * Preset dizisini doğru uzunluğa getirir (null ile doldurur)
   * @param {Array} presets - Mevcut preset dizisi
   * @returns {Array} MAX_SLOTS uzunluğunda dizi
   */
  function _padPresets(presets) {
    var result = presets || [];
    while (result.length < MAX_SLOTS) {
      result.push(null);
    }
    return result.slice(0, MAX_SLOTS);
  }

  /**
   * Tüm preset slot'larını okur
   * @param {Function} callback - callback(presetsArray) - her eleman preset objesi veya null
   */
  function getAll(callback) {
    var local = _getLocalStorage();
    if (!local) {
      callback(_padPresets([]));
      return;
    }

    try {
      local.get([STORAGE_KEY], function(data) {
        var lastError = _getLastError();
        if (lastError) {
          callback(_padPresets([]));
          return;
        }
        callback(_padPresets(data[STORAGE_KEY] || []));
      });
    } catch (e) {
      callback(_padPresets([]));
    }
  }

  /**
   * Belirtilen slot'a courseMap kaydeder
   * @param {number} slotIndex - 0, 1 veya 2
   * @param {string} name - Preset adı
   * @param {Object} courseMap - Kaydedilecek courseMap
   * @param {Function} callback - callback(success)
   */
  function saveToSlot(slotIndex, name, courseMap, callback) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      if (callback) callback(false);
      return;
    }

    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback(false);
      return;
    }

    getAll(function(presets) {
      presets[slotIndex] = {
        name: (name || "").trim().substring(0, CONFIG.PRESET.MAX_NAME_LENGTH),
        courseMap: courseMap,
        createdAt: new Date().toISOString()
      };

      var saveData = {};
      saveData[STORAGE_KEY] = presets;

      try {
        local.set(saveData, function() {
          var lastError = _getLastError();
          if (callback) callback(!lastError);
        });
      } catch (e) {
        if (callback) callback(false);
      }
    });
  }

  /**
   * Belirtilen slot'tan preset okur
   * @param {number} slotIndex - 0, 1 veya 2
   * @param {Function} callback - callback(presetObject|null)
   */
  function loadFromSlot(slotIndex, callback) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      callback(null);
      return;
    }

    getAll(function(presets) {
      callback(presets[slotIndex] || null);
    });
  }

  /**
   * Belirtilen slot'u temizler
   * @param {number} slotIndex - 0, 1 veya 2
   * @param {Function} callback - callback(success)
   */
  function clearSlot(slotIndex, callback) {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      if (callback) callback(false);
      return;
    }

    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback(false);
      return;
    }

    getAll(function(presets) {
      presets[slotIndex] = null;

      var saveData = {};
      saveData[STORAGE_KEY] = presets;

      try {
        local.set(saveData, function() {
          var lastError = _getLastError();
          if (callback) callback(!lastError);
        });
      } catch (e) {
        if (callback) callback(false);
      }
    });
  }

  /**
   * Mevcut courseMap'in otomatik yedeğini alır.
   * Yıkıcı işlemlerden (preset yükleme, import, tümünü sil) önce çağrılır.
   * @param {Object} courseMap - Yedeklenecek courseMap
   * @param {Function} [callback] - callback(success)
   */
  function saveAutoBackup(courseMap, callback) {
    var local = _getLocalStorage();
    if (!local) {
      if (callback) callback(false);
      return;
    }

    var saveData = {};
    saveData[AUTO_BACKUP_KEY] = {
      courseMap: courseMap,
      savedAt: new Date().toISOString()
    };

    try {
      local.set(saveData, function() {
        var lastError = _getLastError();
        if (callback) callback(!lastError);
      });
    } catch (e) {
      if (callback) callback(false);
    }
  }

  /**
   * Otomatik yedeği okur
   * @param {Function} callback - callback(backupObject|null)
   */
  function getAutoBackup(callback) {
    var local = _getLocalStorage();
    if (!local) {
      callback(null);
      return;
    }

    try {
      local.get([AUTO_BACKUP_KEY], function(data) {
        var lastError = _getLastError();
        if (lastError) {
          callback(null);
          return;
        }
        callback(data[AUTO_BACKUP_KEY] || null);
      });
    } catch (e) {
      callback(null);
    }
  }

  return {
    getAll: getAll,
    saveToSlot: saveToSlot,
    loadFromSlot: loadFromSlot,
    clearSlot: clearSlot,
    saveAutoBackup: saveAutoBackup,
    getAutoBackup: getAutoBackup
  };
})();

// Objeleri değiştirilemez yap
Object.freeze(Storage);
Object.freeze(Storage.QUOTA);
Object.freeze(PresetStorage);
