const express = require('express');
const ExcelJS = require('exceljs');
const mysql = require('mysql');
const cors = require('cors');
const PDFDocument = require('pdfkit'); 
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const axios = require('axios');
const router = require('express/lib/router');

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'sql309.infinityfree.com',
  user: 'if0_37637506',     
  password: 's4urj9Wv9e', 
  database: 'if0_37637506_XXX',
  port: 3306
});


db.connect(err => {
  if (err) {
    console.log('Error al conectar con la base de datos', err);
  } else {
    console.log('Conexión a la base de datos exitosa');
  }
});


app.post('/registro', (req, res) => {
  const { nombre, apellido, email, contrasena, telefono, fecha_nacimiento, direccion, rol } = req.body;

  const checkEmailQuery = 'SELECT * FROM usuarios WHERE email = ?';
  db.query(checkEmailQuery, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const insertQuery = 'INSERT INTO usuarios (nombre, apellido, email, contrasena, telefono, fecha_nacimiento, direccion, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(insertQuery, [nombre, apellido, email, contrasena, telefono, fecha_nacimiento, direccion, rol], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error al registrar el usuario' });
      }

      res.status(201).json({ message: 'Usuario registrado exitosamente' });
    });
  });
});


app.post('/login', (req, res) => {
  const { email, password, rol } = req.body; 

  const query = 'SELECT * FROM usuarios WHERE email = ?';

  db.query(query, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length > 0) {
      const user = results[0];

      if (password === user.contrasena) {
        if (rol === user.rol) {
          res.json({ 
            success: true, 
            message: 'Inicio de sesión exitoso', 
            user: {
              id: user.id,
              nombre: user.nombre,
              apellido: user.apellido,
              email: user.email,
              rol: user.rol,
            } 
          });
        } else {
          return res.status(400).json({ error: 'Credenciales incorrectas' });
        }
      } else {
        res.status(400).json({ error: 'Credenciales incorrectas' });
      }
    } else {
      res.status(400).json({ error: 'Usuario no encontrado' });
    }
  });
});


app.post('/citas', (req, res) => {
  const { dpi, nombre_cita, edad_cita, genero, fecha_cita, medico, meses } = req.body;

  const sqlInsert = `INSERT INTO citas (dpi, nombre_cita, edad_cita, genero, fecha_cita, medico) VALUES (?, ?, ?, ?, ?, ?)`;
  const sqlCheck = `SELECT * FROM citas WHERE dpi = ? AND fecha_cita = ?`;

  db.query(sqlCheck, [dpi, fecha_cita], (err, results) => {
    if (err) {
      console.error('Error al verificar cita duplicada:', err.message, err.stack);
      return res.status(500).send('Error al verificar cita duplicada');
    }

    if (results.length > 0) {
      return res.status(400).send('Cita ya registrada para esta fecha');
    }

    db.query(sqlInsert, [dpi, nombre_cita, edad_cita, genero, fecha_cita, medico], (err, result) => {
      if (err) {
        console.error('Error al insertar la primera cita:', err.message, err.stack);
        return res.status(500).send('Error al registrar la primera cita');
      }

      if (meses > 1) {
        const fechaBase = new Date(fecha_cita);

        for (let i = 1; i < meses; i++) {
          const nuevaFecha = new Date(fechaBase);
          nuevaFecha.setMonth(fechaBase.getMonth() + i);

          db.query(sqlCheck, [dpi, nuevaFecha.toISOString().split('T')[0]], (err, results) => {
            if (err) {
              console.error('Error al verificar cita duplicada:', err.message);
              return;
            }

            if (results.length === 0) { 
              db.query(sqlInsert, [dpi, nombre_cita, edad_cita, genero, nuevaFecha.toISOString().split('T')[0], medico], (err) => {
                if (err) {
                  console.error('Error al insertar la cita adicional:', err.message);
                }
              });
            } else {
              console.log(`Cita ya registrada para el DPI ${dpi} en la fecha ${nuevaFecha.toISOString().split('T')[0]}`);
            }
          });
        }
      }

      res.status(200).send('Paciente registrado correctamente y citas generadas');
    });
  });
});


