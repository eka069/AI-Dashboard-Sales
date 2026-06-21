// config.js — Konfigurasi AI Provider
// Ganti GROQ_API_KEY dengan key kamu dari console.groq.com

const CONFIG = {
  AI_PROVIDER: 'groq', // 'ollama' atau 'groq'

  // Ollama settings (lokal)
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'llama3.2:1b',

  // Groq settings — ISI API KEY KAMU DI SINI
  GROQ_API_KEY: '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',
  GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL: 'llama-3.1-8b-instant',

  LANGUAGE: 'Indonesian'
};
