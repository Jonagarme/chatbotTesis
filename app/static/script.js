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
    window.showMainOptions = function () {
        chatBody.innerHTML = `<p>¡Bienvenido, ${userData.nombre}! Selecciona un departamento:</p>`;
    
        fetch("http://127.0.0.1:8000/api/tipos_citas")
            .then(response => response.json())
            .then(data => {
                let departamentos = {};
    
                // Agrupamos por tipo_departamento
                data.forEach(cita => {
                    if (!departamentos[cita.tipo_departamento]) {
                        departamentos[cita.tipo_departamento] = [];
                    }
                    departamentos[cita.tipo_departamento].push(cita);
                });
    
                // Creamos los botones de tipo_departamento
                Object.keys(departamentos).forEach(dep => {
                    chatBody.innerHTML += `<button class="chat-option" onclick='showCitasPorDepartamento(${JSON.stringify(departamentos[dep])})'>${dep}</button>`;
                });
            })
            .catch(error => {
                console.error("Error cargando tipos de cita:", error);
                chatBody.innerHTML += `<p>⚠️ Error al cargar las opciones. Inténtalo más tarde.</p>`;
            });
    };

    window.showCitasPorDepartamento = function(citas) {
        chatBody.innerHTML = "<p>Selecciona un tipo de cita:</p>";
    
        citas.forEach(cita => {
            chatBody.innerHTML += `<button class="chat-option" onclick="seleccionarTipoCita('${cita.nombre_tipo_cita}', ${cita.id_tipo_cita})">${cita.nombre_tipo_cita}</button>`;
        });
    
        // Botón para volver a departamentos
        chatBody.innerHTML += `<button class="chat-option" onclick="showMainOptions()">↩ Volver</button>`;
    };
    
    window.seleccionarTipoCita = function(nombreTipo, idTipo) {
        appendMessage(`Has seleccionado: ${nombreTipo}`);
        userData.opcion = nombreTipo;
        userData.id_tipo_cita = idTipo;
    
        chatBody.innerHTML = `<p>Selecciona una modalidad para tu cita:</p>`;
    
        fetch("http://127.0.0.1:8000/api/modalidades_citas")
            .then(response => response.json())
            .then(modalidades => {
                modalidades.forEach(mod => {
                    chatBody.innerHTML += `<button class="chat-option" onclick="seleccionarModalidad('${mod.nombre_modalidad}', ${mod.id_modalidad})">${mod.nombre_modalidad}</button>`;
                });
    
                chatBody.innerHTML += `<button class="chat-option" onclick="showMainOptions()">↩ Volver</button>`;
            })
            .catch(error => {
                console.error("Error cargando modalidades:", error);
                chatBody.innerHTML += `<p>⚠️ Error al cargar modalidades. Inténtalo más tarde.</p>`;
            });
    };

    window.seleccionarModalidad = function(nombreModalidad, idModalidad) {
        appendMessage(`Has seleccionado la modalidad: ${nombreModalidad}`);
        userData.modalidad = nombreModalidad;
        userData.id_modalidad = idModalidad;
    
        // 🔹 Fechas: de la hora actual a una hora después
        const now = new Date();
        const fechaInicio = new Date(now);
        const fechaFin = new Date(now);
        fechaFin.setHours(now.getHours() + 1);
    
        // 🔹 Formato "YYYY-MM-DD HH:MM:SS"
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const mi = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        };
    
        // 🟢 Simulamos ID solicitante y responsable por ahora
        const payload = {
            cedula_solicitante: userData.cedula,
            estado: "Pendiente",
            fecha_hora_inicio: formatDate(fechaInicio),
            fecha_hora_fin: formatDate(fechaFin),
            id_modalidad: idModalidad,
            id_tipo_cita: userData.id_tipo_cita,
            id_solicitante: 1,     // 🔧 Aquí puedes usar lógica real si tienes
            id_responsable: 2,     // 🔧 Lo mismo para esto
            nombre_solicitante: userData.nombre,
            notas: userData.opcion  // Aquí guardamos el nombre del tipo de cita
        };
    
        // 🔄 Enviar a la API
        fetch("http://127.0.0.1:8000/api/citas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) throw new Error("Error al registrar cita");
            return response.json();
        })
        .then(data => {
            chatBody.innerHTML = `<p>✅ Tu cita fue registrada exitosamente.</p>
                <p><strong>${userData.nombre}</strong> - Modalidad: <strong>${nombreModalidad}</strong></p>
                <p>🗓️ Fecha: ${formatDate(fechaInicio)} a ${formatDate(fechaFin)}</p>
                <button class="chat-option restart-button" onclick="resetChat()">🔄 Reiniciar Conversación</button>`;
        })
        .catch(error => {
            console.error("Error al enviar cita:", error);
            chatBody.innerHTML = `<p>❌ Ocurrió un error al registrar la cita. Intenta nuevamente.</p>`;
        });
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

    micButton.addEventListener("click", function () {
        if (!userData.cedula) {
            alert("⚠️ Debes ingresar tu cédula antes de usar el micrófono.");
            return;
        }

        if (!isRecording) {
            manuallyStopped = false;
            recognition.start();
            mediaRecorder.start();
            isRecording = true;
            audioChunks = [];
            micButton.textContent = "⏹️";
            console.log("🎤 Grabando...");
        } else {
            manuallyStopped = true;
            recognition.stop();
            mediaRecorder.stop();
            isRecording = false;
            micButton.textContent = "🎤";
            console.log("🎤 Grabación detenida.");
        }
    });

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        if (manuallyStopped) {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const reader = new FileReader();

            reader.onloadend = function () {
                const base64Audio = reader.result.split(",")[1];
                sendAudioToServer(base64Audio, userData.cedula, userData.nombre);
            };

            reader.readAsDataURL(audioBlob);
        } else {
            console.log("🛑 Grabación detenida automáticamente, pero ignorada.");
        }
    };

    recognition.onend = () => {
        if (!manuallyStopped) {
            console.log("🔕 Reconocimiento terminado automáticamente, pero ignorado.");
        }
    };
});

