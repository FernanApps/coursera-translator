// Variables globales para configuración de traducción
let currentLang = 'vi';
let useNativeSubtitles = false;

// Variables para subtítulos personalizados en Coursera
let nativeSubtitlesInterval = null;
let currentNativeTrack = null;

// Variables para Text-to-Speech (TTS)
let ttsEnabled = false;
let ttsVoice = null;
let ttsRate = 1.0;
let ttsVolume = 1.0;
let currentUtterance = null;
let lastSpokenText = '';
let availableTTSVoices = [];

// Variables para personalización de subtítulos
let subtitleFontSize = 22;
let subtitleBgColor = '#000000';
let subtitleTextColor = '#FFFFFF';
let subtitleBgOpacity = 70;
let showSubtitles = true;

// Cargar configuración TTS y subtítulos desde storage al inicio
chrome.storage.local.get([
    'ttsEnabled', 'ttsRate', 'ttsVolume', 'ttsVoiceName',
    'subtitleFontSize', 'subtitleBgColor', 'subtitleTextColor', 'subtitleBgOpacity', 'showSubtitles'
], (result) => {
    // Cargar configuración TTS
    if (result.ttsEnabled !== undefined) ttsEnabled = result.ttsEnabled;
    if (result.ttsRate) ttsRate = result.ttsRate;
    if (result.ttsVolume !== undefined) ttsVolume = result.ttsVolume;

    // Cargar configuración de subtítulos
    if (result.subtitleFontSize) subtitleFontSize = result.subtitleFontSize;
    if (result.subtitleBgColor) subtitleBgColor = result.subtitleBgColor;
    if (result.subtitleTextColor) subtitleTextColor = result.subtitleTextColor;
    if (result.subtitleBgOpacity !== undefined) subtitleBgOpacity = result.subtitleBgOpacity;
    if (result.showSubtitles !== undefined) showSubtitles = result.showSubtitles;

    if (result.ttsVoiceName) {
        // Esperar a que las voces estén disponibles
        const loadVoice = () => {
            const voices = speechSynthesis.getVoices();
            const savedVoice = voices.find(v => v.name === result.ttsVoiceName);
            if (savedVoice) {
                ttsVoice = savedVoice;
                console.log('TTS voice loaded:', ttsVoice.name);
            }
        };

        if (speechSynthesis.getVoices().length > 0) {
            loadVoice();
        } else {
            speechSynthesis.onvoiceschanged = loadVoice;
        }
    }

    console.log('Configuración cargada:', { ttsEnabled, ttsRate, ttsVolume, showSubtitles, subtitleFontSize, subtitleBgColor, subtitleTextColor, subtitleBgOpacity });
});

// Escuchar mensajes desde popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.method === 'translate') {
        currentLang = request.lang || 'vi';
        useNativeSubtitles = request.useNative || false;
        console.log('Solicitud de traducción:', { lang: currentLang, useNative: useNativeSubtitles });
        openBilingual();
        sendResponse({ method: 'translate', status: 'success' });
        return true;
    }

    if (request.method === 'getAvailableSubtitles') {
        const subtitles = getAvailableSubtitles();
        sendResponse({ method: 'getAvailableSubtitles', subtitles: subtitles });
        return true;
    }

    if (request.method === 'openTTSPanel') {
        // Remover panel existente si lo hay
        const existingPanel = document.querySelector('.tts-control-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        // Crear nuevo panel
        createTTSControlPanel();
        sendResponse({ status: 'success' });
        return true;
    }

    if (request.method === 'toggleSubtitles') {
        showSubtitles = request.show;
        toggleSubtitleVisibility(showSubtitles);
        sendResponse({ status: 'success' });
        return true;
    }

    if (request.method === 'updateTTSConfig') {
        const config = request.config;

        if (config.enabled !== undefined) {
            ttsEnabled = config.enabled;
            if (!ttsEnabled) stopTTS();
        }

        if (config.rate !== undefined) {
            ttsRate = config.rate;
        }

        if (config.volume !== undefined) {
            ttsVolume = config.volume;
        }

        if (config.voiceName !== undefined) {
            const voices = speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === config.voiceName);
            if (selectedVoice) {
                ttsVoice = selectedVoice;
            }
        }

        console.log('Configuración TTS actualizada:', { ttsEnabled, ttsRate, ttsVolume, ttsVoice: ttsVoice?.name });
        sendResponse({ status: 'success' });
        return true;
    }

    if (request.method === 'updateSubtitleStyle') {
        const style = request.style;

        if (style.fontSize !== undefined) {
            subtitleFontSize = style.fontSize;
        }

        if (style.bgColor !== undefined) {
            subtitleBgColor = style.bgColor;
        }

        if (style.textColor !== undefined) {
            subtitleTextColor = style.textColor;
        }

        if (style.bgOpacity !== undefined) {
            subtitleBgOpacity = style.bgOpacity;
        }

        applySubtitleStyles();
        console.log('Estilo de subtítulos actualizado:', { subtitleFontSize, subtitleBgColor, subtitleTextColor, subtitleBgOpacity });
        sendResponse({ status: 'success' });
        return true;
    }
});

// Verificar en qué página estamos
function getCurrentSite() {
    const url = window.location.href;
    if (url.includes('coursera.org')) {
        return 'coursera';
    } else if (url.includes('learn.deeplearning.ai')) {
        return 'deeplearning';
    }
    return null;
}

