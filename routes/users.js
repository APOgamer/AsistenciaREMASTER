const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Asistencia = require('../models/Asistencia');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para la subida de imágenes
const upload = multer({
    dest: 'uploads/temp/', // Carpeta temporal para guardar archivos
    limits: {
        fileSize: 1024 * 1024 * 5 // Limitar tamaño a 5MB
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Por favor suba una imagen (jpg, jpeg o png)'));
        }
        cb(undefined, true);
    }
});

// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id });
        
        if (!user) {
            throw new Error();
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Por favor autentíquese.' });
    }
};

// Middleware para verificar si es admin
const isAdmin = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
};

// Middleware para verificar si es admin o auxiliar para ciertas rutas de asistencia
const staffAuth = async (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'auxiliar') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador o auxiliar.' });
    }
    next();
};

// Crear usuario auxiliar (solo admin)
router.post('/auxiliar', auth, adminAuth, async (req, res) => {
    try {
        const { username, password, nombre, email, telefono } = req.body;
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        
        const user = new User({
            username,
            password,
            nombre,
            email,
            telefono,
            role: 'auxiliar'
        });
        
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Crear estudiantes masivamente (admin y auxiliar)
router.post('/students', auth, staffAuth, async (req, res) => {
    try {
        const students = req.body;
        const createdStudents = [];
        const errors = [];

        // Obtener IDs de MongoDB para los alumnos existentes por su número
        const numeros = students.map(s => s.numero).filter(n => n !== undefined && n !== null);
        const existingAlumnos = await User.find({ numero: { $in: numeros }, role: 'alumno' }, '_id numero');
        const existingAlumnosMap = new Map(existingAlumnos.map(a => [a.numero, a._id]));

        for (const student of students) {
            try {
                // Verificar si el estudiante ya existe por email o numero
                const existingStudent = await User.findOne({
                    $or: [
                        { email: student.email },
                        { numero: student.numero }
                    ]
                });

                if (existingStudent) {
                    errors.push(`Estudiante ${student.nombreCompleto || student.nombre} (N° ${student.numero}) ya existe`);
                    continue;
                }

                // Crear nuevo estudiante
                const newStudent = new User({
                    username: student.email, // Usar email como username
                    password: student.password,
                    nombre: student.nombreCompleto || student.nombre,
                    nombreCompleto: student.nombreCompleto || student.nombre,
                    email: student.email,
                    telefono: student.telefono,
                    numero: student.numero,
                    codigo: student.codigo,
                    grado: student.grado,
                    seccion: student.seccion,
                    role: 'alumno'
                });

                await newStudent.save();
                createdStudents.push(newStudent);
            } catch (error) {
                errors.push(`Error al crear estudiante ${student.nombreCompleto || student.nombre} (N° ${student.numero}): ${error.message}`);
            }
        }

        res.status(201).json({
            created: createdStudents.length,
            errors: errors
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener perfil del usuario
router.get('/profile', auth, async (req, res) => {
    try {
        // Populate justificacion if role is student
        const user = await User.findById(req.user._id).select('-password').lean();

        // If the user is an 'alumno', fetch their attendance records to check for justifications
        if (user && user.role === 'alumno') {
            // Find attendance records where this student has a justification
            const asistenciasConJustificacion = await Asistencia.find(
                { 'registros.alumno': new mongoose.Types.ObjectId(user._id), 'registros.justificacion': { $ne: null } },
                { 'registros.$': 1, fecha: 1 }
            );

            // Add justification data to the user object
            user.justificaciones = asistenciasConJustificacion.map(asistencia => {
                const registro = asistencia.registros.find(reg => String(reg.alumno) === String(user._id));
                return { 
                    fecha: asistencia.fecha,
                    justificacion: registro ? registro.justificacion : null
                };
            }).filter(item => item.justificacion !== null);
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar perfil del usuario
router.patch('/:id', auth, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const allowedUpdates = ['nombre', 'email', 'password', 'telefono'];
        const updates = Object.keys(req.body)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = req.body[key];
                return obj;
            }, {});

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        Object.assign(user, updates);
        await user.save();

        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obtener todos los usuarios (admin ve todos, auxiliar solo alumnos)
router.get('/', auth, staffAuth, async (req, res) => {
    try {
        let users;
        if (req.user.role === 'admin') {
            users = await User.find({}).select('-password');
        } else if (req.user.role === 'auxiliar') {
            users = await User.find({ role: 'alumno' }).select('-password');
        } else {
            return res.status(403).json({ error: 'No autorizado' });
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Guardar asistencia huellero
router.post('/asistencias', auth, staffAuth, async (req, res) => {
    try {
        const { fecha, registros } = req.body;
        if (!fecha || !Array.isArray(registros)) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        // Asegurarse de que los registros tengan solo los campos necesarios para guardar
        const registrosParaGuardar = registros.map(r => ({
            alumno: r.alumno, // Aquí esperamos el ObjectId del alumno
            estado: r.estado,
            horaLlegada: r.horaLlegada,
            justificacion: r.justificacion || undefined // Incluir justificación si existe
        }));

        let asistencia = await Asistencia.findOne({ fecha });
        if (!asistencia) {
            // Crear nueva asistencia si no existe
            asistencia = new Asistencia({ fecha, registros: registrosParaGuardar });
            await asistencia.save();
            return res.status(201).json({ message: 'Asistencia guardada correctamente', asistencia });
        } else {
            // Actualizar asistencia existente: agregar o actualizar registros
            const registrosExistentesMap = new Map(asistencia.registros.map(r => [String(r.alumno), r]));
            let nuevos = 0;
            let actualizados = 0;

            for (const nuevoReg of registrosParaGuardar) { // Usar for...of para poder usar await si es necesario (aunque no lo es aquí)
                const alumnoId = String(nuevoReg.alumno);
                if (registrosExistentesMap.has(alumnoId)) {
                    // Si el registro ya existe, actualizar si es necesario (por ejemplo, estado o hora más temprana)
                    const regExistente = registrosExistentesMap.get(alumnoId);
                    // Lógica para decidir si actualizar (ej: si el nuevo estado no es F, o si la hora es más temprana)
                    // Priorizar estados que no sean 'F'
                    if (regExistente.estado === 'F' && nuevoReg.estado !== 'F') {
                         regExistente.estado = nuevoReg.estado;
                         regExistente.horaLlegada = nuevoReg.horaLlegada; // Mantener la hora si cambia de F a A/T
                         actualizados++;
                    } else if (regExistente.estado !== 'F' && nuevoReg.estado !== 'F') { // Si ambos no son F
                        // Si la nueva hora es más temprana que la existente, actualizar hora y re-evaluar estado
                        if (nuevoReg.horaLlegada < regExistente.horaLlegada) {
                             regExistente.horaLlegada = nuevoReg.horaLlegada;
                             // NOTA: Re-evaluar el estado ('A' vs 'T') basándose en la nueva hora y el turno del alumno
                             // Esto requeriría obtener la configuración de horas y el turno del alumno aquí.
                             // Para simplificar por ahora, solo actualizamos la hora y mantenemos el estado si no es F.
                             // Si necesitas la re-evaluación automática del estado, habrá que ajustar.
                             actualizados++;
                        }
                    } else if (regExistente.estado === null && nuevoReg.estado !== null) { // Si el estado estaba null, actualizar al primer estado y hora registrada
                         regExistente.estado = nuevoReg.estado;
                         regExistente.horaLlegada = nuevoReg.horaLlegada;
                         actualizados++;
                    }

                } else {
                    // Si el registro no existe, agregarlo
                    asistencia.registros.push(nuevoReg);
                    nuevos++;
                }
            }
            await asistencia.save();
            let message = `Asistencia del ${fecha} actualizada. `;
            if(nuevos) message += `Se agregaron ${nuevos} registros nuevos. `;
            if(actualizados) message += `Se actualizaron ${actualizados} registros existentes.`;
            if(!nuevos && !actualizados) message += 'No había registros nuevos o a actualizar.';

            return res.status(200).json({ message, asistencia });
        }
    } catch (error) {
        // Manejo específico de error de clave duplicada para la fecha
        if (error.code === 11000 && error.keyPattern && error.keyPattern.fecha) {
             return res.status(400).json({ error: `Ya existe un registro de asistencia para la fecha ${req.body.fecha}` });
        }
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las fechas de asistencias
router.get('/asistencias', auth, staffAuth, async (req, res) => {
    try {
        const asistencias = await Asistencia.find({}, 'fecha').sort({ fecha: -1 });
        const fechas = asistencias.map(a => a.fecha);
        res.json(fechas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una asistencia por fecha (admin y auxiliar)
router.get('/asistencias/:fecha', auth, staffAuth, async (req, res) => {
    try {
        const asistencia = await Asistencia.findOne({ fecha: req.params.fecha }).populate('registros.alumno', 'nombreCompleto nombre email numero seccion grado');
        if (!asistencia) return res.status(404).json({ error: 'Asistencia no encontrada' });
        res.json(asistencia);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar una asistencia por fecha
router.patch('/asistencias/:fecha', auth, staffAuth, async (req, res) => {
    try {
        const { registros } = req.body;
        if (!Array.isArray(registros)) return res.status(400).json({ error: 'Registros inválidos' });
        const asistencia = await Asistencia.findOne({ fecha: req.params.fecha });
        if (!asistencia) return res.status(404).json({ error: 'Asistencia no encontrada' });
        asistencia.registros = registros;
        await asistencia.save();
        res.json({ message: 'Asistencia actualizada', asistencia });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Subir imagen para justificación (admin y auxiliar)
router.post('/justificaciones/upload', auth, staffAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        // Devolver la URL temporal del archivo
        const fileUrl = `/uploads/temp/${req.file.filename}`;
        res.json({ url: fileUrl });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 