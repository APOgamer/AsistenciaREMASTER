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

// Estado de la aplicación
let currentUser = null;
let token = null;
let excelProcessor = new ExcelProcessor();
let processedStudents = [];

// Funciones de utilidad
const showError = (message) => {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('.container').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
};

const showSuccess = (message) => {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.querySelector('.container').appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
};

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
    
    // Mostrar/ocultar botones según el rol
    if (currentUser.role === 'admin') {
        createAuxBtn.classList.remove('hidden');
        uploadListsBtn.classList.remove('hidden');
    } else if (currentUser.role === 'auxiliar') {
        uploadListsBtn.classList.remove('hidden');
    }
    
    // Cargar datos del perfil
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
});

createAuxBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.remove('hidden');
    uploadListsSection.classList.add('hidden');
});

uploadListsBtn.addEventListener('click', () => {
    profileSection.classList.add('hidden');
    createAuxSection.classList.add('hidden');
    uploadListsSection.classList.remove('hidden');
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
        showError('Error al procesar el archivo Excel');
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
        
        if (!response.ok) {
            throw new Error('Error al guardar los estudiantes');
        }
        
        showSuccess('Estudiantes guardados correctamente');
        previewSection.classList.add('hidden');
        uploadListsForm.reset();
    } catch (error) {
        showError(error.message);
    }
});

// Verificar si hay un token guardado al cargar la página
const savedToken = localStorage.getItem('token');
if (savedToken) {
    token = savedToken;
    loadProfile().then(() => showDashboard());
} 