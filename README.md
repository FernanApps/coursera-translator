# Coursera & DeepLearning.ai Subtitle Translator

<div align="center">
  <img src="icons/icon.png" alt="Extension Icon" width="100"/>
</div>

Una extensión de Chrome avanzada para traducir subtítulos en cursos de Coursera y DeepLearning.ai con funciones de Text-to-Speech y personalización completa de subtítulos.

## ✨ Características Principales

### 🌐 Traducción Inteligente
- **Múltiples idiomas soportados**: Vietnamita, Español, Chino, Coreano, Japonés, Portugués, Francés, Alemán
- **Detección automática de subtítulos nativos**: Usa subtítulos nativos cuando están disponibles (sin API, mejor calidad)
- **Traducción automática**: Solo traduce cuando el idioma deseado no está disponible nativamente
- **Compatible con dos plataformas**:
  - Coursera.org
  - DeepLearning.ai
- **Traducción en tiempo real** con caché para mejor rendimiento

### 🔊 Text-to-Speech (TTS)
- **Reproducción de voz** automática de los subtítulos
- **Selector de voces** filtrado por idioma seleccionado (todas las variantes de español, etc.)
- **Control de velocidad**: 0.75x, 1.0x, 1.25x, 1.5x, 1.75x, 2.0x
- **Control de volumen**: 0-100%
- **Toggle ON/OFF** independiente
- **Persistencia de configuración** entre sesiones

### 🎨 Personalización de Subtítulos
- **Tamaño de fuente**: Ajustable de 12px a 40px
- **Color de fondo**: Selector de color personalizado
- **Color de texto**: Selector de color personalizado
- **Opacidad del fondo**: Ajustable de 0% a 100%`
- **Botón de reset** para restaurar valores por defecto
- **Subtítulos arrastrables**: Mueve los subtítulos con el mouse a cualquier posición
- **Posición persistente**: Se recuerda la posición entre sesiones

### 🎯 Control de Visualización
- **Toggle Show/Hide**: Oculta o muestra subtítulos sin desactivar TTS
- **Configuración independiente**: TTS y subtítulos funcionan de forma independiente

## 🚀 Instalación

1. Descarga el código fuente:
   ```bash
   git clone https://github.com/FernanApps/coursera-translator.git
   ```

2. Abre Chrome Extensions:
   - Navega a `chrome://extensions/`
   - Activa "Developer mode" (Modo de desarrollador) en la esquina superior derecha

3. Instala la extensión:
   - Click en "Load unpacked" (Cargar extensión sin empaquetar)
   - Selecciona la carpeta con el código fuente descargado

## 📖 Guía de Uso

### Traducir Subtítulos

1. Abre un video de curso en Coursera o DeepLearning.ai
2. Haz clic en el icono de la extensión en la barra de herramientas de Chrome
3. Selecciona el idioma deseado del menú desplegable:
   - Los idiomas marcados con **✓ (Native)** están disponibles nativamente (mejor calidad, sin traducción)
   - Los idiomas bajo **"Translate to"** se traducirán automáticamente usando Google Translate
4. Haz clic en **"Translate Subtitles"**
5. Los subtítulos aparecerán en el idioma seleccionado

### Configurar Text-to-Speech

1. En el popup de la extensión, ve a la sección **"Text-to-Speech"**
2. Activa TTS con el botón **ON/OFF**
3. Selecciona una voz del menú desplegable (filtrado por idioma seleccionado)
4. Ajusta la velocidad de lectura (0.75x - 2.0x)
5. Ajusta el volumen (0-100%)
6. La voz leerá automáticamente los subtítulos mientras se muestran

### Personalizar Subtítulos

1. Abre la sección **"⚙️ Subtitle Customization"** en el popup
2. Ajusta el tamaño de fuente con el slider
3. Selecciona el color de fondo y texto con los selectores de color
4. Ajusta la opacidad del fondo
5. Los cambios se aplican en tiempo real
6. Usa **"Reset to Default"** para restaurar valores predeterminados

### Mover Subtítulos

- Simplemente **arrastra** el área de subtítulos con el mouse
- Los puntos **⋮⋮** indican que el elemento es arrastrable
- La posición se guarda automáticamente

### Ocultar/Mostrar Subtítulos

- Usa el toggle **"Show Subtitles"** en el popup
- Esto oculta los subtítulos pero mantiene TTS activo si está habilitado

## 🛠️ Tecnologías Utilizadas

- **Chrome Extension Manifest V3**: Última versión de la plataforma de extensiones
- **HTML5/CSS3**: Interfaz de usuario moderna y responsive
- **JavaScript ES6+**: Lógica de la aplicación
- **Google Translate API**: Traducción automática de alta calidad
- **Web Speech API**: Text-to-Speech nativo del navegador
- **Chrome Storage API**: Persistencia de configuración
- **MutationObserver**: Detección de cambios en subtítulos

## 📸 Capturas de Pantalla

### Interfaz de la Extensión en Coursera
![Extension Interface](images/extension.png)

### Interfaz de la Extensión en DeepLearning.ai
![Translated Subtitles](images/example-image.png)

## 🎯 Características Técnicas

- ✅ **Detección automática** de subtítulos nativos vs traducidos
- ✅ **Caché inteligente** de traducciones para mejor rendimiento
- ✅ **Subtítulos arrastrables** con persistencia de posición
- ✅ **Sincronización perfecta** con el video
- ✅ **Interfaz moderna** con gradientes y efectos visuales
- ✅ **Modo oscuro automático** según preferencias del sistema
- ✅ **Sin permisos innecesarios**: Solo accede a Coursera y DeepLearning.ai

## 🤝 Contribuciones

¡Todas las contribuciones son bienvenidas! Siéntete libre de:
- 🐛 Reportar bugs
- 💡 Sugerir nuevas características
- 🔧 Crear Pull Requests
- 📖 Mejorar la documentación
- 🌍 Traducir a otros idiomas

## 📝 Licencia

Este proyecto está distribuido bajo la licencia MIT. Ver `LICENSE` para más información.

## 💖 Apoya el Proyecto

Si encuentras útil este proyecto:
- ⭐ Dale una estrella en GitHub
- 📢 Compártelo con amigos que estudian en Coursera o DeepLearning.ai
- 🐦 Sígueme en redes sociales
- ☕ [Cómprame un café](https://www.buymeacoffee.com/fernanapps)

## 🙏 Agradecimientos

Este proyecto está basado en el trabajo original de [bombap/coursera-translator](https://github.com/bombap/coursera-translator).

**¡Muchas gracias por la idea inicial y el código base!** 🎉

### Mejoras y Características Añadidas:
- ✨ Text-to-Speech completo con control de voz, velocidad y volumen
- ✨ Personalización total de subtítulos (colores, tamaño, opacidad)
- ✨ Subtítulos arrastrables con persistencia
- ✨ Detección inteligente de subtítulos nativos
- ✨ Soporte para múltiples idiomas
- ✨ Interfaz de usuario mejorada con diseño moderno
- ✨ Toggle independiente para mostrar/ocultar subtítulos

---

<div align="center">
  Hecho con ❤️ para la comunidad de aprendizaje en línea
  <br/>
  <sub>© 2024 - Coursera & DeepLearning.ai Subtitle Translator</sub>
</div>
