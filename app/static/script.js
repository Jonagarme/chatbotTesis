document.addEventListener("DOMContentLoaded", function() {
    let step = 0;
    let userData = { nombre: "", cedula: "", email: "", opcion: "", subopcion: "", detalle: "" };
    let inactivityTimer;
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const chatBody = document.getElementById("chat-body");
    const micButton = document.getElementById("mic-button");
    const chatTitle = document.getElementById("chat-title");

    micButton.disabled = true;
    let isRecording = false;
    let manuallyStopped = false;

    let recorder;
    let audioContext;
    let stream;
    let input; // Se declara aquí para uso posterior

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
            step = 1;
            chatBody.innerHTML = `<p>Gracias, ${userData.nombre}. Ahora ingresa tu cédula:</p>`;
            return;
        }

        if (step === 1) {
            // Validar cédula: 13 dígitos numéricos
            if (!/^\d{10,13}$/.test(message)) {
                appendMessage("⚠️ La cédula debe tener exactamente 13 números.", false);
                return;
            }
            userData.cedula = message;
            step = 2;
            chatBody.innerHTML = `<p>Perfecto. Ahora escribe tu correo electrónico:</p>`;
            return;
        }

        if (step === 2) {
            // Validar correo
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(message)) {
                appendMessage("⚠️ Por favor ingresa un correo válido (ej. nombre@ejemplo.com).", false);
                return;
            }
            userData.email = message;
            chatTitle.textContent = "Bienvenido, " + userData.nombre;
            micButton.disabled = false;
            showMainOptions();
            step = 3; // ya no volverá a pedir datos
            return;
        }

        // Si hay una respuesta posterior
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: step, userData: userData })
        })
        .then(response => response.json())
        .then(data => {
            appendMessage(data.response);
            step = data.step;
        })
        .catch(error => console.error("Error en la solicitud:", error));
    }


    // **Mostrar Opciones Principales**
