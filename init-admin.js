require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    try {
        // Verificar si ya existe un admin
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('El usuario administrador ya existe');
            process.exit(0);
        }

        // Crear usuario admin
        const admin = new User({
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            nombre: 'Administrador',
            email: 'admin@example.com',
            telefono: '',
            role: 'admin'
        });

        await admin.save();
        console.log('Usuario administrador creado exitosamente');
    } catch (error) {
        console.error('Error al crear el usuario administrador:', error);
    } finally {
        mongoose.connection.close();
    }
}).catch(error => {
    console.error('Error al conectar a MongoDB:', error);
}); 