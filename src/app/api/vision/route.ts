import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Prompts for each scan mode ────────────────────────────────────────────────
const PROMPTS: Record<string, string> = {
  chrono: `You are an OCR assistant for a precision rifle ballistics app.
Analyse this image carefully. It may be a photo of a Garmin Xero C1 Pro chronograph screen,
a Garmin Connect app screen showing a chronograph session, another chronograph device display,
or a handwritten paper log of velocity data.

Extract the following values and return ONLY a raw JSON object — no markdown, no code fences:
{
  "avgVelocity": <number in fps, e.g. 1054.6>,
  "extremeSpread": <number in fps, e.g. 41.8>,
  "stdDev": <number in fps, e.g. 9.4>,
  "shots": <integer shot count, e.g. 79>,
  "sessionName": "<string label if visible, else empty string>",
  "confidence": "<high|medium|low>"
}

Rules:
- avgVelocity: look for AVERAGE / AVG / MV / FPS — use the largest clearly-labelled velocity average
- extremeSpread: look for SPREAD / ES / EXTREME SPREAD
- stdDev: look for STD DEV / SD / SIGMA / S.D.
- shots: look for SHOTS / COUNT / N / number of shots
- If a field is not visible or legible, use null
- Return null values rather than guessing`,

  logbook: `You are an OCR assistant for a precision rimfire benchrest logbook app.
Analyse this image. It may be a handwritten range notebook page, a printed logbook sheet,
or any other shooting session record.

Extract as many of the following as are clearly legible and return ONLY a raw JSON object:
{
  "tunerClick": <integer click number e.g. 26>,
  "groupSize": <decimal inches e.g. 0.210>,
  "ammoLot": "<string lot number or ammo description>",
  "avgVelocity": <fps number>,
  "extremeSpread": <fps number>,
  "stdDev": <fps number>,
  "windSpeed": <mph number>,
  "windDir": "<clock direction e.g. '9 o-clock'>",
  "tempF": <fahrenheit number>,
  "pressureInHg": <inches Hg number>,
  "notes": "<any other legible session notes as a single string>",
  "date": "<date string if visible>",
  "confidence": "<high|medium|low>"
}

Rules:
- Set any field to null if not present or not legible
- Preserve notes verbatim, including abbreviations common in benchrest (e.g. PTP, DA, lwind)
- Return null for fields you are not at least 80% confident about`,

  weather: `You are an OCR assistant for a weather and environmental data app.
Analyse this image. It may be a Kestrel weather meter screen, a weather app screenshot,
or any display showing atmospheric conditions.

Extract and return ONLY a raw JSON object:
{
  "tempF": <fahrenheit number>,
  "tempC": <celsius number>,
  "pressureInHg": <inches Hg e.g. 29.85>,
  "pressureMb": <millibars e.g. 1010.5>,
  "relativeHumidity": <percent 0-100>,
  "windSpeedMph": <mph number>,
  "windDir": "<compass direction e.g. NW>",
  "densityAltitude": <feet number if shown>,
  "dewPointF": <fahrenheit>,
  "confidence": "<high|medium|low>"
}
Rules: null for any unreadable field.`,
};

export async function POST(req: NextRequest) {
  // ── Validate API key ──────────────────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured. Add it to .env.local.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { image, mimeType = 'image/jpeg', mode = 'chrono' } = body;

  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const prompt = PROMPTS[mode] ?? PROMPTS.chrono;

  // ── Call Gemini 1.5 Flash with vision ────────────────────────────────────
  const geminiBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,       // very low — we want precision, not creativity
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  };

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini Vision error:', errText);
      return NextResponse.json({ error: 'Gemini API error', detail: errText }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('Vision route error:', err);
    return NextResponse.json({ error: 'Failed to parse Gemini response', detail: String(err) }, { status: 500 });
  }
}
