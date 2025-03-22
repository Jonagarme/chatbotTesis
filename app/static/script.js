document.addEventListener("DOMContentLoaded", function() {
    let step = 0;
    let userData = { nombre: "", cedula: "", opcion: "", subopcion: "", detalle: "" };
    let inactivityTimer;
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const chatBody = document.getElementById("chat-body");
    const micButton = document.getElementById("mic-button");
    const chatTitle = document.getElementById("chat-title");

    micButton.disabled = true; 
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let manuallyStopped = false;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(resetChat, 300000);
    }

    function resetChat() {
        step = 0;
        userData = { nombre: "", cedula: "", opcion: "", subopcion: "", detalle: "" };
        chatTitle.textContent = "Asistente Virtual";
        chatBody.innerHTML = '<p id="chat-message">¡Hola! Para continuar, ingresa tu nombre:</p>';
        micButton.disabled = true; 
    }
    
    document.getElementById("chat-button").addEventListener("click", function() {
        document.getElementById("chat-container").style.display = "flex";
        resetInactivityTimer();
    });

    document.getElementById("close-chat").addEventListener("click", function() {
        document.getElementById("chat-container").style.display = "none";
    });
    
    sendButton.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
    
        appendMessage(message, true);
        chatInput.value = "";
    
        if (step === 0) {
            userData.nombre = message; 
        } else if (step === 1) {
            userData.cedula = message;
        }
    
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: step, userData: userData })
        })
        .then(response => response.json())
        .then(data => {
            if (step === 0) {
                step = 1;
                chatBody.innerHTML = `<p>Gracias, ${userData.nombre}. Ahora ingresa tu cédula:</p>`;
            } else if (step === 1 && data.step === 1) {
                chatBody.innerHTML = `<p id="chat-message">${data.response}</p>`;
            } else if (step === 1 && data.step === 2) {
                chatTitle.textContent = "Bienvenido, " + userData.nombre;
                micButton.disabled = false;
                showMainOptions();
            } else {
                appendMessage(data.response);
            }
            step = data.step;
        })
        .catch(error => console.error("Error en la solicitud:", error));
    }

    // **Mostrar Opciones Principales**
    window.showMainOptions = function() {
        chatBody.innerHTML = `<p>¡Bienvenido, ${userData.nombre}! Selecciona una opción para agendar una cita:</p>`;
        let options = {
            "1": "Ofertas Académicas",
            "2": "Becas y Ayudas Económicas",
            "3": "Requisitos de Inscripción",
            "4": "Cambio de Carrera",
            "5": "Atención en el Vicerrectorado"
        };

        for (let key in options) {
            chatBody.innerHTML += `<button class="chat-option" onclick="sendOption('${key}', '${options[key]}')">${options[key]}</button>`;
        }
    };

// 🎤 **Habilitar reconocimiento de voz**
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "es-ES";
recognition.continuous = false; 
recognition.interimResults = false; 

let isRecognizing = false;

recognition.onstart = function() {
    isRecognizing = true;
    console.log("🎤 Escuchando...");
};

recognition.onend = function() {
    isRecognizing = false;
    console.log("🎤 Reconocimiento detenido.");
};

// recognition.onresult = function(event) {
//     const transcript = event.results[0][0].transcript;
//     sendAudioToServer(transcript);  // Enviar directamente al servidor
// };

