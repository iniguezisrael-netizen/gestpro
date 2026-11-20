#!/usr/bin/env python3
"""
Verificación de integridad de index.html antes de cada commit.
Corre automáticamente como pre-commit hook.
"""
import sys, re

ARCHIVO = "public/index.html"
MIN_LINEAS = 25000  # actualmente ~25864 — alerta si baja más de ~800 líneas

FUNCIONES_CRITICAS = [
    # Auth / Nav
    "function doLogin",
    "function navigate(",
    "function renderPage(",
    "function can(",
    # Módulos principales
    "function renderCotizaciones(",
    "function renderVentas(",
    "function renderInventario(",
    "function renderCaja(",
    "function renderClientes(",
    "function renderReparaciones(",
    "function renderProduccion(",
    "function renderAgenda(",
    "function renderChecador(",
    # Datos
    "function saveDb(",
    "function loadFromFirebase(",
    "function startRealtimeSync(",
    # UI
    "function showModal(",
    "function closeModal(",
    "function showToast(",
    # Recordatorios
    "_checkRecordatorios",
    "_mostrarPopupRecordatorios",
    "_recAbrir",
    # Críticas de esta sesión
    "window._recViewingId",
    # Opciones de filtro (caso auxiliar)
    "auxiliar",
]

TEXTOS_UNICOS = [
    # Verifica que opciones de UI críticas sigan presentes
    "Solo míos",  # filtro recordatorios
    "Secretaria",
    "Auxiliar",
    "Todos",
    # Constantes clave
    "RTDB_DUAL_WRITE",
    "FIRESTORE_WRITE_ENABLED",
]

# Fragmentos que verifican fixes específicos — si desaparecen, el fix fue sobreescrito
PATRONES_FIXES = [
    # Fix: _gsRefocus no roba foco con modal-overlay abierto (selección de texto en modales)
    "modal-overlay')?.classList.contains('open')) return;",
    # Fix: búsqueda Nueva Venta filtra productos sin disponibles
    "tipo==='productos' ? all.filter(i => (i.cantidad||0) - _apartadosProd(i.id) > 0)",
    # Fix: dropdown muestra stock disponible, no total
    "tipo==='productos' ? (i.cantidad||0) - _apartadosProd(i.id) : i.cantidad||0;",
    # Fix: vSelAddItem bloquea agregar producto 100% apartado
    "_disp = (item.cantidad||0) - _apartadosProd(item.id)",
]

errores = []
advertencias = []

try:
    with open(ARCHIVO, encoding="utf-8") as f:
        contenido = f.read()
        lineas = contenido.splitlines()
except FileNotFoundError:
    print(f"❌ CRÍTICO: No se encontró {ARCHIVO}")
    sys.exit(1)

# 1. Verificar líneas mínimas
total = len(lineas)
if total < MIN_LINEAS:
    errores.append(f"Archivo tiene {total} líneas — mínimo esperado {MIN_LINEAS}. Posible truncado.")
else:
    print(f"✅ Líneas: {total}")

# 2. Verificar funciones críticas
faltantes = [f for f in FUNCIONES_CRITICAS if f not in contenido]
if faltantes:
    for f in faltantes:
        errores.append(f"Función/texto crítico ausente: '{f}'")
else:
    print(f"✅ Funciones críticas: todas presentes ({len(FUNCIONES_CRITICAS)})")

# 3. Verificar textos únicos de UI
faltantes_ui = [t for t in TEXTOS_UNICOS if t not in contenido]
if faltantes_ui:
    for t in faltantes_ui:
        errores.append(f"Texto de UI ausente: '{t}'")
else:
    print(f"✅ Textos de UI: todos presentes ({len(TEXTOS_UNICOS)})")

# 3b. Verificar que los fixes específicos siguen intactos
faltantes_fixes = [p for p in PATRONES_FIXES if p not in contenido]
if faltantes_fixes:
    for p in faltantes_fixes:
        errores.append(f"Fix sobreescrito o ausente: '{p[:60]}...'")
else:
    print(f"✅ Fixes críticos: todos presentes ({len(PATRONES_FIXES)})")

# 4. Verificar que no haya tags HTML rotos al final del archivo
ultimas = contenido.rstrip()[-200:]
if not ultimas.endswith("</html>"):
    errores.append("El archivo no termina con </html> — posible truncado al final.")
else:
    print("✅ Cierre HTML: correcto")

# Resultado
print()
if errores:
    print("=" * 60)
    print(f"❌ VERIFICACIÓN FALLÓ — {len(errores)} problema(s):")
    for e in errores:
        print(f"   • {e}")
    print("=" * 60)
    print("⛔ Commit bloqueado. Revisar antes de continuar.")
    sys.exit(1)
else:
    print("✅ Verificación OK — índice.html íntegro")
    sys.exit(0)
