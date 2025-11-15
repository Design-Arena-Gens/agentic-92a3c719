'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertWebMToMp4, extractAudioFromVideo } from '@/lib/ffmpeg';

export type EmotionKey = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';

export interface EmotionState {
  happy: number;
  sad: number;
  angry: number;
  surprised: number;
  neutral: number;
}

export interface BackgroundOption {
  id: string;
  label: string;
  className: string;
  description: string;
}

export interface CameraAngle {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface AvatarPreset {
  id: string;
  name: string;
  description: string;
  faceTexture: string;
  thumbnail: string;
  accent: string;
}

export interface AvatarAnimationState {
  mouthOpen: number;
  blink: number;
  headRotation: [number, number, number];
  eyeDirection: [number, number];
  handWave: number;
  intensity: number;
  emotionMix: EmotionState;
  energy: number;
}

export type ExportFormat = 'webm' | 'mp4';

type FaceSource =
  | { mode: 'preset'; presetId: string }
  | { mode: 'upload'; url: string; name: string };

interface PlaybackSource {
  source: AudioBufferSourceNode;
  done: Promise<void>;
}

const DEFAULT_EMOTIONS: EmotionState = {
  happy: 0.4,
  sad: 0.1,
  angry: 0.1,
  surprised: 0.2,
  neutral: 0.8,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothStep = (value: number, smoothing = 0.3) =>
  value < 0 ? 0 : value > 1 ? 1 : value * value * (3 - 2 * value) * smoothing + value * (1 - smoothing);

const createSvgAvatar = (opts: {
  skin: string;
  eyes: string;
  mouth: string;
  accent: string;
  background: string;
}) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'>
    <defs>
      <radialGradient id='face' cx='50%' cy='40%' r='65%'>
        <stop offset='0%' stop-color='${opts.skin}' stop-opacity='0.95'/>
        <stop offset='85%' stop-color='${opts.skin}' stop-opacity='0.85'/>
        <stop offset='100%' stop-color='${opts.skin}' stop-opacity='0.6'/>
      </radialGradient>
      <linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='${opts.background}' stop-opacity='0.95'/>
        <stop offset='100%' stop-color='${opts.accent}' stop-opacity='0.35'/>
      </linearGradient>
    </defs>
    <rect width='600' height='600' rx='48' fill='url(#bg)' />
    <g transform='translate(80 60)'>
      <ellipse cx='220' cy='220' rx='180' ry='200' fill='url(#face)' />
      <ellipse cx='220' cy='210' rx='130' ry='145' fill='${opts.skin}' opacity='0.65' />
      <g fill='${opts.eyes}'>
        <ellipse cx='150' cy='190' rx='42' ry='36'/>
        <ellipse cx='290' cy='190' rx='42' ry='36'/>
      </g>
      <g fill='${opts.mouth}' opacity='0.85'>
        <path d='M140 280 Q220 320 300 280 Q220 360 140 280Z' />
      </g>
      <g fill='${opts.accent}' opacity='0.35'>
        <path d='M70 120 Q220 40 370 120 Q220 10 70 120Z' />
        <path d='M70 360 Q220 430 370 360 Q220 440 70 360Z' />
      </g>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'synth-nova',
    name: 'Synth Nova',
    description: 'Futuristic neon synth persona with vibrant gradients.',
    faceTexture: createSvgAvatar({
      skin: '#f5c0ff',
      eyes: '#1cffe3',
      mouth: '#ff71d8',
      accent: '#9925ff',
      background: '#4018d1',
    }),
    thumbnail: createSvgAvatar({
      skin: '#f5c0ff',
      eyes: '#1cffe3',
      mouth: '#ff71d8',
      accent: '#ff922b',
      background: '#1f054a',
    }),
    accent: '#b47aff',
  },
  {
    id: 'aurora-hues',
    name: 'Aurora Hues',
    description: 'Calm storyteller inspired by northern lights palettes.',
    faceTexture: createSvgAvatar({
      skin: '#f9e4d7',
      eyes: '#26396e',
      mouth: '#cb5f5f',
      accent: '#66c0ff',
      background: '#142136',
    }),
    thumbnail: createSvgAvatar({
      skin: '#fde9db',
      eyes: '#26396e',
      mouth: '#cb5f5f',
      accent: '#66c0ff',
      background: '#0b1524',
    }),
    accent: '#66c0ff',
  },
  {
    id: 'chrome-echo',
    name: 'Chrome Echo',
    description: 'Expressive android with chrome reflections.',
    faceTexture: createSvgAvatar({
      skin: '#d7f3ff',
      eyes: '#0c273d',
      mouth: '#1191ff',
      accent: '#6af1ff',
      background: '#020b24',
    }),
    thumbnail: createSvgAvatar({
      skin: '#d7f3ff',
      eyes: '#0c273d',
      mouth: '#1191ff',
      accent: '#6af1ff',
      background: '#010513',
    }),
    accent: '#6af1ff',
  },
];

