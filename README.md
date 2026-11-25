# GeoAlert — Monitoreo Sísmico Global

Plataforma full-stack (React + Vite + Express) para monitorear en tiempo real alertas, avisos y boletines sísmicos de 12 agencias internacionales (IGC-UPA Panamá, USGS, EMSC, SSN México, SGC Colombia, CSN Chile, NRCan Canadá, JMA Japón, INGV Italia, GeoNet Nueva Zelanda, IGN España y BMKG Indonesia).


## Despliegue Full-Stack (Render, Railway, Cloud Run, Docker)

- **Requisitos:** Node.js `>= 22.18.0` (fijado en `.nvmrc` y `package.json`).
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Docker:**
  ```bash
  docker build -t geoalert .
  docker run -p 3000:3000 geoalert
  ```
