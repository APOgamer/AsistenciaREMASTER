const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'auxiliar', 'alumno'],
        required: true
    },
    nombre: {
        type: String,
        required: true
    },
    nombreCompleto: {
        type: String,
        required: function() {
            return this.role === 'alumno';
        }
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    telefono: {
        type: String,
        required: false
    },
    codigo: {
        type: String,
        required: false
    },
    numero: {
        type: Number,
        required: function() {
            return this.role === 'alumno';
        }
    },
    grado: {
        type: Number,
        required: function() {
            return this.role === 'alumno';
        }
    },
    seccion: {
        type: String,
        required: function() {
            return this.role === 'alumno';
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Método para encriptar contraseña
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 