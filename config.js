// config.js — Konfigurasi AI Provider
// Ganti GROQ_API_KEY dengan key kamu dari console.groq.com

const CONFIG = {
  AI_PROVIDER: 'groq', // 'ollama' atau 'groq'

  // Ollama settings (lokal)
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'llama3.2:1b',

  // Groq settings — ISI API KEY KAMU DI SINI
  GROQ_API_KEY: 'ISI API KEY KAMU DI SINI',
  GROQ_URL: 'ISI API KEY KAMU DI SINI',
  GROQ_MODEL: 'llama-3.1-8b-instant',

  LANGUAGE: 'Indonesian'
};
