/**
 * Calico - Import Page
 * Bağımsız pencerede .calico dosyası import işlemi.
 * Firefox'ta popup içinde file picker açılamadığı için bu sayfa kullanılır.
 *
 * Bağımlılıklar: browser-polyfill.js, config.js, storage.js
 */

(function() {
  "use strict";

  var pickBtn = document.getElementById("pickBtn");
  var fileInput = document.getElementById("fileInput");
  var dropzone = document.getElementById("dropzone");
  var statusEl = document.getElementById("status");

  // ============================================
  // Status Helper
  // ============================================

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status visible " + type;
  }

  // ============================================
  // Validation (.calico dosyası)
  // ============================================

  function validateCalicoFile(data) {
    var result = { valid: false, error: null, courseMap: null, warnings: [] };

    if (!data || typeof data !== "object") {
      result.error = "Ge\u00E7ersiz dosya format\u0131";
      return result;
    }

    if (!data.calico || !data.type) {
      result.error = "Bu bir .calico dosyas\u0131 de\u011Fil";
      return result;
    }

    if (data.type !== CONFIG.FILE.TYPE_PRESET) {
      result.error = "Desteklenmeyen dosya t\u00FCr\u00FC: " + data.type;
      return result;
    }

    if (!data.courseMap || typeof data.courseMap !== "object") {
      result.error = "Dosyada ders bulunamad\u0131";
      return result;
    }

    var keys = Object.keys(data.courseMap);
    if (keys.length === 0) {
      result.error = "Dosyada ders bulunamad\u0131";
      return result;
    }

    if (keys.length > CONFIG.FILE.MAX_COURSE_ENTRIES) {
      result.error = "Dosya \u00E7ok fazla ders i\u00E7eriyor (" + keys.length + "/" + CONFIG.FILE.MAX_COURSE_ENTRIES + ")";
      return result;
    }

    var cleanMap = {};
    var truncatedCount = 0;
    var maxLen = CONFIG.INPUT.MAX_COURSE_NAME_LENGTH;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = data.courseMap[key];
      if (typeof val !== "string") continue;

      if (val.length > maxLen) {
        val = val.substring(0, maxLen);
        truncatedCount++;
      }
      cleanMap[key] = val;
    }

    if (Object.keys(cleanMap).length === 0) {
      result.error = "Dosyada ge\u00E7erli ders bulunamad\u0131";
      return result;
    }

    if (truncatedCount > 0) {
      result.warnings.push(truncatedCount + " ders ad\u0131 k\u0131salt\u0131ld\u0131 (" + maxLen + " karakter limiti)");
    }

    result.valid = true;
    result.courseMap = cleanMap;
    return result;
  }

  // ============================================
  // Import İşlemi
  // ============================================

  function processFile(file) {
    if (!file) return;

    if (file.size > CONFIG.FILE.MAX_IMPORT_SIZE) {
      showStatus("Dosya \u00E7ok b\u00FCy\u00FCk (maks. " + (CONFIG.FILE.MAX_IMPORT_SIZE / 1024) + " KB)", "err");
      return;
    }

    if (!file.name.endsWith(CONFIG.FILE.EXTENSION)) {
      showStatus("Ge\u00E7ersiz dosya uzant\u0131s\u0131 (.calico bekleniyor)", "err");
      return;
    }

    showStatus("Okunuyor...", "warn");

    var reader = new FileReader();
    reader.onload = function(e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        showStatus("Ge\u00E7ersiz dosya format\u0131", "err");
        return;
      }

      var validation = validateCalicoFile(parsed);
      if (!validation.valid) {
        showStatus(validation.error, "err");
        return;
      }

      // Mevcut durumu otomatik yedekle, sonra import et
      Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
        var currentMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

        function applyImport() {
          Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: validation.courseMap }, function() {
            var count = Object.keys(validation.courseMap).length;
            Logger.log("USER", ".calico import (pencere)", { courses: count, file: file.name });

            var msg = "\u2713 " + count + " ders y\u00FCklendi";
            if (validation.warnings.length > 0) {
              msg += " (" + validation.warnings.join(", ") + ")";
            }
            showStatus(msg, "ok");

            // 1.5 saniye sonra pencereyi otomatik kapat
            setTimeout(function() {
              window.close();
            }, 1500);
          }, function(err) {
            showStatus("Kaydetme hatas\u0131", "err");
          });
        }

        if (Object.keys(currentMap).length > 0) {
          PresetStorage.saveAutoBackup(currentMap, function() {
            applyImport();
          });
        } else {
          applyImport();
        }
      }, function(err) {
        showStatus("Storage okuma hatas\u0131", "err");
      });
    };

    reader.onerror = function() {
      showStatus("Dosya okunamad\u0131", "err");
    };

    reader.readAsText(file);
  }

  // ============================================
  // Event Listeners
  // ============================================

  // Dosya seç butonu
  pickBtn.addEventListener("click", function() {
    fileInput.click();
  });

  fileInput.addEventListener("change", function() {
    var file = fileInput.files[0];
    fileInput.value = "";
    if (file) processFile(file);
  });

  // Drag & Drop
  dropzone.addEventListener("dragover", function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");

    var files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
  });

  // Logger init
  Logger.init(function() {});
})();
