import base64
import csv
from datetime import datetime
import io
import os
import re
import unicodedata
import wave
import json
from flask import Blueprint, request, jsonify
from app.utils.preprocesamiento import normalize_text
from app.utils.model_utils import predecir_categoria, entrenar_modelo

chat_voz = Blueprint('chat_voz', __name__)

turnos_registrados = {}
AUDIO_DIR = "citas_audios"

if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURRENT_DIR, "..", "models")
UTILS_DIR = os.path.join(CURRENT_DIR, "..", "utils")

# Rutas a los archivos JSON de opciones, subopciones y prioridades
opciones_path = os.path.join(UTILS_DIR, "opciones.json")
subopciones_path = os.path.join(UTILS_DIR, "subopciones.json")
prioridades_path = os.path.join(UTILS_DIR, "prioridades.json")

with open(opciones_path, encoding="utf-8") as f:
    opciones = json.load(f)

with open(subopciones_path, encoding="utf-8") as f:
    subopciones = json.load(f)

with open(prioridades_path, encoding="utf-8") as f:
    prioridades = json.load(f)

# Función para limpiar nombres de archivos
def sanitize_filename(filename):
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    filename = re.sub(r'[^A-Za-z0-9_\-\.]', '', filename)
    return filename

# Función para guardar datos en un CSV para futuros entrenamientos
def guardar_datos_audio(transcribed_text, opcion_detectada):
    datos_csv = os.path.join(UTILS_DIR, "datos_audio.csv")
    # Si el archivo no existe, escribimos la cabecera
    file_exists = os.path.isfile(datos_csv)
    with open(datos_csv, "a", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow(["texto", "opcion"])
        writer.writerow([transcribed_text, opcion_detectada])

@chat_voz.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        audio_base64 = data.get("audio", "")
        cedula = data.get("cedula", "unknown")
        nombre_usuario = data.get("nombre", "No registrado")

        if not audio_base64:
            return jsonify({"error": "No se recibió audio"}), 400

        # Remover prefijo si existe
        if audio_base64.startswith("data:"):
            audio_base64 = audio_base64.split(",")[1]

        audio_base64 = re.sub(r'[^A-Za-z0-9+/=]', '', audio_base64)
        if len(audio_base64) % 4 == 1:
            return jsonify({"error": "Audio inválido, base64 mal formado"}), 400
        elif len(audio_base64) % 4:
            audio_base64 += '=' * (4 - len(audio_base64) % 4)

        try:
            audio_data = base64.b64decode(audio_base64, validate=True)
        except Exception as e:
            return jsonify({"error": f"Error al decodificar el audio: {str(e)}"}), 400

        # Guardar audio en formato WAV
        fecha_hora = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = sanitize_filename(f"{cedula}_{fecha_hora}.wav")
        filepath = os.path.join(AUDIO_DIR, filename)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(audio_data)

        print(f"✅ Audio guardado en {filepath}")

        # 🔊 Transcripción simulada (aquí se integraría el servicio de reconocimiento de voz)
        transcribed_text = "quiero una cita para renovar mi beca en el vicerrectorado"
        texto_normalizado = normalize_text(transcribed_text)

        # Ruta del modelo y del CSV de datos
        modelo_path = os.path.join(MODELS_DIR, "modelo_categorias.pkl")
        datos_csv = os.path.join(UTILS_DIR, "datos_audio.csv")
        
        # Si el modelo no existe, se entrena inicialmente (se crea un CSV con datos de ejemplo si es necesario)
        if not os.path.exists(modelo_path):
            print("El modelo no existe. Entrenando modelo inicial...")
            if not os.path.exists(datos_csv):
                with open(datos_csv, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(["texto", "opcion"])
                    writer.writerow(["quiero una cita para renovar mi beca en el vicerrectorado", "Becas y Ayudas Económicas"])
            entrenar_modelo(datos_csv, modelo_path)
        
        # 🧠 Predecir categoría utilizando el modelo previamente entrenado
        opcion_detectada = predecir_categoria(texto_normalizado, modelo_path)

        # Guardar los datos del audio para entrenamiento futuro
        guardar_datos_audio(transcribed_text, opcion_detectada)

        # ENTRENAMIENTO AUTOMÁTICO: Reentrena el modelo con los datos actualizados
        entrenar_modelo(datos_csv, modelo_path)

        # 🔍 Detectar subopción y detalle
        subopcion_detectada = "No detectado"
        detalle_detectado = "No detectado"

        for opcion_id, subops in subopciones.items():
            if opciones.get(opcion_id) == opcion_detectada:
                for subop, detalles in subops.items():
                    if subop.lower() in texto_normalizado:
                        subopcion_detectada = subop
                        for detalle in detalles:
                            if detalle.lower() in texto_normalizado:
                                detalle_detectado = detalle
                                break
                        break
                break

        palabra_clave = prioridades.get(opcion_detectada, {}).get("clave", "XX")
        if palabra_clave not in turnos_registrados:
            turnos_registrados[palabra_clave] = 1
        else:
            turnos_registrados[palabra_clave] += 1
        turno = f"{palabra_clave}{turnos_registrados[palabra_clave]:03d}"

        cita = {
            "usuario": nombre_usuario,
            "cedula": cedula,
            "opcion": opcion_detectada,
            "subopcion": subopcion_detectada,
            "detalle": detalle_detectado,
            "palabra_clave": palabra_clave,
            "turno": turno,
            "mensaje": f"{nombre_usuario} quiere agendar una cita para {opcion_detectada} sobre {subopcion_detectada} en {detalle_detectado}. Su turno es {turno}."
        }

        return jsonify({
            "message": "Audio recibido correctamente",
            "filename": filename,
            "cita": cita
        })

    except Exception as e:
        print(f"❌ Error en process_audio: {str(e)}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

@chat_voz.route('/train_model', methods=['POST'])
def train_model():
    try:
        ruta_csv = os.path.join(UTILS_DIR, "datos_audio.csv")
        modelo_path = os.path.join(MODELS_DIR, "modelo_categorias.pkl")
        entrenar_modelo(ruta_csv, modelo_path)
        return jsonify({"message": "Modelo entrenado exitosamente"})
    except Exception as e:
        return jsonify({"error": f"Error al entrenar el modelo: {str(e)}"}), 500
