import { NextResponse } from 'next/server';

const DEFAULT_VOICE = 'en-US';
const GOOGLE_TTS_ENDPOINT = 'https://translate.googleapis.com/translate_tts';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text: string | undefined = body?.text;
    const voice: string = body?.voice ?? DEFAULT_VOICE;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required for synthesis.' }, { status: 400 });
    }

    const trimmed = text.trim().slice(0, 300);
    const url = new URL(GOOGLE_TTS_ENDPOINT);
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('tl', voice);
    url.searchParams.set('q', trimmed);

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to synthesize speech.' }, { status: 502 });
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('TTS API error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
