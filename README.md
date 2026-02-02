# Ventas con Financiamiento (MEGUESA)

Esta herramienta permite capturar los datos de una venta con financiamiento, generar la **corrida** y exportar una **cotización en PDF** desde el celular.

## Acceso
Abrir en el navegador (iPhone/Android):
- https://meguesa.github.io/

> Recomendación: agregarla a la pantalla de inicio para usarla como “app”.

### Instalar como app (opcional)
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
3. **Enganche**:
   - Puedes capturar **% Enganche** *o* **Enganche (con IVA)**.
   - Si llenas **Enganche (con IVA)**, ese monto tiene prioridad sobre el %.
4. **Tasa anual (%)**.
5. **Meses**.
6. **Primer pago (fecha)** (fecha del primer pago).
7. **IVA (%)** (normalmente 16%).
8. **Cálculo de IVA**:
   - “IVA sobre (capital + interés)” (modo usado por defecto).
   - “IVA solo sobre interés” (si se requiere).
9. **Días por periodo (base 360)**: dejar en 30 (default), salvo indicación.

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

## Botones
- **Calcular:** genera/resetea la corrida con base en los datos capturados.
- **Limpiar:** borra los campos y reinicia la pantalla.
- **Generar PDF:** crea la cotización con logo y tabla de corrida.

---

## Recomendaciones
- Capturar el **monto total con IVA** (como aparece en la propuesta del paquete).
- Verificar que **meses** y **tasa anual** sean los correctos antes de generar el PDF.
- Si el cliente pide cambiar enganche, es mejor capturar el **monto de enganche** directamente.

---

## Soporte / Cambios
Si se requiere modificar:
- Logo
- Encabezado del PDF
- Fórmula de IVA
- Formato de tabla

Contactar al administrador del sistema/finanzas.
