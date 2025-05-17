const mongoose = require('mongoose');

const justificacionSchema = new mongoose.Schema({
    descripcion: { type: String },
    imagenUrl: { type: String },
    fecha: { type: Date, default: Date.now }
}, { _id: false });

const registroSchema = new mongoose.Schema({
    alumno: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    estado: { type: String, enum: ['A', 'T', 'F', null], default: null }, // Asistió, Tardanza, Faltó
    horaLlegada: { type: String, required: false },
    justificacion: { type: justificacionSchema, default: null }
}, { _id: false });

const asistenciaSchema = new mongoose.Schema({
    fecha: { type: String, required: true, unique: true }, // formato YYYY-MM-DD
    registros: [registroSchema]
});

module.exports = mongoose.model('Asistencia', asistenciaSchema); 