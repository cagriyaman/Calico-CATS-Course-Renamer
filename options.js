/**
 * Calico - Options Page
 * Extension popup arayüzü ve kullanıcı etkileşimleri.
 * 
 * Bağımlılıklar: storage.js (ErrorHandler dahil), emojis.js
 * Not: HTML'de önce yüklenmeli
 */

// ============================================
// DOM Elementleri
// ============================================

const els = {
  list: document.getElementById("autoCourseList"),
  saveAll: document.getElementById("saveAll"),
  clear: document.getElementById("clearMappings"),
  status: document.getElementById("status"),
  modal: document.getElementById("emojiPickerModal"),
  emojiGrid: document.getElementById("emojiGrid"),
  closeEmoji: document.getElementById("closeEmoji"),
  aboutModal: document.getElementById("aboutModal"),
  aboutBtn: document.getElementById("aboutBtn"),
  closeAbout: document.getElementById("closeAbout"),
  extensionToggle: document.getElementById("extensionToggle"),
  restoreBackupMain: document.getElementById("restoreBackupMain"),
  // Tab Navigation
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabCourses: document.getElementById("tabCourses"),
  tabSettings: document.getElementById("tabSettings"),
  // Settings Tab
  loggerToggle: document.getElementById("loggerToggle"),
  logViewer: document.getElementById("logViewer"),
  logCount: document.getElementById("logCount"),
  logOldest: document.getElementById("logOldest"),
  exportLogs: document.getElementById("exportLogs"),
  clearLogs: document.getElementById("clearLogs"),
  logFilterBtns: document.querySelectorAll(".log-filter-btn"),
  storageBarFill: document.getElementById("storageBarFill"),
  storageUsed: document.getElementById("storageUsed"),
  storageTotal: document.getElementById("storageTotal"),
  storagePercent: document.getElementById("storagePercent"),
  // Preset & Export/Import
  presetSlots: document.getElementById("presetSlots"),
  presetBackup: document.getElementById("presetBackup"),
  exportCalico: document.getElementById("exportCalico"),
  importCalicoBtn: document.getElementById("importCalicoBtn"),
  importCalicoInput: document.getElementById("importCalicoInput"),
  importStatus: document.getElementById("importStatus")
};

// ============================================
// State
// ============================================

let editingCourse = null;
let currentCategory = EMOJI_DATA.DEFAULT_CATEGORY;
let extensionEnabled = true;
let activeFilter = "all";

// ============================================
// UI Helper Fonksiyonları
// ============================================

/**
 * Durum mesajı gösterir
 * @param {string} message - Gösterilecek mesaj
 * @param {number} [duration=2000] - Görünme süresi (ms)
 * @param {string} [type="success"] - Mesaj türü: "success", "error", "warning"
 */
function showStatus(message, duration, type) {
  duration = duration || 2000;
  type = type || "success";
  
  els.status.textContent = message;
  els.status.className = "status-message status-" + type;
  els.status.style.opacity = "1";
  
  setTimeout(function() {
    els.status.style.opacity = "0";
  }, duration);
}

/**
 * ErrorHandler'dan gelen hata objesini kullanıcıya gösterir
 * @param {Object|Error} errorInfo - ErrorHandler'dan gelen hata bilgisi veya Error objesi
 */
function showError(errorInfo) {
  var message;
  
  if (errorInfo && errorInfo.message) {
    // ErrorHandler.handle() dönüşü veya Error objesi
    message = "❌ " + errorInfo.message;
  } else {
    // Bilinmeyen hata
    message = "❌ " + ErrorHandler.getUserMessage("UNKNOWN");
  }
  
  showStatus(message, 3000, "error");
}

// ============================================
// Storage Quota Kontrolü
// ============================================

/**
 * Kaydetmeden önce quota kontrolü yapar
 * @param {Object} newData - Kaydedilecek veri
 * @param {Function} onSuccess - Quota uygunsa çağrılır
 * @param {Function} [onFail] - Quota aşılırsa çağrılır
 */
function checkQuotaBeforeSave(newData, onSuccess, onFail) {
  Storage.checkQuota(newData, function(result) {
    if (result.canSave) {
      onSuccess();
    } else {
      showStatus("⚠️ Depolama limiti aşıldı. Lütfen bazı dersleri temizleyin.", 5000, "error");
      if (onFail) onFail(result);
    }
  });
}

// ============================================
// Input Validation
// ============================================

/**
 * Input değerini doğrular
 * @param {string} value - Doğrulanacak değer
 * @returns {{valid: boolean, error: string|null, warning: string|null}}
 */
function validateInput(value) {
  var result = {
    valid: true,
    error: null,
    warning: null
  };

  // Boş değer kontrolü (boş değer silme anlamına gelir, geçerli)
  if (!value || value.trim().length === 0) {
    return result;
  }

  var trimmedValue = value.trim();
  var maxLen = CONFIG.INPUT.MAX_COURSE_NAME_LENGTH;
  var minLen = CONFIG.INPUT.MIN_COURSE_NAME_LENGTH;
  var warnThreshold = Math.floor(maxLen * CONFIG.INPUT.WARNING_THRESHOLD / 100);

  // Minimum uzunluk kontrolü
  if (trimmedValue.length < minLen) {
    result.valid = false;
    result.error = "En az " + minLen + " karakter gerekli";
    return result;
  }

  // Maksimum uzunluk kontrolü
  if (trimmedValue.length > maxLen) {
    result.valid = false;
    result.error = "En fazla " + maxLen + " karakter olabilir";
    return result;
  }

  // Uyarı eşiği kontrolü
  if (trimmedValue.length >= warnThreshold) {
    result.warning = trimmedValue.length + "/" + maxLen + " karakter";
  }

  // Yasaklı karakter kontrolü
  var forbidden = CONFIG.INPUT.FORBIDDEN_CHARS;
  if (forbidden && forbidden.length > 0) {
    for (var i = 0; i < forbidden.length; i++) {
      if (trimmedValue.indexOf(forbidden[i]) !== -1) {
        result.valid = false;
        result.error = "'" + forbidden[i] + "' karakteri kullanılamaz";
        return result;
      }
    }
  }

  return result;
}