// Obtener todos los subtítulos disponibles
function getAvailableSubtitles() {
    const site = getCurrentSite();
    const subtitles = [];

    if (site === 'coursera') {
        // Para Coursera: leer los tracks del video
        const tracks = document.getElementsByTagName("track");
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                subtitles.push({
                    language: track.srclang,
                    label: track.label || track.srclang.toUpperCase(),
                    kind: track.kind
                });
            }
        }
    } else if (site === 'deeplearning') {
        // Para DeepLearning.ai: intentar detectar desde los botones de subtítulos
        // Por ahora solo detectamos inglés ya que es el que está disponible en el transcript
        subtitles.push({
            language: 'en',
            label: 'English',
            kind: 'captions'
        });
    }

    return subtitles;
}

async function openBilingual() {
    const site = getCurrentSite();
    if (site === 'coursera') {
        await openBilingualCoursera();
    } else if (site === 'deeplearning') {
        await openBilingualDeeplearning();
    }
}

async function openBilingualCoursera() {
    let tracks = document.getElementsByTagName("track");

    // Thêm đoạn code kiểm tra và xóa icon nếu đã tồn tại
    const existingIcon = document.querySelector('.translate-icon');
    if (existingIcon) {
        existingIcon.remove();
    }

    if (!tracks.length) {
        console.log('No tracks found');
        return;
    }

    // Si useNativeSubtitles es true, usar subtítulos nativos
    if (useNativeSubtitles) {
        console.log('Using native subtitles for language:', currentLang);

        // Buscar el track del idioma seleccionado
        let targetTrack = null;
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].srclang === currentLang) {
                targetTrack = tracks[i];
                break;
            }
        }

        if (targetTrack) {
            // Ocultar subtítulos por defecto de Coursera
            hideDefaultCourseraSubtitles();

            // Activar el track en modo hidden para poder leer los cues
            targetTrack.track.mode = "hidden";
            await sleep(500);

            // Crear div personalizado para mostrar subtítulos
            createCourseraCustomSubtitlesDiv();

            // Iniciar actualización de subtítulos nativos
            startCourseraNativeSubtitles(targetTrack);

            console.log('Native subtitles activated:', currentLang);
        } else {
            console.error('Native subtitles not found for language:', currentLang);
        }
        return;
    }

    // Si useNativeSubtitles es false, usar traducción automática
    console.log('Using auto-translation to:', currentLang);

    let sourceTrack = null;
    // Buscar track en inglés como fuente
    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].srclang === "en") {
            sourceTrack = tracks[i];
            break;
        }
    }

    if (!sourceTrack) {
        console.error('Source track (English) not found');
        return;
    }

    // Ocultar subtítulos por defecto
    hideDefaultCourseraSubtitles();

    // Activar track en modo hidden para leer los cues
    sourceTrack.track.mode = "hidden";
    await sleep(500);
    let cues = sourceTrack.track.cues;

    // Crear div personalizado
    createCourseraCustomSubtitlesDiv();

    // Tìm các điểm kết thúc câu trong phụ đề tiếng Anh
    var endSentence = [];
    for (let i = 0; i < cues.length; i++) {
        for (let j = 0; j < cues[i].text.length; j++) {
            if (cues[i].text[j] == "." && cues[i].text[j + 1] == undefined) {
                endSentence.push(i);
            }
        }
    }

    var cuesTextList = getTexts(cues);
    getTranslation(cuesTextList, (translatedText) => {
        var translatedList = translatedText.split(/[zZ]\s*~~~\s*[zZ]/);
        translatedList.splice(-1, 1);

        // Guardar traducciones en un objeto para acceso rápido
        window.translatedCuesCoursera = {};

        for (let i = 0; i < endSentence.length; i++) {
            if (i != 0) {
                for (let j = endSentence[i - 1] + 1; j <= endSentence[i]; j++) {
                    if (cues[j] && translatedList[i]) {
                        window.translatedCuesCoursera[j] = translatedList[i];
                    }
                }
            } else {
                for (let j = 0; j <= endSentence[i]; j++) {
                    if (cues[j] && translatedList[i]) {
                        window.translatedCuesCoursera[j] = translatedList[i];
                    }
                }
            }
        }

        // Iniciar actualización de subtítulos traducidos
        startCourseraTranslatedSubtitles(sourceTrack);
    });
}

// Función para iniciar actualización de subtítulos traducidos
function startCourseraTranslatedSubtitles(track) {
    currentNativeTrack = track;

    // Limpiar interval anterior si existe
    if (nativeSubtitlesInterval) {
        clearInterval(nativeSubtitlesInterval);
    }

    // Actualizar subtítulos cada 100ms
    nativeSubtitlesInterval = setInterval(() => {
        updateCourseraTranslatedSubtitles();
    }, 100);
}

