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
  extensionToggle: document.getElementById("extensionToggle")
};

// ============================================
// State
// ============================================

let editingCourse = null;
let currentCategory = EMOJI_DATA.DEFAULT_CATEGORY;
let extensionEnabled = true;

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
    Storage.set({ [CONFIG.STORAGE_KEYS.COURSE_MAP]: {} }, function() {
      loadAndRender();
      showStatus("Tümü temizlendi", 2000, "success");
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
    
    // Ders listesini render et
    renderCourseList(
      data[CONFIG.STORAGE_KEYS.DETECTED_COURSES] || [],
      data[CONFIG.STORAGE_KEYS.COURSE_MAP] || {}
    );
  }, showError);
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
// Initialization
// ============================================

/**
 * Options sayfası başlatma fonksiyonu.
 * Migration kontrolü yapar, sonra UI'ı yükler.
 */
function initializeOptions() {
  // Önce migration kontrolü
  Storage.migrate(function() {
    // UI'ı yükle
    loadAndRender();
    setupEventListeners();
  });
}

document.addEventListener("DOMContentLoaded", initializeOptions);