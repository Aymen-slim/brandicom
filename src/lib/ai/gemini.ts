import { GoogleGenAI } from '@google/genai';
import { dailyAiLimit, modelFor } from './config';

export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

export function geminiModel(): string {
  return modelFor('chat');
}

/** @deprecated use dailyAiLimit() */
const DAILY_LIMIT = dailyAiLimit();

export { DAILY_LIMIT };
