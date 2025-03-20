import base64
from datetime import datetime
import io
import time
import wave
from flask import Blueprint, request, jsonify

chat_voz = Blueprint('chat_voz', __name__)

@chat_voz.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No se recibió ningún dato"}), 400

        audio_base64 = data.get("audio", "")
        cedula = data.get("cedula", "unknown")  # Si no hay cédula, usa "unknown"

        if not audio_base64:
            return jsonify({"error": "No se recibió audio"}), 400

        # **Decodificar Base64**
        audio_data = base64.b64decode(audio_base64)
        audio_file = io.BytesIO(audio_data)

        # **Generar nombre de archivo usando la cédula y la fecha/hora actual**
        fecha_hora = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{cedula}_{fecha_hora}.wav"

        # **Guardar el archivo**
        with wave.open(filename, "wb") as wf:
            wf.setnchannels(1)  # Audio mono
            wf.setsampwidth(2)  # 16 bits
            wf.setframerate(44100)  # 44.1 kHz
            wf.writeframes(audio_file.read())

        print(f"✅ Archivo guardado: {filename}")

        return jsonify({"message": "Audio recibido correctamente", "filename": filename})

    except Exception as e:
        print(f"❌ Error en process_audio: {str(e)}")  # Imprimir error en la consola
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500