// 🔷 Mostrar los departamentos como tarjetas
window.showMainOptions = function () {
    chatBody.innerHTML = `<p>¡Bienvenido, ${userData.nombre}! Selecciona un departamento:</p>
    <div class="departamentos-grid"></div>`;

    const grid = document.querySelector(".departamentos-grid");

    fetch("http://127.0.0.1:8000/api/tipos_citas")
        .then(response => response.json())
        .then(data => {
            let departamentos = {};

            data.forEach(cita => {
                if (!departamentos[cita.tipo_departamento]) {
                    departamentos[cita.tipo_departamento] = [];
                }
                departamentos[cita.tipo_departamento].push(cita);
            });

            Object.keys(departamentos).forEach(dep => {
                const card = document.createElement("div");
                card.className = "departamento-card";
                card.innerHTML = `
                    <div class="icon">🏢</div>
                    <div class="departamento-titulo">${dep}</div>
                    <div class="departamento-desc">Ver citas disponibles</div>
                `;
                card.onclick = () => showCitasPorDepartamento(departamentos[dep]);
                grid.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error cargando tipos de cita:", error);
            chatBody.innerHTML += `<p>⚠️ Error al cargar las opciones. Inténtalo más tarde.</p>`;
        });
};

// 🔷 Mostrar tipos de cita como tarjetas
window.showCitasPorDepartamento = function(citas) {
    chatBody.innerHTML = `<p>Selecciona un tipo de cita:</p>
    <div class="citas-grid"></div>`;

    const grid = document.querySelector(".citas-grid");

    citas.forEach(cita => {
        const card = document.createElement("div");
        card.className = "cita-card";
        card.innerHTML = `
            <div class="icon">📄</div>
            <div class="cita-titulo">${cita.nombre_tipo_cita}</div>
            <div class="cita-desc">${cita.descripcion || "Tipo de cita"}</div>
        `;
        card.onclick = () => seleccionarTipoCita(cita.nombre_tipo_cita, cita.id_tipo_cita);
        grid.appendChild(card);
    });

    const volver = document.createElement("button");
    volver.className = "chat-option volver-boton";
    volver.innerText = "↩ Volver";
    volver.onclick = showMainOptions;
    chatBody.appendChild(volver);
};


   window.seleccionarTipoCita = function(nombreTipo, idTipo) {
    appendMessage(`Has seleccionado: ${nombreTipo}`);
    userData.opcion = nombreTipo;
    userData.id_tipo_cita = idTipo;

    chatBody.innerHTML = `
        <p>Selecciona una modalidad para tu cita:</p>
        <div class="modalidades-grid"></div>
    `;

    const grid = document.querySelector(".modalidades-grid");

    fetch("http://127.0.0.1:8000/api/modalidades_citas")
        .then(response => response.json())
        .then(modalidades => {
            modalidades.forEach(mod => {
                const card = document.createElement("div");
                card.className = "modalidad-card";
                card.innerHTML = `
                    <div class="icon">🎯</div>
                    <div class="modalidad-titulo">${mod.nombre_modalidad}</div>
                    <div class="modalidad-desc">${mod.descripcion}</div>
                `;
                card.onclick = () => seleccionarModalidad(mod.nombre_modalidad, mod.id_modalidad);
                grid.appendChild(card);
            });

            const volver = document.createElement("button");
            volver.className = "chat-option volver-boton";
            volver.innerText = "↩ Volver";
            volver.onclick = showMainOptions;
            chatBody.appendChild(volver);
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
            email_solicitante: userData.email,
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
                <p><strong>${userData.tipo_cita}</strong> - Modalidad: <strong>${nombreModalidad}</strong></p>
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

recognition.onstart = function () {
    console.log("🎤 Reconocimiento iniciado.");
};

recognition.onend = function () {
    console.log("🎤 Reconocimiento finalizado.");
    if (!manuallyStopped) {
        console.log("🔕 Fin automático ignorado.");
    }
};

// recognition.onresult = function(event) {
//     const transcript = event.results[0][0].transcript;
//     sendAudioToServer(transcript);  // Enviar directamente al servidor
// };

// 🎤 **Capturar audio y enviarlo a Flask**
// 🎤 Capturar audio y enviarlo a Flask como .wav real
micButton.addEventListener("click", async () => {
    if (!userData.cedula) {
        alert("⚠️ Debes ingresar tu cédula antes de usar el micrófono.");
        return;
    }

    if (!isRecording) {
        manuallyStopped = false;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        input = audioContext.createMediaStreamSource(stream);

        try {
            recorder = new Recorder(input, { numChannels: 1 });
        } catch (e) {
            console.error("Recorder no está definido. Asegúrate de haber cargado recorder.min.js correctamente.");
            alert("Error: no se pudo inicializar la grabadora.");
            return;
        }

        recorder.record();
        recognition.start();
        isRecording = true;
        micButton.textContent = "⏹️";
        console.log("🎤 Grabando...");
    } else {
        manuallyStopped = true;
        recognition.stop();
        recorder.stop();

        recorder.exportWAV(blob => {
            const reader = new FileReader();
            reader.onloadend = function () {
                const base64Audio = reader.result.split(",")[1];
                sendAudioToServer(base64Audio, userData.cedula, userData.nombre);
            };
            reader.readAsDataURL(blob);
        });

        recorder.clear();
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        isRecording = false;
        micButton.textContent = "🎤";
        console.log("🎤 Grabación detenida.");
    }
});

    recognition.onend = () => {
        if (!manuallyStopped) {
            console.log("🔕 Reconocimiento terminado automáticamente, pero ignorado.");
        }
    };


    function sendAudioToServer(base64Audio, cedula, nombre) {
        fetch("/process_audio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audio: base64Audio,
                cedula: cedula,
                nombre: nombre,
                email: userData.email
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
        email_solicitante: cita.email || "sin@email.com",
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
            <p><strong>${cita.tipo_cita}</strong> - Modalidad: <strong>${cita.modalidad}</strong></p>
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