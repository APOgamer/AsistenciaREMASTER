# Sistema de Asistencia

Sistema de asistencia con diferentes roles de usuario (admin, auxiliar, alumno).

## Requisitos

- Node.js
- MongoDB
- npm o yarn

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo .env con las siguientes variables:
```
MONGODB_URI=mongodb://localhost:27017/asistencia-app
JWT_SECRET=tu_clave_secreta_muy_segura
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=3000
```

4. Inicializar el usuario administrador:
```bash
node init-admin.js
```

5. Iniciar el servidor:
```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## Características

- Autenticación de usuarios
- Tres tipos de usuarios: admin, auxiliar y alumno
- Los administradores pueden crear usuarios auxiliares
- Gestión de perfil de usuario
- Interfaz responsiva y moderna

## Roles de Usuario

### Administrador
- Crear usuarios auxiliares
- Gestionar su perfil
- Acceso completo al sistema

### Auxiliar
- Gestionar su perfil
- Funciones específicas de auxiliar (pendientes de implementar)

### Alumno
- Gestionar su perfil
- Funciones específicas de alumno (pendientes de implementar) 