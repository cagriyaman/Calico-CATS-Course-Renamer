/**
 * Calico - Browser API Polyfill
 * Chrome ve Firefox arasında API uyumluluğunu sağlar.
 * 
 * Chrome: chrome.* API (callback tabanlı)
 * Firefox: browser.* API (Promise tabanlı) veya chrome.* (uyumluluk)
 * 
 * Bu dosya, her iki tarayıcıda da çalışan birleşik bir API sağlar.
 */

(function(global) {
  "use strict";

  // Zaten tanımlıysa tekrar tanımlama
  if (global.browserAPI) {
    return;
  }

  // ============================================
  // Tarayıcı Algılama
  // ============================================

  /**
   * Hangi tarayıcıda çalıştığımızı belirle
   * Firefox: browser objesi tanımlı ve browser.runtime.getBrowserInfo mevcut
   * Chrome: chrome objesi tanımlı
   */
  var isFirefox = typeof browser !== "undefined" && 
                  typeof browser.runtime !== "undefined" &&
                  typeof browser.runtime.getBrowserInfo === "function";
  
  var isChrome = typeof chrome !== "undefined" && 
                 typeof chrome.runtime !== "undefined" &&
                 !isFirefox;

  // Ham API referansı
  var rawAPI = isFirefox ? browser : (typeof chrome !== "undefined" ? chrome : null);

  if (!rawAPI) {
    console.error("[Calico] Tarayıcı API bulunamadı!");
    return;
  }

  // ============================================
  // Promise -> Callback Dönüştürücü
  // ============================================

  /**
   * Firefox'un Promise döndüren API'lerini callback formatına çevirir.
   * Chrome zaten callback kullandığı için doğrudan çağrılır.
   * 
   * @param {Function} promiseFn - Promise döndüren fonksiyon
   * @param {Function} callback - Sonuç için callback
   * @param {Function} [errorCallback] - Hata için callback (opsiyonel)
   */
  function promiseToCallback(promiseFn, callback, errorCallback) {
    try {
      var result = promiseFn();
      
      // Firefox Promise döndürür
      if (result && typeof result.then === "function") {
        result.then(function(data) {
          if (callback) callback(data);
        }).catch(function(error) {
          // Firefox'ta hata durumunda runtime.lastError simüle et
          console.warn("[Calico] API Error:", error);
          if (errorCallback) {
            errorCallback(error);
          } else if (callback) {
            callback(undefined);
          }
        });
      }
      // Chrome callback'i kendi çağırır, bir şey yapmamıza gerek yok
    } catch (e) {
      console.error("[Calico] API Exception:", e);
      if (errorCallback) {
        errorCallback(e);
      }
    }
  }

  // ============================================
  // Storage API Wrapper
  // ============================================

  var StorageAreaWrapper = function(storageArea, areaName) {
    this._storage = storageArea;
    this._areaName = areaName;
  };

  /**
   * Storage'dan veri okur
   * @param {string|string[]|Object} keys - Okunacak key(ler)
   * @param {Function} callback - Sonuç callback'i
   */
  StorageAreaWrapper.prototype.get = function(keys, callback) {
    var storage = this._storage;
    
    if (isFirefox) {
      promiseToCallback(
        function() { return storage.get(keys); },
        callback
      );
    } else {
      // Chrome - doğrudan çağır
      storage.get(keys, callback);
    }
  };

  /**
   * Storage'a veri yazar
   * @param {Object} items - Yazılacak key-value çiftleri
   * @param {Function} [callback] - Tamamlanma callback'i
   */
  StorageAreaWrapper.prototype.set = function(items, callback) {
    var storage = this._storage;
    
    if (isFirefox) {
      promiseToCallback(
        function() { return storage.set(items); },
        callback
      );
    } else {
      // Chrome - doğrudan çağır
      storage.set(items, callback);
    }
  };

  /**
   * Storage'dan veri siler
   * @param {string|string[]} keys - Silinecek key(ler)
   * @param {Function} [callback] - Tamamlanma callback'i
   */
  StorageAreaWrapper.prototype.remove = function(keys, callback) {
    var storage = this._storage;
    
    if (isFirefox) {
      promiseToCallback(
        function() { return storage.remove(keys); },
        callback
      );
    } else {
      // Chrome - doğrudan çağır
      storage.remove(keys, callback);
    }
  };

  /**
   * Storage kullanım bilgisini alır
   * @param {Function} callback - Sonuç callback'i (bytesInUse)
   */
  StorageAreaWrapper.prototype.getBytesInUse = function(callback) {
    var storage = this._storage;
    
    // Firefox getBytesInUse desteklemiyor, tahmini değer döndür
    if (isFirefox) {
      // Firefox'ta bu API yok, tüm veriyi alıp hesapla
      promiseToCallback(
        function() { return storage.get(null); },
        function(data) {
          try {
            var size = new Blob([JSON.stringify(data)]).size;
            if (callback) callback(size);
          } catch (e) {
            if (callback) callback(0);
          }
        }
      );
    } else {
      // Chrome - doğrudan çağır
      if (storage.getBytesInUse) {
        storage.getBytesInUse(null, callback);
      } else {
        if (callback) callback(0);
      }
    }
  };

  // ============================================
  // Storage Değişiklik Dinleyicisi
  // ============================================

  var storageChangeListeners = [];

  /**
   * Storage değişikliklerini dinler
   * @param {Function} callback - Değişiklik callback'i (changes, areaName)
   */
  function addStorageChangeListener(callback) {
    if (!callback) return;
    
    storageChangeListeners.push(callback);
    
    // İlk listener eklendiyse, native listener'ı ekle
    if (storageChangeListeners.length === 1) {
      rawAPI.storage.onChanged.addListener(function(changes, areaName) {
        for (var i = 0; i < storageChangeListeners.length; i++) {
          try {
            storageChangeListeners[i](changes, areaName);
          } catch (e) {
            console.error("[Calico] Storage listener error:", e);
          }
        }
      });
    }
  }

  // ============================================
  // Runtime API Wrapper
  // ============================================

  var RuntimeWrapper = {
    /**
     * Son hatayı döndürür
     * Firefox'ta bu farklı çalışır, Promise rejection olarak gelir
     */
    get lastError() {
      return rawAPI.runtime.lastError;
    },

    /**
     * Extension ID'sini döndürür
     */
    get id() {
      return rawAPI.runtime.id;
    },

    /**
     * Extension URL'si oluşturur
     * @param {string} path - Dosya yolu
     * @returns {string} Tam URL
     */
    getURL: function(path) {
      return rawAPI.runtime.getURL(path);
    },

    /**
     * Extension manifest bilgisini döndürür
     * @returns {Object} Manifest objesi
     */
    getManifest: function() {
      return rawAPI.runtime.getManifest();
    }
  };

  // ============================================
  // Ana API Objesi
  // ============================================

  var browserAPI = {
    /**
     * Tarayıcı bilgisi
     */
    isFirefox: isFirefox,
    isChrome: isChrome,
    
    /**
     * Storage API
     */
    storage: {
      sync: new StorageAreaWrapper(rawAPI.storage.sync, "sync"),
      local: new StorageAreaWrapper(rawAPI.storage.local, "local"),
      
      /**
       * Storage değişikliklerini dinle
       */
      onChanged: {
        addListener: addStorageChangeListener
      }
    },

    /**
     * Runtime API
     */
    runtime: RuntimeWrapper,

    /**
     * Ham API'ye erişim (gerekirse)
     */
    _raw: rawAPI
  };

  // ============================================
  // Global Export
  // ============================================

  global.browserAPI = browserAPI;

  // Debug bilgisi
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[Calico] Browser Polyfill loaded:", 
      isFirefox ? "Firefox" : (isChrome ? "Chrome" : "Unknown"));
  }

})(typeof window !== "undefined" ? window : this);