/**
 * Input elementine karakter sayacı ekler
 * @param {HTMLInputElement} input - Input elementi
 */
function addCharCounter(input) {
  // Mevcut sayaç varsa kullan
  var existingCounter = input.parentElement.querySelector(".char-counter");
  if (existingCounter) {
    updateCharCounter(input, existingCounter);
    return existingCounter;
  }

  // Yeni sayaç oluştur
  var counter = document.createElement("span");
  counter.className = "char-counter";
  input.parentElement.appendChild(counter);
  
  updateCharCounter(input, counter);
  return counter;
}

/**
 * Karakter sayacını günceller
 * @param {HTMLInputElement} input - Input elementi
 * @param {HTMLElement} counter - Sayaç elementi
 */
function updateCharCounter(input, counter) {
  var value = input.value;
  var len = value.length;
  var maxLen = CONFIG.INPUT.MAX_COURSE_NAME_LENGTH;
  var warnThreshold = Math.floor(maxLen * CONFIG.INPUT.WARNING_THRESHOLD / 100);

  counter.textContent = len + "/" + maxLen;
  
  // Renk durumu
  counter.classList.remove("warning", "error");
  if (len > maxLen) {
    counter.classList.add("error");
  } else if (len >= warnThreshold) {
    counter.classList.add("warning");
  }
}

/**
 * Input'a validation uygular ve hata gösterir
 * @param {HTMLInputElement} input - Input elementi
 * @returns {boolean} Geçerli mi?
 */
function validateAndShowError(input) {
  var validation = validateInput(input.value);
  var counter = input.parentElement.querySelector(".char-counter");
  
  // Error sınıfını kaldır/ekle
  input.classList.remove("input-error", "input-warning");
  
  if (!validation.valid) {
    input.classList.add("input-error");
    if (counter) counter.classList.add("error");
    return false;
  }
  
  if (validation.warning) {
    input.classList.add("input-warning");
    if (counter) counter.classList.add("warning");
  }
  
  return true;
}

// ============================================
// Ders Listesi Render
// ============================================

/**
 * Ders listesini render eder
 * @param {string[]} detectedCourses - Tespit edilen ders listesi
 * @param {Object} courseMap - Ders isim eşleştirmeleri
 */
