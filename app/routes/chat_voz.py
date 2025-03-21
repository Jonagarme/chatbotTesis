import base64
from datetime import datetime
import io
import os
import re
import time
import unicodedata
import wave
from flask import Blueprint, request, jsonify

chat_voz = Blueprint('chat_voz', __name__)

turnos_registrados = {}

# 📂 Directorio donde se guardarán los audios
AUDIO_DIR = "citas_audios"

# Si no existe la carpeta `citas_audios`, la creamos
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

opciones = {
    "1": "Ofertas Académicas",
    "2": "Becas y Ayudas Económicas",
    "3": "Requisitos de Inscripción",
    "4": "Cambio de Carrera",
    "5": "Atención en el Vicerrectorado"
}

subopciones = {
    "1": {
        "Pregrado": ["Carreras de Ingeniería", "Carreras Sociales", "Carreras de Salud"],
        "Posgrado": ["Maestrías en Tecnología", "Maestrías en Educación", "Maestrías en Administración"]
    },
    "2": {
        "Requisitos para becas": ["Becas completas", "Becas parciales", "Becas deportivas"],
        "Renovación de becas": ["Documentos necesarios", "Plazos de renovación", "Requisitos de renovación"]
    },
    "3": {
        "Documentos requeridos": ["Acta de nacimiento", "Certificado de estudios", "Comprobante de domicilio"],
        "Fechas de inscripción": ["Fechas de preinscripción", "Fechas de examen de admisión", "Fechas de inscripción final"]
    },
    "4": {
        "Procedimiento": ["Solicitud en línea", "Evaluación de requisitos", "Confirmación de cambio"],
        "Plazos y requisitos": ["Fechas límite", "Materias convalidables", "Criterios de aceptación"]
    },
    "5": {
        "Horario de atención": ["Lunes a viernes", "Sábados", "Feriados"],
        "Contacto del vicerrectorado": ["Correo electrónico", "Teléfono", "Oficinas físicas"]
    }
}

# 🔎 Palabras clave relacionadas con cada opción
keywords = {
    "Ofertas Académicas": ["pregrado", "posgrado", "carrera", "ingeniería", "sociales", "salud", "maestría"],
    "Becas y Ayudas Económicas": ["beca", "ayuda", "económica", "renovación", "postular", "requisitos"],
    "Requisitos de Inscripción": ["documento", "acta", "certificado", "inscripción", "admisión"],
    "Cambio de Carrera": ["cambio", "traslado", "convalidación", "materia", "aceptación"],
    "Atención en el Vicerrectorado": ["vicerrectorado", "contacto", "horario", "consulta", "correo", "teléfono"]
}

# 📌 Función para limpiar nombres de archivo
def sanitize_filename(filename):
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    filename = re.sub(r'[^A-Za-z0-9_\-\.]', '', filename)  # Permite solo letras, números, guiones y puntos
    return filename

# 📌 Función para normalizar texto
def normalize_text(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^A-Za-z0-9\s]', '', text)
    return text.lower()

# 📌 Procesar audio, guardar y generar JSON de la cita
@chat_voz.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No se recibió ningún dato"}), 400

        audio_base64 = data.get("audio", "")
        cedula = data.get("cedula", "unknown")
        nombre_usuario = data.get("nombre", "No registrado")

        if not audio_base64:
            return jsonify({"error": "No se recibió audio"}), 400

        # Eliminar posible prefijo 'data:audio/wav;base64,'
        if audio_base64.startswith("data:"):
            audio_base64 = audio_base64.split(",")[1]

        # Filtrar la cadena para dejar solo caracteres válidos en base64:
        audio_base64 = re.sub(r'[^A-Za-z0-9+/=]', '', audio_base64)
        
        # Asegurar que la cadena tenga el padding correcto
        missing_padding = len(audio_base64) % 4
        if missing_padding:
            audio_base64 += '=' * (4 - missing_padding)

        # Decodificar el audio en binario
        try:
            audio_data = base64.b64decode(audio_base64, validate=True)
        except Exception as e:
            return jsonify({"error": f"Error al decodificar el audio: {str(e)}"}), 400

        # Generar nombre de archivo usando la cédula y la fecha/hora actual
        fecha_hora = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = sanitize_filename(f"{cedula}_{fecha_hora}.wav")
        filepath = os.path.join(AUDIO_DIR, filename)

        # Guardar el archivo en citas_audios/
        try:
            with wave.open(filepath, "wb") as wf:
                wf.setnchannels(1)  # Audio mono
                wf.setsampwidth(2)  # 16 bits
                wf.setframerate(44100)  # 44.1 kHz
                wf.writeframes(audio_data)
        except Exception as e:
            return jsonify({"error": f"Error al escribir el archivo de audio: {str(e)}"}), 500

        print(f"✅ Archivo guardado en: {filepath}")

        # 🔍 Simulación de texto transcrito
        transcribed_text = "quiero una cita para renovar mi beca en el vicerrectorado"
        transcribed_text = normalize_text(transcribed_text)

        # 🔎 Procesar el texto y generar la cita
        cita_json = generar_cita_json(cedula, nombre_usuario, transcribed_text)
        
        return jsonify({"message": "Audio recibido correctamente", "filename": filename, "cita": cita_json})

    except Exception as e:
        print(f"❌ Error en process_audio: {str(e)}")
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500

# 📌 Función para extraer datos y generar el JSON de la cita
def generar_cita_json(cedula, nombre_usuario, transcribed_text):
    transcribed_text = transcribed_text.lower()

    opcion_detectada = None
    subopcion_detectada = "No detectado"
    detalle_detectado = "No detectado"

    # 1️⃣ Detectar la opción principal
    for opcion, palabras in keywords.items():
        if any(re.search(r'\b' + re.escape(palabra) + r'\b', transcribed_text) for palabra in palabras):
            opcion_detectada = opcion
            break

    # 2️⃣ Detectar la subopción y detalle si se encuentra la opción principal
    if opcion_detectada:
        for opcion_id, subops in subopciones.items():
            if opciones[opcion_id] == opcion_detectada:
                for subop, detalles in subops.items():
                    if subop.lower() in transcribed_text:
                        subopcion_detectada = subop
                        for detalle in detalles:
                            if detalle.lower() in transcribed_text:
                                detalle_detectado = detalle
                                break
                        break
                break

    # 3️⃣ Generar la palabra clave y turno
    palabra_clave = opcion_detectada[:2].upper() if opcion_detectada else "XX"

    # 4️⃣ Generar el turno secuencial
    if palabra_clave not in turnos_registrados:
        turnos_registrados[palabra_clave] = 1
    else:
        turnos_registrados[palabra_clave] += 1

    turno = f"{palabra_clave}{turnos_registrados[palabra_clave]:03d}"

    # 5️⃣ Generar el JSON de la cita con el nombre del usuario
    return {
        "usuario": nombre_usuario,
        "cedula": cedula,
        "opcion": opcion_detectada or "No detectado",
        "subopcion": subopcion_detectada,
        "detalle": detalle_detectado,
        "palabra_clave": palabra_clave,
        "turno": turno,
        "mensaje": f"{nombre_usuario} quiere agendar una cita para {opcion_detectada} sobre {subopcion_detectada} en {detalle_detectado}. Su turno es {turno}."
    }