// ✅ Función para enviar el audio
function sendAudioToServer(base64Audio, cedula, nombre) {
    fetch("/process_audio", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            audio: base64Audio,
            cedula: cedula,
            nombre: nombre
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log("🎤 Respuesta del servidor:", data);

        if (data.cita) {
            const c = data.cita;
            appendMessage(`📝 ${c.mensaje}`, false);
            appendMessage(`🗓️ Turno: ${c.turno}`, false);
            appendMessage(`📌 Modalidad: ${c.modalidad || "No detectada"}`, false);
            appendMessage(`📄 Tipo de cita: ${c.tipo_cita || "No detectado"}`, false);

            enviarCitaDetectada(c);
            trainModel();
        } else {
            appendMessage("❌ No se pudo registrar la cita.", false);
        }
    })
    .catch(error => {
        console.error("Error enviando audio:", error);
        appendMessage("⚠️ Error al enviar el audio. Intenta nuevamente.", false);
    });
}

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

    // ✅ Enviar la cita a la API cuando es detectada desde audio
function enviarCitaDetectada(cita) {
    const now = new Date();
    const fechaInicio = new Date(now);
    const fechaFin = new Date(now);
    fechaFin.setHours(now.getHours() + 1);

    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    };

    const payload = {
        cedula_solicitante: cita.cedula,
        estado: "Pendiente",
        fecha_hora_inicio: formatDate(fechaInicio),
        fecha_hora_fin: formatDate(fechaFin),
        id_modalidad: cita.id_modalidad,
        id_tipo_cita: cita.id_tipo_cita,
        id_solicitante: 1, // puedes ajustarlo
        id_responsable: 2,
        nombre_solicitante: cita.usuario,
        notas: cita.tipo_cita
    };

    fetch("http://127.0.0.1:8000/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Error al registrar cita");
        return response.json();
    })
    .then(data => {
        chatBody.innerHTML = `<p>✅ Tu cita fue registrada exitosamente.</p>
            <p><strong>${cita.usuario}</strong> - Modalidad: <strong>${cita.modalidad}</strong></p>
            <p>🗓️ Fecha: ${formatDate(fechaInicio)} a ${formatDate(fechaFin)}</p>
            <p> Su cita esta en proceso de revision y aprobacion por el departamento correspondiente</p>
            <button class="chat-option restart-button" onclick="resetChat()">🔄 Reiniciar Conversación</button>`;
    })
    .catch(error => {
        console.error("❌ Error al enviar cita:", error);
        chatBody.innerHTML = `<p>❌ Ocurrió un error al registrar la cita. Intenta nuevamente.</p>`;
    });
}

});