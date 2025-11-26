
document.addEventListener('DOMContentLoaded', async () => {
  const translateBtn = document.getElementById('translateBtn');
  const subtitlesList = document.getElementById('subtitlesList');

  // Cargar subtítulos disponibles al abrir el popup
  await loadAvailableSubtitles();

  // Inicializar controles TTS
  await initializeTTSControlsPopup();

  // Inicializar controles de personalización de subtítulos
  await initializeSubtitleCustomization();

  translateBtn.addEventListener('click', async () => {
    try {
      const langSelect = document.getElementById('lang');
      const lang = langSelect.value;
      const selectedOption = langSelect.options[langSelect.selectedIndex];
      const isNative = selectedOption.dataset.native === 'true';

      if (!lang) {
        alert('Por favor selecciona un idioma primero');
        return;
      }

      // Guardar idioma seleccionado
      await chrome.storage.sync.set({ lang });
      console.log('Idioma establecido:', lang, 'Nativo:', isNative);

      // Obtener tab actual
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Asegurar que content script está inyectado
      try {
        // Intentar enviar mensaje primero
        const response = await chrome.tabs.sendMessage(tab.id, {
          method: 'translate',
          lang: lang,
          useNative: isNative  // Indicar si debe usar subtítulos nativos
        });

        if (response?.method === 'translate') {
          console.log('Solicitud de traducción exitosa');
        }
      } catch (err) {
        // Si no hay content script, inyectarlo
        if (err.message.includes('Receiving end does not exist')) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Intentar enviar mensaje nuevamente
          const response = await chrome.tabs.sendMessage(tab.id, {
            method: 'translate',
            lang: lang,
            useNative: isNative
          });
          if (response?.method === 'translate') {
            console.log('Solicitud de traducción exitosa después de la inyección');
          }
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error durante la traducción:', error);
    }
  });


  // Función para cargar y mostrar los subtítulos disponibles
  async function loadAvailableSubtitles() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Verificar si estamos en una página compatible
      if (!tab.url.includes('coursera.org') && !tab.url.includes('learn.deeplearning.ai')) {
        subtitlesList.innerHTML = '<div class="loading-message">Navega a Coursera o DeepLearning.ai</div>';
        populateLanguageSelector([]);
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          method: 'getAvailableSubtitles'
        });

        if (response?.subtitles && response.subtitles.length > 0) {
          displaySubtitles(response.subtitles);
          populateLanguageSelector(response.subtitles);
        } else {
          subtitlesList.innerHTML = '<div class="no-subtitles-message">No se encontraron subtítulos. Abre un video primero.</div>';
          populateLanguageSelector([]);
        }
      } catch (err) {
        if (err.message.includes('Receiving end does not exist')) {
          // Inyectar content script si no está cargado
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Reintentar
          setTimeout(loadAvailableSubtitles, 500);
        } else {
          console.error('Error al cargar subtítulos:', err);
          subtitlesList.innerHTML = '<div class="no-subtitles-message">Error al cargar subtítulos</div>';
          populateLanguageSelector([]);
        }
      }
    } catch (error) {
      console.error('Error en loadAvailableSubtitles:', error);
      subtitlesList.innerHTML = '<div class="loading-message">Abre un video para ver subtítulos...</div>';
      populateLanguageSelector([]);
    }
  }

  // Función para mostrar los subtítulos en el panel
  function displaySubtitles(subtitles) {
    subtitlesList.innerHTML = '';

    subtitles.forEach(subtitle => {
      const item = document.createElement('div');
      item.className = 'subtitle-item';
      item.innerHTML = `
        <span class="language-code">${subtitle.language}</span>
        <span class="language-label">${subtitle.label}</span>
      `;
      subtitlesList.appendChild(item);
    });
  }

  // Función para poblar el selector de idiomas
  async function populateLanguageSelector(availableSubtitles) {
    const langSelect = document.getElementById('lang');
    langSelect.innerHTML = '';

    // Idiomas adicionales para traducción (alternativa)
    const additionalLanguages = [
      { code: 'vi', name: 'Vietnamita' },
      { code: 'es', name: 'Español' },
      { code: 'zh', name: 'Chino' },
      { code: 'ko', name: 'Coreano' },
      { code: 'ja', name: 'Japonés' },
      { code: 'pt', name: 'Portugués' },
      { code: 'fr', name: 'Francés' },
      { code: 'de', name: 'Alemán' }
    ];

    if (availableSubtitles.length === 0) {
      langSelect.innerHTML = '<option value="">No hay video cargado</option>';
      return;
    }

    // Primero agregar los idiomas disponibles nativamente
    availableSubtitles.forEach(subtitle => {
      const option = document.createElement('option');
      option.value = subtitle.language;
      option.textContent = `${subtitle.label} ✓ (Nativo)`;
      option.dataset.native = 'true';
      langSelect.appendChild(option);
    });

    // Agregar separador si hay idiomas nativos
    if (availableSubtitles.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.textContent = '──── Traducir a ────';
      langSelect.appendChild(separator);
    }

    // Agregar idiomas adicionales (solo si no están ya disponibles)
    const nativeCodes = availableSubtitles.map(s => s.language);
    additionalLanguages.forEach(lang => {
      if (!nativeCodes.includes(lang.code)) {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = `${lang.name} (Auto-traducir)`;
        option.dataset.native = 'false';
        langSelect.appendChild(option);
      }
    });

    // Restaurar idioma guardado previamente
    const result = await chrome.storage.sync.get(['lang']);
    if (result.lang) {
      // Verificar que el idioma guardado existe en las opciones
      const optionExists = Array.from(langSelect.options).some(opt => opt.value === result.lang);
      if (optionExists) {
        langSelect.value = result.lang;
      }
    }
  }

  // ============ TOGGLE MOSTRAR/OCULTAR SUBTÍTULOS ============
  const showSubtitlesToggle = document.getElementById('show-subtitles-toggle');
  if (showSubtitlesToggle) {
    // Cargar estado guardado
    chrome.storage.local.get(['showSubtitles'], (result) => {
      const showSubtitles = result.showSubtitles !== undefined ? result.showSubtitles : true;
      showSubtitlesToggle.checked = showSubtitles;
    });

    showSubtitlesToggle.addEventListener('change', async (e) => {
      const showSubtitles = e.target.checked;
      chrome.storage.local.set({ showSubtitles: showSubtitles });

      // Enviar mensaje a content script
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
          method: 'toggleSubtitles',
          show: showSubtitles
        });
      } catch (err) {
        console.log('No se pudo enviar mensaje a content script:', err);
      }
    });
  }

  // ============ CONTROLES TTS EN POPUP ============
  async function initializeTTSControlsPopup() {
    // Cargar configuración guardada
    chrome.storage.local.get(['ttsEnabled', 'ttsRate', 'ttsVolume', 'ttsVoiceName'], (result) => {
      const ttsEnabled = result.ttsEnabled || false;
      const ttsRate = result.ttsRate || 1.0;
      const ttsVolume = result.ttsVolume !== undefined ? result.ttsVolume : 1.0;

      // Actualizar UI
      updateTTSUI(ttsEnabled, ttsRate, ttsVolume);
      toggleTTSControls(ttsEnabled);

      // Cargar voces
      loadVoices(result.ttsVoiceName);
    });

    // Toggle ON/OFF
    const toggleBtn = document.getElementById('tts-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const currentState = toggleBtn.textContent === 'ON';
        const newState = !currentState;

        chrome.storage.local.set({ ttsEnabled: newState });
        updateTTSUI(newState, null, null);
        toggleTTSControls(newState);

        // Enviar mensaje a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateTTSConfig',
            config: { enabled: newState }
          });
        } catch (err) {
          console.log('No se pudo enviar mensaje a content script:', err);
        }
      });
    }

    // Selector de voz
    const voiceSelect = document.getElementById('tts-voice-select');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', async (e) => {
        const voiceName = e.target.value;
        chrome.storage.local.set({ ttsVoiceName: voiceName });

        // Enviar mensaje a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateTTSConfig',
            config: { voiceName: voiceName }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }

    // Botones de velocidad
    const speedBtns = document.querySelectorAll('.speed-btn');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const rate = parseFloat(btn.dataset.rate);
        chrome.storage.local.set({ ttsRate: rate });

        updateTTSUI(null, rate, null);

        // Actualizar estilos
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Enviar mensaje a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateTTSConfig',
            config: { rate: rate }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    });

    // Slider de volumen
    const volumeSlider = document.getElementById('tts-volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', async (e) => {
        const volume = e.target.value / 100;
        document.getElementById('tts-volume-value').textContent = e.target.value + '%';
        chrome.storage.local.set({ ttsVolume: volume });

        // Enviar mensaje a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateTTSConfig',
            config: { volume: volume }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }
  }

  function toggleTTSControls(enabled) {
    const ttsControls = document.getElementById('tts-controls');
    const ttsSection = document.getElementById('tts-section');

    if (ttsControls) {
      if (enabled) {
        ttsControls.classList.remove('hidden');
        ttsSection.classList.remove('disabled');
      } else {
        ttsControls.classList.add('hidden');
        ttsSection.classList.add('disabled');
      }
    }
  }

  function updateTTSUI(enabled, rate, volume) {
    const toggleBtn = document.getElementById('tts-toggle');
    if (enabled !== null && toggleBtn) {
      toggleBtn.textContent = enabled ? 'ON' : 'OFF';
      toggleBtn.classList.remove('off', 'on');
      toggleBtn.classList.add(enabled ? 'on' : 'off');
    }

    if (rate !== null) {
      const rateValue = document.getElementById('tts-rate-value');
      if (rateValue) {
        rateValue.textContent = rate + 'x';
      }
      // Actualizar botón de velocidad activo
      const speedBtns = document.querySelectorAll('.speed-btn');
      speedBtns.forEach(btn => {
        if (parseFloat(btn.dataset.rate) === rate) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (volume !== null) {
      const volumeSlider = document.getElementById('tts-volume-slider');
      const volumeValue = document.getElementById('tts-volume-value');
      if (volumeSlider) {
        volumeSlider.value = volume * 100;
      }
      if (volumeValue) {
        volumeValue.textContent = Math.round(volume * 100) + '%';
      }
    }
  }

  function loadVoices(savedVoiceName) {
    const select = document.getElementById('tts-voice-select');
    if (!select) return;

    // Esperar a que las voces estén disponibles
    const populateVoices = () => {
      const voices = speechSynthesis.getVoices();

      // Obtener idioma seleccionado
      const langSelect = document.getElementById('lang');
      const currentLang = langSelect?.value || 'es';

      // Filtrar voces por idioma
      let filteredVoices = voices.filter(v => {
        if (currentLang === 'es') {
          return v.lang.startsWith("es");
        }
        return v.lang.startsWith(currentLang) || v.lang.split('-')[0] === currentLang;
      });

      if (filteredVoices.length === 0) {
        filteredVoices = voices; // Mostrar todas si no hay del idioma
      }

      select.innerHTML = '';

      if (filteredVoices.length === 0) {
        select.innerHTML = '<option value="">No voices available</option>';
        return;
      }

      filteredVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(option);
      });

      // Restaurar voz guardada
      if (savedVoiceName) {
        select.value = savedVoiceName;
      }
    };

    // Cargar voces
    if (speechSynthesis.getVoices().length > 0) {
      populateVoices();
    } else {
      speechSynthesis.onvoiceschanged = populateVoices;
    }

    // Actualizar voces cuando cambie el idioma
    const langSelect = document.getElementById('lang');
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        setTimeout(populateVoices, 100);
      });
    }
  }

  // ============ SUBTITLE CUSTOMIZATION ============
  async function initializeSubtitleCustomization() {
    // Cargar configuración guardada
    chrome.storage.local.get([
      'subtitleFontSize',
      'subtitleBgColor',
      'subtitleTextColor',
      'subtitleBgOpacity'
    ], (result) => {
      const fontSize = result.subtitleFontSize || 22;
      const bgColor = result.subtitleBgColor || '#000000';
      const textColor = result.subtitleTextColor || '#FFFFFF';
      const bgOpacity = result.subtitleBgOpacity !== undefined ? result.subtitleBgOpacity : 70;

      // Actualizar UI
      updateSubtitleCustomizationUI(fontSize, bgColor, textColor, bgOpacity);
    });

    // Font size slider
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', async (e) => {
        const size = parseInt(e.target.value);
        fontSizeValue.textContent = size + 'px';
        chrome.storage.local.set({ subtitleFontSize: size });

        // Enviar a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateSubtitleStyle',
            style: { fontSize: size }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }

    // Background color picker
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgColorValue = document.getElementById('bg-color-value');
    if (bgColorPicker) {
      bgColorPicker.addEventListener('input', async (e) => {
        const color = e.target.value;
        bgColorValue.textContent = color;
        chrome.storage.local.set({ subtitleBgColor: color });

        // Enviar a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateSubtitleStyle',
            style: { bgColor: color }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }

    // Text color picker
    const textColorPicker = document.getElementById('text-color-picker');
    const textColorValue = document.getElementById('text-color-value');
    if (textColorPicker) {
      textColorPicker.addEventListener('input', async (e) => {
        const color = e.target.value;
        textColorValue.textContent = color;
        chrome.storage.local.set({ subtitleTextColor: color });

        // Enviar a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateSubtitleStyle',
            style: { textColor: color }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }

    // Background opacity slider
    const bgOpacitySlider = document.getElementById('bg-opacity-slider');
    const bgOpacityValue = document.getElementById('bg-opacity-value');
    if (bgOpacitySlider) {
      bgOpacitySlider.addEventListener('input', async (e) => {
        const opacity = parseInt(e.target.value);
        bgOpacityValue.textContent = opacity + '%';
        chrome.storage.local.set({ subtitleBgOpacity: opacity });

        // Enviar a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateSubtitleStyle',
            style: { bgOpacity: opacity }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }

    // Reset button
    const resetBtn = document.getElementById('reset-subtitle-style');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const defaults = {
          subtitleFontSize: 22,
          subtitleBgColor: '#000000',
          subtitleTextColor: '#FFFFFF',
          subtitleBgOpacity: 70
        };

        chrome.storage.local.set(defaults);
        updateSubtitleCustomizationUI(22, '#000000', '#FFFFFF', 70);

        // Enviar a content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.sendMessage(tab.id, {
            method: 'updateSubtitleStyle',
            style: {
              fontSize: 22,
              bgColor: '#000000',
              textColor: '#FFFFFF',
              bgOpacity: 70
            }
          });
        } catch (err) {
          console.log('Could not send message to content script:', err);
        }
      });
    }
  }

  function updateSubtitleCustomizationUI(fontSize, bgColor, textColor, bgOpacity) {
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const bgColorValue = document.getElementById('bg-color-value');
    const textColorPicker = document.getElementById('text-color-picker');
    const textColorValue = document.getElementById('text-color-value');
    const bgOpacitySlider = document.getElementById('bg-opacity-slider');
    const bgOpacityValue = document.getElementById('bg-opacity-value');

    if (fontSizeSlider) fontSizeSlider.value = fontSize;
    if (fontSizeValue) fontSizeValue.textContent = fontSize + 'px';
    if (bgColorPicker) bgColorPicker.value = bgColor;
    if (bgColorValue) bgColorValue.textContent = bgColor;
    if (textColorPicker) textColorPicker.value = textColor;
    if (textColorValue) textColorValue.textContent = textColor;
    if (bgOpacitySlider) bgOpacitySlider.value = bgOpacity;
    if (bgOpacityValue) bgOpacityValue.textContent = bgOpacity + '%';
  }
});