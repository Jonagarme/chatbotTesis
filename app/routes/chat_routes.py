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
        detail_selected = user_data.get("detalle", "")
        user_sessions[user_id]["detalle"] = detail_selected
        response = f"Has seleccionado la opción final: {detail_selected}. ¡Gracias por usar el asistente!"
        next_step = 4
    return jsonify({
        "response": response,
        "step": next_step,
        "userData": user_sessions[user_id]  # Retorna toda la sesión del usuario
    })