// Función para actualizar subtítulos traducidos en el div
function updateCourseraTranslatedSubtitles() {
    if (!currentNativeTrack) return;

    const captionsDiv = document.querySelector('.coursera-custom-captions');
    if (!captionsDiv) return;

    const video = document.querySelector('video');
    if (!video) return;

    const currentTime = video.currentTime;
    const cues = currentNativeTrack.track.cues;

    if (!cues || cues.length === 0) return;

    // Buscar el cue actual
    let activeCueIndex = -1;
    for (let i = 0; i < cues.length; i++) {
        if (currentTime >= cues[i].startTime && currentTime <= cues[i].endTime) {
            activeCueIndex = i;
            break;
        }
    }

    // Actualizar el texto con la traducción
    if (activeCueIndex >= 0 && window.translatedCuesCoursera && window.translatedCuesCoursera[activeCueIndex]) {
        const text = window.translatedCuesCoursera[activeCueIndex];
        captionsDiv.textContent = text;
        captionsDiv.style.opacity = '1';

        // Leer con TTS
        speakText(text);
    } else {
        captionsDiv.textContent = '';
        captionsDiv.style.opacity = '0';
    }
}

// Función para hacer un elemento arrastrable
function makeDraggable(element, container) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    element.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        // Solo permitir arrastrar con click izquierdo
        if (e.button !== 0) return;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === element) {
            isDragging = true;
            element.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.6)';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            // Obtener dimensiones del contenedor
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();

            // Calcular posición relativa al contenedor
            const relativeX = e.clientX - containerRect.left;
            const relativeY = e.clientY - containerRect.top;

            // Limitar dentro del contenedor
            const maxX = containerRect.width - elementRect.width / 2;
            const maxY = containerRect.height - elementRect.height / 2;
            const minX = elementRect.width / 2;
            const minY = elementRect.height / 2;

            const boundedX = Math.max(minX, Math.min(relativeX, maxX));
            const boundedY = Math.max(minY, Math.min(relativeY, maxY));

            // Aplicar posición usando left/top en lugar de transform
            element.style.left = boundedX + 'px';
            element.style.top = boundedY + 'px';
            element.style.bottom = 'auto';
            element.style.transform = 'translate(-50%, -50%)';

            // Guardar posición en storage
            chrome.storage.local.set({
                subtitlePosition: { x: boundedX, y: boundedY }
            });
        }
    }

    function dragEnd(e) {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            element.style.boxShadow = '';
        }
    }

    // Cargar posición guardada
    chrome.storage.local.get(['subtitlePosition'], (result) => {
        if (result.subtitlePosition) {
            const pos = result.subtitlePosition;
            element.style.left = pos.x + 'px';
            element.style.top = pos.y + 'px';
            element.style.bottom = 'auto';
            element.style.transform = 'translate(-50%, -50%)';
            xOffset = pos.x;
            yOffset = pos.y;
        }
    });
}

// Función para ocultar subtítulos por defecto de Coursera
function hideDefaultCourseraSubtitles() {
    const style = document.createElement('style');
    style.id = 'hide-coursera-captions';
    style.textContent = `
        .vcs-captions-container,
        [data-testid="captions-container"],
        .rc-SubtitlesDisplay {
            display: none !important;
        }
    `;
    if (!document.getElementById('hide-coursera-captions')) {
        document.head.appendChild(style);
    }
}

// Función para crear div personalizado en Coursera
function createCourseraCustomSubtitlesDiv() {
    let videoContainer = document.querySelector('#video-player');
    if (!videoContainer) {
        videoContainer = document.querySelector('[data-testid="video-player"]');
    }
    if (!videoContainer) {
        videoContainer = document.querySelector('video').parentElement;
    }

    // Remover div existente si lo hay
    const existing = document.querySelector('.coursera-custom-captions');
    if (existing) {
        existing.remove();
    }

    const captionsDiv = document.createElement('div');
    captionsDiv.className = 'coursera-custom-captions';
    captionsDiv.style.cssText = `
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        text-align: center;
        z-index: 9999;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        font-size: 22px;
        font-weight: 500;
        pointer-events: auto;
        max-width: 90%;
        background-color: rgba(0, 0, 0, 0.7);
        padding: 8px 16px 8px 28px;
        border-radius: 8px;
        backdrop-filter: blur(4px);
        line-height: 1.4;
        font-family: Arial, sans-serif;
        cursor: move;
        user-select: none;
        transition: box-shadow 0.2s;
    `;

    // Agregar indicador de arrastre (grip dots)
    const dragHandle = document.createElement('div');
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.style.cssText = `
        position: absolute;
        left: 6px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
        letter-spacing: -2px;
        pointer-events: none;
    `;
    captionsDiv.appendChild(dragHandle);

    // Hacer el div arrastrable
    makeDraggable(captionsDiv, videoContainer);

    videoContainer.style.position = 'relative';
    videoContainer.appendChild(captionsDiv);

    // Aplicar estilos personalizados y visibilidad inicial
    setTimeout(() => {
        applySubtitleStyles();
        toggleSubtitleVisibility(showSubtitles);
    }, 100);
}

// Función para iniciar actualización de subtítulos nativos
function startCourseraNativeSubtitles(track) {
    currentNativeTrack = track;

    // Limpiar interval anterior si existe
    if (nativeSubtitlesInterval) {
        clearInterval(nativeSubtitlesInterval);
    }

    // Actualizar subtítulos cada 100ms
    nativeSubtitlesInterval = setInterval(() => {
        updateCourseraNativeSubtitles();
    }, 100);
}

