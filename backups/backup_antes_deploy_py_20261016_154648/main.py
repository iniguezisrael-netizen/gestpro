import base64
import io
import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn
import msoffcrypto
import openpyxl

firebase_admin.initialize_app()

@https_fn.on_call()
def descifrarExcel(req: https_fn.CallableRequest) -> dict:
    if not req.auth:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="Debes iniciar sesión.")
    db = firestore.client()
    caller_snap = db.collection("roles").document(req.auth.uid).get()
    if not caller_snap.exists or caller_snap.to_dict().get("rol") != "admin":
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED, message="Solo administradores pueden usar esta función.")
    file_base64 = req.data.get("fileBase64")
    password = req.data.get("password") or ""
    if not file_base64 or not isinstance(file_base64, str):
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Falta el archivo.")
    try:
        file_bytes = base64.b64decode(file_base64)
        encrypted_io = io.BytesIO(file_bytes)
        decrypted_io = io.BytesIO()
        office_file = msoffcrypto.OfficeFile(encrypted_io)
        office_file.load_key(password=password)
        office_file.decrypt(decrypted_io)
        decrypted_io.seek(0)
        wb = openpyxl.load_workbook(decrypted_io, data_only=True)
        ws = wb.active
        if not ws:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message="El archivo no tiene hojas.")
        headers = None
        rows = []
        for row in ws.iter_rows(values_only=True):
            if all(v is None for v in row):
                continue
            if headers is None:
                headers = [str(h).strip() if h is not None else "" for h in row]
            else:
                if any(v is not None for v in row):
                    row_dict = {}
                    for i, val in enumerate(row):
                        if i < len(headers) and headers[i]:
                            row_dict[headers[i]] = str(val) if val is not None else ""
                    if row_dict:
                        rows.append(row_dict)
        return {"rows": rows}
    except https_fn.HttpsError:
        raise
    except Exception as e:
        err_str = str(e).lower()
        if any(k in err_str for k in ["password", "decrypt", "invalid key", "ecma376", "key", "incorrect"]):
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Contraseña incorrecta o formato no soportado.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=f"Error al leer el archivo: {str(e)}")
