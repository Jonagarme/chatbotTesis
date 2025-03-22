import time
import json
import os
from flask import Blueprint, request, jsonify

chat = Blueprint('chat', __name__)

# Diccionario para almacenar datos del usuario y su última actividad
user_sessions = {}
user_last_activity = {}
turnos_registrados = {}  # Para manejar turnos secuenciales

SESSION_TIMEOUT = 300  # 5 minutos

# 📌 Prioridades con claves
prioridades = {
    "Ofertas Académicas": {"clave": "OF"},
    "Becas y Ayudas Económicas": {"clave": "BE"},
    "Requisitos de Inscripción": {"clave": "RI"},
    "Cambio de Carrera": {"clave": "CC"},
    "Atención en el Vicerrectorado": {"clave": "AV"},
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UTILS_DIR = os.path.join(BASE_DIR, "..", "utils")  # <-- ojo con ".."

with open(os.path.join(UTILS_DIR, "opciones.json"), encoding="utf-8") as f:
    opciones = json.load(f)

with open(os.path.join(UTILS_DIR, "subopciones.json"), encoding="utf-8") as f:
    subopciones = json.load(f)


@chat.route('/chat', methods=['POST'])
def chats():
    data = request.json
    step = data.get("step", 0)
    user_data = data.get("userData", {})

    print(f"Step: {step}")
    print(f"User data: {user_data}")

    user_id = "temp_user"
    current_time = time.time()

    if user_id in user_last_activity and (current_time - user_last_activity[user_id]) > SESSION_TIMEOUT:
        user_sessions.pop(user_id, None)
        user_last_activity.pop(user_id, None)
        return jsonify({
            "response": "¡Hola! Para continuar, ingresa tu nombre:",
            "step": 0,
            "userData": {}
        })

    user_last_activity[user_id] = current_time

    if user_id not in user_sessions:
        user_sessions[user_id] = {}

    response = ""
    next_step = step

    if step == 0:
        user_sessions[user_id]["nombre"] = user_data.get("nombre", "")
        response = f"Gracias, {user_sessions[user_id]['nombre']}. Ahora ingresa tu cédula:"
        next_step = 1

    elif step == 1:
        cedula = user_data.get("cedula", "").strip()
        if not cedula.isdigit() or len(cedula) != 10:
            response = "Por favor, ingresa exactamente 10 dígitos numéricos para la cédula."
            next_step = 1
        else:
            user_sessions[user_id]["cedula"] = cedula
            response = f"¡Bienvenido, {user_sessions[user_id]['nombre']}! Selecciona una opción para agendar una cita:"
            next_step = 2

    elif step == 2:
        option_selected = user_data.get("opcion", "")
        if option_selected in opciones.values():
            user_sessions[user_id]["opcion"] = option_selected
            response = f"Has seleccionado: {option_selected}. Ahora elige una subopción:"
            subopts = list(subopciones.values())[list(opciones.values()).index(option_selected)]
            response += " | ".join(subopts)
            next_step = 3
        else:
            response = "Por favor, selecciona una opción válida."
            next_step = 2

    elif step == 3:
        suboption_selected = user_data.get("subopcion", "")
        main_option = str(list(opciones.keys())[list(opciones.values()).index(user_sessions[user_id]["opcion"])])
        if suboption_selected in subopciones[main_option]:
            user_sessions[user_id]["subopcion"] = suboption_selected
            response = f"Has seleccionado la subopción: {suboption_selected}. Ahora elige un detalle:"
            response += " | ".join(subopciones[main_option][suboption_selected])
            next_step = 4
        else:
            response = "Por favor, selecciona una subopción válida."
            next_step = 3

    elif step == 4:
        opcion = user_sessions[user_id].get("opcion", "Desconocido")
        subopcion = user_sessions[user_id].get("subopcion", "Desconocido")
        detalle = user_data.get("detalle", "Desconocido")
        prioridad = prioridades.get(opcion, {"clave": "XX"})

        palabra_clave = prioridad["clave"]
        if palabra_clave not in turnos_registrados:
            turnos_registrados[palabra_clave] = 1
        else:
            turnos_registrados[palabra_clave] += 1
        turno = f"{palabra_clave}{turnos_registrados[palabra_clave]:03d}"

        resultado_json = {
            "usuario": user_sessions[user_id].get("nombre", "Usuario desconocido"),
            "cedula": user_sessions[user_id].get("cedula", "0000000000"),
            "opcion": opcion,
            "subopcion": subopcion,
            "detalle": detalle,
            "palabra_clave": palabra_clave,
            "turno": turno,
            "mensaje": f"{user_sessions[user_id].get('nombre', 'El usuario')} quiere agendar una cita para {opcion} sobre el tema {subopcion} en {detalle}. Su turno es {turno}."
        }

        return jsonify({
            "response": resultado_json["mensaje"],
            "step": next_step,
            "userData": resultado_json
        })

    return jsonify({
        "response": response,
        "step": next_step,
        "userData": user_sessions[user_id]
    })