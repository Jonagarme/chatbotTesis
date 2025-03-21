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
            appendMessage(data.response);
        });
    };

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
});