app.get('/tablaCitas', (req, res) => {
  const fecha = req.query.fecha; 
  const query = 'SELECT dpi, nombre_cita, medico, genero, fecha_cita FROM citas WHERE DATE(fecha_cita) = ?';
  
  db.query(query, [fecha], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get('/paciente_v/:dpi', (req, res) => {
  const { dpi } = req.params;

  const query = `
    SELECT 
      p.*, 
      pg.peso, 
      pg.altura, 
      pg.presion_arterial, 
      pg.frecuencia_cardiaca, 
      pg.nivel_glucosa, 
      pg.colesterol_total, 
      me.fecha_probable_parto, 
      me.numero_embarazos, 
      me.trimestre_actual, 
      me.semanas_gestacion, 
      me.fecha_ultimo_ultrasonido, 
      me.peso_preembarazo, 
      me.peso_actual, 
      me.hipertension, 
      me.diabetes_gestacional, 
      i.peso_al_nacer, 
      i.altura_al_nacer, 
      i.vacunas_aplicadas, 
      i.desarrollo_motor, 
      i.fecha_ultimo_control, 
      i.lactancia_materna, 
      i.tipo_lactancia
    FROM pacientes p
    LEFT JOIN pacientesGenerales pg ON p.paciente_id = pg.paciente_id
    LEFT JOIN mujeresEmbarazadas me ON p.paciente_id = me.paciente_id
    LEFT JOIN infantes i ON p.paciente_id = i.paciente_id
    WHERE p.dpi_paciente = ?`;

  db.query(query, [dpi], (error, results) => {
    if (error) {
      console.error("Error en la consulta a la base de datos:", error);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json(results[0]);
  });
});

app.post('/pacientes_r', (req, res) => {
  const {
      dpi_paciente,
      nombres_paciente,
      apellidos_paciente,
      direccion,
      fecha_nacimiento,
      genero,
      diagnostico,
      tipo_paciente,
      telefono,
      email,
      contacto_emergencia,
      telefono_contacto_emergencia,
      antecedentes_medicos,
      alergias,
      peso,
      altura,
      presion_arterial,
      frecuencia_cardiaca,
      nivel_glucosa,
      colesterol_total,
      antecedentes_familiares,
      fecha_probable_parto,
      numero_embarazos,
      trimestre_actual,
      semanas_gestacion,
      fecha_ultimo_ultrasonido,
      peso_preembarazo,
      peso_actual,
      hipertension,
      diabetes_gestacional,
      peso_al_nacer,
      altura_al_nacer,
      vacunas_aplicadas,
      desarrollo_motor,
      fecha_ultimo_control,
      lactancia_materna,
      tipo_lactancia
  } = req.body;

  if (!dpi_paciente || !nombres_paciente || !apellidos_paciente || !direccion || !fecha_nacimiento || !genero) {
      return res.status(400).json({ error: 'DPI, nombres, apellidos, dirección, fecha de nacimiento y género son obligatorios.' });
  }

  if (!['General', 'Embarazada', 'Infante'].includes(tipo_paciente)) {
      return res.status(400).json({ error: 'Tipo de paciente no válido.' });
  }

  const queryPaciente = `
      INSERT INTO pacientes (
          dpi_paciente, 
          nombres_paciente, 
          apellidos_paciente, 
          direccion, 
          fecha_nacimiento, 
          genero, 
          diagnostico, 
          tipo_paciente,
          telefono,
          email,
          contacto_emergencia,
          telefono_contacto_emergencia,
          antecedentes_medicos,
          alergias
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(queryPaciente, [
      dpi_paciente,
      nombres_paciente,
      apellidos_paciente,
      direccion,
      fecha_nacimiento,
      genero,
      diagnostico,
      tipo_paciente,
      telefono,
      email,
      contacto_emergencia,
      telefono_contacto_emergencia,
      antecedentes_medicos,
      alergias
  ], (err, result) => {
      if (err) {
          console.error('Error al insertar paciente:', err.message);
          return res.status(500).json({ error: 'Error al insertar paciente en la base de datos.' });
      }

      const pacienteId = result.insertId;

      if (tipo_paciente === 'General') {
          const queryGeneral = `
              INSERT INTO pacientesGenerales (
                  paciente_id, 
                  peso, 
                  altura, 
                  presion_arterial, 
                  frecuencia_cardiaca, 
                  nivel_glucosa, 
                  colesterol_total, 
                  antecedentes_familiares
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.query(queryGeneral, [pacienteId, peso, altura, presion_arterial, frecuencia_cardiaca, nivel_glucosa, colesterol_total, antecedentes_familiares], (err) => {
              if (err) {
                  console.error('Error al insertar paciente general:', err.message);
                  return res.status(500).json({ error: 'Error al insertar paciente general.' });
              }
              res.status(201).json({ message: 'Paciente general insertado correctamente' });
          });
      } else if (tipo_paciente === 'Embarazada') {
          const queryEmbarazada = `
              INSERT INTO mujeresEmbarazadas (
                  paciente_id, 
                  fecha_probable_parto, 
                  numero_embarazos, 
                  trimestre_actual, 
                  semanas_gestacion, 
                  fecha_ultimo_ultrasonido, 
                  peso_preembarazo, 
                  peso_actual, 
                  hipertension, 
                  diabetes_gestacional
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.query(queryEmbarazada, [
              pacienteId, 
              fecha_probable_parto, 
              numero_embarazos, 
              trimestre_actual, 
              semanas_gestacion, 
              fecha_ultimo_ultrasonido, 
              peso_preembarazo, 
              peso_actual, 
              hipertension, 
              diabetes_gestacional
          ], (err) => {
              if (err) {
                  console.error('Error al insertar paciente embarazada:', err.message);
                  return res.status(500).json({ error: 'Error al insertar paciente embarazada.' });
              }
              res.status(201).json({ message: 'Paciente embarazada insertada correctamente' });
          });
      } else if (tipo_paciente === 'Infante') {
          const queryInfante = `
              INSERT INTO infantes (
                  paciente_id, 
                  peso_al_nacer, 
                  altura_al_nacer, 
                  vacunas_aplicadas, 
                  desarrollo_motor, 
                  fecha_ultimo_control, 
                  lactancia_materna, 
                  tipo_lactancia
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.query(queryInfante, [
              pacienteId, 
              peso_al_nacer, 
              altura_al_nacer, 
              vacunas_aplicadas, 
              desarrollo_motor, 
              fecha_ultimo_control, 
              lactancia_materna, 
              tipo_lactancia
          ], (err) => {
              if (err) {
                  console.error('Error al insertar infante:', err.message);
                  return res.status(500).json({ error: 'Error al insertar infante.' });
              }
              res.status(201).json({ message: 'Infante insertado correctamente' });
          });
      }
  });
});


app.get('/pacientes', (req, res) => {
  const { dpi, tipo } = req.query;

  let sql = '';
  let params = [];

  if (dpi) {
      sql = `SELECT * FROM pacientes WHERE dpi_paciente = ?`;
      params.push(dpi);
  } else if (tipo) {
      sql = `SELECT * FROM pacientes WHERE tipo_paciente = ?`;
      params.push(tipo);
  } else {
      return res.status(400).json({ error: 'Se debe proporcionar el DPI o el tipo de paciente' });
  }

  db.query(sql, params, (err, results) => {
      if (err) {
          console.error('Error executing query:', err);
          return res.status(500).json({ error: 'Error al ejecutar la consulta' });
      }

      if (results.length > 0) {
          res.json(results);
      } else {
          res.status(404).json({ message: 'Paciente no encontrado' });
      }
  });
});

app.get('/generar-pdf/:dpi', (req, res) => {
  const dpi = req.params.dpi;

  if (!dpi || dpi.trim() === '') {
    return res.status(400).send('DPI inválido');
  }

  const query = 'SELECT paciente_id, dpi_paciente, nombres_paciente, apellidos_paciente, fecha_registro, tipo_paciente, diagnostico, genero FROM pacientes WHERE dpi_paciente = ?';

  db.query(query, [dpi], async (err, results) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      return res.status(500).send('Error al consultar la base de datos');
    }

    if (results.length === 0) {
      return res.status(404).send('No se encontró al paciente');
    }

    const paciente = results[0];
    const pacienteId = paciente.paciente_id; 

    const fechaRegistro = new Date(paciente.fecha_registro);
    const fechaFormateada = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(fechaRegistro);

    try {
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Disposition', `attachment; filename=paciente_${dpi}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');

      doc.pipe(res);
      const imageUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzkbgTlfmzY5oSWd4_BtAL-BBsVKwfhre_2g&s';
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');
      
      doc.image(imageBuffer, 50, 50, { width: 100 }); 

      doc.fontSize(16).text('CENTRO DE SALUD DE TOTONICAPÁN', 200, 70, { align: 'center' });

      doc.moveDown(4); 

      doc.fontSize(20).text('Detalles del Paciente', { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(12).text(`DPI: ${paciente.dpi_paciente}`, { continued: true });
      doc.text(`Nombres: ${paciente.nombres_paciente}`);
      doc.text(`Apellidos: ${paciente.apellidos_paciente}`);
      doc.text(`Fecha de Registro: ${fechaFormateada}`);
      doc.text(`Tipo de Paciente: ${paciente.tipo_paciente}`);
      doc.text(`Diagnóstico: ${paciente.diagnostico}`);
      doc.text(`Género: ${paciente.genero}`);

      const detallesPromesas = [];

      if (paciente.tipo_paciente === 'General') {
        const queryGeneral = 'SELECT peso, altura, presion_arterial, frecuencia_cardiaca, nivel_glucosa, colesterol_total, antecedentes_familiares FROM pacientesGenerales WHERE paciente_id = ?';
        detallesPromesas.push(new Promise((resolve, reject) => {
          db.query(queryGeneral, [pacienteId], (err, generalResults) => {
            if (err) {
              return reject('Error al consultar pacientesGenerales: ' + err);
            }
            if (generalResults.length > 0) {
              const general = generalResults[0];
              doc.moveDown().text('Detalles Generales:');
              doc.text(`Peso: ${general.peso}`);
              doc.text(`Altura: ${general.altura}`);
              doc.text(`Presión Arterial: ${general.presion_arterial}`);
              doc.text(`Frecuencia Cardíaca: ${general.frecuencia_cardiaca}`);
              doc.text(`Nivel de Glucosa: ${general.nivel_glucosa}`);
              doc.text(`Colesterol Total: ${general.colesterol_total}`);
              doc.text(`Antecedentes Familiares: ${general.antecedentes_familiares}`);
            }
            resolve();
          });
        }));
      } else if (paciente.tipo_paciente === 'Embarazada') {
        const queryEmbarazada = 'SELECT fecha_probable_parto, numero_embarazos, trimestre_actual, semanas_gestacion, fecha_ultimo_ultrasonido, peso_preembarazo, peso_actual, hipertension, diabetes_gestacional FROM mujeresEmbarazadas WHERE paciente_id = ?';
        detallesPromesas.push(new Promise((resolve, reject) => {
          db.query(queryEmbarazada, [pacienteId], (err, embarazadaResults) => {
            if (err) {
              return reject('Error al consultar mujeresEmbarazadas: ' + err);
            }
            if (embarazadaResults.length > 0) {
              const embarazada = embarazadaResults[0];

              const fechaProbableParto = new Date(embarazada.fecha_probable_parto);
              const fechaFormateadaParto = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(fechaProbableParto);

              const fechaUltimoUltrasonido = new Date(embarazada.fecha_ultimo_ultrasonido);
              const fechaFormateadaUltrasonido = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(fechaUltimoUltrasonido);


              doc.moveDown().text('Detalles Embarazada:');
              doc.text(`Fecha Probable de Parto: ${fechaFormateadaParto}`);
              doc.text(`Número de Embarazos: ${embarazada.numero_embarazos}`);
              doc.text(`Trimestre Actual: ${embarazada.trimestre_actual}`);
              doc.text(`Semanas de Gestación: ${embarazada.semanas_gestacion}`);
              doc.text(`Fecha Último Ultrasonido: ${fechaFormateadaUltrasonido}`);
              doc.text(`Peso Preembarazo: ${embarazada.peso_preembarazo}`);
              doc.text(`Peso Actual: ${embarazada.peso_actual}`);
              doc.text(`Hipertensión: ${embarazada.hipertension ? 'Sí' : 'No'}`);
              doc.text(`Diabetes Gestacional: ${embarazada.diabetes_gestacional ? 'Sí' : 'No'}`);
            }
            resolve();
          });
        }));
      } else if (paciente.tipo_paciente === 'Infante') {
        const queryInfante = 'SELECT peso_al_nacer, altura_al_nacer, vacunas_aplicadas, desarrollo_motor, fecha_ultimo_control, lactancia_materna, tipo_lactancia FROM infantes WHERE paciente_id = ?';
        detallesPromesas.push(new Promise((resolve, reject) => {
          db.query(queryInfante, [pacienteId], (err, infanteResults) => {
            if (err) {
              return reject('Error al consultar infantes: ' + err);
            }
            if (infanteResults.length > 0) {
              const infante = infanteResults[0];

              const fechaUltimoControl = new Date(infante.fecha_ultimo_control);
              const fechaFormateadaControl = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(fechaUltimoControl);

              doc.moveDown().text('Detalles Infante:');
              doc.text(`Peso al Nacer: ${infante.peso_al_nacer}`);
              doc.text(`Altura al Nacer: ${infante.altura_al_nacer}`);
              doc.text(`Vacunas Aplicadas: ${infante.vacunas_aplicadas}`);
              doc.text(`Desarrollo Motor: ${infante.desarrollo_motor}`);
              doc.text(`Fecha Último Control: ${fechaFormateadaControl}`);
              doc.text(`Lactancia Materna: ${infante.lactancia_materna ? 'Sí' : 'No'}`);
              doc.text(`Tipo de Lactancia: ${infante.tipo_lactancia}`);
            }
            resolve();
          });
        }));
      }

      await Promise.all(detallesPromesas);

      console.log("Generando código QR para DPI:", paciente.dpi_paciente);

      try {
        const qrCodeUrl = await QRCode.toDataURL(String(paciente.dpi_paciente)); 
        console.log("Código QR generado correctamente");

        doc.moveDown();
        doc.text("Código QR generado para este paciente:");
        doc.image(qrCodeUrl, {
          fit: [100, 100], 
          align: 'center',
        });
      } catch (qrError) {
        console.error("Error al generar el código QR:", qrError);
        doc.text("No se pudo generar el código QR"); 
      }

      doc.end();

    } catch (pdfError) {
      console.error("Error al generar el PDF:", pdfError);
      if (!res.headersSent) {
        res.status(500).send("Error al generar el PDF");
      }
    }
  });
});

app.get('/generar-reporte/:tipo', (req, res) => {
  const { tipo } = req.params;
  let query = '';
  
  if (tipo === 'general') {
    query = 'SELECT dpi_paciente, nombres_paciente, apellidos_paciente, peso, altura, presion_arterial, frecuencia_cardiaca, nivel_glucosa, colesterol_total, antecedentes_familiares FROM pacientes JOIN pacientesgenerales ON pacientes.paciente_id = pacientesgenerales.paciente_id';
  } else if (tipo === 'embarazos') {
    query = 'SELECT dpi_paciente, nombres_paciente, apellidos_paciente, fecha_probable_parto, numero_embarazos, trimestre_actual, semanas_gestacion, fecha_ultimo_ultrasonido, peso_preembarazo, peso_actual, hipertension, diabetes_gestacional FROM pacientes JOIN mujeresembarazadas ON pacientes.paciente_id = mujeresembarazadas.paciente_id';
  } else if (tipo === 'infantes') {
    query = 'SELECT dpi_paciente, nombres_paciente, apellidos_paciente, peso_al_nacer, altura_al_nacer, vacunas_aplicadas, desarrollo_motor, fecha_ultimo_control, lactancia_materna, tipo_lactancia FROM pacientes JOIN infantes ON pacientes.paciente_id = infantes.paciente_id';
  } else {
    return res.status(400).send('Tipo de reporte inválido');
  }

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).send('Error en la consulta');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    if (tipo === 'general') {
      worksheet.columns = [
        { header: 'DPI', key: 'dpi_paciente', width: 15 },
        { header: 'Nombres', key: 'nombres_paciente', width: 25 },
        { header: 'Apellidos', key: 'apellidos_paciente', width: 25 },
        { header: 'Peso', key: 'peso', width: 10 },
        { header: 'Altura', key: 'altura', width: 10 },
        { header: 'Presión Arterial', key: 'presion_arterial', width: 15 },
        { header: 'Frecuencia Cardiaca', key: 'frecuencia_cardiaca', width: 18 },
        { header: 'Nivel de Glucosa', key: 'nivel_glucosa', width: 15 },
        { header: 'Colesterol Total', key: 'colesterol_total', width: 15 },
        { header: 'Antecedentes Familiares', key: 'antecedentes_familiares', width: 25 },
      ];
    } else if (tipo === 'embarazos') {
      worksheet.columns = [
        { header: 'DPI', key: 'dpi_paciente', width: 15 },
        { header: 'Nombres', key: 'nombres_paciente', width: 25 },
        { header: 'Apellidos', key: 'apellidos_paciente', width: 25 },
        { header: 'Fecha Probable de Parto', key: 'fecha_probable_parto', width: 20 },
        { header: 'Número de Embarazos', key: 'numero_embarazos', width: 15 },
        { header: 'Trimestre Actual', key: 'trimestre_actual', width: 15 },
        { header: 'Semanas de Gestación', key: 'semanas_gestacion', width: 15 },
        { header: 'Fecha Último Ultrasonido', key: 'fecha_ultimo_ultrasonido', width: 20 },
        { header: 'Peso Preembarazo', key: 'peso_preembarazo', width: 15 },
        { header: 'Peso Actual', key: 'peso_actual', width: 15 },
        { header: 'Hipertensión', key: 'hipertension', width: 15 },
        { header: 'Diabetes Gestacional', key: 'diabetes_gestacional', width: 18 },
      ];
    } else if (tipo === 'infantes') {
      worksheet.columns = [
        { header: 'DPI', key: 'dpi_paciente', width: 15 },
        { header: 'Nombres', key: 'nombres_paciente', width: 25 },
        { header: 'Apellidos', key: 'apellidos_paciente', width: 25 },
        { header: 'Peso al Nacer', key: 'peso_al_nacer', width: 15 },
        { header: 'Altura al Nacer', key: 'altura_al_nacer', width: 15 },
        { header: 'Vacunas Aplicadas', key: 'vacunas_aplicadas', width: 20 },
        { header: 'Desarrollo Motor', key: 'desarrollo_motor', width: 20 },
        { header: 'Fecha Último Control', key: 'fecha_ultimo_control', width: 20 },
        { header: 'Lactancia Materna', key: 'lactancia_materna', width: 15 },
        { header: 'Tipo de Lactancia', key: 'tipo_lactancia', width: 15 },
      ];
    }

    worksheet.addRows(results);

    res.setHeader('Content-Disposition', `attachment; filename=reporte_${tipo}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    workbook.xlsx.write(res)
      .then(() => {
        res.end();
      })
      .catch((err) => {
        console.error("Error al generar el archivo Excel:", err);
        res.status(500).send('Error al generar el archivo Excel');
      });
  });
});

app.listen(3306, () => {
  console.log('Servidor corriendo en el puerto 3306');
});

  
