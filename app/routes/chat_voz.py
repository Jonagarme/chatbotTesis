import base64
import csv
from datetime import datetime, timedelta
import os
import re
import unicodedata
import wave
import requests
from flask import Blueprint, request, jsonify
from google.oauth2 import service_account
from googleapiclient.discovery import build
import speech_recognition as sr

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


def convertir_audio_a_texto(ruta_audio):
    r = sr.Recognizer()
    with sr.AudioFile(ruta_audio) as source:
        audio_data = r.record(source)
    try:
        texto = r.recognize_google(audio_data, language="es-ES")
        return texto
    except sr.UnknownValueError:
        return ""
    except sr.RequestError as e:
        print(f"Error al llamar a la API de reconocimiento: {e}")
        return ""


def sanitize_filename(filename):
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    filename = re.sub(r'[^A-Za-z0-9_\-\.]', '', filename)
    return filename

def extraer_modalidad_y_tipo_cita(texto):
    texto_limpio = texto.lower()

    # Detectar modalidad
    if "modalidad presencial" in texto_limpio:
        modalidad = "Presencial"
        texto = texto.replace("modalidad presencial", "").strip()
    elif "modalidad híbrida" in texto_limpio or "modalidad hibrida" in texto_limpio:
        modalidad = "Híbrida"
        texto = texto.replace("modalidad híbrida", "").replace("modalidad hibrida", "").strip()
    else:
        modalidad = "Desconocida"

    # Detectar tipo de cita (ejemplos personalizables)
    if "departamento académico" in texto_limpio:
        tipo_cita = "Departamento Académico"
    elif "departamento de investigación" in texto_limpio:
        tipo_cita = "Departamento de Investigación"
    elif "reuniones externas" in texto_limpio:
        tipo_cita = "Reuniones Externas"
    elif "visitas institucionales" in texto_limpio:
        tipo_cita = "Visitas Institucionales"
    else:
        tipo_cita = "Desconocida"

    return texto.strip(), modalidad, tipo_cita


def guardar_datos(texto, modalidad, tipo_cita):
    datos_csv = os.path.join(UTILS_DIR, "datos_modalidad.csv")
    file_exists = os.path.isfile(datos_csv)
    with open(datos_csv, "a", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)
        if not file_exists:
            writer.writerow(["texto", "modalidad", "tipo_cita"])
        writer.writerow([texto.strip(), modalidad.strip(), tipo_cita.strip()])


def crear_evento_google_calendar(nombre, correo, tipo_cita, modalidad, fecha_inicio, fecha_fin):
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    SERVICE_ACCOUNT_FILE = 'credentials.json'

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)

    service = build('calendar', 'v3', credentials=credentials)

    evento = {
        'summary': f'Cita: {tipo_cita} - {modalidad}',
        'description': f'Cita agendada por {nombre} ({correo})',
        'start': {
            'dateTime': fecha_inicio,
            'timeZone': 'America/Guayaquil',
        },
        'end': {
            'dateTime': fecha_fin,
            'timeZone': 'America/Guayaquil',
        },
        'attendees': [{'email': correo}],
    }

    evento_creado = service.events().insert(calendarId='primary', body=evento).execute()
    print(f"✅ Evento creado: {evento_creado.get('htmlLink')}")
    return evento_creado.get('htmlLink')


@chat_voz.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        audio_base64 = data.get("audio", "")
        cedula = data.get("cedula", "unknown")
        nombre_usuario = data.get("nombre", "No registrado")

        if not audio_base64:
            return jsonify({"error": "No se recibió audio"}), 400

        # Quitar encabezado "data:audio/wav;base64," si existe
        if audio_base64.startswith("data:"):
            audio_base64 = audio_base64.split(",")[1]

        # Limpiar base64
        audio_base64 = re.sub(r'[^A-Za-z0-9+/=]', '', audio_base64)
        if len(audio_base64) % 4 == 1:
            return jsonify({"error": "Audio inválido"}), 400
        elif len(audio_base64) % 4:
            audio_base64 += '=' * (4 - len(audio_base64) % 4)

        # Decodificar base64
        audio_data = base64.b64decode(audio_base64, validate=True)

        # Guardar directamente como .wav
        fecha_hora = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = sanitize_filename(f"{cedula}_{fecha_hora}.wav")
        filepath = os.path.join(AUDIO_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(audio_data)

        # Validar que el archivo WAV sea válido
        try:
            with wave.open(filepath, "rb") as wf:
                print(f"✅ Audio válido: {wf.getnchannels()} canales, {wf.getframerate()} Hz")
        except wave.Error as e:
            return jsonify({"error": f"Archivo de audio inválido: {str(e)}"}), 400

        print(f"✅ Audio guardado: {filepath}")

        # Transcripción
        transcribed_text = convertir_audio_a_texto(filepath)
        texto_normalizado = normalize_text(transcribed_text)

        if not texto_normalizado.strip():
            return jsonify({
                "error": "No se pudo transcribir el audio o el texto está vacío. Verifique la calidad del audio."
            }), 400

        modalidad_model_path = os.path.join(MODELS_DIR, "modelo_modalidad.pkl")
        tipo_model_path = os.path.join(MODELS_DIR, "modelo_tipo_cita.pkl")
        datos_csv = os.path.join(UTILS_DIR, "datos_modalidad.csv")
        # POR ESTE:
        if not os.path.exists(modalidad_model_path) or not os.path.exists(tipo_model_path):
            print("⚠️ Modelos no encontrados. Creando dataset inicial...")
            with open(datos_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["texto", "modalidad", "tipo_cita"])
                writer.writerow([transcribed_text.strip(), "Desconocida", "Desconocida"])
            entrenar_modelo_modalidad(datos_csv, modalidad_model_path)
            entrenar_modelo_tipo_cita(datos_csv, tipo_model_path)

        try:
            modalidades = requests.get("http://127.0.0.1:8000/api/modalidades_citas").json()
            tipos = requests.get("http://127.0.0.1:8000/api/tipos_citas").json()
        except Exception as e:
            return jsonify({"error": "No se pudo acceder a las APIs de modalidades o tipos"}), 500

        # modalidad_detectada = predecir_modalidad(texto_normalizado, modalidad_model_path)
        # tipo_detectado = predecir_tipo_cita(texto_normalizado, tipo_model_path)

        texto_preprocesado, modalidad_detectada, tipo_detectado = extraer_modalidad_y_tipo_cita(transcribed_text)

        id_modalidad = next(
            (m["id_modalidad"] for m in modalidades
             if m["nombre_modalidad"].lower() == modalidad_detectada.lower()),
            1
        )
        id_tipo_cita = next(
            (t["id_tipo_cita"] for t in tipos
             if t["nombre_tipo_cita"].lower() == tipo_detectado.lower()),
            1
        )

        guardar_datos(texto_preprocesado, modalidad_detectada, tipo_detectado)
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

        try:
            fecha_inicio = datetime.now()
            fecha_fin = fecha_inicio + timedelta(hours=1)
            crear_evento_google_calendar(
                nombre=nombre_usuario,
                correo=data.get("email", "noemail@ejemplo.com"),
                tipo_cita=tipo_detectado,
                modalidad=modalidad_detectada,
                fecha_inicio=fecha_inicio.isoformat(),
                fecha_fin=fecha_fin.isoformat()
            )
            print(f"✅ Evento creado en Google Calendar: {cita['mensaje']}")
        except Exception as e:
            print(f"⚠️ Error al crear evento en Google Calendar: {str(e)}")

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