// Función para actualizar subtítulos nativos en el div
function updateCourseraNativeSubtitles() {
    if (!currentNativeTrack) return;

    const captionsDiv = document.querySelector('.coursera-custom-captions');
    if (!captionsDiv) return;

    const video = document.querySelector('video');
    if (!video) return;

    const currentTime = video.currentTime;
    const cues = currentNativeTrack.track.cues;

    if (!cues || cues.length === 0) return;

    // Buscar el cue actual
    let activeCue = null;
    for (let i = 0; i < cues.length; i++) {
        if (currentTime >= cues[i].startTime && currentTime <= cues[i].endTime) {
            activeCue = cues[i];
            break;
        }
    }

    // Actualizar el texto
    if (activeCue) {
        const text = activeCue.text;
        captionsDiv.textContent = text;
        captionsDiv.style.opacity = '1';

        // Leer con TTS
        speakText(text);
    } else {
        captionsDiv.textContent = '';
        captionsDiv.style.opacity = '0';
    }
}

let translatedSubtitles = new Map(); // Cache cho các bản dịch

// Thêm hàm để tắt/bật subtitle gốc
function toggleDefaultCaptions(shouldDisable) {
    const captionButtons = document.querySelectorAll('button.vds-caption-button');
    const captionButton = captionButtons[captionButtons.length - 1];
    if (captionButton) {
        const isPressed = captionButton.getAttribute('aria-pressed') === 'true';
        if (shouldDisable && isPressed) {
            captionButton.click(); // Tắt CC đi
            console.log('Default captions disabled');
        } else if (!shouldDisable && !isPressed) {
            captionButton.click(); // Bật CC lên
            console.log('Default captions enabled');
        }
    }
}

// Thêm hàm tạo div hiển thị phụ đề dịch
function createTranslatedCaptionsDiv() {
    const videoContainer = document.querySelector('div[data-media-provider]');
    if (!videoContainer) return null;

    let translatedCaptionsDiv = videoContainer.querySelector('.translated-captions');
    if (translatedCaptionsDiv) return translatedCaptionsDiv;

    translatedCaptionsDiv = document.createElement('div');
    translatedCaptionsDiv.className = 'translated-captions';
    translatedCaptionsDiv.style.cssText = `
        position: absolute;
        bottom: 10%;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        text-align: center;
        z-index: 1000;
        text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
        font-size: 20px;
        pointer-events: auto;
        max-width: 80%;
        width: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        cursor: move;
        user-select: none;
        transition: box-shadow 0.2s;
    `;

    // Agregar indicador de arrastre (grip dots)
    const dragHandle = document.createElement('div');
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.style.cssText = `
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
        letter-spacing: -2px;
        pointer-events: none;
        flex-shrink: 0;
    `;
    translatedCaptionsDiv.appendChild(dragHandle);

    // Tạo cấu trúc giống với phụ đề gốc
    const cueDisplay = document.createElement('div');
    cueDisplay.setAttribute('data-part', 'cue-display');
    cueDisplay.style.cssText = `
        text-align: center;
        display: inline-block;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 8px 16px;
        border-radius: 8px;
        backdrop-filter: blur(2px);
        width: auto;
        min-width: min-content;
        pointer-events: none;
    `;

    const cueDiv = document.createElement('div');
    cueDiv.setAttribute('data-part', 'cue');
    cueDiv.style.cssText = `
        line-height: 1.4;
        white-space: pre-wrap;
        display: inline;
    `;

    cueDisplay.appendChild(cueDiv);
    translatedCaptionsDiv.appendChild(cueDisplay);

    // Hacer el div arrastrable
    makeDraggable(translatedCaptionsDiv, videoContainer);

    videoContainer.appendChild(translatedCaptionsDiv);

    // Aplicar estilos personalizados y visibilidad inicial
    setTimeout(() => {
        applySubtitleStyles();
        toggleSubtitleVisibility(showSubtitles);
    }, 100);

    return translatedCaptionsDiv;
}

// Thêm biến để theo dõi observer
let captionsObserver = null;
let captionsCheckInterval = null;

// Thêm hàm để ẩn caption gốc
function hideOriginalCaptions() {
    const captionsDivs = document.querySelectorAll('.vds-captions');
    captionsDivs.forEach(div => {
        if (div) {
            div.style.display = 'none';
        }
    });
}

// Thêm hàm để theo dõi và ẩn caption gốc
function observeCaptions() {
    if (captionsObserver) return;

    const videoContainer = document.querySelector('div[data-media-provider]');
    if (!videoContainer) return;

    // Tạo observer với cấu hình mở rộng
    captionsObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Kiểm tra các node được thêm vào
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && node.classList.contains('vds-captions')) {
                        node.style.display = 'none';
                    }
                    // Kiểm tra sâu hơn trong cây DOM
                    const captionsDivs = node.querySelectorAll ? node.querySelectorAll('.vds-captions') : [];
                    captionsDivs.forEach(div => {
                        div.style.display = 'none';
                    });
                });
            }
            // Kiểm tra các thay đổi về thuộc tính
            if (mutation.type === 'attributes' && mutation.target.classList && mutation.target.classList.contains('vds-captions')) {
                mutation.target.style.display = 'none';
            }
        });
    });

    // Theo dõi với cấu hình mở rộng
    captionsObserver.observe(videoContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // Thêm interval check định kỳ
    if (captionsCheckInterval) {
        clearInterval(captionsCheckInterval);
    }
    captionsCheckInterval = setInterval(hideOriginalCaptions, 100);

    // Ẩn caption hiện tại
    hideOriginalCaptions();
}

