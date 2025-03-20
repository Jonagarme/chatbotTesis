import time
from flask import Blueprint, request, jsonify

chat = Blueprint('chat', __name__)

# Diccionario para almacenar datos del usuario y su última actividad
user_sessions = {}
user_last_activity = {}

SESSION_TIMEOUT = 300  # 5 minutos

@chat.route('/chat', methods=['POST'])
def chats():
    data = request.json
    step = data.get("step", 0)
    user_data = data.get("userData", {})

    print(f"Step: {step}")
    print(f"User data: {user_data}")

    user_id = "temp_user"
    current_time = time.time()

    # Verificar si la sesión del usuario ha expirado
    if user_id in user_last_activity and (current_time - user_last_activity[user_id]) > SESSION_TIMEOUT:
        user_sessions.pop(user_id, None)  # Eliminar sesión del usuario
        user_last_activity.pop(user_id, None)  # Eliminar última actividad
        return jsonify({
            "response": "¡Hola! Para continuar, ingresa tu nombre:",
            "step": 0,
            "userData": {}
        })

    # Actualizar la última actividad del usuario
    user_last_activity[user_id] = current_time

    if user_id not in user_sessions:
        user_sessions[user_id] = {}

    opciones = {
        "1": "Ofertas Académicas",
        "2": "Becas y Ayudas Económicas",
        "3": "Requisitos de Inscripción",
        "4": "Cambio de Carrera",
        "5": "Atención en el Vicerrectorado"
    }

    subopciones = {
        "1": ["Pregrado", "Posgrado"],
        "2": ["Requisitos para becas", "Renovación de becas"],
        "3": ["Documentos requeridos", "Fechas de inscripción"],
        "4": ["Procedimiento", "Plazos y requisitos"],
        "5": ["Horario de atención", "Contacto del vicerrectorado"]
    }

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
        user_sessions[user_id]["subopcion"] = suboption_selected
        response = f"Has seleccionado la subopción: {suboption_selected}."
        next_step = 3  # Se mantiene en las subopciones

    return jsonify({
        "response": response,
        "step": next_step,
        "userData": user_sessions[user_id]  # Retorna toda la sesión del usuario
    })