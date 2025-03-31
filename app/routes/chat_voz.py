import base64
import csv
from datetime import datetime
import os
import re
import unicodedata
import wave
import requests
from flask import Blueprint, request, jsonify
from app.utils.preprocesamiento import normalize_text
from app.utils.model_utils import (
    entrenar_modelo_modalidad,
    predecir_modalidad,
    entrenar_modelo_tipo_cita,
    predecir_tipo_cita
)

chat_voz = Blueprint('chat_voz', __name__)

turnos_registrados = {}
AUDIO_DIR = "citas_audios"

if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURRENT_DIR, "..", "models")
UTILS_DIR = os.path.join(CURRENT_DIR, "..", "utils")


def sanitize_filename(filename):
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    filename = re.sub(r'[^A-Za-z0-9_\-\.]', '', filename)
    return filename


def guardar_datos(texto, modalidad, tipo_cita):
    datos_csv = os.path.join(UTILS_DIR, "datos_modalidad.csv")
    file_exists = os.path.isfile(datos_csv)
    with open(datos_csv, "a", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            writer.writerow(["texto", "modalidad", "tipo_cita"])
        writer.writerow([texto, modalidad, tipo_cita])


@chat_voz.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        audio_base64 = data.get("audio", "")
        cedula = data.get("cedula", "unknown")
        nombre_usuario = data.get("nombre", "No registrado")

        if not audio_base64:
            return jsonify({"error": "No se recibio audio"}), 400

        if audio_base64.startswith("data:"):
            audio_base64 = audio_base64.split(",")[1]

        audio_base64 = re.sub(r'[^A-Za-z0-9+/=]', '', audio_base64)
        if len(audio_base64) % 4 == 1:
            return jsonify({"error": "Audio invalido"}), 400
        elif len(audio_base64) % 4:
            audio_base64 += '=' * (4 - len(audio_base64) % 4)

        audio_data = base64.b64decode(audio_base64, validate=True)
        fecha_hora = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = sanitize_filename(f"{cedula}_{fecha_hora}.wav")
        filepath = os.path.join(AUDIO_DIR, filename)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(audio_data)

        print(f"✅ Audio guardado: {filepath}")

        transcribed_text = "quiero agendar una cita en el departamento academico sobre reuniones con TH en modalidad hibrida"
        texto_normalizado = normalize_text(transcribed_text)

        modalidad_model_path = os.path.join(MODELS_DIR, "modelo_modalidad.pkl")
        tipo_model_path = os.path.join(MODELS_DIR, "modelo_tipo_cita.pkl")
        datos_csv = os.path.join(UTILS_DIR, "datos_modalidad.csv")

        if not os.path.exists(modalidad_model_path) or not os.path.exists(tipo_model_path):
            print("Modelo no encontrado, creando dataset inicial...")
            with open(datos_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["texto", "modalidad", "tipo_cita"])
                writer.writerow([transcribed_text, "Hibrida", "Reuniones con TH"])
            entrenar_modelo_modalidad(datos_csv, modalidad_model_path)
            entrenar_modelo_tipo_cita(datos_csv, tipo_model_path)

        res_modalidades = requests.get("http://127.0.0.1:8000/api/modalidades_citas")
        res_tipos = requests.get("http://127.0.0.1:8000/api/tipos_citas")
        modalidades = res_modalidades.json()
        tipos = res_tipos.json()

        modalidad_detectada = predecir_modalidad(texto_normalizado, modalidad_model_path)
        tipo_detectado = predecir_tipo_cita(texto_normalizado, tipo_model_path)

        id_modalidad = next((m["id_modalidad"] for m in modalidades if m["nombre_modalidad"].lower() == modalidad_detectada.lower()), 1)
        id_tipo_cita = next((t["id_tipo_cita"] for t in tipos if t["nombre_tipo_cita"].lower() == tipo_detectado.lower()), 1)

        guardar_datos(transcribed_text, modalidad_detectada, tipo_detectado)
        entrenar_modelo_modalidad(datos_csv, modalidad_model_path)
        entrenar_modelo_tipo_cita(datos_csv, tipo_model_path)

        turno = f"{modalidad_detectada[:2].upper()}{datetime.now().strftime('%H%M')}"

        cita = {
            "usuario": nombre_usuario,
            "cedula": cedula,
            "modalidad": modalidad_detectada,
            "tipo_cita": tipo_detectado,
            "id_modalidad": id_modalidad,
            "id_tipo_cita": id_tipo_cita,
            "turno": turno,
            "mensaje": f"{nombre_usuario} quiere agendar una cita del tipo '{tipo_detectado}' en modalidad {modalidad_detectada}. Su turno es {turno}."
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
        ruta_csv = os.path.join(UTILS_DIR, "datos_modalidad.csv")
        entrenar_modelo_modalidad(ruta_csv, os.path.join(MODELS_DIR, "modelo_modalidad.pkl"))
        entrenar_modelo_tipo_cita(ruta_csv, os.path.join(MODELS_DIR, "modelo_tipo_cita.pkl"))
        return jsonify({"message": "Modelos entrenados exitosamente"})
    except Exception as e:
        return jsonify({"error": f"Error al entrenar modelos: {str(e)}"}), 500