// 🎤 **Capturar audio y enviarlo a Flask**
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const mediaRecorder = new MediaRecorder(stream);

    micButton.addEventListener("click", function() {
        if (!userData.cedula) {
            alert("⚠️ Debes ingresar tu cédula antes de usar el micrófono.");
            return;
        }

        if (!isRecording) {
            // ✅ Iniciar grabación
            manuallyStopped = false;
            recognition.start();
            mediaRecorder.start();
            isRecording = true;
            audioChunks = [];
            micButton.textContent = "⏹️";
            console.log("🎤 Grabando...");
        } else {
            // ✅ Detener grabación
            manuallyStopped = true;
            recognition.stop();
            mediaRecorder.stop();
            isRecording = false;
            micButton.textContent = "🎤";
            console.log("🎤 Grabación detenida.");
        }
    });

    // 👂 Capturar fragmentos de audio
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    // 📤 Enviar al servidor cuando se detiene manualmente
    mediaRecorder.onstop = () => {
        if (manuallyStopped) {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const reader = new FileReader();

            reader.onloadend = function() {
                const base64Audio = reader.result.split(",")[1];
                sendAudioToServer(base64Audio, userData.cedula, userData.nombre);
            };

            reader.readAsDataURL(audioBlob);
        } else {
            console.log("🛑 Grabación detenida automáticamente, pero ignorada.");
        }
    };

    // 🧠 Si el reconocimiento termina por sí solo, ignorarlo a menos que sea manual
    recognition.onend = () => {
        if (!manuallyStopped) {
            console.log("🔕 Reconocimiento terminado automáticamente, pero ignorado.");
            return;
        }
    };
});

    // **Enviar el audio en Base64 al servidor**
    function sendAudioToServer(base64Audio, cedula) {
        fetch("/process_audio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ audio: base64Audio, cedula: cedula, nombre: userData.nombre })  // Se envía el nombre del usuario
        })
        .then(response => response.json())
        .then(data => {
            console.log("🎤 Respuesta del servidor:", data);

            if (data.cita) {
                const mensajeFinal = data.cita.mensaje;  // Mensaje generado con la cita
                appendMessage(mensajeFinal, false);  // Mostrar en el chat
                
                // Mostrar también el turno en un mensaje separado
                const turnoMensaje = `🗓️ Tu turno es: ${data.cita.turno}`;
                appendMessage(turnoMensaje, false);
            }
        })
        .catch(error => console.error("Error enviando audio:", error));
    }


    // **Enviar opción principal**
    window.sendOption = function(option, optionName) {
        appendMessage(`Has seleccionado: ${optionName}`);
        userData.opcion = optionName;
        chatBody.innerHTML = '<p>Selecciona una subopción:</p>';
        
        let subOptions = {
            "Ofertas Académicas": ["Pregrado", "Posgrado"],
            "Becas y Ayudas Económicas": ["Requisitos para becas", "Renovación de becas"],
            "Requisitos de Inscripción": ["Documentos requeridos", "Fechas de inscripción"],
            "Cambio de Carrera": ["Procedimiento", "Plazos y requisitos"],
            "Atención en el Vicerrectorado": ["Horario de atención", "Contacto del vicerrectorado"]
        };

        if (subOptions[optionName]) {
            subOptions[optionName].forEach(sub => {
                chatBody.innerHTML += `<button class="chat-option" onclick="sendSubOption('${optionName}', '${sub}')">${sub}</button>`;
            });
        }

        // **Botón Volver**
        chatBody.innerHTML += `<button class="chat-option" onclick="showMainOptions()">↩ Volver</button>`;
    };

    // **Enviar subopción**
    window.sendSubOption = function(option, subOptionName) {
        appendMessage(`Has seleccionado: ${subOptionName}`);
        userData.subopcion = subOptionName;
        chatBody.innerHTML = '<p>Selecciona un detalle:</p>';

        let detailOptions = {
            "Pregrado": ["Carreras de Ingeniería", "Carreras Sociales", "Carreras de Salud"],
            "Posgrado": ["Maestrías en Tecnología", "Maestrías en Educación", "Maestrías en Administración"],
            "Requisitos para becas": ["Becas completas", "Becas parciales", "Becas deportivas"],
            "Renovación de becas": ["Documentos necesarios", "Plazos de renovación", "Requisitos de renovación"]
        };

        if (detailOptions[subOptionName]) {
            detailOptions[subOptionName].forEach(detail => {
                chatBody.innerHTML += `<button class="chat-option" onclick="sendDetailOption('${subOptionName}', '${detail}')">${detail}</button>`;
            });
        }

        // **Botón Volver**
        chatBody.innerHTML += `<button class="chat-option" onclick="sendOption('${userData.opcion}', '${option}')">↩ Volver</button>`;
    };

    // **Enviar opción final (detalle)**
    window.sendDetailOption = function(subOption, detailName) {
        appendMessage(`Has seleccionado: ${detailName}`);
        userData.detalle = detailName;
    
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: 4, userData: userData })
        })
        .then(response => response.json())
        .then(data => {
            appendMessage(data.response);  // Mostramos el mensaje con el turno asignado
            // Agregar botón de reinicio de conversación
            chatBody.innerHTML += `<button class="chat-option restart-button" onclick="resetChat()">🔄 Reiniciar Conversación</button>`;
            });
    };

    // Función para reiniciar el chat
    window.resetChat = function() {
        step = 0;
        userData = { nombre: "", cedula: "" };
        chatTitle.textContent = "Asistente Virtual";
        chatBody.innerHTML = '<p id="chat-message">¡Hola! Para continuar, ingresa tu nombre:</p>';
        micButton.disabled = true;
    }

    // **Función para agregar mensajes al chat**
    function appendMessage(text, isUser = false) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        if (isUser) messageDiv.classList.add("user-message");
        
        const messageText = document.createElement("p");
        messageText.textContent = text;
        
        const timeStamp = document.createElement("span");
        timeStamp.classList.add("message-time");
        timeStamp.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(messageText);
        messageDiv.appendChild(timeStamp);
        chatBody.appendChild(messageDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
    // Función para disparar el entrenamiento del modelo
    function trainModel() {
        fetch("/train_model", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log("Resultado del entrenamiento:", data);
            if(data.message) {
                appendMessage("✅ Modelo entrenado exitosamente.", false);
            } else if(data.error) {
                appendMessage("❌ Error en el entrenamiento: " + data.error, false);
            }
        })
        .catch(error => console.error("Error al entrenar el modelo:", error));
    }
});