// Thêm hàm để dừng theo dõi
function stopObservingCaptions() {
    if (captionsObserver) {
        captionsObserver.disconnect();
        captionsObserver = null;
    }
    if (captionsCheckInterval) {
        clearInterval(captionsCheckInterval);
        captionsCheckInterval = null;
    }
    // Khôi phục hiển thị caption gốc
    const captionsDivs = document.querySelectorAll('.vds-captions');
    captionsDivs.forEach(div => {
        if (div) {
            div.style.display = '';
        }
    });
}

async function openBilingualDeeplearning() {
    console.log("openBilingualDeeplearning");

    // Bật CC gốc và bắt đầu theo dõi
    toggleDefaultCaptions(true);
    observeCaptions();

    // Tạo div hiển thị phụ đề dịch
    createTranslatedCaptionsDiv();

    // Open transcript panel
    const transcriptButton = document.querySelector('button.vds-button[aria-label="open transcript panel"]');
    if (transcriptButton) {
        transcriptButton.click();
        console.log('Transcript panel opened');
    }

    // Wait for transcript to load
    await sleep(2000);

    // Read transcript
    const paragraphs = document.querySelectorAll('p.text-neutral');
    const texts = Array.from(paragraphs).map(p => {
        const time = p.querySelector('span.link-primary') ? p.querySelector('span.link-primary').innerText : '';
        const text = p.querySelector('span:not(.link-primary)') ? p.querySelector('span:not(.link-primary)').innerText : '';
        return [time, text];
    });

    // Process and merge subtitles
    let mergedSubtitles = [];
    let currentSubtitle = ['', ''];

    texts.forEach(([time, text], index) => {
        if (currentSubtitle[0] === '') {
            currentSubtitle[0] = time;
        }
        currentSubtitle[1] += ` ${text}`;

        if (text.trim().endsWith('.') || index === texts.length - 1) {
            mergedSubtitles.push([currentSubtitle[0], currentSubtitle[1].trim()]);
            currentSubtitle = ['', ''];
        }
    });

    // Filter valid subtitles and store them
    subtitles = mergedSubtitles.filter(sub => sub[0] !== '' && sub[1] !== '');
    console.log("Subtitles loaded:", subtitles);

    // Dịch tất cả subtitle một lần
    const allText = subtitles.map(sub => sub[1]).join(' z~~~z ');
    getTranslation(allText, (translatedText) => {
        const translations = translatedText.split(/[zZ]\s*~~~\s*[zZ]/);
        // Cache các bản dịch
        subtitles.forEach((sub, index) => {
            if (translations[index]) {
                translatedSubtitles.set(sub[1], translations[index].trim());
            }
        });
        console.log("Translations loaded:", translatedSubtitles);
    });

    // Close transcript panel
    const container = document.querySelector('div.sticky.top-0.flex.justify-between.bg-base-200.py-4.pr-4.text-neutral');
    const closeButton = container ? container.querySelector('button.btn.btn-circle.btn-ghost.btn-sm') : null;
    if (closeButton) {
        closeButton.click();
        console.log('Transcript panel closed');
    }

    // Start subtitle updater
    startSubtitleUpdater();
}

// Thêm biến để theo dõi trạng thái dịch
let isTranslating = false;

// Thêm hàm tạo và chèn icon
function createTranslateIcon() {
    const site = getCurrentSite();
    let container;

    if (site === 'coursera') {
        container = document.querySelector('#video-player-row');
    } else if (site === 'deeplearning') {
        container = document.querySelector('div[data-media-provider]');
    }

    if (!container || document.querySelector('.translate-icon')) return;

    const icon = document.createElement('div');
    icon.className = 'translate-icon';
    icon.innerHTML = '🌐';

    // Thêm sự kiện click với stopPropagation
    icon.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();

        // Toggle trạng thái dịch
        isTranslating = !isTranslating;
        icon.style.backgroundColor = isTranslating ? '#1E80E2' : 'rgba(0, 0, 0, 0.5)';

        if (isTranslating) {
            const site = getCurrentSite();
            if (site === 'deeplearning') {
                toggleDefaultCaptions(true); // Bật CC gốc
                observeCaptions(); // Bắt đầu theo dõi y ẩn caption gốc
            }
            openBilingual();
        } else {
            // Limpiar para DeepLearning.ai
            stopObservingCaptions(); // Dừng theo dõi
            toggleDefaultCaptions(false); // Tắt CC gốc
            const translatedCaptionsDiv = document.querySelector('.translated-captions');
            if (translatedCaptionsDiv) {
                translatedCaptionsDiv.remove();
            }
            const originalCaptions = document.querySelector('.vds-captions');
            if (originalCaptions) {
                originalCaptions.style.display = '';
            }

            // Limpiar para Coursera
            if (nativeSubtitlesInterval) {
                clearInterval(nativeSubtitlesInterval);
                nativeSubtitlesInterval = null;
            }
            currentNativeTrack = null;
            const courseraCaptionsDiv = document.querySelector('.coursera-custom-captions');
            if (courseraCaptionsDiv) {
                courseraCaptionsDiv.remove();
            }
            const hideStyle = document.getElementById('hide-coursera-captions');
            if (hideStyle) {
                hideStyle.remove();
            }
            // Limpiar traducciones
            if (window.translatedCuesCoursera) {
                delete window.translatedCuesCoursera;
            }

            // Detener TTS
            stopTTS();
        }
    });

    // Thêm style cho icon
    icon.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 8px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s, background-color 0.3s;
        font-size: 20px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto; /* Đảm bảo icon nhận được sự kiện click */
    `;

    // Thêm hover effect
    icon.addEventListener('mouseover', () => {
        icon.style.opacity = '1';
    });
    icon.addEventListener('mouseout', () => {
        icon.style.opacity = '0.7';
    });

    // Crear icono TTS
    const ttsIcon = document.createElement('div');
    ttsIcon.className = 'tts-icon';
    ttsIcon.innerHTML = '🔊';
    ttsIcon.style.cssText = `
        position: absolute;
        top: 70px;
        right: 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 8px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s, background-color 0.3s;
        font-size: 20px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    `;

    ttsIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();

        // Toggle panel TTS
        const existingPanel = document.querySelector('.tts-control-panel');
        if (existingPanel) {
            existingPanel.remove();
        } else {
            createTTSControlPanel();
        }
    });

    ttsIcon.addEventListener('mouseover', () => {
        ttsIcon.style.opacity = '1';
    });
    ttsIcon.addEventListener('mouseout', () => {
        ttsIcon.style.opacity = '0.7';
    });

    // Tạo một wrapper div để chứa ambos iconos
    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1000;
        pointer-events: none; /* Cho phép click xuyên qua wrapper */
    `;

    iconWrapper.appendChild(icon);
    iconWrapper.appendChild(ttsIcon);
    container.insertBefore(iconWrapper, container.firstChild);
}

