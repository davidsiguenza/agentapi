import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import AWS from "aws-sdk";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ========== CONFIGURACIÓN ========== 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AI_AGENT_ID = process.env.AI_AGENT_ID;
const SALESFORCE_INSTANCE = process.env.SALESFORCE_INSTANCE;
const TOKEN_URL = process.env.SALESFORCE_TOKEN_URL ||
  `https://${SALESFORCE_INSTANCE}/services/oauth2/token`;
const CHAT_URL = `https://api.salesforce.com/einstein/ai-agent/v1/agents/${AI_AGENT_ID}/sessions`;

// ElevenLabs Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Spanish voice

let accessToken = "";
let sessionId = "";

// ========== CORS CONFIGURATION ========== 
const allowedOrigins = [
  'https://storm-92056ec8b1c6ce.lightning.force.com',
  'https://storm-92056ec8b1c6ce.my.site.com',
  'https://salesforce-agent-api-0b27fb87403b.herokuapp.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://*.lightning.force.com',
  'https://*.site.com',
  'https://*.force.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const ok = allowedOrigins.some(o => o.includes('*')
      ? new RegExp("^" + o.replace(/\*/g, '.*') + "$").test(origin)
      : o === origin
    );
    ok ? callback(null, true) : callback(new Error('Origen no permitido'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ========== AWS POLLY SETUP ========== 
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const polly = new AWS.Polly();

// ========== OBTENER OAUTH TOKEN ========== 
app.post('/get-token', async (req, res) => {
  try {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
    });
    const json = await resp.json();
    accessToken = json.access_token;
    res.json({ accessToken });
  } catch (err) {
    console.error('get-token error', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== VALIDAR SESIÓN EXISTENTE ========== 
app.post('/validate-session', async (req, res) => {
  try {
    const { sessionId: testSessionId } = req.body;
    
    if (!testSessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Intentar hacer una petición simple para verificar si la sesión existe
    const resp = await fetch(
      `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${testSessionId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (resp.ok) {
      // La sesión es válida, actualizar el sessionId global
      sessionId = testSessionId;
      console.log('[Server] Sesión validada exitosamente:', testSessionId);
      res.json({ valid: true, sessionId: testSessionId });
    } else {
      console.log('[Server] Sesión inválida:', resp.status, await resp.text());
      res.status(400).json({ valid: false, error: 'Session not found or expired' });
    }
    
  } catch (err) {
    console.error('[Server] Error validando sesión:', err);
    res.status(500).json({ valid: false, error: err.message });
  }
});

// ========== INICIAR SESIÓN DE CHAT ========== 
app.post('/start-session', async (req, res) => {
  try {
    const { externalSessionKey, variables, streamingCapabilities, bypassUser } = req.body;

    const payload = {
      externalSessionKey: externalSessionKey || "",
      instanceConfig: { endpoint: `${SALESFORCE_INSTANCE}` },
      streamingCapabilities: streamingCapabilities || { chunkTypes: ["Text"] }
    };
    if (Array.isArray(variables) && variables.length) payload.variables = variables;
    if (bypassUser) payload.bypassUser = true;

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();

    if (!resp.ok) {
      console.error('start-session ERROR', resp.status, text);
      return res.status(resp.status).json({ error: text });
    }

    const json = JSON.parse(text);
    sessionId = json.sessionId;
    console.log('[Server] Nueva sesión creada:', sessionId);
    res.json({ sessionId });
  } catch (err) {
    console.error('start-session exception', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== ENVIAR MENSAJE ========== 
app.post('/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'No active session. Please start a session first.' });
    }

    const resp = await fetch(
      `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: { sequenceId: Date.now(), type: "Text", text: message },
          variables: []
        })
      }
    );
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('[Server] Error enviando mensaje:', resp.status, errorText);
      
      // Si es un error 404, la sesión probablemente expiró
      if (resp.status === 404) {
        sessionId = ""; // Limpiar sessionId
        return res.status(404).json({ 
          error: 'Session expired or not found',
          sessionExpired: true
        });
      }
      
      return res.status(resp.status).json({ error: errorText });
    }
    
    const json = await resp.json();
    console.log('[Server] Mensaje enviado exitosamente');
    res.json(json);
  } catch (err) {
    console.error('send-message error', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== FINALIZAR SESIÓN ========== 
app.delete('/end-session', async (req, res) => {
  try {
    if (!sessionId) {
      return res.json({ message: 'No active session to end' });
    }

    const resp = await fetch(
      `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-session-end-reason': 'UserRequest'
        }
      }
    );

    const currentSessionId = sessionId;
    sessionId = "";
    
    if (resp.ok) {
      console.log('[Server] Sesión terminada exitosamente:', currentSessionId);
      res.json({ message: 'Session ended successfully' });
    } else {
      const errorText = await resp.text();
      console.log('[Server] Error terminando sesión (pero limpiando localmente):', resp.status, errorText);
      // Aún así consideramos que se "terminó" localmente
      res.json({ message: 'Session ended locally' });
    }
  } catch (err) {
    console.error('end-session error', err);
    sessionId = ""; // Limpiar de todas formas
    res.status(500).json({ error: err.message });
  }
});

// ========== TTS SYNTHESIS - AWS POLLY ========== 
async function synthesizeWithAWS(text, voiceId = 'Lucia') {
  return new Promise((resolve, reject) => {
    const params = {
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId
    };
    
    polly.synthesizeSpeech(params, (err, data) => {
      if (err) {
        reject(err);
      } else if (data.AudioStream instanceof Buffer) {
        resolve(data.AudioStream);
      } else {
        reject(new Error('No audio stream'));
      }
    });
  });
}

// ========== TTS SYNTHESIS - ELEVENLABS ========== 
async function synthesizeWithElevenLabs(text, voiceId = ELEVENLABS_VOICE_ID) {
  console.log('ElevenLabs synthesis request:', { text: text.substring(0, 50), voiceId, hasApiKey: !!ELEVENLABS_API_KEY });
  
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.5,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs API error:', response.status, errorText);
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// ========== UNIFIED TTS ENDPOINT ========== 
app.post('/synthesize', async (req, res) => {
  try {
    const { text, provider = 'aws', voiceId } = req.body;
    
    console.log('TTS request:', { provider, text: text?.substring(0, 50), voiceId });
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let audioBuffer;
    
    if (provider === 'elevenlabs') {
      if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key missing');
        return res.status(400).json({ 
          error: 'ElevenLabs API key not configured. Please add ELEVENLABS_API_KEY to your environment variables.' 
        });
      }
      audioBuffer = await synthesizeWithElevenLabs(text, voiceId);
    } else {
      // Default to AWS
      audioBuffer = await synthesizeWithAWS(text, voiceId || 'Lucia');
    }

    console.log('TTS synthesis successful, buffer size:', audioBuffer.length);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length
    });
    res.send(audioBuffer);
    
  } catch (err) {
    console.error('synthesize error:', err.message);
    res.status(500).json({ 
      error: err.message,
      details: 'TTS synthesis failed'
    });
  }
});

// ========== SERVIR ARCHIVOS ESTÁTICOS ========== 
app.use(express.static(path.join(__dirname, 'public')));

// ========== HEALTH CHECK ========== 
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasActiveSession: !!sessionId,
    sessionId: sessionId || 'none'
  });
});

// ========== ARRANCAR SERVIDOR ========== 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});
