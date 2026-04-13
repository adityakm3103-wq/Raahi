// src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as supabaseEnv from '../../environments/supabase';


export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  createdAt?: string;
  source?: 'online' | 'offline';
}

export interface ChatContext {
  destination?: string;
  tripName?: string;
  startDate?: string;
  endDate?: string;
  currentDay?: number;
  totalDays?: number;
  currentTime?: string;
  userPreferences?: string[] | string;
  selectedPlaces?: {
    name: string;
    startTime?: string;
    endTime?: string;
    category?: string;
  }[];
}

interface GroqChatApiResponse {
  reply: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  /** Full chat history (used by chat-bubble) */
  private messages: ChatMessage[] = [];

  /** Toggle: if you want to disable online model for testing */
  private onlineEnabled = true;

  constructor(private http: HttpClient) {}

  // ----------------------------------------------------
  // PUBLIC API — used by ChatBubble
  // ----------------------------------------------------

  /** Get current conversation (for UI) */
  getMessages(): ChatMessage[] {
    return this.messages;
  }

  /** Clear chat history */
  clear(): void {
    this.messages = [];
  }

  /**
   * Main method: called by ChatBubble
   * - appends user message
   * - decides online vs offline
   * - returns assistant reply
   */
  async sendMessage(
    userText: string,
    context?: ChatContext
  ): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
    };
    this.messages.push(userMsg);

    const useOnline = this.shouldUseOnlineModel();

    let replyText = '';
    let source: 'online' | 'offline' = 'online';

    try {
      if (useOnline && this.onlineEnabled) {
        replyText = await this.callGroqBackend(userText, context);
        source = 'online';
      } else {
        replyText = await this.callOfflineModel(userText, context);
        source = 'offline';
      }
    } catch (e) {
      console.error('Online model failed, falling back to offline:', e);
      replyText = await this.callOfflineModel(userText, context);
      source = 'offline';
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: replyText,
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
      source,
    };

    this.messages.push(assistantMsg);
    return assistantMsg;
  }

  // ----------------------------------------------------
  // ONLINE MODEL — Groq Llama 3.1 70B (via backend API)
  // ----------------------------------------------------

  /**
   * Decide whether to use online model:
   * - Simple check: navigator.onLine
   * - You can extend later (e.g. ping your backend)
   */
  private shouldUseOnlineModel(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  }

  /**
   * Call your backend API which wraps Groq Llama 3.1 70B.
   */
  private async callGroqBackend(
    userText: string,
    context?: ChatContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    // Build payload: full chat history + fresh system context
    const payload = {
      system: systemPrompt,
      messages: this.messages,
      context,
    };

    // 👇 Adjust URL if your backend route is different
   const res = await this.http.post<GroqChatApiResponse>(
  'https://vfoxulljyqfkolixzwdq.supabase.co/functions/v1/groq-ai',
  payload,
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseEnv.SUPABASE_ANON_KEY}`,
      'apikey': supabaseEnv.SUPABASE_ANON_KEY,
    }
  }
).toPromise();




    if (!res || !res.reply) {
      throw new Error('Empty response from Groq backend');
    }

    return res.reply;
  }

  /**
   * Build a system-level instruction for the LLM using trip context.
   * This makes the model act like "Raahi Travel Sidekick".
   */
 private buildSystemPrompt(context?: ChatContext): string {
  if (!context) {
    return `
You are Raahi 2.0, a friendly Karnataka travel sidekick.

ANSWERING RULES (VERY IMPORTANT):
- Always answer ONLY the specific question asked.
- If user asks: "best time to visit?" → give only best time information.
- If user asks "how long does it take?" → answer only duration.
- If user asks "tell about this place" → give 4–6 bullet points (short & crisp).
- Do NOT add extra information the user didn’t ask for.
- Avoid storytelling, long paragraphs, and unnecessary context.

FORMAT:
- Always respond in bullet points (4–6 max).
- Keep every bullet short and direct.
- Prioritize clarity, accuracy, and local-friendly tips.

TONE:
- Sound like a knowledgeable, concise local guide.
- Helpful, crisp, and straight to the point.
    `.trim();
  }



    const {
      destination,
      tripName,
      startDate,
      endDate,
      currentDay,
      totalDays,
      currentTime,
      userPreferences,
      selectedPlaces,
    } = context;

    const prefsString = Array.isArray(userPreferences)
      ? userPreferences.join(', ')
      : userPreferences || 'not specified';

    const placesSummary = (selectedPlaces || [])
      .map((p) => {
        const timePart =
          p.startTime && p.endTime
            ? ` (${p.startTime}–${p.endTime})`
            : '';
        const catPart = p.category ? ` [${p.category}]` : '';
        return `- ${p.name}${timePart}${catPart}`;
      })
      .join('\n');

   return `
You are Raahi 2.0, a concise and premium Karnataka travel sidekick.

ANSWERING RULES:
- Always answer ONLY the specific question the user asks.
- If user asks “best time?”, give only best-time info.
- If user asks “how long?”, give only duration.
- If user asks “tell about this place”, give 4–6 crisp bullet points.
- If user asks “what should I do now?”, use itinerary + current time to give 2–3 practical suggestions.
- Do NOT provide extra details unless directly asked.
- Avoid long paragraphs and storytelling.

FORMAT:
- Always use bullet points (4–6 max).
- Keep every bullet short, clear, and useful.

USE THIS CONTEXT SILENTLY:
- Destination: ${destination || 'Unknown'}
- Trip name: ${tripName || 'Unnamed trip'}
- Dates: ${startDate || '?'} → ${endDate || '?'}
- Today: Day ${currentDay || '?'} of ${totalDays || '?'} (time: ${currentTime || 'unknown'})
- Preferences: ${prefsString}
- Today’s planned places:
${placesSummary || '- None'}

Do NOT mention context, JSON, Supabase, or technical details.
`.trim();
}


  // ----------------------------------------------------
  // OFFLINE MODEL — WebLLM / Fallback
  // ----------------------------------------------------

  /**
   * Offline path:
   */
  private async callOfflineModel(
    userText: string,
    context?: ChatContext
  ): Promise<string> {
    const sys = this.buildSystemPrompt(context);

    const destPart = context?.destination
      ? `You're currently planning a trip to ${context.destination}.`
      : '';

    const dayPart =
      context?.currentDay && context?.totalDays
        ? `It is day ${context.currentDay} of ${context.totalDays}.`
        : '';

    const placesPart =
      context?.selectedPlaces && context.selectedPlaces.length > 0
        ? `Today's places include: ${context.selectedPlaces
            .map((p) => p.name)
            .join(', ')}.`
        : '';

    return `
(Local smart mode active)

${destPart} ${dayPart} ${placesPart}

You asked:
"${userText}"

Based on your itinerary and general Karnataka travel knowledge, here’s a helpful suggestion:

- I would first: try to answer your question using general trip logic.
- Since I'm in local mode, I might not have the very latest details,
  but I can still suggest: best time to visit, rough duration,
  and typical safety / weather tips for common tourist spots.

${sys.substring(0, 400)} ...
`.trim();
  }
}

