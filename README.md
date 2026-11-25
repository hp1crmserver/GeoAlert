# GeoAlert — Monitoreo Sísmico Global

Plataforma full-stack (React + Vite + Express) para monitorear en tiempo real alertas, avisos y boletines sísmicos de 12 agencias internacionales (IGC-UPA Panamá, USGS, EMSC, SSN México, SGC Colombia, CSN Chile, NRCan Canadá, JMA Japón, INGV Italia, GeoNet Nueva Zelanda, IGN España y BMKG Indonesia).

## Despliegue en GitHub Pages (`http://apps.hp1crm.org/GeoAlert/`)

El repositorio incluye `.github/workflows/deploy.yml` y rutas relativas (`base: './'`) con consulta directa en navegador para funcionar en GitHub Pages sin servidor backend:

1. Sube estos cambios a la rama `main` (o `master`) en GitHub.
2. En tu repositorio de GitHub ve a **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions** (en lugar de *Deploy from a branch*, ya que esa opción sirve el `index.html` sin compilar).
3. El workflow compilará `dist/` automáticamente y lo publicará en tu dominio configurado (`http://apps.hp1crm.org/GeoAlert/`).

## Despliegue Full-Stack (Render, Railway, Cloud Run, Docker)

- **Requisitos:** Node.js `>= 22.18.0` (fijado en `.nvmrc` y `package.json`).
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Docker:**
  ```bash
  docker build -t geoalert .
  docker run -p 3000:3000 geoalert
  ```
