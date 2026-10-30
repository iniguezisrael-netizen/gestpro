import sys, os
path = os.path.join(os.environ['HOME'], 'mnt/firebase-deploy/public/index.html')
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

# 1. Añadir _globalScanInit() al final de initApp
OLD1 = '  setTimeout(_prewarmPDFAssets, 800);\n}'
NEW1 = '  setTimeout(_prewarmPDFAssets, 800);\n  _globalScanInit();\n}'
assert src.count(OLD1) == 1, f"OLD1 count={src.count(OLD1)}"
src = src.replace(OLD1, NEW1, 1)
print("Paso 1 OK")

# 2. Verificar punto de inserción
INSERT_BEFORE = "document.addEventListener('DOMContentLoaded', _updateDarkBtn);"
assert src.count(INSERT_BEFORE) == 1, f"INSERT_BEFORE count={src.count(INSERT_BEFORE)}"
print("Paso 2 OK")

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print("Guardado OK —", len(src), "bytes")
