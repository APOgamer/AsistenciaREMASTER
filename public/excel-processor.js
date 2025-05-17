class ExcelProcessor {
    constructor() {
        this.students = [];
    }

    async processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    this.processWorkbook(workbook);
                    resolve(this.students);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    processWorkbook(workbook) {
        this.students = [];
        
        // Procesar cada hoja del libro
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            // Extraer el grado del nombre de la hoja (ejemplo: "5A" -> grado 5)
            const grado = parseInt(sheetName.match(/\d+/)[0]);
            const seccion = sheetName.match(/[A-F]$/)[0];
            
            // Procesar filas desde A5 hasta A34
            for (let i = 4; i < 34; i++) {
                if (!data[i] || !data[i][0]) continue; // Saltar filas vacías
                
                const numero = data[i][0];
                const codigo = data[i][1] || '';
                const nombreCompleto = data[i][2] || '';
                const email = data[i][4] || '';
                const password = data[i][5] || '';
                const telefono = data[i][6] || '';
                
                if (numero && nombreCompleto) {
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
                }
            }
        });
    }

    generatePreviewHTML() {
        const previewHTML = [];
        
        // Agrupar estudiantes por grado y sección
        const groupedStudents = this.students.reduce((acc, student) => {
            const key = `${student.grado}${student.seccion}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(student);
            return acc;
        }, {});
        
        // Generar tabla para cada grupo
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