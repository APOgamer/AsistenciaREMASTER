const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

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
router.post('/students', auth, async (req, res) => {
    try {
        const students = req.body;
        const createdStudents = [];
        const errors = [];

        for (const student of students) {
            try {
                // Verificar si el estudiante ya existe
                const existingStudent = await User.findOne({ 
                    $or: [
                        { username: student.email },
                        { numero: student.numero }
                    ]
                });

                if (existingStudent) {
                    errors.push(`Estudiante ${student.nombreCompleto} ya existe`);
                    continue;
                }

                // Crear nuevo estudiante
                const newStudent = new User({
                    username: student.email,
                    password: student.password,
                    nombre: student.nombreCompleto,
                    nombreCompleto: student.nombreCompleto,
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
                errors.push(`Error al crear estudiante ${student.nombreCompleto}: ${error.message}`);
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
        const user = await User.findById(req.user._id).select('-password');
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
router.get('/', auth, async (req, res) => {
    try {
        let users;
        if (req.user.role === 'admin') {
            users = await User.find({});
        } else if (req.user.role === 'auxiliar') {
            users = await User.find({ role: 'alumno' });
        } else {
            return res.status(403).json({ error: 'No autorizado' });
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 