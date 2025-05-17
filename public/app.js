// Elementos del DOM
const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const profileBtn = document.getElementById('profile-btn');
const createAuxBtn = document.getElementById('create-aux-btn');
const uploadListsBtn = document.getElementById('upload-lists-btn');
const logoutBtn = document.getElementById('logout-btn');
const profileSection = document.getElementById('profile-section');
const createAuxSection = document.getElementById('create-aux-section');
const uploadListsSection = document.getElementById('upload-lists-section');
const profileForm = document.getElementById('profile-form');
const createAuxForm = document.getElementById('create-aux-form');
const uploadListsForm = document.getElementById('upload-lists-form');
const previewSection = document.getElementById('preview-section');
const previewTables = document.getElementById('preview-tables');
const saveStudentsBtn = document.getElementById('save-students-btn');
const viewSection = document.getElementById('view-section');
const viewSectionTitle = document.getElementById('view-section-title');
const filtersContainer = document.getElementById('filters-container');
const tableContainer = document.getElementById('table-container');
const searchInput = document.getElementById('search-input');
const viewStudentsBtn = document.getElementById('view-students-btn');
const viewUsersBtn = document.getElementById('view-users-btn');
const uploadAttendanceBtn = document.getElementById('upload-attendance-btn');
const uploadAttendanceSection = document.getElementById('upload-attendance-section');
const uploadAttendanceForm = document.getElementById('upload-attendance-form');
const attendanceFileInput = document.getElementById('attendance-file');
const attendancePreviewSection = document.getElementById('attendance-preview-section');
const attendanceFiltersContainer = document.getElementById('attendance-filters-container');
const attendanceTableContainer = document.getElementById('attendance-table-container');
const saveAttendanceBtn = document.getElementById('save-attendance-btn');
const viewAttendanceBtn = document.getElementById('view-attendance-btn');
const viewAttendanceSection = document.getElementById('view-attendance-section');
const attendanceDatesList = document.getElementById('attendance-dates-list');
const attendanceDetailSection = document.getElementById('attendance-detail-section');
const attendanceDetailTitle = document.getElementById('attendance-detail-title');
const attendanceDetailTableContainer = document.getElementById('attendance-detail-table-container');
const saveAttendanceEditBtn = document.getElementById('save-attendance-edit-btn');

// Estado de la aplicación
let currentUser = null;
let token = null;
let excelProcessor = new ExcelProcessor();
let processedStudents = [];
let allData = [];
let filteredData = [];
let currentView = '';
let attendanceRawData = [];
let attendancePreviewData = [];
let alumnosById = {};
let horasConfig = null;
let asistenciaActual = null;
let asistenciaEditada = null;

// Funciones de utilidad
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

const showError = (message) => showToast(message, 'error');
const showSuccess = (message) => showToast(message, 'success');
const showInfo = (message) => showToast(message, 'info');

// Funciones de autenticación
const login = async (username, password) => {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error);
        }
        
        currentUser = data.user;
        token = data.token;
        localStorage.setItem('token', token);
        
        showDashboard();
    } catch (error) {
        showError(error.message);
    }
};

const logout = () => {
    currentUser = null;
    token = null;
    localStorage.removeItem('token');
    showLogin();
};

// Funciones de UI
const showLogin = () => {
    loginContainer.classList.remove('hidden');
    dashboard.classList.add('hidden');
};

const showDashboard = () => {
    loginContainer.classList.add('hidden');
    dashboard.classList.remove('hidden');
    createAuxBtn.classList.add('hidden');
    uploadListsBtn.classList.add('hidden');
    uploadAttendanceBtn.classList.add('hidden');
    viewStudentsBtn.classList.add('hidden');
    viewUsersBtn.classList.add('hidden');
    viewAttendanceBtn.classList.add('hidden');
    if (currentUser.role === 'admin') {
        createAuxBtn.classList.remove('hidden');
        uploadListsBtn.classList.remove('hidden');
        uploadAttendanceBtn.classList.remove('hidden');
        viewUsersBtn.classList.remove('hidden');
        viewAttendanceBtn.classList.remove('hidden');
    } else if (currentUser.role === 'auxiliar') {
        uploadListsBtn.classList.remove('hidden');
        uploadAttendanceBtn.classList.remove('hidden');
        viewStudentsBtn.classList.remove('hidden');
        viewAttendanceBtn.classList.remove('hidden');
    }
    loadProfile();
};