function renderCourseList(detectedCourses, courseMap) {
  els.list.innerHTML = "";

  if (!detectedCourses || detectedCourses.length === 0) {
    els.list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <h3>Henüz ders bulunamadı</h3>
        <p>CATS portalına giriş yapıp sayfayı yenileyin</p>
      </div>
    `;
    return;
  }

  // DocumentFragment ile performans optimizasyonu
  // Tüm elementler önce fragment'e eklenir, sonra tek seferde DOM'a yazılır
  var fragment = document.createDocumentFragment();
  
  detectedCourses.forEach(function(course) {
    var courseRow = createCourseRow(course, courseMap[course] || "");
    fragment.appendChild(courseRow);
  });
  
  // Tek seferde DOM'a ekle (Reflow/Repaint optimizasyonu)
  els.list.appendChild(fragment);
}

/**
 * Tek bir ders satırı elementi oluşturur
 * @param {string} courseName - Ders adı
 * @param {string} customName - Özel isim (varsa)
 * @returns {HTMLElement} Ders satırı elementi
 */
function createCourseRow(courseName, customName) {
  const row = document.createElement("div");
  row.className = "course";

  // Header: Label + Actions
  const header = document.createElement("div");
  header.className = "course-header";

  const label = document.createElement("label");
  label.textContent = courseName;
  label.title = courseName;

  const actions = document.createElement("div");
  actions.className = "course-actions";

  // Emoji butonu
  const emojiBtn = document.createElement("button");
  emojiBtn.className = "icon-btn";
  emojiBtn.title = "Emoji ekle";
  emojiBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/>
    </svg>
    <svg class="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  `;
  emojiBtn.addEventListener("click", function() {
    openEmojiPicker(courseName);
  });

  // Input elementi
  const input = document.createElement("input");
  input.type = "text";
  input.value = customName;
  input.placeholder = "Özel isim girin...";
  input.dataset.course = courseName;
  input.maxLength = CONFIG.INPUT.MAX_COURSE_NAME_LENGTH;

  // Input wrapper (karakter sayacı için)
  const inputWrapper = document.createElement("div");
  inputWrapper.className = "input-wrapper";

  // Silme butonu (çöp kutusu ikonu)
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "icon-btn danger";
  deleteBtn.title = "Temizle";
  deleteBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  `;
  deleteBtn.addEventListener("click", function() {
    handleDeleteCourse(courseName);
  });

  // Input değişiklik takibi ve validation
  input.addEventListener("input", function() {
    input.dataset.modified = "true";
    // Değişiklik yapılınca kaydedilmiş stilini kaldır
    input.classList.remove("input-saved");
    updateCharCounter(input, input.parentElement.querySelector(".char-counter"));
    validateAndShowError(input);
  });

  // Focus olduğunda karakter sayacını göster
  input.addEventListener("focus", function() {
    var counter = input.parentElement.querySelector(".char-counter");
    if (counter) counter.classList.add("visible");
  });

  // Blur olduğunda karakter sayacını gizle (eğer boşsa)
  input.addEventListener("blur", function() {
    var counter = input.parentElement.querySelector(".char-counter");
    if (counter && input.value.length === 0) {
      counter.classList.remove("visible");
    }
  });

  // DOM yapısını oluştur
  actions.appendChild(emojiBtn);
  actions.appendChild(deleteBtn);
  header.appendChild(label);
  header.appendChild(actions);
  
  inputWrapper.appendChild(input);
  addCharCounter(input);
  
  row.appendChild(header);
  row.appendChild(inputWrapper);

  // Başlangıçta değer varsa sayacı göster ve kaydedilmiş stilini uygula
  if (customName && customName.length > 0) {
    var counter = inputWrapper.querySelector(".char-counter");
    if (counter) counter.classList.add("visible");
    // Kaydedilmiş değer varsa turuncu stil uygula
    input.classList.add("input-saved");
  }

  return row;
}

// ============================================
// Ders İşlemleri
// ============================================

/**
 * Tek bir dersin özel ismini siler
 * @param {string} courseName - Silinecek ders adı
 */
function handleDeleteCourse(courseName) {
  Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP, CONFIG.STORAGE_KEYS.DETECTED_COURSES], function(data) {
    var courseMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};
    var detectedCourses = data[CONFIG.STORAGE_KEYS.DETECTED_COURSES] || [];
    
    // Silinecek key'i bul
    // courseName bir key VEYA value olabilir (zaten rename edilmişse)
    var keyToDelete = null;
    
    if (courseMap[courseName] !== undefined) {
      // courseName doğrudan bir key
      keyToDelete = courseName;
    } else {
      // courseName bir value olabilir, orijinal key'i bul
      for (var key in courseMap) {
        if (courseMap.hasOwnProperty(key) && courseMap[key] === courseName) {
          keyToDelete = key;
          break;
        }
      }
    }
    
    if (keyToDelete) {
      delete courseMap[keyToDelete];
      
      Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: courseMap }, function() {
        Logger.log('USER', 'Tekli silme', { course: keyToDelete });
        renderCourseList(detectedCourses, courseMap);
        showStatus("✓ Temizlendi, sayfayı yenileyin", 3000);
      }, showError);
    } else {
      showStatus("Zaten temiz");
    }
  }, showError);
}

/**
 * Tüm değişiklikleri kaydeder
 */
function handleSaveAll() {
  const inputs = document.querySelectorAll('.course input[data-modified="true"]');
  let saveCount = 0;
  let errorCount = 0;
  
  // Önce tüm inputları validate et
  inputs.forEach(function(input) {
    if (!validateAndShowError(input)) {
      errorCount++;
    }
  });
  
  // Hata varsa kaydetme
  if (errorCount > 0) {
    showStatus("❌ " + errorCount + " hatalı giriş var", 3000, "error");
    return;
  }
  
  Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
    var courseMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};
    
    inputs.forEach(function(input) {
      var course = input.dataset.course;
      var value = input.value.trim();
      
      if (value) {
        courseMap[course] = value;
      } else {
        delete courseMap[course];
      }
      
      saveCount++;
    });
    
    if (saveCount > 0) {
      // Quota kontrolü yap
      checkQuotaBeforeSave({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: courseMap }, function() {
        // Quota uygun, kaydet
        Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: courseMap }, function() {
          // Modified flag'leri temizle ve kaydedilmiş stilini uygula
          inputs.forEach(function(input) {
            input.dataset.modified = "false";
            // Değer varsa kaydedilmiş stilini uygula
            if (input.value.trim()) {
              input.classList.add("input-saved");
            }
          });
          
          Logger.log('USER', 'Tümü kaydedildi', { count: saveCount });
          showStatus("✓ " + saveCount + " ders kaydedildi", 2000, "success");
        }, showError);
      });
    } else {
      showStatus("Değişiklik yok", 1500, "warning");
    }
  }, showError);
}

/**
 * Tüm özel isimleri siler
 */
function handleClearAll() {
  if (confirm("Tüm özel isimleri silmek istediğinizden emin misiniz?")) {
    // Önce mevcut durumu otomatik yedekle
    Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
      var currentMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

      function doClear() {
        Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: {} }, function() {
          Logger.log('USER', 'Tüm isimler temizlendi');
          loadAndRender();
          showStatus("Tümü temizlendi", 2000, "success");
          renderAutoBackup();
        }, showError);
      }

      if (Object.keys(currentMap).length > 0) {
        PresetStorage.saveAutoBackup(currentMap, function() {
          doClear();
        });
      } else {
        doClear();
      }
    }, showError);
  }
}

// ============================================
// Emoji Picker
// ============================================

/**
 * Emoji picker modalını açar
 * @param {string} course - Emoji eklenecek ders
 */
function openEmojiPicker(course) {
  editingCourse = course;
  els.modal.classList.add("active");
  renderEmojiGrid(currentCategory);
}

/**
 * Emoji picker modalını kapatır
 */
function closeEmojiPicker() {
  editingCourse = null;
  els.modal.classList.remove("active");
}

/**
 * Emoji grid'ini render eder
 * @param {string} category - Gösterilecek kategori
 */
function renderEmojiGrid(category) {
  currentCategory = category;
  els.emojiGrid.innerHTML = "";

  var emojis = EMOJI_DATA.getCategory(category);
  
  // DocumentFragment ile performans optimizasyonu
  var fragment = document.createDocumentFragment();
  
  emojis.forEach(function(emoji) {
    var emojiItem = document.createElement("span");
    emojiItem.className = "emoji-item";
    emojiItem.textContent = emoji;
    emojiItem.title = emoji;
    
    emojiItem.addEventListener("click", function() {
      handleEmojiSelect(emoji);
    });
    
    fragment.appendChild(emojiItem);
  });
  
  // Tek seferde DOM'a ekle
  els.emojiGrid.appendChild(fragment);
}

/**
 * Emoji seçildiğinde çağrılır
 * @param {string} emoji - Seçilen emoji
 */
function handleEmojiSelect(emoji) {
  const input = document.querySelector('input[data-course="' + editingCourse + '"]');
  if (input) {
    // Limit kontrolü
    var newValue = input.value + emoji;
    if (newValue.length > CONFIG.INPUT.MAX_COURSE_NAME_LENGTH) {
      showStatus("⚠️ Karakter limiti aşıldı", 2000, "warning");
      closeEmojiPicker();
      return;
    }
    
    input.value = newValue;
    input.dataset.modified = "true";
    
    // Sayacı güncelle
    var counter = input.parentElement.querySelector(".char-counter");
    if (counter) {
      updateCharCounter(input, counter);
      counter.classList.add("visible");
    }
    
    closeEmojiPicker();
  }
}

/**
 * Kategori butonlarını ayarlar
 */
function setupCategoryButtons() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  
  categoryButtons.forEach(function(btn) {
    btn.addEventListener("click", function() {
      // Aktif sınıfını güncelle
      categoryButtons.forEach(function(b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      
      // Grid'i güncelle
      const category = btn.dataset.category;
      renderEmojiGrid(category);
    });
  });
}

// ============================================
// About Modal
// ============================================

/**
 * Hakkında modalını açar
 */
function openAboutModal() {
  els.aboutModal.classList.add("active");
}

/**
 * Hakkında modalını kapatır
 */
function closeAboutModal() {
  els.aboutModal.classList.remove("active");
}

// ============================================
// Veri Yükleme
// ============================================

/**
 * Storage'dan verileri yükler ve UI'ı render eder
 */
function loadAndRender() {
  Storage.get([
    CONFIG.STORAGE_KEYS.DETECTED_COURSES,
    CONFIG.STORAGE_KEYS.COURSE_MAP,
    CONFIG.STORAGE_KEYS.EXTENSION_ENABLED
  ], function(data) {
    // Extension enabled state'i yükle (varsayılan: true)
    extensionEnabled = data[CONFIG.STORAGE_KEYS.EXTENSION_ENABLED] !== false;
    
    // Toggle'ı güncelle
    if (els.extensionToggle) {
      els.extensionToggle.checked = extensionEnabled;
    }
    
    // Toggle text'i güncelle
    var toggleText = document.getElementById("toggleText");
    if (toggleText) {
      toggleText.textContent = extensionEnabled ? "Açık" : "Kapalı";
    }
    
    // UI state'ini güncelle
    updateUIState();
    
    var courseMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

    // Ders listesini render et
    renderCourseList(
      data[CONFIG.STORAGE_KEYS.DETECTED_COURSES] || [],
      courseMap
    );

    // courseMap boşsa ve otomatik yedek varsa "Geri Yükle" butonunu göster
    checkMainRestoreButton(courseMap);
  }, showError);
}

/**
 * courseMap boşsa ve otomatik yedek varsa "Geri Yükle" butonunu göster
 * @param {Object} courseMap - Mevcut ders eşleştirmeleri
 */
function checkMainRestoreButton(courseMap) {
  var hasCustomNames = courseMap && Object.keys(courseMap).length > 0;

  if (hasCustomNames) {
    els.restoreBackupMain.style.display = "none";
    return;
  }

  // courseMap boş - yedek var mı kontrol et
  PresetStorage.getAutoBackup(function(backup) {
    if (backup && backup.courseMap && Object.keys(backup.courseMap).length > 0) {
      els.restoreBackupMain.style.display = "flex";
    } else {
      els.restoreBackupMain.style.display = "none";
    }
  });
}

/**
 * Ana ekrandaki "Geri Yükle" butonunun click handler'ı
 */
function handleMainRestore() {
  PresetStorage.getAutoBackup(function(backup) {
    if (!backup || !backup.courseMap) {
      showStatus("Yedek bulunamad\u0131", 2000, "error");
      return;
    }

    var count = Object.keys(backup.courseMap).length;
    var date = new Date(backup.savedAt);
    var dateStr = date.getDate() + "/" + (date.getMonth() + 1) + " " +
      String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");

    if (!confirm(count + " ders yedekten geri y\u00FCklensin mi?\n(Yedek tarihi: " + dateStr + ")")) return;

    Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: backup.courseMap }, function() {
      Logger.log("USER", "Ana ekrandan yedek geri y\u00FCklendi", { courses: count });
      showStatus("\u2713 " + count + " ders geri y\u00FCklendi", 2500);
      loadAndRender();
    }, showError);
  });
}

/**
 * Extension açık/kapalı durumuna göre UI'ı günceller
 */
function updateUIState() {
  if (extensionEnabled) {
    document.body.classList.remove("extension-disabled");
  } else {
    document.body.classList.add("extension-disabled");
  }
}

/**
 * Extension toggle değişikliğini işler
 * @param {boolean} enabled - Yeni durum
 */
function handleToggleChange(enabled) {
  extensionEnabled = enabled;
  
  // Toggle text'i güncelle
  var toggleText = document.getElementById("toggleText");
  if (toggleText) {
    toggleText.textContent = enabled ? "Açık" : "Kapalı";
  }
  
  // Storage'a kaydet
  Storage.set({ [CONFIG.STORAGE_KEYS.EXTENSION_ENABLED]: enabled }, function() {
    Logger.log('USER', 'Extension toggle değişti', { enabled: enabled });
    updateUIState();
    
    if (enabled) {
      showStatus("Uzantı etkinleştirildi", 1500, "success");
    } else {
      showStatus("Uzantı devre dışı", 1500, "warning");
    }
  }, showError);
}

// ============================================
// Event Listeners
// ============================================

/**
 * Tüm event listener'ları ayarlar
 */
function setupEventListeners() {
  // Extension toggle
  if (els.extensionToggle) {
    els.extensionToggle.addEventListener("change", function() {
      handleToggleChange(els.extensionToggle.checked);
    });
  }
  
  // Emoji picker kapat butonu
  els.closeEmoji.addEventListener("click", closeEmojiPicker);
  
  // Emoji modal backdrop tıklama
  var emojiBackdrop = els.modal.querySelector(".modal-backdrop");
  if (emojiBackdrop) {
    emojiBackdrop.addEventListener("click", closeEmojiPicker);
  }
  
  // About modal açma butonu
  els.aboutBtn.addEventListener("click", openAboutModal);
  
  // About modal kapat butonu
  els.closeAbout.addEventListener("click", closeAboutModal);
  
  // About modal backdrop tıklama
  var aboutBackdrop = els.aboutModal.querySelector(".modal-backdrop");
  if (aboutBackdrop) {
    aboutBackdrop.addEventListener("click", closeAboutModal);
  }
  
  // Kaydet butonu
  els.saveAll.addEventListener("click", handleSaveAll);

  // Geri Yükle butonu (ana ekran)
  els.restoreBackupMain.addEventListener("click", handleMainRestore);

  // Tümünü sil butonu
  els.clear.addEventListener("click", handleClearAll);
  
  // Kategori butonları
  setupCategoryButtons();
  
  // Escape tuşu ile modal kapatma
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      if (els.modal.classList.contains("active")) {
        closeEmojiPicker();
      }
      if (els.aboutModal.classList.contains("active")) {
        closeAboutModal();
      }
    }
  });
}

// ============================================
// Storage Değişiklik Dinleyicisi
// ============================================

Storage.onChanged(function(changes, areaName) {
  // detectedCourses değiştiğinde listeyi yenile
  if (changes.detectedCourses) {
    loadAndRender();
  }
});

// ============================================
// Tab Navigation
// ============================================

/**
 * Sekme değiştirir
 * @param {string} tabName - Sekme adı ("courses" veya "settings")
 */
function switchTab(tabName) {
  // Butonları güncelle
  els.tabBtns.forEach(function(btn) {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  // Panelleri güncelle
  els.tabCourses.classList.toggle("active", tabName === "courses");
  els.tabSettings.classList.toggle("active", tabName === "settings");

  // Ayarlar sekmesine geçildiğinde verileri güncelle
  if (tabName === "settings") {
    renderPresetSlots();
    renderAutoBackup();
    updateLoggerToggle();
    renderLogViewer();
    updateStorageInfo();
  }
}

// ============================================
// Settings Tab - Logger
// ============================================

/**
 * Logger toggle durumunu günceller
 */
function updateLoggerToggle() {
  els.loggerToggle.checked = Logger.isEnabled();
}

/**
 * Türkçe kategori etiketleri
 */
var CATEGORY_LABELS = {
  INIT: "Başlangıç",
  ST_R: "Okuma",
  ST_W: "Yazma",
  ST_D: "Silme",
  DOM_D: "Tespit",
  DOM_A: "Uygulama",
  ORPH: "Orphan",
  USER: "Kullanıcı",
  ERR: "Hata",
  WARN: "Uyarı"
};

/**
 * Log viewer'ı render eder (filtreleme ve tarih ayırıcıları destekler)
 */
function renderLogViewer() {
  var logs = Logger.getLogs();
  var stats = Logger.getStats();

  // İstatistikleri güncelle
  els.logCount.textContent = stats.total;
  els.logOldest.textContent = stats.oldest
    ? Logger.formatDate(new Date(stats.oldest).getTime()) + " " + Logger.formatTimestamp(new Date(stats.oldest).getTime())
    : "-";

  // Log yoksa boş mesaj göster
  if (logs.length === 0) {
    els.logViewer.innerHTML = '<div class="log-empty">' +
      (Logger.isEnabled() ? "Henüz log yok." : "Loglama kapalı.") +
      "</div>";
    return;
  }

  // Filtre uygula
  var filtered = logs;
  if (activeFilter !== "all") {
    filtered = logs.filter(function(log) {
      return log.c === activeFilter;
    });
  }

  if (filtered.length === 0) {
    els.logViewer.innerHTML = '<div class="log-empty">Bu kategoride log yok.</div>';
    return;
  }

  // En yeni en üstte, tarih ayırıcılarıyla render et
  var html = "";
  var lastDate = null;

  for (var i = filtered.length - 1; i >= 0; i--) {
    var log = filtered[i];
    var logDate = Logger.formatDate(log.t);

    // Tarih ayırıcı (çok günlü loglar için)
    if (logDate !== lastDate) {
      html += '<div class="log-date-separator">' + logDate + "</div>";
      lastDate = logDate;
    }

    html += renderLogEntry(log);
  }

  els.logViewer.innerHTML = html;
}

/**
 * Tek bir log entry'sini render eder
 * @param {Object} log - Log objesi
 * @returns {string} HTML string
 */
function renderLogEntry(log) {
  var time = Logger.formatTimestamp(log.t);
  var catLabel = CATEGORY_LABELS[log.c] || log.c;
  var message = log.m;
  var data = log.d;

  var html = '<div class="log-entry">';
  html += '<span class="log-time">' + time + "</span>";
  html += '<span class="log-category log-cat-' + log.c + '">' + escapeHtml(catLabel) + "</span>";
  html += '<span class="log-message">' + escapeHtml(message) + "</span>";

  if (data) {
    html += '<div class="log-data">' + formatLogData(data) + "</div>";
  }

  html += "</div>";
  return html;
}

/**
 * Log verisini okunabilir formata çevirir
 * @param {*} data - Log verisi
 * @returns {string} Formatlanmış HTML string
 */
function formatLogData(data) {
  if (typeof data !== "object" || data === null) {
    return escapeHtml(String(data));
  }

  // Kısaltılmış veri göstergesi
  if (data._truncated) {
    return "<em>Veri kısıldı (" + data._size + " byte)</em>";
  }

  var parts = [];
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      var val = data[key];
      var displayVal;

      if (Array.isArray(val)) {
        if (val.length === 0) {
          displayVal = "[]";
        } else {
          displayVal = "[" + val.length + " öğe] " + val.join(", ");
        }
      } else if (typeof val === "object" && val !== null) {
        displayVal = JSON.stringify(val);
      } else if (typeof val === "boolean") {
        displayVal = val ? "evet" : "hayır";
      } else {
        displayVal = String(val);
      }

      parts.push('<span class="log-data-key">' + escapeHtml(key) + ":</span> " + escapeHtml(displayVal));
    }
  }

  return parts.join("<br>");
}

/**
 * HTML karakterlerini escape eder
 * @param {string} str - Escape edilecek string
 * @returns {string} Escape edilmiş string
 */
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Logger toggle değişikliğini işler
 */
function handleLoggerToggle() {
  if (els.loggerToggle.checked) {
    Logger.enable(function(success) {
      if (success) {
        showStatus("✓ Loglama açıldı", 2000);
        renderLogViewer();
      } else {
        els.loggerToggle.checked = false;
        showStatus("❌ Loglama açılamadı", 2000, "error");
      }
    });
  } else {
    Logger.disable(function(success) {
      showStatus("✓ Loglama kapatıldı", 2000);
      renderLogViewer();
    });
  }
}

/**
 * Logları JSON olarak indirir
 */
function handleExportLogs() {
  var exportData = Logger.exportLogs();
  
  if (exportData.entries.length === 0) {
    showStatus("İndirilecek log yok", 2000, "warning");
    return;
  }
  
  var dataStr = JSON.stringify(exportData, null, 2);
  var blob = new Blob([dataStr], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  
  var date = new Date().toISOString().split('T')[0];
  var filename = 'calico-logs-' + date + '.json';
  
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
  showStatus("✓ Loglar indirildi", 2000);
  
  Logger.log('USER', 'Loglar export edildi', { count: exportData.entries.length });
}

/**
 * Logları temizler
 */
function handleClearLogs() {
  Logger.clearLogs(function(success) {
    if (success) {
      showStatus("✓ Loglar temizlendi", 2000);
      renderLogViewer();
    } else {
      showStatus("❌ Loglar temizlenemedi", 2000, "error");
    }
  });
}

/**
 * Storage kullanım bilgisini günceller
 */
function updateStorageInfo() {
  Storage.getUsage(function(usage) {
    els.storageUsed.textContent = Storage.formatBytes(usage.used);
    els.storageTotal.textContent = Storage.formatBytes(usage.total);
    els.storagePercent.textContent = usage.percentage;
    els.storageBarFill.style.width = usage.percentage + '%';
  });
}

// ============================================
// Preset Slotlar
// ============================================

/**
 * Preset slotlarını render eder
 */
function renderPresetSlots() {
  PresetStorage.getAll(function(presets) {
    els.presetSlots.innerHTML = "";
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < CONFIG.PRESET.MAX_SLOTS; i++) {
      var preset = presets[i];
      var slot = createPresetSlotElement(i, preset);
      fragment.appendChild(slot);
    }

    els.presetSlots.appendChild(fragment);
  });
}

/**
 * Tek bir preset slot elementi oluşturur
 * @param {number} index - Slot indeksi
 * @param {Object|null} preset - Preset verisi
 * @returns {HTMLElement}
 */
function createPresetSlotElement(index, preset) {
  var slot = document.createElement("div");
  slot.className = "preset-slot";

  // Numara badge
  var badge = document.createElement("span");
  badge.className = "preset-slot-number " + (preset ? "filled" : "empty");
  badge.textContent = index + 1;

  // Info alanı
  var info = document.createElement("div");
  info.className = "preset-slot-info";

  if (preset) {
    var name = document.createElement("span");
    name.className = "preset-slot-name";
    name.textContent = preset.name;
    name.title = preset.name;

    var meta = document.createElement("span");
    meta.className = "preset-slot-meta";
    var courseCount = preset.courseMap ? Object.keys(preset.courseMap).length : 0;
    var date = new Date(preset.createdAt);
    meta.textContent = courseCount + " ders \u00B7 " + formatShortDate(date);

    info.appendChild(name);
    info.appendChild(meta);
  } else {
    var empty = document.createElement("span");
    empty.className = "preset-slot-empty";
    empty.textContent = "Bo\u015F slot";
    info.appendChild(empty);
  }

  // Aksiyon butonları
  var actions = document.createElement("div");
  actions.className = "preset-slot-actions";

  // Kaydet butonu (her zaman görünür)
  var saveBtn = document.createElement("button");
  saveBtn.className = "icon-btn";
  saveBtn.title = "Mevcut dersleri kaydet";
  saveBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  saveBtn.addEventListener("click", function() {
    handlePresetSave(index);
  });
  actions.appendChild(saveBtn);

  if (preset) {
    // Yükle butonu
    var loadBtn = document.createElement("button");
    loadBtn.className = "icon-btn";
    loadBtn.title = "Bu preset\u2019i y\u00FCkle";
    loadBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    loadBtn.addEventListener("click", function() {
      handlePresetLoad(index);
    });
    actions.appendChild(loadBtn);

    // Sil butonu
    var clearBtn = document.createElement("button");
    clearBtn.className = "icon-btn danger";
    clearBtn.title = "Slot\u2019u temizle";
    clearBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
    clearBtn.addEventListener("click", function() {
      handlePresetClear(index);
    });
    actions.appendChild(clearBtn);
  }

  slot.appendChild(badge);
  slot.appendChild(info);
  slot.appendChild(actions);
  return slot;
}

/**
 * Kısa tarih formatı
 * @param {Date} date
 * @returns {string}
 */
function formatShortDate(date) {
  var d = date.getDate();
  var m = date.getMonth() + 1;
  var h = String(date.getHours()).padStart(2, "0");
  var min = String(date.getMinutes()).padStart(2, "0");
  return d + "/" + m + " " + h + ":" + min;
}

/**
 * Preset kaydetme - inline isim girişi gösterir
 * @param {number} index - Slot indeksi
 */
function handlePresetSave(index) {
  Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
    var courseMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

    if (Object.keys(courseMap).length === 0) {
      showStatus("\u26A0\uFE0F Kaydedilecek ders yok", 2000, "warning");
      return;
    }

    // Slot satırını bul ve inline input göster
    var slotEl = els.presetSlots.children[index];
    if (!slotEl) return;

    var info = slotEl.querySelector(".preset-slot-info");
    var oldHTML = info.innerHTML;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "preset-name-input";
    input.placeholder = CONFIG.PRESET.DEFAULT_NAMES[index];
    input.maxLength = CONFIG.PRESET.MAX_NAME_LENGTH;
    input.value = "";

    info.innerHTML = "";
    info.appendChild(input);
    input.focus();

    function doSave() {
      var name = input.value.trim() || CONFIG.PRESET.DEFAULT_NAMES[index];
      PresetStorage.saveToSlot(index, name, courseMap, function(success) {
        if (success) {
          Logger.log("USER", "Preset kaydedildi", { slot: index + 1, name: name, courses: Object.keys(courseMap).length });
          showStatus("\u2713 Slot " + (index + 1) + " kaydedildi", 2000);
          renderPresetSlots();
        } else {
          info.innerHTML = oldHTML;
          showStatus("\u274C Kaydetme ba\u015Far\u0131s\u0131z", 2000, "error");
        }
      });
    }

    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") doSave();
      if (e.key === "Escape") {
        info.innerHTML = oldHTML;
      }
    });

    input.addEventListener("blur", function() {
      // Kısa gecikme: eğer Enter ile save olursa blur'dan önce save çalışsın
      setTimeout(function() {
        if (info.contains(input)) {
          doSave();
        }
      }, 100);
    });
  }, showError);
}

/**
 * Preset yükleme
 * @param {number} index - Slot indeksi
 */
function handlePresetLoad(index) {
  if (!confirm("Bu preset\u2019i y\u00FCklemek istedi\u011Finizden emin misiniz?\nMevcut ders adlar\u0131n\u0131z\u0131n yerine ge\u00E7ecektir.")) {
    return;
  }

  PresetStorage.loadFromSlot(index, function(preset) {
    if (!preset || !preset.courseMap) {
      showStatus("\u274C Slot bo\u015F", 2000, "error");
      return;
    }

    // Önce mevcut durumu otomatik yedekle
    Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
      var currentMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

      function applyPreset() {
        Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: preset.courseMap }, function() {
          Logger.log("USER", "Preset y\u00FCklendi", { slot: index + 1, name: preset.name, courses: Object.keys(preset.courseMap).length });
          showStatus("\u2713 \"" + preset.name + "\" y\u00FCklendi", 2500);
          loadAndRender();
          renderAutoBackup();
        }, showError);
      }

      if (Object.keys(currentMap).length > 0) {
        PresetStorage.saveAutoBackup(currentMap, function() {
          applyPreset();
        });
      } else {
        applyPreset();
      }
    }, showError);
  });
}

/**
 * Preset slot temizleme
 * @param {number} index - Slot indeksi
 */
function handlePresetClear(index) {
  if (!confirm("Slot " + (index + 1) + " temizlensin mi?")) return;

  PresetStorage.clearSlot(index, function(success) {
    if (success) {
      Logger.log("USER", "Preset silindi", { slot: index + 1 });
      showStatus("\u2713 Slot " + (index + 1) + " temizlendi", 2000);
      renderPresetSlots();
    } else {
      showStatus("\u274C Temizleme ba\u015Far\u0131s\u0131z", 2000, "error");
    }
  });
}

// ============================================
// Otomatik Yedek
// ============================================

/**
 * Otomatik yedek barını render eder
 */
function renderAutoBackup() {
  PresetStorage.getAutoBackup(function(backup) {
    if (!backup || !backup.courseMap || Object.keys(backup.courseMap).length === 0) {
      els.presetBackup.style.display = "none";
      return;
    }

    var courseCount = Object.keys(backup.courseMap).length;
    var date = new Date(backup.savedAt);

    els.presetBackup.style.display = "flex";
    els.presetBackup.innerHTML =
      '<div class="backup-bar-icon"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div>' +
      '<div class="backup-bar-info">' +
        '<div class="backup-bar-title">Otomatik Yedek</div>' +
        '<div class="backup-bar-meta">' + courseCount + " ders \u00B7 " + formatShortDate(date) + "</div>" +
      "</div>" +
      '<div class="backup-bar-action">' +
        '<button id="restoreBackupBtn" class="btn-secondary btn-small">Geri Y\u00FCkle</button>' +
      "</div>";

    document.getElementById("restoreBackupBtn").addEventListener("click", function() {
      handleRestoreBackup(backup);
    });
  });
}

/**
 * Otomatik yedekten geri yükleme
 * @param {Object} backup - Yedek verisi
 */
function handleRestoreBackup(backup) {
  if (!confirm("Otomatik yedekten geri y\u00FCklemek istedi\u011Finizden emin misiniz?")) return;

  Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: backup.courseMap }, function() {
    Logger.log("USER", "Otomatik yedekten geri y\u00FCklendi", { courses: Object.keys(backup.courseMap).length });
    showStatus("\u2713 Yedekten geri y\u00FCklendi", 2500);
    loadAndRender();
  }, showError);
}

// ============================================
// .calico Export / Import
// ============================================

/**
 * .calico dosyası olarak export eder
 */
function handleExportCalico() {
  Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
    var courseMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

    if (Object.keys(courseMap).length === 0) {
      showStatus("\u26A0\uFE0F D\u0131\u015Fa aktar\u0131lacak ders yok", 2000, "warning");
      return;
    }

    var exportData = {
      calico: CONFIG.FILE.VERSION,
      type: CONFIG.FILE.TYPE_PRESET,
      exportedAt: new Date().toISOString(),
      courseMap: courseMap
    };

    var dataStr = JSON.stringify(exportData, null, 2);
    var blob = new Blob([dataStr], { type: "application/json" });
    var url = URL.createObjectURL(blob);

    var date = new Date().toISOString().split("T")[0];
    var filename = "calico-courses-" + date + CONFIG.FILE.EXTENSION;

    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    Logger.log("USER", ".calico export", { courses: Object.keys(courseMap).length });
    showStatus("\u2713 Dosya indirildi", 2000);
  }, showError);
}

/**
 * .calico dosyasını validate eder
 * @param {Object} data - Parse edilmiş JSON
 * @returns {{valid: boolean, error: string|null, courseMap: Object|null, warnings: string[]}}
 */
function validateCalicoFile(data) {
  var result = { valid: false, error: null, courseMap: null, warnings: [] };

  // Temel yapı kontrolü
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

  // Ders adı uzunluk kontrolü (truncate + uyarı)
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

/**
 * .calico dosyasını işler (File objesi alır)
 * @param {File} file - İşlenecek dosya
 */
function processImportFile(file) {
  if (!file) return;

  // Boyut kontrolü
  if (file.size > CONFIG.FILE.MAX_IMPORT_SIZE) {
    setImportStatus("Dosya \u00E7ok b\u00FCy\u00FCk (maks. " + (CONFIG.FILE.MAX_IMPORT_SIZE / 1024) + " KB)", "err");
    return;
  }

  // Uzantı kontrolü
  if (!file.name.endsWith(CONFIG.FILE.EXTENSION)) {
    setImportStatus("Ge\u00E7ersiz dosya uzant\u0131s\u0131 (.calico bekleniyor)", "err");
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      setImportStatus("Ge\u00E7ersiz dosya format\u0131", "err");
      return;
    }

    var validation = validateCalicoFile(parsed);
    if (!validation.valid) {
      setImportStatus(validation.error, "err");
      return;
    }

    // Mevcut durumu otomatik yedekle ve import et
    Storage.get([CONFIG.STORAGE_KEYS.COURSE_MAP], function(data) {
      var currentMap = data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {};

      function applyImport() {
        Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: validation.courseMap }, function() {
          var count = Object.keys(validation.courseMap).length;
          Logger.log("USER", ".calico import", { courses: count, file: file.name });

          var msg = "\u2713 " + count + " ders y\u00FCklendi";
          if (validation.warnings.length > 0) {
            msg += " (" + validation.warnings.join(", ") + ")";
          }
          setImportStatus(msg, "ok");
          showStatus("\u2713 Import ba\u015Far\u0131l\u0131", 2500);
          loadAndRender();
          renderAutoBackup();
        }, showError);
      }

      if (Object.keys(currentMap).length > 0) {
        PresetStorage.saveAutoBackup(currentMap, function() {
          applyImport();
        });
      } else {
        applyImport();
      }
    }, showError);
  };

  reader.onerror = function() {
    setImportStatus("Dosya okunamad\u0131", "err");
  };

  reader.readAsText(file);
}

/**
 * File input change handler
 */
function handleImportFileInput(event) {
  var file = event.target.files[0];
  event.target.value = "";
  if (file) processImportFile(file);
}

/**
 * Import butonuna tıklama handler'ı
 * Firefox'ta popup içinde file picker açılınca popup kapanır.
 * Bu yüzden Firefox'ta ayrı bir pencere (windows.create) açılır.
 * Chrome'da doğrudan file picker kullanılır.
 */
function handleImportClick() {
  if (browserAPI.isFirefox) {
    // Firefox: bağımsız import penceresi aç
    var importUrl = browserAPI.runtime.getURL("import.html");
    browserAPI._raw.windows.create({
      url: importUrl,
      type: "popup",
      width: 380,
      height: 400
    });
  } else {
    // Chrome: doğrudan file picker aç
    els.importCalicoInput.click();
  }
}

/**
 * Import durum mesajını gösterir
 * @param {string} msg - Mesaj
 * @param {string} type - "ok" veya "err"
 */
function setImportStatus(msg, type) {
  els.importStatus.textContent = msg;
  els.importStatus.className = "import-status status-" + type;

  // 5 saniye sonra temizle
  setTimeout(function() {
    els.importStatus.textContent = "";
    els.importStatus.className = "import-status";
  }, 5000);
}

/**
 * Settings tab event listener'larını kurar
 */
function setupSettingsListeners() {
  // Tab navigasyonu
  els.tabBtns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      switchTab(btn.dataset.tab);
    });
  });

  // Logger toggle
  els.loggerToggle.addEventListener("change", handleLoggerToggle);

  // Export/Clear
  els.exportLogs.addEventListener("click", handleExportLogs);
  els.clearLogs.addEventListener("click", handleClearLogs);

  // Log filtre butonları
  els.logFilterBtns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      els.logFilterBtns.forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderLogViewer();
    });
  });

  // .calico Export
  els.exportCalico.addEventListener("click", handleExportCalico);

  // .calico Import
  els.importCalicoBtn.addEventListener("click", handleImportClick);
  els.importCalicoInput.addEventListener("change", handleImportFileInput);
}

// ============================================
// Initialization
// ============================================

/**
 * Options sayfası başlatma fonksiyonu.
 * Migration kontrolü yapar, sonra UI'ı yükler.
 */
function initializeOptions() {
  // Logger'ı başlat
  Logger.init(function() {
    // Önce migration kontrolü
    Storage.migrate(function() {
      // UI'ı yükle
      loadAndRender();
      setupEventListeners();
      setupSettingsListeners();
    });
  });
}

document.addEventListener("DOMContentLoaded", initializeOptions);