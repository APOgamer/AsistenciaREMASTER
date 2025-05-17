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

// Estado de la aplicación
let currentUser = null;
let token = null;
let excelProcessor = new ExcelProcessor();
let processedStudents = [];
let allData = [];
let filteredData = [];
let currentView = '';

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
    viewStudentsBtn.classList.add('hidden');
    viewUsersBtn.classList.add('hidden');
    if (currentUser.role === 'admin') {
        createAuxBtn.classList.remove('hidden');
        uploadListsBtn.classList.remove('hidden');
        viewUsersBtn.classList.remove('hidden');
    } else if (currentUser.role === 'auxiliar') {
        uploadListsBtn.classList.remove('hidden');
        viewStudentsBtn.classList.remove('hidden');
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