const loadProfile = async () => {
    try {
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const user = await response.json();
        
        document.getElementById('profile-name').value = user.nombre;
        document.getElementById('profile-email').value = user.email;
        document.getElementById('profile-telefono').value = user.telefono || '';
    } catch (error) {
        showError('Error al cargar el perfil');
    }
};

// Event Listeners
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
});

profileBtn.addEventListener('click', () => {
    profileSection.classList.remove('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.add('hidden');
    viewSection.classList.add('hidden');
});

createAuxBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.remove('hidden');
    uploadListsSection.classList.add('hidden');
    viewSection.classList.add('hidden');
});

uploadListsBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.remove('hidden');
    viewSection.classList.add('hidden');
});

logoutBtn.addEventListener('click', logout);

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`/api/users/${currentUser._id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nombre: document.getElementById('profile-name').value,
                email: document.getElementById('profile-email').value,
                telefono: document.getElementById('profile-telefono').value,
                password: document.getElementById('profile-password').value
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar el perfil');
        }
        
        showSuccess('Perfil actualizado correctamente');
        document.getElementById('profile-password').value = '';
    } catch (error) {
        showError(error.message);
    }
});

createAuxForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('/api/users/auxiliar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                username: document.getElementById('aux-username').value,
                password: document.getElementById('aux-password').value,
                nombre: document.getElementById('aux-name').value,
                email: document.getElementById('aux-email').value,
                telefono: document.getElementById('aux-telefono').value
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al crear el usuario auxiliar');
        }
        
        showSuccess('Usuario auxiliar creado correctamente');
        createAuxForm.reset();
    } catch (error) {
        showError(error.message);
    }
});

// Manejo de archivos Excel
uploadListsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('excel-file').files[0];
    
    if (!file) {
        showError('Por favor seleccione un archivo Excel');
        return;
    }
    
    try {
        processedStudents = await excelProcessor.processFile(file);
        previewTables.innerHTML = excelProcessor.generatePreviewHTML();
        previewSection.classList.remove('hidden');
    } catch (error) {
        // Mostrar errores de formato o vacíos
        if (error && error.errors) {
            previewSection.classList.add('hidden');
            previewTables.innerHTML = '';
            showError(error.errors.join('\n'));
        } else {
            showError('Error al procesar el archivo Excel');
        }
    }
});

saveStudentsBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/users/students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(processedStudents)
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Error al guardar los estudiantes');
        }
        // Mostrar mensajes según el resultado
        if (result.errors && result.errors.length > 0) {
            if (result.created > 0) {
                showToast(`Algunos alumnos se guardaron, pero hubo errores:\n${result.errors.join('\n')}`, 'info');
            } else {
                showError(`No se guardó ningún alumno.\n${result.errors.join('\n')}`);
            }
        } else {
            showSuccess('Estudiantes guardados correctamente');
        }
        previewSection.classList.add('hidden');
        uploadListsForm.reset();
    } catch (error) {
        showError(error.message);
    }
});

// Navegación
viewStudentsBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.add('hidden');
    viewSection.classList.remove('hidden');
    viewSectionTitle.textContent = 'Alumnos';
    currentView = 'alumnos';
    fetchAndRenderTable('alumno');
});

viewUsersBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.add('hidden');
    viewSection.classList.remove('hidden');
    viewSectionTitle.textContent = 'Usuarios';
    currentView = 'usuarios';
    fetchAndRenderTable();
});

// Fetch y renderizado de tabla
async function fetchAndRenderTable(roleFilter) {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('No se pudieron obtener los datos');
        let data = await response.json();
        if (roleFilter) data = data.filter(u => u.role === roleFilter);
        allData = data;
        filteredData = data;
        renderFilters(data);
        renderTable(data);
    } catch (error) {
        showError(error.message);
        tableContainer.innerHTML = '';
        filtersContainer.innerHTML = '';
    }
}

// Renderizar filtros
function renderFilters(data) {
    filtersContainer.innerHTML = '';
    if (!data.length) return;
    const keys = Object.keys(data[0]).filter(k => !['_id','password','__v','createdAt'].includes(k));
    keys.forEach(key => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Filtrar por ${key}`;
        input.className = 'filter-input';
        input.style.marginRight = '8px';
        input.addEventListener('input', () => {
            applyFilters();
        });
        input.dataset.key = key;
        filtersContainer.appendChild(input);
    });
}

