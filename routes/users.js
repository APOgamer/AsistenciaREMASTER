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
const axios = require('axios');

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

router.post('/asistencias/:fecha/enviar-wsp', auth, staffAuth, async (req, res) => {
    try {
        const asistencia = await Asistencia.findOne({ fecha: req.params.fecha })
            .populate('registros.alumno', 'nombre nombreCompleto telefono');

        if (!asistencia) {
            return res.status(404).json({ error: 'No se encontró asistencia' });
        }

        const faltaron = asistencia.registros.filter(r => r.estado === 'F');
        if (faltaron.length === 0) {
            return res.json({ message: 'No hay alumnos que hayan faltado.' });
        }

        const WSP_TOKEN = process.env.WSP_TOKEN;
        const WSP_PHONE_ID = process.env.WSP_PHONE_ID;

        if (!WSP_TOKEN || !WSP_PHONE_ID) {
            return res.status(500).json({ error: 'Falta configuración de WhatsApp (token o phone ID)' });
        }

        let enviados = 0, errores = 0;
        const erroresDetalle = [];

        for (const r of faltaron) {
            const alumno = r.alumno;
            const telefono = alumno.telefono ? alumno.telefono.replace(/\D/g, '') : '';
            const nombre = alumno.nombreCompleto || alumno.nombre || '';

            if (!telefono || telefono.length < 9) {
                console.warn(`Teléfono inválido para ${nombre}: "${alumno.telefono}"`);
                errores++;
                erroresDetalle.push(`${nombre}: Teléfono inválido`);
                continue;
            }

            const payload = {
                messaging_product: "whatsapp",
                to: `51${telefono}`,
                type: "template",
                template: {
                    name: "alerta_faltas",
                    language: { code: "es" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: nombre },
                                { type: "text", text: asistencia.fecha }
                            ]
                        }
                    ]
                }
            };

            try {
                console.log(`Enviando mensaje a 51${telefono} (${nombre})`);
                console.log('Payload:', JSON.stringify(payload, null, 2));

                const response = await axios.post(
                    `https://graph.facebook.com/v19.0/${WSP_PHONE_ID}/messages`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${WSP_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                enviados++;
            } catch (err) {
                const errorMsg = err.response?.data?.error?.message || err.message;
                console.error(`❌ Error al enviar a ${telefono}: ${errorMsg}`);
                errores++;
                erroresDetalle.push(`${nombre} (${telefono}): ${errorMsg}`);
            }
        }

        const mensajeFinal = `✅ Mensajes enviados: ${enviados}, ❌ Errores: ${errores}`;
        const respuesta = { message: mensajeFinal };

        if (erroresDetalle.length > 0) {
            respuesta.erroresDetalle = erroresDetalle;
        }

        res.json(respuesta);
    } catch (error) {
        console.error('Error en enviar-wsp:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/reportes/semanal/wsp', auth, staffAuth, async (req, res) => {
    try {
        const { fechas } = req.body;

        if (!Array.isArray(fechas) || fechas.length === 0) {
            return res.status(400).json({ error: 'Debe proporcionar al menos una fecha' });
        }

        const asistencias = await Asistencia.find({ 
            fecha: { $in: fechas } 
        }).populate('registros.alumno', 'nombre nombreCompleto telefono');

        if (!asistencias || asistencias.length === 0) {
            return res.status(404).json({ error: 'No se encontraron asistencias para las fechas proporcionadas' });
        }

        // Consolidar faltas por alumno
        const faltasPorAlumno = new Map();

        asistencias.forEach(asistencia => {
            asistencia.registros.forEach(r => {
                if (r.estado === 'F' && r.alumno) {
                    const alumnoId = r.alumno._id.toString();
                    const alumno = r.alumno;
                    if (!faltasPorAlumno.has(alumnoId)) {
                        faltasPorAlumno.set(alumnoId, {
                            alumno,
                            fechas: []
                        });
                    }
                    faltasPorAlumno.get(alumnoId).fechas.push(asistencia.fecha);
                }
            });
        });

        if (faltasPorAlumno.size === 0) {
            return res.json({ message: 'No hay alumnos con faltas en las fechas proporcionadas.' });
        }

        const WSP_TOKEN = process.env.WSP_TOKEN;
        const WSP_PHONE_ID = process.env.WSP_PHONE_ID;

        if (!WSP_TOKEN || !WSP_PHONE_ID) {
            return res.status(500).json({ error: 'Falta configuración de WhatsApp (token o phone ID)' });
        }

        let enviados = 0, errores = 0;
        const erroresDetalle = [];

        for (const { alumno, fechas } of faltasPorAlumno.values()) {
            const telefono = alumno.telefono?.replace(/\D/g, '');
            const nombre = alumno.nombreCompleto || alumno.nombre || '';
            if (!telefono || telefono.length < 9) {
                errores++;
                erroresDetalle.push(`${nombre}: Teléfono inválido (${alumno.telefono})`);
                continue;
            }

            const textoFechas = fechas.join(', ');
            const mensaje = `Estimada/o ${nombre},

Se han registrado tus inasistencias los días ${textoFechas} en el sistema de control de asistencias del colegio.

Si se trata de un error o tienes una justificación, por favor comunícate con la coordinación lo antes posible.

Atentamente,
Coordinación Académica - Colegio Nuestra Señora de Lourdes`;

          const payload = {
  messaging_product: "whatsapp",
  to: `51${telefono}`,
  type: "template",
  template: {
    name: "alertafaltasvarias",
    language: { code: "es" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: nombre },
          { type: "text", text: textoFechas }
        ]
      }
    ]
  }
};


            try {
                const wspRes = await axios.post(`https://graph.facebook.com/v19.0/${WSP_PHONE_ID}/messages`, payload, {
  headers: {
    Authorization: `Bearer ${WSP_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
console.log('✅ WhatsApp response:', JSON.stringify(wspRes.data, null, 2));

                enviados++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // pequeña pausa
            } catch (err) {
                errores++;
                erroresDetalle.push(`${nombre} (${telefono}): ${err.response?.data?.error?.message || err.message}`);
            }
        }

        res.json({
            message: `✅ Mensajes enviados: ${enviados}, ❌ Errores: ${errores}`,
            erroresDetalle
        });

    } catch (error) {
        console.error('Error en reporte semanal:', error);
        res.status(500).json({ error: error.message });
    }
});



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
router.get('/asistencias/:fecha', auth, async (req, res) => {
    try {
        const asistencia = await Asistencia.findOne({ fecha: req.params.fecha })
            .populate('registros.alumno', 'nombre nombreCompleto email telefono numero grado seccion')
            .lean(); // <- ahora correctamente colocado después de populate

        if (!asistencia) {
            return res.status(404).json({ error: 'No se encontró asistencia para esa fecha' });
        }

        console.log(asistencia.registros.map(r => r.alumno.telefono)); // debería mostrar los teléfonos ahora
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
router.post('/asistencias/reporte-semanal/enviar-wsp', auth, staffAuth, async (req, res) => {
    console.log('📅 Fechas recibidas:', req.body.fechas);

    try {
        const { fechas, titulo } = req.body;
        
        if (!Array.isArray(fechas) || fechas.length === 0) {
            return res.status(400).json({ error: 'Debe proporcionar al menos una fecha' });
        }

        // Obtener todas las asistencias de las fechas seleccionadas
        const asistencias = await Asistencia.find({ 
            fecha: { $in: fechas } 
        })
        .populate('registros.alumno', 'nombre nombreCompleto telefono numero grado seccion')
        .sort({ fecha: 1 });

        if (asistencias.length === 0) {
            return res.status(404).json({ error: 'No se encontraron asistencias para las fechas seleccionadas' });
        }

        // Consolidar faltas por alumno
        const faltasPorAlumno = new Map();
        
        asistencias.forEach(asistencia => {
            asistencia.registros.forEach(registro => {
                if (registro.estado === 'F') {
                    const alumnoId = registro.alumno._id.toString();
                    const alumno = registro.alumno;
                    
                    if (!faltasPorAlumno.has(alumnoId)) {
                        faltasPorAlumno.set(alumnoId, {
                            alumno: {
                                nombre: alumno.nombreCompleto || alumno.nombre || '',
                                telefono: alumno.telefono,
                                numero: alumno.numero,
                                grado: alumno.grado,
                                seccion: alumno.seccion
                            },
                            fechasFaltas: []
                        });
                    }
                    
                    faltasPorAlumno.get(alumnoId).fechasFaltas.push(asistencia.fecha);
                }
            });
        });

        if (faltasPorAlumno.size === 0) {
            return res.json({ message: 'No hay alumnos con faltas en las fechas seleccionadas.' });
        }

        const WSP_TOKEN = process.env.WSP_TOKEN;
        const WSP_PHONE_ID = process.env.WSP_PHONE_ID;

        if (!WSP_TOKEN || !WSP_PHONE_ID) {
            return res.status(500).json({ error: 'Configuración de WhatsApp no encontrada' });
        }

        let enviados = 0, errores = 0;
        const erroresDetalle = [];

        // Enviar mensaje consolidado a cada padre de familia
        for (const [alumnoId, data] of faltasPorAlumno) {
            const { alumno, fechasFaltas } = data;
            const telefono = alumno.telefono ? alumno.telefono.replace(/\D/g, '') : '';
            
            if (!telefono) {
                erroresDetalle.push(`${alumno.nombre}: No tiene teléfono registrado`);
                errores++;
                continue;
            }

            // Crear mensaje personalizado
            const fechasFormateadas = fechasFaltas.join(', ');
            const totalFaltas = fechasFaltas.length;
            const mensajePersonalizado = `${titulo || 'Reporte de Asistencias'}

Estimado padre/madre de familia:

Le informamos sobre las inasistencias de su hijo/a *${alumno.nombre}*:

📅 *Fechas con faltas:* ${fechasFormateadas}
📊 *Total de faltas:* ${totalFaltas}
👤 *Estudiante:* ${alumno.nombre}
🎓 *Grado:* ${alumno.grado || 'No especificado'}
📚 *Sección:* ${alumno.seccion || 'No especificado'}

Por favor, coordine con la institución para justificar las inasistencias correspondientes.

_Mensaje automático del sistema de asistencias_`;

            try {
                await axios.post(
                    `https://graph.facebook.com/v19.0/${WSP_PHONE_ID}/messages`,
                    {
                        messaging_product: "whatsapp",
                        to: `51${telefono}`,
                        type: "text",
                        text: {
                            body: mensajePersonalizado
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${WSP_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                enviados++;
                
                // Pequeña pausa entre mensajes para evitar límites de rate
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (err) {
                const errorMsg = `${alumno.nombre} (${telefono}): ${err.response?.data?.error?.message || err.message}`;
                console.error(`Error al enviar mensaje a ${telefono}:`, err.response?.data || err.message);
                erroresDetalle.push(errorMsg);
                errores++;
            }
        }

        // Preparar respuesta detallada
        let mensaje = `Reporte semanal procesado:\n`;
        mensaje += `✅ Mensajes enviados: ${enviados}\n`;
        mensaje += `❌ Errores: ${errores}\n`;
        mensaje += `📊 Alumnos con faltas: ${faltasPorAlumno.size}\n`;
        mensaje += `📅 Fechas procesadas: ${fechas.length} (${fechas.join(', ')})`;

        const respuesta = { 
            message: mensaje,
            detalles: {
                enviados,
                errores,
                totalAlumnosConFaltas: faltasPorAlumno.size,
                fechasProcesadas: fechas.length,
                fechas: fechas
            }
        };

        // Agregar detalles de errores si los hay
        if (erroresDetalle.length > 0) {
            respuesta.erroresDetalle = erroresDetalle;
        }

        res.json(respuesta);

    } catch (error) {
        console.error('Error en reporte semanal:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al procesar reporte semanal',
            detalle: error.message 
        });
    }
});
module.exports = router; 