const DEFAULT_FACE = AVATAR_PRESETS[0];

const computeEmotionBlend = (emotion: EmotionState, energy: number): EmotionState => ({
  happy: clamp01(emotion.happy * 0.7 + energy * 0.2 + emotion.neutral * 0.1),
  sad: clamp01(emotion.sad * 0.7 + (1 - energy) * 0.2 + emotion.neutral * 0.1),
  angry: clamp01(emotion.angry * 0.6 + energy * 0.25),
  surprised: clamp01(emotion.surprised * 0.6 + energy * 0.35),
  neutral: clamp01(emotion.neutral * 0.4 + (1 - energy) * 0.2),
});

interface UseAvatarEngineArgs {
  initialPresetId?: string;
}

export const useAvatarEngine = (args: UseAvatarEngineArgs = {}) => {
  const [faceSource, setFaceSource] = useState<FaceSource>({
    mode: 'preset',
    presetId: args.initialPresetId ?? DEFAULT_FACE.id,
  });
  const [uploadedFaceName, setUploadedFaceName] = useState<string | null>(null);
  const [emotions, setEmotions] = useState<EmotionState>(DEFAULT_EMOTIONS);
  const [gestureSeed, setGestureSeed] = useState<number>(() => Math.random());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [hasAudio, setHasAudio] = useState(false);

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const ignoreEndRef = useRef(false);
  const peakEnergyRef = useRef(0.0001);

  const [mouthOpen, setMouthOpen] = useState(0);
  const [blink, setBlink] = useState(0);
  const [headRotation, setHeadRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [eyeDirection, setEyeDirection] = useState<[number, number]>([0, 0]);
  const [handWave, setHandWave] = useState(0);
  const [energy, setEnergy] = useState(0);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      throw new Error('Audio context not available on the server.');
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if (!gainRef.current) {
      const gain = audioContext.createGain();
      gain.gain.value = volume;
      gainRef.current = gain;
    }
    if (!destinationRef.current) {
      destinationRef.current = audioContext.createMediaStreamDestination();
    }
    if (!analyserRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.9;
      analyserRef.current = analyser;
      dataArrayRef.current = new Float32Array(analyser.frequencyBinCount);
      analyser.connect(gainRef.current);
    }
    if (gainRef.current && destinationRef.current && gainRef.current.numberOfOutputs > 0) {
      try {
        gainRef.current.connect(audioContext.destination);
      } catch {
        // Connection already established.
      }
      try {
        gainRef.current.connect(destinationRef.current);
      } catch {
        // Connection already established.
      }
    }
    gainRef.current!.gain.value = volume;
    return audioContext;
  }, [volume]);

  const currentFaceTexture = useMemo(() => {
    if (faceSource.mode === 'preset') {
      return AVATAR_PRESETS.find((preset) => preset.id === faceSource.presetId) ?? DEFAULT_FACE;
    }
    return {
      ...DEFAULT_FACE,
      id: 'custom',
      name: uploadedFaceName ?? 'Custom Face',
      description: 'User provided face map',
      faceTexture: faceSource.url,
      thumbnail: faceSource.url,
      accent: '#70b5ff',
    };
  }, [faceSource, uploadedFaceName]);

  const hasAudio = useMemo(() => Boolean(audioBufferRef.current), []);

  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let frame: number;
    const loop = () => {
      if (analyserRef.current && dataArrayRef.current && audioBufferRef.current) {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;

        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = dataArray[i];
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        peakEnergyRef.current = Math.max(peakEnergyRef.current * 0.995, rms);
        const normalizedEnergy = peakEnergyRef.current > 0 ? rms / peakEnergyRef.current : 0;
        const smoothedMouth = smoothStep(normalizedEnergy * 1.8, 0.4);
        const newEnergy = clamp01(normalizedEnergy);

        setMouthOpen((prev) => prev * 0.8 + smoothedMouth * 0.2);
        setEnergy((prev) => prev * 0.9 + newEnergy * 0.1);

        const now = audioContextRef.current?.currentTime ?? 0;
        const elapsed = isPlaying
          ? now - startTimeRef.current
          : pauseOffsetRef.current;
        const duration = audioBufferRef.current?.duration ?? 0;
        const rawProgress = duration > 0 ? Math.min(elapsed / duration, 0.999) : 0;
        setPlaybackProgress((prev) => prev * 0.8 + rawProgress * 0.2);

        const t = performance.now() / 1000;
        const seed = gestureSeed;
        const headX = Math.sin(t * 1.3 + seed) * 0.15 * (0.5 + newEnergy);
        const headY = Math.sin(t * 0.9 + seed * 2.2) * 0.2 * (0.4 + emotions.happy * 0.6);
        const headZ = Math.sin(t * 1.7 + seed * 1.4) * 0.08 * (0.5 + emotions.surprised * 0.3);

        setHeadRotation(([x, y, z]) => [
          x * 0.8 + headX * 0.2,
          y * 0.8 + headY * 0.2,
          z * 0.8 + headZ * 0.2,
        ]);

        const blinkSpeed = 0.6 + emotions.neutral * 0.4 + (1 - newEnergy) * 0.5;
        const blinkValue = (Math.sin(t * blinkSpeed + seed * 4.1) + 1) / 2;
        setBlink(blinkValue > 0.85 ? (blinkValue - 0.85) * 6 : 0);

        const eyeX = Math.sin(t * 0.7 + seed * 3.4) * 0.4 * (0.4 + newEnergy);
        const eyeY = Math.sin(t * 0.5 + seed * 2.1) * 0.3 * (0.5 + emotions.surprised * 0.4);
        setEyeDirection(([prevX, prevY]) => [
          prevX * 0.8 + eyeX * 0.2,
          prevY * 0.8 + eyeY * 0.2,
        ]);

        const hand = Math.sin(t * 1.8 + seed * 6.2) * (0.3 + newEnergy * 0.5);
        setHandWave((prev) => prev * 0.85 + hand * 0.15);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [emotions, gestureSeed, isPlaying]);

  const stopCurrentSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  }, []);

  const getCurrentOffset = useCallback(() => {
    if (!audioBufferRef.current) {
      return 0;
    }
    if (isPlaying && audioContextRef.current) {
      const current = audioContextRef.current.currentTime;
      const elapsed = current - startTimeRef.current;
      return Math.min(Math.max(elapsed, 0), audioBufferRef.current.duration);
    }
    return Math.min(pauseOffsetRef.current, audioBufferRef.current.duration);
  }, [isPlaying]);

  const schedulePlayback = useCallback(
    async (offset: number, markPlaying = true): Promise<PlaybackSource | null> => {
      if (!audioBufferRef.current) {
        return null;
      }
      const audioContext = await ensureAudioContext();
      const duration = audioBufferRef.current.duration;
      const startOffset = Math.min(Math.max(offset, 0), Math.max(duration - 0.001, 0));

      stopCurrentSource();
      ignoreEndRef.current = false;

      const source = audioContext.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(analyserRef.current!);

      const done = new Promise<void>((resolve) => {
        source.onended = () => {
          if (!ignoreEndRef.current && sourceNodeRef.current === source) {
            sourceNodeRef.current = null;
            pauseOffsetRef.current = 0;
            if (markPlaying) {
              setIsPlaying(false);
            }
          }
          resolve();
        };
      });

      sourceNodeRef.current = source;
      startTimeRef.current = audioContext.currentTime - startOffset;
      pauseOffsetRef.current = startOffset;
      if (markPlaying) {
        setIsPlaying(true);
      }
      source.start(0, startOffset);
      return { source, done };
    },
    [ensureAudioContext, stopCurrentSource],
  );

  const play = useCallback(async () => {
    if (!audioBufferRef.current) {
      throw new Error('Load audio before playing the preview.');
    }
    const offset = getCurrentOffset();
    await schedulePlayback(offset);
  }, [getCurrentOffset, schedulePlayback]);

  const pause = useCallback(() => {
    if (!audioBufferRef.current || !audioContextRef.current || !isPlaying) {
      return;
    }
    const offset = getCurrentOffset();
    pauseOffsetRef.current = offset;
    ignoreEndRef.current = true;
    stopCurrentSource();
    setIsPlaying(false);
  }, [getCurrentOffset, isPlaying, stopCurrentSource]);

  const resetPlayback = useCallback(() => {
    pauseOffsetRef.current = 0;
    startTimeRef.current = 0;
    stopCurrentSource();
    setIsPlaying(false);
    setPlaybackProgress(0);
    setMouthOpen(0);
    setEnergy(0);
    setBlink(0);
    setHeadRotation([0, 0, 0]);
    setEyeDirection([0, 0]);
    setHandWave(0);
  }, [stopCurrentSource]);

  const decodeAudioData = useCallback(
    async (arrayBuffer: ArrayBuffer) => {
      const audioContext = await ensureAudioContext();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      audioBufferRef.current = decoded;
      setHasAudio(true);
      setAudioDuration(decoded.duration);
      resetPlayback();
    },
    [ensureAudioContext, resetPlayback],
  );

  const loadAudioFromFile = useCallback(
    async (file: File) => {
      setIsLoadingAudio(true);
      setStatusMessage(`Decoding ${file.name}...`);
      try {
        setHasAudio(false);
        const buffer = await file.arrayBuffer();
        await decodeAudioData(buffer);
        setAudioName(file.name);
        setStatusMessage(`Loaded ${file.name}`);
      } catch (error) {
        console.error(error);
        setStatusMessage('Unable to decode audio file.');
        setHasAudio(false);
        throw error;
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [decodeAudioData],
  );

  const generateSpeechFromText = useCallback(
    async (text: string, voice: string) => {
      if (!text.trim()) {
        throw new Error('Please provide text to generate speech.');
      }
      setIsGeneratingSpeech(true);
      setStatusMessage('Synthesizing speech...');
      try {
        setHasAudio(false);
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        });
        if (!response.ok) {
          throw new Error('Unable to generate speech.');
        }
        const arrayBuffer = await response.arrayBuffer();
        await decodeAudioData(arrayBuffer);
        setAudioName(`TTS • ${voice}`);
        setStatusMessage('Speech generated successfully.');
      } catch (error) {
        console.error(error);
        setStatusMessage('Text-to-speech failed.');
        setHasAudio(false);
        throw error;
      } finally {
        setIsGeneratingSpeech(false);
      }
    },
    [decodeAudioData],
  );

  const loadAudioFromVideo = useCallback(
    async (file: File) => {
      setIsProcessingVideo(true);
      setStatusMessage(`Extracting audio from ${file.name}...`);
      try {
        setHasAudio(false);
        const wavBuffer = await extractAudioFromVideo(file);
        await decodeAudioData(wavBuffer);
        setAudioName(`${file.name} • audio track`);
        setStatusMessage('Video audio extracted.');
      } catch (error) {
        console.error(error);
        setStatusMessage('Unable to extract audio from video.');
        setHasAudio(false);
        throw error;
      } finally {
        setIsProcessingVideo(false);
      }
    },
    [decodeAudioData],
  );

  const setEmotionValue = useCallback((key: EmotionKey, value: number) => {
    setEmotions((prev) => ({ ...prev, [key]: clamp01(value) }));
  }, []);

  const setPreset = useCallback((presetId: string) => {
    setFaceSource({ mode: 'preset', presetId });
    setUploadedFaceName(null);
  }, []);

  const setCustomFace = useCallback(async (file: File) => {
    const reader = new FileReader();
    const promise = new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('Unable to read image file.'));
      reader.onload = () => resolve(reader.result as string);
    });
    reader.readAsDataURL(file);
    const url = await promise;
    setFaceSource({ mode: 'upload', url, name: file.name });
    setUploadedFaceName(file.name);
  }, []);

  const regenerateGestures = useCallback(() => {
    setGestureSeed(Math.random());
  }, []);

  const updateVolume = useCallback(
    (value: number) => {
      const clamped = clamp01(value);
      setVolume(clamped);
      if (gainRef.current) {
        gainRef.current.gain.value = clamped;
      }
    },
    [],
  );

  const exportVideo = useCallback(
    async (canvas: HTMLCanvasElement | null, format: ExportFormat) => {
      if (!canvas) {
        throw new Error('Preview canvas is not ready yet.');
      }
      if (!audioBufferRef.current) {
        throw new Error('Load or generate speech before exporting.');
      }

      setIsExporting(true);
      setStatusMessage(`Rendering ${format.toUpperCase()}...`);

      const previousOffset = getCurrentOffset();
      const wasPlaying = isPlaying;

      try {
        pause();

        await ensureAudioContext();
        const videoStream = canvas.captureStream(60);
        const audioStream = destinationRef.current?.stream;
        if (!audioStream) {
          throw new Error('Audio routing unavailable for export.');
        }
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioStream.getAudioTracks(),
        ]);

        const mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('Browser does not support the required recording format.');
        }

        const recorder = new MediaRecorder(combinedStream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        const recordingPromise = new Promise<void>((resolve, reject) => {
          recorder.onerror = (event) => reject(event.error ?? new Error('Recorder error'));
          recorder.onstop = () => resolve();
        });

        recorder.start(100);
        const playback = await schedulePlayback(0, true);
        if (playback) {
          await playback.done;
        }
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        await recordingPromise;

        const webmBlob = new Blob(chunks, { type: mimeType });
        let finalBlob = webmBlob;
        if (format === 'mp4') {
          finalBlob = await convertWebMToMp4(webmBlob);
        }

        setStatusMessage('Export complete.');

        if (wasPlaying) {
          pauseOffsetRef.current = previousOffset;
          await schedulePlayback(previousOffset, true);
        } else {
          pauseOffsetRef.current = previousOffset;
          setIsPlaying(false);
        }

        return finalBlob;
      } catch (error) {
        setStatusMessage('Export failed. Please try again.');
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    // convertWebMToMp4 is module-scoped and stable.
    [ensureAudioContext, getCurrentOffset, isPlaying, pause, schedulePlayback],
  );

  const animationState: AvatarAnimationState = useMemo(
    () => ({
      mouthOpen,
      blink,
      headRotation,
      eyeDirection,
      handWave,
      intensity: energy,
      emotionMix: computeEmotionBlend(emotions, energy),
      energy,
    }),
    [blink, emotions, energy, eyeDirection, handWave, headRotation, mouthOpen],
  );

  return {
    face: currentFaceTexture,
    faceSource,
    setPreset,
    setCustomFace,
    regenerateGestures,
    animationState,
    emotions,
    setEmotionValue,
    play,
    pause,
    isPlaying,
    isLoadingAudio,
    isGeneratingSpeech,
    isProcessingVideo,
    statusMessage,
    playbackProgress,
    audioDuration,
    audioName,
    loadAudioFromFile,
    loadAudioFromVideo,
    generateSpeechFromText,
    exportVideo,
    isExporting,
    hasAudio,
    updateVolume,
    volume,
  };
};