// Aplicar filtros y búsqueda
function applyFilters() {
    const filterInputs = filtersContainer.querySelectorAll('.filter-input');
    filteredData = allData.filter(row => {
        return Array.from(filterInputs).every(input => {
            const key = input.dataset.key;
            return String(row[key] || '').toLowerCase().includes(input.value.toLowerCase());
        });
    }).filter(row => {
        const search = searchInput.value.toLowerCase();
        return !search || Object.values(row).some(val => String(val).toLowerCase().includes(search));
    });
    renderTable(filteredData);
}

searchInput.addEventListener('input', applyFilters);

// Renderizar tabla
function renderTable(data) {
    if (!data.length) {
        tableContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No hay datos para mostrar.</div>';
        return;
    }
    const keys = Object.keys(data[0]).filter(k => !['_id','password','__v','createdAt'].includes(k));
    let html = '<div style="overflow-x:auto;"><table class="preview-table"><thead><tr>';
    keys.forEach(k => {
        html += `<th>${k.charAt(0).toUpperCase() + k.slice(1)}</th>`;
    });
    html += '</tr></thead><tbody>';
    data.forEach(row => {
        html += '<tr>';
        keys.forEach(k => {
            html += `<td>${row[k] ?? ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    tableContainer.innerHTML = html;
}

// Mostrar/ocultar sección de asistencia huellero
uploadAttendanceBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.add('hidden');
    viewSection.classList.add('hidden');
    uploadAttendanceSection.classList.remove('hidden');
});

// Ocultar sección al cambiar de menú
profileBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });
createAuxBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });
uploadListsBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });
viewStudentsBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });
viewUsersBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });
logoutBtn.addEventListener('click', () => { uploadAttendanceSection.classList.add('hidden'); });

// Leer horas.json
async function fetchHorasConfig() {
    if (horasConfig) return horasConfig;
    try {
        const res = await fetch('/horas.json');
        if (!res.ok) throw new Error('No se pudo cargar el archivo de horarios (horas.json)');
        horasConfig = await res.json();
        return horasConfig;
    } catch (err) {
        showError('No se pudo cargar el archivo de horarios (horas.json). Contacta al administrador.');
        throw err;
    }
}

// Leer alumnos de la base de datos y mapear por ID
async function fetchAlumnosById() {
    const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
    const users = await res.json();
    alumnosById = {};
    users.filter(u => u.role === 'alumno').forEach(u => {
        alumnosById[u.numero] = u;
    });
}

// Procesar archivo .dat
uploadAttendanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = attendanceFileInput.files[0];
    if (!file) {
        showError('Por favor seleccione un archivo .dat');
        return;
    }
    await fetchAlumnosById();
    try {
        await fetchHorasConfig();
    } catch (err) {
        return; // Ya se mostró el error
    }
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    // Usar regex para extraer solo el primer número y la primera fecha/hora, ignorando el resto
    const registrosDat = {};
    const regex = /^(\d+)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/;
    let lineasIgnoradas = [];
    let idsNoEncontrados = [];
    lines.forEach(line => {
        const cleanLine = line.trim();
        const match = cleanLine.match(regex);
        if (match) {
            const id = match[1];
            const fechaHora = match[2];
            if (!registrosDat[id] || fechaHora < registrosDat[id]) {
                registrosDat[id] = fechaHora;
            }
        } else {
            lineasIgnoradas.push(line);
        }
    });
    if (Object.keys(registrosDat).length === 0) {
        attendancePreviewData = [];
        renderAttendancePreview([]);
        let msg = 'El archivo .dat no contiene registros válidos.';
        if (lineasIgnoradas.length > 0) {
            msg += '\nLíneas ignoradas por formato incorrecto (ejemplo):\n' + lineasIgnoradas.slice(0,3).join('\n');
        }
        showError(msg);
        return;
    }
    const primerFecha = Object.values(registrosDat)[0]?.split(' ')[0];
    attendancePreviewData = Object.values(alumnosById).map(alumno => {
        const id = alumno.numero;
        const seccion = (alumno.seccion || '').toUpperCase();
        const grado = alumno.grado || '';
        const turno = (seccion === 'E' || seccion === 'F') ? 'tarde' : 'mañana';
        let fecha = primerFecha || '';
        let hora = '';
        let estado = 'F'; // Por defecto, faltó
        if (registrosDat[id]) {
            const partes = registrosDat[id].split(' ');
            fecha = partes[0] || '';
            hora = partes[1] || '';
            const horaPuntual = horasConfig.turnos[turno]?.hora_puntual || '00:00';
            const horaTarde = horasConfig.turnos[turno]?.llegar_tarde_desde || '00:00';
            if (hora >= horaTarde) {
                estado = 'T'; // Tardanza
            } else if (hora < horaPuntual) {
                estado = 'A'; // Puntual
            } else {
                estado = 'A'; // Asistió
            }
        }
        return {
            id: alumno.numero,
            nombre: alumno.nombreCompleto || alumno.nombre || '',
            seccion,
            grado,
            fecha,
            hora,
            estado
        };
    });
    // IDs del archivo que no están en la base de datos
    const idsArchivo = Object.keys(registrosDat);
    idsNoEncontrados = idsArchivo.filter(id => !alumnosById[id]);
    if (attendancePreviewData.length === 0 || attendancePreviewData.every(a => a.estado === 'F')) {
        let msg = 'Ningún ID del archivo coincide con alumnos registrados.';
        if (idsNoEncontrados.length > 0) {
            msg += '\nIDs no encontrados en la base de datos (ejemplo): ' + idsNoEncontrados.slice(0,5).join(', ');
        }
        showError(msg);
    }
    renderAttendancePreview(attendancePreviewData);
    attendancePreviewSection.classList.remove('hidden');
});

// Renderizar vista previa y filtros
function renderAttendancePreview(data) {
    attendanceTableContainer.innerHTML = '';
    attendanceFiltersContainer.innerHTML = '';
    if (!data.length) {
        attendanceTableContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No hay datos para mostrar.</div>';
        return;
    }
    // Filtros: fecha, hora, estado
    const estados = [...new Set(data.map(d => d.estado))];
    // Crear input de fecha y select de estado
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'filter-input';
    dateInput.id = 'date-filter';
    const estadoSelect = createSelectFilter('Estado', estados, 'estado-filter', {A:'Asistió',T:'Tardanza',F:'Faltó'});

    // Filtro por hora
    const horaInput = document.createElement('input');
    horaInput.type = 'time';
    horaInput.placeholder = 'Hora mínima';
    horaInput.className = 'filter-input';
    horaInput.id = 'hora-min-filter';
    horaInput.style.marginRight = '8px';
    const horaMaxInput = document.createElement('input');
    horaMaxInput.type = 'time';
    horaMaxInput.placeholder = 'Hora máxima';
    horaMaxInput.className = 'filter-input';
    horaMaxInput.id = 'hora-max-filter';

    attendanceFiltersContainer.append(dateInput, estadoSelect, horaInput, horaMaxInput);
    
    // Evento de filtros
    attendanceFiltersContainer.querySelectorAll('select, input[type="date"], input[type="time"]').forEach(el => {
        el.addEventListener('input', applyAttendanceFilters);
    });
    // Aplicar filtros inicialmente
    applyAttendanceFilters();
}

function createSelectFilter(label, options, id, map={}) {
    const select = document.createElement('select');
    select.className = 'filter-input';
    select.id = id;
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = label;
    select.appendChild(optAll);
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = map[opt] || opt;
        select.appendChild(option);
    });
    return select;
}

function applyAttendanceFilters() {
    let data = [...attendancePreviewData];
    const date = document.getElementById('date-filter').value;
    const estado = document.getElementById('estado-filter').value;
    const horaMin = document.getElementById('hora-min-filter').value;
    const horaMax = document.getElementById('hora-max-filter').value;
    // Aplicar filtros
    if (date) data = data.filter(d => d.fecha === date);
    if (estado) data = data.filter(d => d.estado === estado);
    if (horaMin) data = data.filter(d => d.hora >= horaMin);
    if (horaMax) data = data.filter(d => d.hora <= horaMax);
    renderAttendanceTable(data);
}

function renderAttendanceTable(data) {
    if (!data.length) {
        attendanceTableContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No hay datos para mostrar.</div>';
        return;
    }
    let html = '<div style="overflow-x:auto;"><table class="attendance-table"><thead><tr>';
    html += '<th>ID</th><th>Nombre</th><th>Sección</th><th>Grado</th><th>Fecha</th><th>Hora</th><th>Estado</th>';
    html += '</tr></thead><tbody>';
    data.forEach(row => {
        html += `<tr><td>${row.id}</td><td>${row.nombre}</td><td>${row.seccion}</td><td>${row.grado}</td><td>${row.fecha}</td><td>${row.hora}</td><td>${row.estado}</td></tr>`;
    });
    html += '</tbody></table></div>';
    attendanceTableContainer.innerHTML = html;
}

// Verificar si hay un token guardado al cargar la página
const savedToken = localStorage.getItem('token');
if (savedToken) {
    token = savedToken;
    fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async response => {
        if (!response.ok) {
            // Token inválido o expirado
            localStorage.removeItem('token');
            showLogin();
            return;
        }
        currentUser = await response.json();
        showDashboard();
    })
    .catch(() => {
        localStorage.removeItem('token');
        showLogin();
    });
} else {
    showLogin();
}

saveAttendanceBtn.addEventListener('click', async () => {
    // Obtener los datos filtrados actuales
    const dataFiltrada = attendanceTableContainer.querySelectorAll('tbody tr').length > 0 ? 
        attendanceTableContainer.querySelectorAll('tbody tr').length : 0;
    
    if (dataFiltrada === 0) {
        showError('No hay datos de asistencia para guardar.');
        return;
    }

    // Obtener la fecha del filtro
    const fechaFiltro = document.getElementById('date-filter').value;
    if (!fechaFiltro) {
        showError('Por favor seleccione una fecha en el filtro.');
        return;
    }

    // Mapear numero a _id usando solo los datos filtrados
    const registros = [];
    attendanceTableContainer.querySelectorAll('tbody tr').forEach(row => {
        const id = row.cells[0].textContent; // ID está en la primera columna
        const alumno = alumnosById[id];
        if (alumno) {
            registros.push({
                alumno: alumno._id,
                estado: row.cells[6].textContent, // Estado está en la séptima columna
                horaLlegada: row.cells[5].textContent // Hora está en la sexta columna
            });
        }
    });

    try {
        const response = await fetch('/api/users/asistencias', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fecha: fechaFiltro, registros })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al guardar la asistencia');
        showSuccess(result.message || 'Asistencia guardada correctamente');
        attendancePreviewSection.classList.add('hidden');
        uploadAttendanceForm.reset();
    } catch (error) {
        showError(error.message);
    }
});

// Navegación para ver asistencias
viewAttendanceBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.add('hidden');
    uploadAttendanceSection.classList.add('hidden');
    viewSection.classList.add('hidden');
    viewAttendanceSection.classList.remove('hidden');
    attendanceDetailSection.classList.add('hidden');
    cargarFechasAsistencias();
});

// Ocultar sección al cambiar de menú
profileBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
createAuxBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
uploadListsBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
uploadAttendanceBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
viewStudentsBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
viewUsersBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });
logoutBtn.addEventListener('click', () => { viewAttendanceSection.classList.add('hidden'); });

// Cargar fechas de asistencias
async function cargarFechasAsistencias() {
    attendanceDatesList.innerHTML = '<div style="padding:10px;">Cargando fechas...</div>';
    try {
        const res = await fetch('/api/users/asistencias', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Error desconocido al cargar fechas');
        }
        const fechas = await res.json();
        if (!Array.isArray(fechas) || fechas.length === 0) {
            attendanceDatesList.innerHTML = '<div style="padding:10px; color:#888;">No hay asistencias registradas.</div>';
            return;
        }
        attendanceDatesList.innerHTML = '<b>Fechas disponibles:</b><br>' + fechas.map(f => `<button class="date-btn" data-fecha="${f}">${f}</button>`).join(' ');
        attendanceDatesList.querySelectorAll('.date-btn').forEach(btn => {
            btn.addEventListener('click', () => cargarAsistenciaPorFecha(btn.dataset.fecha));
        });
    } catch (err) {
        attendanceDatesList.innerHTML = `<div style="padding:10px; color:#e74c3c;">${err.message || 'Error al cargar fechas de asistencias.'}</div>`;
        showError(err.message || 'Error al cargar fechas de asistencias.'); // Mostrar toast con el error específico si está disponible
    }
}

// Cargar asistencia por fecha
async function cargarAsistenciaPorFecha(fecha) {
    attendanceDetailSection.classList.add('hidden');
    attendanceDetailTableContainer.innerHTML = '<div style="padding:10px;">Cargando asistencia...</div>';
    try {
        const res = await fetch(`/api/users/asistencias/${fecha}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const asistencia = await res.json();
        asistenciaActual = asistencia;
        asistenciaEditada = JSON.parse(JSON.stringify(asistencia)); // copia profunda
        renderAsistenciaDetalle(asistenciaEditada);
        attendanceDetailTitle.textContent = `Asistencia del ${fecha}`;
        attendanceDetailSection.classList.remove('hidden');
        saveAttendanceEditBtn.classList.add('hidden');
    } catch (err) {
        attendanceDetailTableContainer.innerHTML = '<div style="padding:10px; color:#e74c3c;">Error al cargar la asistencia.</div>';
    }
}

// Renderizar tabla editable de asistencia
function renderAsistenciaDetalle(asistencia) {
    if (!asistencia || !asistencia.registros || asistencia.registros.length === 0) {
        attendanceDetailTableContainer.innerHTML = '<div style="padding:10px; color:#888;">No hay registros para esta asistencia.</div>';
        return;
    }
    let html = '<div style="overflow-x:auto;"><table class="attendance-table"><thead><tr>';
    html += '<th>Nombre</th><th>Correo</th><th>Número</th><th>Sección</th><th>Grado</th><th>Hora Llegada</th><th>Estado</th><th>Justificar</th>';
    html += '</tr></thead><tbody>';
    asistencia.registros.forEach((reg, idx) => {
        const alumno = reg.alumno || {};
        html += `<tr>
            <td>${alumno.nombreCompleto || alumno.nombre || ''}</td>
            <td>${alumno.email || ''}</td>
            <td>${alumno.numero || ''}</td>
            <td>${alumno.seccion || ''}</td>
            <td>${alumno.grado || ''}</td>
            <td><input type="time" value="${reg.horaLlegada || ''}" data-idx="${idx}" class="edit-hora"></td>
            <td>
                <select data-idx="${idx}" class="edit-estado">
                    <option value="A" ${reg.estado === 'A' ? 'selected' : ''}>Asistió</option>
                    <option value="T" ${reg.estado === 'T' ? 'selected' : ''}>Tardanza</option>
                    <option value="F" ${reg.estado === 'F' ? 'selected' : ''}>Faltó</option>
                </select>
            </td>
            <td>`;
        if (reg.estado === 'T' || reg.estado === 'F') {
            html += `<button class="justify-btn" data-idx="${idx}">Justificar</button>`;
        } else {
            html += '-';
        }
        html += `</td></tr>`;
    });
    html += '</tbody></table></div>';
    attendanceDetailTableContainer.innerHTML = html;
    // Habilitar edición
    attendanceDetailTableContainer.querySelectorAll('.edit-hora').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.dataset.idx;
            asistenciaEditada.registros[idx].horaLlegada = e.target.value;
            saveAttendanceEditBtn.classList.remove('hidden');
        });
    });
    attendanceDetailTableContainer.querySelectorAll('.edit-estado').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = e.target.dataset.idx;
            asistenciaEditada.registros[idx].estado = e.target.value;
            saveAttendanceEditBtn.classList.remove('hidden');
            renderAsistenciaDetalle(asistenciaEditada); // refrescar para mostrar/ocultar botón justificar
        });
    });
    // Botón justificar
    attendanceDetailTableContainer.querySelectorAll('.justify-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.idx;
            mostrarModalJustificar(idx);
        });
    });
}

