function generarCsvAxet_FinalUI() {
  console.time("Tiempo Total");
  console.log("--- GENERANDO CSV (Interfaz Final) ---");
  
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var codigoUsuario = "T000000"; // Reemplaza con tu código de empleado

  // 1. MAPEO A, B, C, D
  var mapaColores = {
    "#ffff00": "A", // Diseño
    "#a4c2f4": "B", // Construcción
    "#8e7cc3": "C", // Pruebas
    "#6aa84f": "D"  // Despliegue
  };

  // 2. OBTENER DATOS
  var rangoTotal = hoja.getDataRange();
  var matrizTextos = rangoTotal.getDisplayValues(); 
  var matrizFondos = rangoTotal.getBackgrounds();   
  
  // 3. LOCALIZAR FILAS CLAVE
  var filaMeses = 0; 
  var filaEncabezados = -1;
  var filaUsuario = -1;
  var filaFinBloque = -1;

  for (var i = 0; i < matrizTextos.length; i++) {
    var celdaA = String(matrizTextos[i][0]).trim();
    var celdaALower = celdaA.toLowerCase();

    if (celdaALower === "usuario") {
      filaEncabezados = i;
    } else if (celdaA === codigoUsuario) {
      filaUsuario = i;
    } else if (filaUsuario !== -1 && celdaA !== "" && filaFinBloque === -1) {
      filaFinBloque = i;
    }
  }

  if (filaUsuario === -1) { SpreadsheetApp.getUi().alert("❌ Usuario " + codigoUsuario + " no encontrado."); return; }
  if (filaEncabezados === -1) { SpreadsheetApp.getUi().alert("❌ Fila de encabezados no encontrada."); return; }
  if (filaFinBloque === -1) filaFinBloque = matrizTextos.length; 
  var filaHorasEsperadas = filaFinBloque - 1;

  // 4. DETECTAR CALENDARIO
  var colInicioCalendario = -1;
  var headerRow = matrizTextos[filaEncabezados];
  for (var c = 0; c < headerRow.length; c++) {
    if (!isNaN(parseInt(headerRow[c])) && parseInt(headerRow[c]) > 20) {
      colInicioCalendario = c; break;
    }
  }
  if (colInicioCalendario === -1) {
     for (var c = 0; c < matrizTextos[0].length; c++) {
        if (matrizTextos[0][c].includes("202")) { colInicioCalendario = c; break; }
     }
  }

  // 5. CONSTRUCCIÓN CSV
  var filasCSV = [];
  filasCSV.push(matrizTextos[filaMeses]);       // Fila 1: Meses
  filasCSV.push(matrizTextos[filaEncabezados]); // Fila 2: Encabezados (Salta basura intermedia)

  // Filas Usuario (Transformación)
  for (var r = filaUsuario; r < filaHorasEsperadas; r++) {
    var filaTransformada = matrizTextos[r].map(function(textoCelda, colIndex) {
      if (colIndex >= colInicioCalendario) {
        var colorCelda = matrizFondos[r][colIndex];
        var letraAsignada = mapaColores[colorCelda.toLowerCase()]; 
        
        if (letraAsignada) {
          // Limpiar letras viejas, mantener números (con coma o punto)
          var valorLimpio = textoCelda.replace(/[a-zA-Z]/g, "").trim();
          var esNumero = /[0-9]/.test(valorLimpio);
          
          if (esNumero) {
            return valorLimpio + letraAsignada; // "4,5" + "B" -> "4,5B"
          } else {
            return letraAsignada; // "B"
          }
        }
      }
      return textoCelda;
    });
    filasCSV.push(filaTransformada);
  }
  // Fila Final
  filasCSV.push(matrizTextos[filaHorasEsperadas]);

  // 6. GENERAR Y MOSTRAR VENTANA HTML
  var escapeCsv = function(row) {
    return row.map(function(field) {
      var str = String(field);
      if (str.search(/("|,|\n)/g) >= 0) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    }).join(",");
  };

  var csvString = filasCSV.map(escapeCsv).join("\r\n");
  var nombreArchivo = "Importacion_" + codigoUsuario + "_Final.csv";
  var csvBase64 = Utilities.base64Encode(csvString, Utilities.Charset.UTF_8);
  
  // --- AQUI ESTÁ EL HTML QUE PEDISTE ---
  var htmlContent = `
    <div style="text-align:center; font-family:sans-serif; padding-top:20px;">
       
       <h3 style="color:#28a745;">✅ CSV Generado con Éxito</h3>
       
       <p style="font-size: 14px;">Proceda a importar en la extensión <strong>Axet-AutoIncurrido</strong></p>
       <br>
       
       <a href="data:text/csv;charset=utf-8;base64,${csvBase64}" download="${nombreArchivo}"
          style="background-color:#007bff; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:bold; font-size:14px;">
          📥 DESCARGAR CSV
       </a>
       
       <p style="font-size: 0.85em; color: #666; margin-top: 20px;">
         Si la descarga no comenzó automáticamente, haz clic en el botón de arriba.
       </p>
       
       <script>
         // Intento de descarga automática tras 1.5 segundos
         setTimeout(function(){ 
            document.querySelector('a').click(); 
         }, 1500);
       </script>
    </div>
  `;
  
  var htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(280);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Descargar CSV');
  
  console.timeEnd("Tiempo Total");
}