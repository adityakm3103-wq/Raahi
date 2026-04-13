// src/app/components/chat-bubble/chat-bubble.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChatService,
  ChatContext,
  ChatMessage,
} from '../../services/chat.service';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-bubble.html',
  styleUrls: ['./chat-bubble.css'],
})
export class ChatBubble implements OnInit {
  @Input() destination: string | null = null;
  @Input() currentDay: number | null = null;

  isOpen = false;
  isSending = false;

  inputText = '';

  // ⭐ Loaded from Supabase
  latestTrip: any = null;

  messages: ChatMessage[] = [
    {
      role: 'assistant',
      content: `Hey there 👋  
I’m Raahi, your personalized travel guide.  
Ask me about places, safety, weather, or bespoke plans!`,
      timestamp: new Date(),
    },
  ];

  constructor(private chat: ChatService) {}

  // ---------------------------------------------------------------------------
  // ⭐ LOAD LATEST SAVED TRIP FROM SUPABASE
  // ---------------------------------------------------------------------------
  async ngOnInit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('trips')
      .select('plan')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      this.latestTrip = data[0].plan;
    }
  }

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  // ---------------------------------------------------------------------------
  // ⭐ SEND MESSAGE + FULL TRIP CONTEXT
  // ---------------------------------------------------------------------------
  async send() {
    const trimmed = this.inputText.trim();
    if (!trimmed || this.isSending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    this.messages = [...this.messages, userMsg];
    this.inputText = '';
    this.isSending = true;

    try {
      // --------------------------------------------------------------
      // ⭐ BUILD CONTEXT FROM SAVED TRIP
      // --------------------------------------------------------------
      const todayActivities =
        this.latestTrip?.itinerary?.[ (this.currentDay ?? 1) - 1 ]?.activities || [];

      const ctx: ChatContext = {
        destination: this.latestTrip?.destination,
        tripName: this.latestTrip?.tripName,
        startDate: this.latestTrip?.startDate,
        endDate: this.latestTrip?.endDate,
        totalDays: this.latestTrip?.itinerary?.length,
        currentDay: this.currentDay ?? undefined,
        currentTime: new Date().toLocaleTimeString(),

        userPreferences: [], // optional for future

        selectedPlaces: todayActivities.map((act: any) => ({
          name: act.name,
          startTime: act.startTime,
          endTime: act.endTime,
        })),
      };

      // --------------------------------------------------------------
      // ⭐ CALL CHAT SERVICE
      // --------------------------------------------------------------
      const reply = await this.chat.sendMessage(trimmed, ctx);
      this.messages = [...this.messages, reply];

      // scroll to bottom
      setTimeout(() => {
        const el = document.querySelector('.raahi-chat-messages') as HTMLElement | null;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }, 10);

    } catch (err) {
      console.error(err);
      const fallback: ChatMessage = {
        role: 'assistant',
        content: 'Oops, something went wrong while answering. Please try again.',
        timestamp: new Date(),
      };
      this.messages = [...this.messages, fallback];
    } finally {
      this.isSending = false;
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  // Helper for template
  isAssistant(msg: ChatMessage): boolean {
    return msg.role === 'assistant';
  }
}