// Modal para justificar
function mostrarModalJustificar(idx) {
    let modal = document.getElementById('justificar-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'justificar-modal';
        modal.innerHTML = `
            <div class="modal-bg"></div>
            <div class="modal-content">
                <h3>Justificar Asistencia</h3>
                <div class="form-group">
                    <label for="justificacion-desc">Descripción:</label>
                    <textarea id="justificacion-desc" placeholder="Descripción" rows="3" style="width:100%;"></textarea>
                </div>
                <div class="form-group">
                    <label for="justificacion-img">Imagen:</label>
                    <input type="file" id="justificacion-img" accept="image/*">
                </div>
                <div style="margin-top:10px;">
                    <button id="guardar-justificacion-btn">Guardar</button>
                    <button id="cancelar-justificacion-btn">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    // Cargar justificación existente si hay
    const justificacionExistente = asistenciaEditada.registros[idx].justificacion;
    if (justificacionExistente) {
        document.getElementById('justificacion-desc').value = justificacionExistente.descripcion || '';
        // No podemos cargar el archivo de imagen por seguridad, pero podríamos mostrar un enlace o vista previa si la URL existe.
        // Por ahora, simplemente dejamos el campo de archivo vacío.
    }

    document.getElementById('cancelar-justificacion-btn').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('guardar-justificacion-btn').onclick = async () => {
        const desc = document.getElementById('justificacion-desc').value;
        const imgInput = document.getElementById('justificacion-img');
        let imagenUrl = justificacionExistente ? justificacionExistente.imagenUrl : ''; // Mantener URL existente si no se sube nueva imagen

        if (imgInput.files[0]) {
            // Subir imagen al backend
            const formData = new FormData();
            formData.append('file', imgInput.files[0]);
            try {
                const res = await fetch('/api/users/justificaciones/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.url) {
                    imagenUrl = data.url;
                } else {
                    showError(data.error || 'Error al subir la imagen');
                    return; // Detener si falla la subida de imagen
                }
            } catch (error) {
                showError('Error de red al subir la imagen.');
                return; // Detener si falla la subida de imagen
            }
        } else if (justificacionExistente && justificacionExistente.imagenUrl && !desc) {
            // Si solo se elimina la descripción pero había imagen, mantener la imagen
             // Ya manejado por imagenUrl = justificacionExistente.imagenUrl : '';
        } else if (!desc && !imgInput.files[0] && (!justificacionExistente || (!justificacionExistente.descripcion && !justificacionExistente.imagenUrl))) {
             // Si no hay descripción, no hay nueva imagen y no había justificación existente, no guardar nada
             asistenciaEditada.registros[idx].justificacion = undefined;
             showInfo('Justificación eliminada.');
        } else {
             // Si hay descripción y/o imagen (nueva o existente)
             asistenciaEditada.registros[idx].justificacion = { descripcion: desc, imagenUrl };
        }


        saveAttendanceEditBtn.classList.remove('hidden');
        modal.style.display = 'none';
        renderAsistenciaDetalle(asistenciaEditada); // Volver a renderizar para actualizar el estado visual si es necesario
    };
}

// Guardar cambios en la asistencia
saveAttendanceEditBtn.addEventListener('click', async () => {
    if (!asistenciaEditada) return;
    try {
        const res = await fetch(`/api/users/asistencias/${asistenciaEditada.fecha}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ registros: asistenciaEditada.registros.map(r => ({
                alumno: r.alumno._id || r.alumno,
                estado: r.estado,
                horaLlegada: r.horaLlegada
            })) })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al guardar los cambios');
        showSuccess('Asistencia actualizada correctamente');
        saveAttendanceEditBtn.classList.add('hidden');
        cargarAsistenciaPorFecha(asistenciaEditada.fecha);
    } catch (err) {
        showError(err.message);
    }
}); 