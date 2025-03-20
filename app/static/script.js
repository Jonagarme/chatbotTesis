document.addEventListener("DOMContentLoaded", function() {
    let step = 0;
    let userData = { nombre: "", cedula: "" };
    let inactivityTimer;
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const chatBody = document.getElementById("chat-body");
    const micButton = document.getElementById("mic-button");
    const chatMessage = document.getElementById("chat-message");
    const chatTitle = document.getElementById("chat-title");
    
    micButton.disabled = true; 
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(resetChat, 300000);
    }

    function resetChat() {
        step = 0;
        userData = { nombre: "", cedula: "" };
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
    
        // 1. Asignamos los datos a userData según el step
        if (step === 0) {
            userData.nombre = message; 
        } else if (step === 1) {
            userData.cedula = message;
        }
    
        // 2. Ahora sí enviamos el fetch con userData completo
        fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: message, step: step, userData: userData })
        })
        .then(response => response.json())
        .then(data => {
            // Manejo de la respuesta del servidor
            if (step === 0) {
                step = 1;
                chatBody.innerHTML = `<p>Gracias, ${userData.nombre}. Ahora ingresa tu cédula:</p>`;
            } else if (step === 1 && data.step === 1) {
                // Quedamos en el mismo step si hay error en la cédula
                chatBody.innerHTML = `<p id="chat-message">${data.response}</p>`;
            } else if (step === 1 && data.step === 2) {
                // Si el servidor acepta la cédula y avanza a step=2
                chatTitle.textContent = "Bienvenido, " + userData.nombre;
                micButton.disabled = false; // Habilita el micrófono después de validar la cédula
                showMainOptions();
            } else {
                appendMessage(data.response);
            }
    
            step = data.step;
        })
        .catch(error => console.error("Error en la solicitud:", error));
    }
    
    
    window.showMainOptions = function() {
        chatBody.innerHTML = `<p>¡Bienvenido, ${userData.nombre}! Selecciona una opción para agendar una cita:</p>`;
        chatBody.innerHTML += '<button class="chat-option" onclick="sendOption(\'1\', \'Ofertas Académicas\')">Ofertas Académicas</button>';
        chatBody.innerHTML += '<button class="chat-option" onclick="sendOption(\'2\', \'Becas y Ayudas Económicas\')">Becas y Ayudas Económicas</button>';
        chatBody.innerHTML += '<button class="chat-option" onclick="sendOption(\'3\', \'Requisitos de Inscripción\')">Requisitos de Inscripción</button>';
        chatBody.innerHTML += '<button class="chat-option" onclick="sendOption(\'4\', \'Cambio de Carrera\')">Cambio de Carrera</button>';
        chatBody.innerHTML += '<button class="chat-option" onclick="sendOption(\'5\', \'Atención en el Vicerrectorado\')">Atención en el Vicerrectorado</button>';
    }

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

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        sendMessage();
    };

    // 🎤 **Capturar audio y enviarlo a Flask**
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        
        micButton.addEventListener("click", function() {
            if (!userData.cedula) {
                alert("⚠️ Debes ingresar tu cédula antes de usar el micrófono.");
                return;
            }

            if (!isRecording) {
                // 🎤 **Iniciar grabación y reconocimiento**
                recognition.start();
                mediaRecorder.start();
                isRecording = true;
                audioChunks = [];
                micButton.textContent = "⏹️";  // Cambiar icono a stop
                console.log("🎤 Grabando...");
            } else {
                // ⏹️ **Detener grabación y reconocimiento**
                recognition.stop();
                mediaRecorder.stop();
                isRecording = false;
                micButton.textContent = "🎤";  // Restaurar icono de micrófono
                console.log("🎤 Grabación detenida.");
            }
        });

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const reader = new FileReader();

            reader.onloadend = function() {
                const base64Audio = reader.result.split(",")[1]; // Obtener el Base64 sin el prefijo
                sendAudioToServer(base64Audio,  userData.cedula);
            };

            reader.readAsDataURL(audioBlob);
        };

        micButton.addEventListener("dblclick", function() {
            mediaRecorder.stop();
            console.log("🎤 Grabación detenida.");
        });
    });

    // **Enviar el audio en Base64 al servidor**
    function sendAudioToServer(base64Audio, cedula) {
        fetch("/process_audio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ audio: base64Audio, cedula: cedula })
        })
        .then(response => response.json())
        .then(data => {
            console.log("🎤 Respuesta del servidor:", data);
        })
        .catch(error => console.error("Error enviando audio:", error));
    }



    // Función para enviar la opción principal (1, 2, 3, etc.)
    window.sendOption = function(option, optionName) {
        appendMessage(`Has seleccionado: ${optionName}`);
        chatBody.innerHTML += '<p>Selecciona una subopción:</p>';
        
        let subOptions = {
            '1': ["Pregrado", "Posgrado"],
            '2': ["Requisitos para becas", "Renovación de becas"],
            '3': ["Documentos requeridos", "Fechas de inscripción"],
            '4': ["Procedimiento", "Plazos y requisitos"],
            '5': ["Horario de atención", "Contacto del vicerrectorado"]
        };

        if (subOptions[option]) {
            subOptions[option].forEach((sub, index) => {
                chatBody.innerHTML += `<button class="chat-option" onclick="sendSubOption('${option}', '${sub}')">${sub}</button>`;
            });
            chatBody.innerHTML += `<button class="chat-option" onclick="showMainOptions()">↩ Volver</button>`;
        }
    };


    // Función para enviar la subopción (por ejemplo, 1.1, 1.2, etc.)
    window.sendSubOption = function(option, subOptionName) {
        userData.subopcion = subOptionName;
        appendMessage(`Has seleccionado: ${subOptionName}`);
        
        fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ step: 3, userData: userData })
        });
    };

    function appendMessage(text, isUser = false) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        if (isUser) {
            messageDiv.classList.add("user-message");
        }
        
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
});
