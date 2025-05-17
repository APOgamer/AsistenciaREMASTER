require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const initAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Verificar si ya existe un admin
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            console.log('El usuario administrador ya existe');
            process.exit(0);
        }

        // Crear usuario admin
        const admin = new User({
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            role: 'admin',
            nombre: 'Administrador',
            email: 'admin@example.com',
            telefono: ''
        });

        await admin.save();
        console.log('Usuario administrador creado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('Error al crear el usuario administrador:', error);
        process.exit(1);
    }
};

initAdmin(); 