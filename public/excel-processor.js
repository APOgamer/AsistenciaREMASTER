class ExcelProcessor {
    constructor() {
        this.students = [];
        this.errors = [];
    }

    async processFile(file) {
        this.errors = [];
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    this.processWorkbook(workbook);
                    if (this.errors.length > 0) {
                        reject({ type: 'format', errors: this.errors });
                    } else if (this.students.length === 0) {
                        reject({ type: 'empty', errors: ['No se encontraron alumnos válidos en el archivo.'] });
                    } else {
                        resolve(this.students);
                    }
                } catch (error) {
                    reject({ type: 'exception', errors: [error.message] });
                }
            };
            
            reader.onerror = (error) => reject({ type: 'exception', errors: [error.message] });
            reader.readAsArrayBuffer(file);
        });
    }

    processWorkbook(workbook) {
        this.students = [];
        this.errors = [];
        let hojasValidas = 0;
        
        workbook.SheetNames.forEach(sheetName => {
            // Validar nombre de hoja
            const gradoMatch = sheetName.match(/\d+/);
            const seccionMatch = sheetName.match(/[A-F]$/);
            if (!gradoMatch || !seccionMatch) {
                this.errors.push(`La hoja "${sheetName}" no tiene el formato esperado (ejemplo: "5A", "6B").`);
                return;
            }
            hojasValidas++;
            const grado = parseInt(gradoMatch[0]);
            const seccion = seccionMatch[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            let filasValidas = 0;
            for (let i = 4; i < 34; i++) {
                if (!data[i] || !data[i][0]) continue;
                const numero = parseInt(data[i][0]);
                const codigo = data[i][1] || '';
                const nombreCompleto = data[i][2] || '';
                const email = data[i][4] || '';
                const password = data[i][5] || '';
                const telefono = data[i][6] || '';
                if (
                    !isNaN(numero) &&
                    nombreCompleto &&
                    nombreCompleto.toLowerCase() !== 'nombre completo' &&
                    email.toLowerCase() !== 'email' &&
                    telefono.toLowerCase() !== 'teléfono'
                ) {
                    this.students.push({
                        numero,
                        codigo,
                        nombreCompleto,
                        email,
                        password,
                        telefono,
                        grado,
                        seccion
                    });
                    filasValidas++;
                }
            }
            if (filasValidas === 0) {
                this.errors.push(`La hoja "${sheetName}" no contiene filas válidas. Se espera al menos un alumno con número y nombre completo.`);
            }
        });
        if (hojasValidas === 0) {
            this.errors.push('Ninguna hoja del archivo tiene el formato correcto. Ejemplo esperado: "5A", "6B".');
        }
    }

    generatePreviewHTML() {
        const previewHTML = [];
        const groupedStudents = this.students.reduce((acc, student) => {
            const key = `${student.grado}${student.seccion}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(student);
            return acc;
        }, {});
        Object.entries(groupedStudents).forEach(([key, students]) => {
            const tableHTML = `
                <div class="preview-table">
                    <h4>Grado ${key}</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Número</th>
                                <th>Código</th>
                                <th>Nombre Completo</th>
                                <th>Email</th>
                                <th>Teléfono</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => `
                                <tr>
                                    <td>${student.numero}</td>
                                    <td>${student.codigo}</td>
                                    <td>${student.nombreCompleto}</td>
                                    <td>${student.email}</td>
                                    <td>${student.telefono}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            previewHTML.push(tableHTML);
        });
        return previewHTML.join('');
    }
} 