// Thêm MutationObserver để theo dõi khi video player được load
function observeVideoContainer() {
    const site = getCurrentSite();
    let selector;

    if (site === 'coursera') {
        selector = '#video-player-row';
    } else if (site === 'deeplearning') {
        selector = 'div[data-media-provider]';
    } else {
        return;
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (document.querySelector(selector)) {
                createTranslateIcon();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Chạy observer khi trang web load
document.addEventListener('DOMContentLoaded', observeVideoContainer);
// Chạy ngay lập tức trong trường hợp trang đã load
observeVideoContainer();

// Các hàm tiện ích
String.prototype.replaceAt = function (index, replacement) {
    return (
        this.substr(0, index) +
        replacement +
        this.substr(index + replacement.length)
    );
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTexts(cues) {
    let cuesTextList = "";
    for (let i = 0; i < cues.length; i++) {
        if (cues[i].text[cues[i].text.length - 1] == ".") {
            cues[i].text = cues[i].text.replaceAt(
                cues[i].text.length - 1,
                ". z~~~z "
            );
        }
        cuesTextList += cues[i].text.replace(/\n/g, " ") + " ";
    }
    return cuesTextList;
}

function getTranslation(words, callback) {
    console.log("getTranslation", words);
    const lang = currentLang; // Usar el idioma seleccionado
    const xhr = new XMLHttpRequest();
    let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURI(
        words
    )}`;

    xhr.open("GET", url, true);
    xhr.responseType = "text";
    xhr.onload = function () {
        if (xhr.readyState === xhr.DONE) {
            if (xhr.status === 200 || xhr.status === 304) {
                const translatedList = JSON.parse(xhr.responseText)[0];
                let translatedText = "";
                for (let i = 0; i < translatedList.length; i++) {
                    translatedText += translatedList[i][0];
                }
                callback(translatedText);
            }
        }
    };
    xhr.send();
}

// Cập nhật hàm updateSubtitles
function updateSubtitles(currentTime) {
    if (!isTranslating) return;

    const translatedCaptionsDiv = document.querySelector('.translated-captions');
    if (!translatedCaptionsDiv) return;

    const cueDiv = translatedCaptionsDiv.querySelector('[data-part="cue"]');
    if (!cueDiv) return;

    // Tìm phụ đề phù hợp với thời gian hiện tại
    const currentSubtitle = subtitles
        .filter(([time]) => {
            const [minutes, seconds] = time.split(':').map(Number);
            const totalSeconds = minutes * 60 + seconds;
            return currentTime >= totalSeconds;
        })
        .pop();

    // Cập nhật nội dung phụ đề
    if (currentSubtitle) {
        const [_, text] = currentSubtitle;
        // Lấy bản dịch từ cache
        const translatedText = translatedSubtitles.get(text);
        if (translatedText) {
            cueDiv.textContent = translatedText;
            // Leer con TTS
            speakText(translatedText);
        }
    } else {
        cueDiv.textContent = '';
    }
}

// Cập nhật hàm startSubtitleUpdater
function startSubtitleUpdater() {
    // Clear existing interval if any
    if (window.subtitleInterval) {
        clearInterval(window.subtitleInterval);
    }

    // Start new interval
    window.subtitleInterval = setInterval(() => {
        const currentTime = getCurrentTime();
        updateSubtitles(currentTime);
    }, 1000);
}

function getCurrentTime() {
    const site = getCurrentSite();
    let videoElement;

    if (site === 'coursera') {
        videoElement = document.querySelector('video');
    } else if (site === 'deeplearning') {
        const videoContainer = document.querySelector('div[data-media-provider]');
        videoElement = videoContainer ? videoContainer.querySelector('video') : null;
    }

    if (videoElement) {
        return videoElement.currentTime;
    }
    return 0;
}

// ==================== TEXT-TO-SPEECH FUNCTIONS ====================

// Cargar voces disponibles
function loadTTSVoices() {
    return new Promise((resolve) => {
        let voices = speechSynthesis.getVoices();

        if (voices.length > 0) {
            resolve(voices);
        } else {
            speechSynthesis.onvoiceschanged = () => {
                voices = speechSynthesis.getVoices();
                resolve(voices);
            };
        }
    });
}

// Obtener voces filtradas por idioma
function getVoicesForLanguage(lang) {
    const allVoices = speechSynthesis.getVoices();

    // Filtrar voces según el idioma
    let voices = allVoices.filter(v => {
        // Para español, incluir todas las variantes
        if (lang === 'es') {
            return v.lang.startsWith("es") &&
                (v.name.toLowerCase().includes("mex") ||
                 v.name.toLowerCase().includes("lat") ||
                 v.name.toLowerCase().includes("es-") ||
                 v.lang === "es-MX" ||
                 v.lang === "es-US" ||
                 v.lang === "es-419" ||
                 v.lang.startsWith("es"));
        }

        // Para otros idiomas, buscar coincidencias
        return v.lang.startsWith(lang);
    });

    // Si no hay voces específicas, intentar con el código de idioma más general
    if (voices.length === 0) {
        voices = allVoices.filter(v => v.lang.split('-')[0] === lang);
    }

    availableTTSVoices = voices;
    console.log(`Voces disponibles para ${lang}:`, voices);
    return voices;
}

// Hablar texto con TTS
function speakText(text) {
    // No hablar si TTS está deshabilitado
    if (!ttsEnabled || !text || text.trim() === '') return;
    if (text === lastSpokenText) return; // No repetir el mismo texto

    // Cancelar habla anterior
    if (currentUtterance) {
        speechSynthesis.cancel();
    }

    lastSpokenText = text;

    const utterance = new SpeechSynthesisUtterance(text);

    // Configurar voz
    if (ttsVoice) {
        utterance.voice = ttsVoice;
    } else {
        // Intentar seleccionar una voz automáticamente
        const voices = getVoicesForLanguage(currentLang);
        if (voices.length > 0) {
            ttsVoice = voices[0];
            utterance.voice = ttsVoice;
        }
    }

    // Configurar velocidad y volumen
    utterance.rate = ttsRate;
    utterance.volume = ttsVolume;
    utterance.lang = currentLang;

    // Eventos
    utterance.onend = () => {
        currentUtterance = null;
    };

    utterance.onerror = (error) => {
        console.error('TTS Error:', error);
        currentUtterance = null;
    };

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
}

// Detener TTS
function stopTTS() {
    if (currentUtterance) {
        speechSynthesis.cancel();
        currentUtterance = null;
        lastSpokenText = '';
    }
}

// Mostrar/ocultar subtítulos
function toggleSubtitleVisibility(show) {
    const courseraCaptionsDiv = document.querySelector('.coursera-custom-captions');
    const translatedCaptionsDiv = document.querySelector('.translated-captions');

    if (courseraCaptionsDiv) {
        courseraCaptionsDiv.style.display = show ? 'block' : 'none';
    }

    if (translatedCaptionsDiv) {
        translatedCaptionsDiv.style.display = show ? 'block' : 'none';
    }

    console.log('Visibilidad de subtítulos cambiada:', { visible: show });
}

// Aplicar estilos personalizados a los subtítulos
function applySubtitleStyles() {
    const courseraCaptionsDiv = document.querySelector('.coursera-custom-captions');
    const translatedCaptionsDiv = document.querySelector('.translated-captions');

    const hexToRgba = (hex, opacity) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    };

    // Aplicar a Coursera custom captions
    if (courseraCaptionsDiv) {
        courseraCaptionsDiv.style.fontSize = subtitleFontSize + 'px';
        courseraCaptionsDiv.style.color = subtitleTextColor;
        courseraCaptionsDiv.style.backgroundColor = hexToRgba(subtitleBgColor, subtitleBgOpacity);
    }

    // Aplicar a translated captions (DeepLearning.ai)
    if (translatedCaptionsDiv) {
        const cueDisplay = translatedCaptionsDiv.querySelector('[data-part="cue-display"]');
        const cueDiv = translatedCaptionsDiv.querySelector('[data-part="cue"]');

        if (cueDisplay) {
            cueDisplay.style.backgroundColor = hexToRgba(subtitleBgColor, subtitleBgOpacity);
        }

        if (cueDiv) {
            cueDiv.style.fontSize = subtitleFontSize + 'px';
            cueDiv.style.color = subtitleTextColor;
        }
    }

    console.log('Estilos de subtítulos aplicados:', { fontSize: subtitleFontSize, bgColor: subtitleBgColor, textColor: subtitleTextColor, bgOpacity: subtitleBgOpacity });
}

// Crear panel de controles TTS
function createTTSControlPanel() {
    const site = getCurrentSite();
    let container;

    if (site === 'coursera') {
        container = document.querySelector('#video-player-row') || document.querySelector('#video-player');
    } else if (site === 'deeplearning') {
        container = document.querySelector('div[data-media-provider]');
    }

    if (!container || document.querySelector('.tts-control-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'tts-control-panel';
    panel.style.cssText = `
        position: absolute;
        top: 60px;
        right: 20px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 12px;
        border-radius: 8px;
        z-index: 9999;
        min-width: 250px;
        backdrop-filter: blur(8px);
        font-family: Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">🔊</span>
                <span style="font-weight: bold;">Text-to-Speech</span>
            </div>
            <button id="tts-toggle" style="
                background: #4CAF50;
                border: none;
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
            ">ON</button>
        </div>

        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.8;">Voice:</label>
            <select id="tts-voice-select" style="
                width: 100%;
                padding: 6px;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.3);
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 12px;
            ">
                <option value="">Loading voices...</option>
            </select>
        </div>

        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.8;">Speed: <span id="tts-rate-value">1.0x</span></label>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="tts-rate-btn" data-rate="0.75" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">0.75x</button>
                <button class="tts-rate-btn" data-rate="1.0" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.3); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">1.0x</button>
                <button class="tts-rate-btn" data-rate="1.25" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">1.25x</button>
                <button class="tts-rate-btn" data-rate="1.5" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">1.5x</button>
                <button class="tts-rate-btn" data-rate="1.75" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">1.75x</button>
                <button class="tts-rate-btn" data-rate="2.0" style="flex: 1; min-width: 45px; padding: 4px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">2.0x</button>
            </div>
        </div>

        <div style="margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.8;">Volume: <span id="tts-volume-value">100%</span></label>
            <input type="range" id="tts-volume-slider" min="0" max="100" value="100" style="
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: rgba(255,255,255,0.2);
                outline: none;
                cursor: pointer;
            ">
        </div>

        <div style="text-align: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
            <button id="tts-close" style="
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">Close Panel</button>
        </div>
    `;

    container.appendChild(panel);
    initializeTTSControls();
}

// Inicializar controles TTS
async function initializeTTSControls() {
    // Cargar preferencias guardadas
    chrome.storage.local.get(['ttsEnabled', 'ttsRate', 'ttsVolume', 'ttsVoiceName'], (result) => {
        if (result.ttsEnabled !== undefined) ttsEnabled = result.ttsEnabled;
        if (result.ttsRate) ttsRate = result.ttsRate;
        if (result.ttsVolume) ttsVolume = result.ttsVolume;

        updateTTSUI();
    });

    // Cargar voces
    await loadTTSVoices();
    populateVoiceSelect();

    // Event listeners
    const toggleBtn = document.getElementById('tts-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            ttsEnabled = !ttsEnabled;
            chrome.storage.local.set({ ttsEnabled });
            updateTTSUI();
            if (!ttsEnabled) stopTTS();
        });
    }

    const voiceSelect = document.getElementById('tts-voice-select');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', (e) => {
            const selectedVoice = availableTTSVoices.find(v => v.name === e.target.value);
            if (selectedVoice) {
                ttsVoice = selectedVoice;
                chrome.storage.local.set({ ttsVoiceName: selectedVoice.name });
            }
        });
    }

    const rateBtns = document.querySelectorAll('.tts-rate-btn');
    rateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ttsRate = parseFloat(btn.dataset.rate);
            chrome.storage.local.set({ ttsRate });
            updateTTSUI();

            // Actualizar estilos de botones
            rateBtns.forEach(b => {
                b.style.background = 'rgba(255,255,255,0.1)';
            });
            btn.style.background = 'rgba(255,255,255,0.3)';
        });
    });

    const volumeSlider = document.getElementById('tts-volume-slider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            ttsVolume = e.target.value / 100;
            document.getElementById('tts-volume-value').textContent = e.target.value + '%';
            chrome.storage.local.set({ ttsVolume });
        });
    }

    const closeBtn = document.getElementById('tts-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const panel = document.querySelector('.tts-control-panel');
            if (panel) panel.remove();
        });
    }
}

// Poblar selector de voces
function populateVoiceSelect() {
    const select = document.getElementById('tts-voice-select');
    if (!select) return;

    const voices = getVoicesForLanguage(currentLang);

    select.innerHTML = '';

    if (voices.length === 0) {
        select.innerHTML = '<option value="">No voices available</option>';
        return;
    }

    voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        select.appendChild(option);

        if (index === 0 && !ttsVoice) {
            ttsVoice = voice;
        }
    });

    // Restaurar voz guardada
    chrome.storage.local.get(['ttsVoiceName'], (result) => {
        if (result.ttsVoiceName) {
            const savedVoice = voices.find(v => v.name === result.ttsVoiceName);
            if (savedVoice) {
                ttsVoice = savedVoice;
                select.value = savedVoice.name;
            }
        }
    });
}

// Actualizar UI de TTS
function updateTTSUI() {
    const toggleBtn = document.getElementById('tts-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = ttsEnabled ? 'ON' : 'OFF';
        toggleBtn.style.background = ttsEnabled ? '#4CAF50' : '#f44336';
    }

    const rateValue = document.getElementById('tts-rate-value');
    if (rateValue) {
        rateValue.textContent = ttsRate + 'x';
    }

    const volumeSlider = document.getElementById('tts-volume-slider');
    if (volumeSlider) {
        volumeSlider.value = ttsVolume * 100;
        document.getElementById('tts-volume-value').textContent = Math.round(ttsVolume * 100) + '%';
    }
} 