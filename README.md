# Ventas con Financiamiento (MEGUESA)

Esta herramienta permite capturar los datos de una venta con financiamiento, generar la **corrida** y exportar una **cotización en PDF** desde el celular.

## Acceso
Abrir en el navegador (iPhone/Android):
- https://meguesa.github.io/

> Recomendación: agregarla a la pantalla de inicio para usarla como “app”.

---

## Instalar como app (opcional)
**iPhone (Safari):**
1. Abrir la liga.
2. Botón **Compartir**.
3. **Agregar a pantalla de inicio**.

**Android (Chrome):**
1. Abrir la liga.
2. Menú **⋮**.
3. **Agregar a pantalla principal / Instalar app**.

---

## Cómo usarla (paso a paso)
### 1) Capturar datos
En la sección **Datos**, llenar:

1. **Cliente** (nombre del cliente).
2. **Monto total del paquete (con IVA)**.
3. **Enganche** (elige UNA forma):
   - Capturar **% Enganche**, o
   - Capturar **Enganche (con IVA)**.
   > Si llenas **Enganche (con IVA)**, ese monto tiene prioridad sobre el %.
4. **Tasa anual (%)**.
5. **Meses**.
6. **Primer pago (fecha)** (fecha del primer pago).
7. **IVA (%)** (normalmente 16%).
8. **Cálculo de IVA**:
   - “IVA sobre (capital + interés)” (modo usado por defecto).
   - “IVA solo sobre interés” (si se requiere).
9. **Días por periodo (base 360)**:
   - Dejar en **30** (default), salvo indicación.

### 2) Calcular
- Presiona **Calcular**.
- Se mostrará:
  - **Resumen** (enganche, monto a financiar, mensualidad aproximada, etc.)
  - **Corrida** (tabla con pagos por mes)

### 3) Generar PDF
- Presiona **Generar PDF**.
- El archivo se descargará en el celular con el nombre:
  - `Corrida_<Cliente>_<YYYY-MM-DD>.pdf`

### 4) Enviar el PDF
Desde el celular, comparte el PDF por:
- WhatsApp
- Correo
- AirDrop (iPhone)
- Guardar en Archivos/Drive

---

## Ejemplo rápido (para práctica)
Captura estos datos y presiona **Calcular**:

- **Cliente:** Juan Pérez  
- **Monto total (con IVA):** 100000  
- **% Enganche:** 8  
- **Tasa anual (%):** 20  
- **Meses:** 36  
- **Primer pago:** (elige una fecha, por ejemplo el próximo mes)  
- **IVA (%):** 16  
- **Cálculo de IVA:** IVA sobre (capital + interés)  
- **Días por periodo:** 30  

Luego presiona **Generar PDF** y compártelo por WhatsApp.

---

## Botones
- **Calcular:** genera/actualiza la corrida con base en los datos capturados.
- **Limpiar:** borra los campos y reinicia la pantalla.
- **Generar PDF:** crea la cotización con logo y tabla de corrida.

---

## Preguntas frecuentes (FAQ)

### 1) ¿Qué monto debo capturar en “Monto total del paquete”?
Captura el **monto total con IVA**, tal como se cotiza al cliente.

### 2) ¿Qué pasa si capturo % enganche y también monto de enganche?
El sistema toma **Enganche (con IVA)** como prioridad.  
El % se ajusta automáticamente para reflejar ese monto.

### 3) ¿Puedo poner enganche en 0?
Sí. Solo deja el % en 0 (o no captures enganche monto) y calcula.

### 4) ¿Qué “Cálculo de IVA” debo usar?
- **IVA sobre (capital + interés):** es el modo por defecto (similar al Excel usado).
- **IVA solo sobre interés:** usar solo si así lo requiere la política del financiamiento.

Si no estás seguro, usa el modo por defecto.

### 5) ¿Qué significa “Días por periodo (base 360)”?
Es la base de cálculo de la tasa por periodo.  
Normalmente se deja en **30** (equivalente a año de 360 días con meses de 30).

### 6) No me deja generar PDF / no sale el botón
Primero debes presionar **Calcular**.  
El botón **Generar PDF** se activa solo cuando existe una corrida calculada.

### 7) No veo cambios recientes en la página (se ve “vieja”)
Tu teléfono puede estar usando caché.
- Abre la página en **modo incógnito**, o
- Recarga la página, o
- Si la instalaste como app: **desinstala y vuelve a instalar**.

### 8) ¿Dónde queda guardado el PDF?
Depende del teléfono:
- iPhone: se guarda en **Archivos** o en descargas del navegador.
- Android: generalmente en **Descargas**.

---

## Soporte / Cambios
Si se requiere modificar:
- Logo
- Encabezado del PDF
- Fórmula de IVA
- Formato de tabla

Contactar al administrador del sistema/finanzas.
