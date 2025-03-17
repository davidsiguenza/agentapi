# Salesforce Chat Application

Este proyecto es una aplicación web que integra un chatbot de Salesforce utilizando la API de Einstein AI Agent. La aplicación también incluye funcionalidades como dictado de voz y reproducción de respuestas utilizando AWS Polly.

## Características

- Integración con Salesforce Einstein AI Agent
- Dictado de voz para introducir mensajes
- Reproducción de respuestas con AWS Polly
- Interfaz de chat amigable y responsive

## Requisitos previos

- Node.js (v18 o superior)
- Una cuenta de Salesforce con Einstein AI Agent configurado
- Credenciales de AWS para utilizar Polly
- Git instalado (para la implementación en Heroku)

## Instalación y configuración local

1. Clona este repositorio:
   ```
   git clone https://github.com/tuusuario/salesforce-chat-app.git
   cd salesforce-chat-app
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` a partir del archivo `.env.sample`:
   ```
   cp .env.sample .env
   ```

4. Edita el archivo `.env` con tus credenciales y configuración.

5. Inicia el servidor en modo desarrollo:
   ```
   npm run dev
   ```

6. Abre tu navegador en `http://localhost:3000` para usar la aplicación.

## Despliegue en Heroku

### Método 1: Despliegue desde GitHub

1. Crea un repositorio en GitHub y sube tu código:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tuusuario/salesforce-chat-app.git
   git push -u origin main
   ```

2. En Heroku, crea una nueva aplicación y conecta tu repositorio de GitHub.

3. Habilita los despliegues automáticos para la rama `main`.

4. Configura las variables de entorno en la pestaña "Settings" > "Config Vars" de tu aplicación en Heroku.

### Método 2: Despliegue desde CLI de Heroku

1. Instala Heroku CLI y haz login:
   ```
   npm install -g heroku
   heroku login
   ```

2. Crea una nueva aplicación en Heroku:
   ```
   heroku create mi-salesforce-chat
   ```

3. Configura las variables de entorno:
   ```
   heroku config:set CLIENT_ID=your_client_id_here
   heroku config:set CLIENT_SECRET=your_client_secret_here
   heroku config:set AI_AGENT_ID=your_ai_agent_id_here
   heroku config:set SALESFORCE_INSTANCE=https://your-instance.my.salesforce.com
   heroku config:set SALESFORCE_TOKEN_URL=https://your-instance.my.salesforce.com/services/oauth2/token
   heroku config:set AWS_REGION=us-east-1
   heroku config:set AWS_ACCESS_KEY_ID=your_aws_access_key_id
   heroku config:set AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   ```

4. Despliega la aplicación:
   ```
   git push heroku main
   ```

5. Abre la aplicación:
   ```
   heroku open
   ```

## Estructura del proyecto

- `server.mjs`: Servidor Express que maneja la API
- `public/index.html`: Frontend de la aplicación
- `Procfile`: Configuración para Heroku
- `package.json`: Configuración de dependencias y scripts

## Licencia

ISC
