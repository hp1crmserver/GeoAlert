# GeoAlert — Monitoreo Sísmico Global

Plataforma full-stack (React + Vite + Express) para monitorear en tiempo real alertas, avisos y boletines sísmicos de 12 agencias internacionales (IGC-UPA Panamá, USGS, EMSC, SSN México, SGC Colombia, CSN Chile, NRCan Canadá, JMA Japón, INGV Italia, GeoNet Nueva Zelanda, IGN España y BMKG Indonesia).

## Requisitos

- **Node.js `>= 22.18.0`** (incluido en `.nvmrc` y `package.json` `"engines"` para ejecución directa de `server.ts`).

## Despliegue desde GitHub

### Opción 1: Plataformas PaaS (Render, Railway, Heroku, Koyeb, Cloud Run)
1. Conecta el repositorio de GitHub.
2. Configura los comandos:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Variables de entorno opcionales:
   - `NODE_ENV=production`
   - `PORT=3000` (o el puerto asignado automáticamente por la plataforma)

### Opción 2: Docker
```bash
docker build -t geoalert .
docker run -p 3000:3000 geoalert
```

### Opción 3: Ejecución local
```bash
npm install
npm run dev      # Modo desarrollo (puerto 3000)
```

Para probar localmente en modo producción:
```bash
npm run build
npm start
```
