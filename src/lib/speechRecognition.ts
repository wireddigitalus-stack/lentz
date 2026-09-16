'use client';

// Web Speech API interface definitions
export interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

export type BenchVoiceAction =
  | { type: 'SET_TUNER'; click: number; rawText: string }
  | { type: 'NUDGE_TUNER'; delta: number; rawText: string }
  | { type: 'ADD_RUN'; tunerClick: number; verticalInches: number; groupSizeInches: number; rawText: string }
  | { type: 'NAVIGATE'; tab: string; rawText: string }
  | { type: 'ASK_AI'; question: string; rawText: string }
  | { type: 'SET_TEMP'; tempF: number; rawText: string }
  | { type: 'DICTATE_NOTE'; text: string; rawText: string }
  | { type: 'UNKNOWN'; rawText: string };

// Check if browser supports speech recognition
export const isSpeechRecognitionSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
};

// Create a configured recognition instance
export const createSpeechRecognizer = (
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
) => {
  if (!isSpeechRecognitionSupported()) {
    onError('Speech recognition is not supported in this browser. Works best on Safari / Chrome.');
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const item = event.results[i];
      if (item.isFinal) {
        final += item[0].transcript;
      } else {
        interim += item[0].transcript;
      }
    }

    if (final) {
      onResult(final.trim(), true);
    } else if (interim) {
      onResult(interim.trim(), false);
    }
  };

  recognition.onerror = (event: any) => {
    console.warn('Speech recognition error event:', event.error);
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
};

// Words to number mapper for spoken numbers (e.g. "point zero eight", "fifteen")
export const parseSpokenNumber = (text: string): number | null => {
  const cleaned = text.toLowerCase().trim();

  // Try direct float parse
  const direct = parseFloat(cleaned);
  if (!isNaN(direct)) return direct;

  // Spoken number words
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50,
  };

  if (words[cleaned] !== undefined) {
    return words[cleaned];
  }

  // Handle "point X Y" or "dot X Y"
  if (cleaned.includes('point') || cleaned.includes('dot')) {
    const parts = cleaned.replace('dot', 'point').split('point');
    let decimalStr = '0.';
    const subWords = parts[1].trim().split(/\s+/);
    for (const w of subWords) {
      if (words[w] !== undefined) {
        decimalStr += words[w].toString();
      } else if (!isNaN(parseInt(w))) {
        decimalStr += w;
      }
    }
    const val = parseFloat(decimalStr);
    if (!isNaN(val)) return val;
  }

  return null;
};

// Benchrest Voice Command Parser
export const parseBenchVoiceCommand = (raw: string): BenchVoiceAction => {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. Tuner Click Adjustments: "tuner 15", "set tuner to 18", "click 12", "set click 22"
  const tunerMatch = lower.match(/(?:tuner|click|set tuner to|set click to)\s+(\d+|[a-z\s]+)/i);
  if (tunerMatch) {
    const num = parseSpokenNumber(tunerMatch[1]);
    if (num !== null && num >= 0 && num <= 50) {
      return { type: 'SET_TUNER', click: Math.round(num), rawText: text };
    }
  }

  // 2. Tuner Nudges: "plus one", "up two clicks", "minus one", "down one click"
  if (lower.includes('plus one') || lower.includes('up one') || lower.includes('next click')) {
    return { type: 'NUDGE_TUNER', delta: 1, rawText: text };
  }
  if (lower.includes('minus one') || lower.includes('down one') || lower.includes('back one')) {
    return { type: 'NUDGE_TUNER', delta: -1, rawText: text };
  }
  if (lower.includes('plus two') || lower.includes('up two')) {
    return { type: 'NUDGE_TUNER', delta: 2, rawText: text };
  }
  if (lower.includes('minus two') || lower.includes('down two')) {
    return { type: 'NUDGE_TUNER', delta: -2, rawText: text };
  }

  // 3. Navigation: "show target", "open scanner", "harmonics", "weather", "advisor", "logbook", "tuner"
  if (lower.includes('scanner') || lower.includes('target')) {
    return { type: 'NAVIGATE', tab: 'scanner', rawText: text };
  }
  if (lower.includes('harmonic') || lower.includes('chart') || lower.includes('curve')) {
    return { type: 'NAVIGATE', tab: 'harmonics', rawText: text };
  }
  if (lower.includes('weather') || lower.includes('density') || lower.includes('atmosphere')) {
    return { type: 'NAVIGATE', tab: 'weather', rawText: text };
  }
  if (lower.includes('advisor') || lower.includes('consultant') || lower.includes('ai')) {
    return { type: 'NAVIGATE', tab: 'advisor', rawText: text };
  }
  if (lower.includes('logbook') || lower.includes('barrel') || lower.includes('ammo')) {
    return { type: 'NAVIGATE', tab: 'logbook', rawText: text };
  }
  if (lower.includes('tuner dial') || lower.includes('show dial') || lower.includes('dial')) {
    return { type: 'NAVIGATE', tab: 'tuner', rawText: text };
  }

  // 4. Bench Run Voice Logging: "run click 14 vertical 0.09 group 0.15"
  if (lower.includes('run') && (lower.includes('vertical') || lower.includes('group'))) {
    const clickMatch = lower.match(/click\s+(\d+|[a-z]+)/);
    const vertMatch = lower.match(/vertical\s+([0-9\.]+|[a-z\s]+?)(?=\s+group|$)/);
    const groupMatch = lower.match(/group\s+([0-9\.]+|[a-z\s]+)/);

    const clickVal = clickMatch ? parseSpokenNumber(clickMatch[1]) : 13;
    const vertVal = vertMatch ? parseSpokenNumber(vertMatch[1]) : 0.125;
    const groupVal = groupMatch ? parseSpokenNumber(groupMatch[1]) : (vertVal ? vertVal * 1.4 : 0.18);

    if (clickVal !== null && vertVal !== null) {
      return {
        type: 'ADD_RUN',
        tunerClick: Math.round(clickVal),
        verticalInches: Number(vertVal.toFixed(3)),
        groupSizeInches: Number((groupVal || vertVal * 1.3).toFixed(3)),
        rawText: text,
      };
    }
  }

  // 5. Ask AI: "ask Lentz...", "question for Lentz..."
  if (lower.startsWith('ask lentz') || lower.startsWith('hey lentz') || lower.startsWith('ask')) {
    const question = text.replace(/^(ask lentz|hey lentz|ask)\s*/i, '').trim();
    if (question) {
      return { type: 'ASK_AI', question, rawText: text };
    }
  }

  // 6. Temperature: "temp 78", "temperature 82 degrees"
  const tempMatch = lower.match(/(?:temp|temperature)\s+(\d+)/);
  if (tempMatch) {
    const tempF = parseInt(tempMatch[1]);
    if (!isNaN(tempF) && tempF >= 20 && tempF <= 120) {
      return { type: 'SET_TEMP', tempF, rawText: text };
    }
  }

  // 7. General Note: "note [text]" or "dictate [text]"
  if (lower.startsWith('note') || lower.startsWith('dictate')) {
    const note = text.replace(/^(note|dictate)\s*/i, '').trim();
    return { type: 'DICTATE_NOTE', text: note, rawText: text };
  }

  // Default: Dictated text
  return { type: 'DICTATE_NOTE', text, rawText: text };
};
