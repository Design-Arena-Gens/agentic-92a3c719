'use client';

import Image from 'next/image';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import AvatarPreview from '../components/AvatarPreview';
import {
  AVATAR_PRESETS,
  type AvatarPreset,
  type BackgroundOption,
  type CameraAngle,
  type EmotionKey,
  useAvatarEngine,
} from '../hooks/useAvatarEngine';

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'nebula',
    label: 'Nebula Glow',
    description: 'Deep violet cosmic gradient with soft haze.',
    className:
      'bg-[radial-gradient(circle_at_20%_20%,rgba(87,119,255,0.45),transparent_55%)] bg-[#050415]',
  },
  {
    id: 'studio',
    label: 'Cinema Studio',
    description: 'Professional blue studio wash.',
    className: 'bg-gradient-to-br from-[#0b1120] via-[#0f172a] to-[#1e1b4b]',
  },
  {
    id: 'sunset',
    label: 'Sunset Pulse',
    description: 'Warm atmospheric glow for energetic sessions.',
    className: 'bg-gradient-to-br from-[#1a1037] via-[#ff4d6d] to-[#ffb347]',
  },
  {
    id: 'minimal',
    label: 'Minimal Noir',
    description: 'Clean neutral stage with subtle spotlight.',
    className:
      'bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.12),transparent_65%)] bg-[#050608]',
  },
  {
    id: 'hyper',
    label: 'Hyper Grid',
    description: 'Futuristic cyan grid energy field.',
    className:
      'bg-[#03111f] before:pointer-events-none before:absolute before:inset-0 before:content-[""] before:bg-[radial-gradient(circle_at_80%_20%,rgba(0,212,255,0.32),transparent_60%)]',
  },
];

const CAMERA_ANGLES: CameraAngle[] = [
  { id: 'front', label: 'Front', position: [0, 0.38, 3], target: [0, 0.32, 0] },
  { id: 'focus', label: 'Focus', position: [0.85, 0.28, 2.6], target: [0, 0.3, 0] },
  { id: 'profile', label: 'Profile', position: [2.2, 0.35, 1], target: [0, 0.25, 0] },
  { id: 'immersive', label: 'Immersive', position: [0, 1.4, 1.8], target: [0, 0.8, 0] },
];

const EMOTION_LABELS: Record<EmotionKey, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  surprised: 'Surprised',
  neutral: 'Neutral',
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const rem = Math.floor(clamped % 60);
  return `${minutes}:${rem.toString().padStart(2, '0')}`;
};

const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition hover:border-white/20 hover:shadow-xl hover:shadow-indigo-500/10">
    <div className="flex items-baseline justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-200">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
    <div className="mt-5 space-y-5">{children}</div>
  </section>
);

const ChipToggle = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={clsx(
      'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
      active
        ? 'bg-white text-slate-900 shadow-lg shadow-white/20'
        : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white',
    )}
  >
    {label}
  </button>
);

const EmotionSlider = ({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: string;
}) => (
  <label className="block">
    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-300">
      <span>{label}</span>
      <span className="text-slate-400">{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      onChange={(event) => onChange(Number(event.target.value) / 100)}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-400"
      style={{ accentColor: accent }}
    />
  </label>
);

const IconButton = ({
  label,
  icon,
  onClick,
  disabled,
  tone = 'primary',
  type = 'button',
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
}) => {
  const styles: Record<'primary' | 'secondary' | 'danger', string> = {
    primary:
      'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-[0_15px_45px_-20px_rgba(139,92,246,0.8)]',
    secondary: 'bg-white/10 text-slate-200 hover:bg-white/15',
    danger: 'bg-red-500/20 text-red-200 hover:bg-red-500/30',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:opacity-50',
        styles[tone],
      )}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

const LoadingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
  </span>
);

export default function Home() {
  const {
    face,
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
  } = useAvatarEngine();

  const [background, setBackground] = useState<BackgroundOption>(BACKGROUND_OPTIONS[0]);
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>(CAMERA_ANGLES[0]);
  const [ttsText, setTtsText] = useState(
    'Hello! I am your AI-driven avatar. Adjust my emotions, upload audio, or synthesize speech to bring me to life.',
  );
  const [voice, setVoice] = useState('en-US');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await loadAudioFromFile(file);
      setToast({ type: 'success', message: `Loaded audio: ${file.name}` });
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message ?? 'Audio load failed' });
    }
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await loadAudioFromVideo(file);
      setToast({ type: 'success', message: `Synced with video: ${file.name}` });
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message ?? 'Video processing failed' });
    }
  };

  const handleFaceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await setCustomFace(file);
      setToast({ type: 'success', message: `Face updated: ${file.name}` });
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message ?? 'Unable to load face texture' });
    }
  };

  const handleGenerateSpeech = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await generateSpeechFromText(ttsText, voice);
      setToast({ type: 'success', message: 'Speech synthesized successfully.' });
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message ?? 'Text-to-speech failed' });
    }
  };

  const handlePlayToggle = async () => {
    if (!hasAudio) {
      setToast({ type: 'info', message: 'Load or generate audio first.' });
      return;
    }
    if (isPlaying) {
      pause();
    } else {
      try {
        await play();
      } catch (error) {
        setToast({ type: 'error', message: (error as Error).message ?? 'Unable to start playback' });
      }
    }
  };

  const handleExport = async (format: 'webm' | 'mp4') => {
    if (!hasAudio) {
      setToast({ type: 'info', message: 'Provide audio before exporting.' });
      return;
    }
    try {
      const blob = await exportVideo(canvasRef.current, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `avatar-sync-${Date.now()}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast({ type: 'success', message: `Exported ${format.toUpperCase()} successfully.` });
    } catch (error) {
      setToast({ type: 'error', message: (error as Error).message ?? 'Export failed' });
    }
  };

  const playbackPercent = Math.min(100, Math.max(0, playbackProgress * 100));

  const emotionAccent = useMemo(
    () =>
      new Map<EmotionKey, string>([
        ['happy', '#facc15'],
        ['sad', '#38bdf8'],
        ['angry', '#f87171'],
        ['surprised', '#a855f7'],
        ['neutral', '#9ca3af'],
      ]),
    [],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#010103] via-[#06021a] to-[#0e0a2a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,28,135,0.35),transparent_65%)]" />
      <main className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-24 pt-14 lg:px-12">
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
            AI Lip Sync Suite
          </div>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Create expressive AI avatars with precise lip sync and emotional control.
            </h1>
            <p className="text-lg text-slate-300">
              Upload custom faces or start from designer presets, blend emotions in real-time, drive
              speech from audio, video, or text, and export cinematic animations ready for production.
            </p>
          </div>
        </header>

        {toast ? (
          <div
            className={clsx(
              'sticky top-4 z-20 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur',
              toast.type === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
              toast.type === 'error' && 'border-red-500/40 bg-red-500/10 text-red-200',
              toast.type === 'info' && 'border-blue-500/40 bg-blue-500/10 text-blue-200',
            )}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-widest text-white/70 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        ) : null}

        <div className="grid gap-10 xl:grid-cols-[420px_1fr]">
          <aside className="space-y-6">
            <SectionCard title="Media Sources" description="Generate or upload audio to drive motion.">
              <form onSubmit={handleGenerateSpeech} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.3em] text-slate-400">
                    Text-to-Speech
                  </span>
                  <textarea
                    value={ttsText}
                    onChange={(event) => setTtsText(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-inner focus:border-indigo-400 focus:outline-none"
                    placeholder="Type what you want the avatar to say..."
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={voice}
                    onChange={(event) => setVoice(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.25em] text-indigo-200 focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="en-US">US Narrative</option>
                    <option value="en-GB">UK Conversational</option>
                    <option value="en-AU">AU Friendly</option>
                    <option value="es-ES">Spanish</option>
                    <option value="fr-FR">French</option>
                  </select>
                  <IconButton
                    type="submit"
                    label={isGeneratingSpeech ? 'Generating...' : 'Generate Speech'}
                    icon={isGeneratingSpeech ? <LoadingDots /> : '✨'}
                    disabled={isGeneratingSpeech}
                  />
                </div>
              </form>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="rounded-2xl border border-dashed border-indigo-500/40 bg-indigo-500/5 px-4 py-3 text-left text-sm font-semibold text-indigo-200 shadow-inner transition hover:border-indigo-400 hover:bg-indigo-500/10"
                >
                  Upload Audio
                  <p className="mt-1 text-xs font-normal text-indigo-200/70">MP3, WAV, OGG</p>
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="rounded-2xl border border-dashed border-fuchsia-500/40 bg-fuchsia-500/5 px-4 py-3 text-left text-sm font-semibold text-fuchsia-200 shadow-inner transition hover:border-fuchsia-400 hover:bg-fuchsia-500/10"
                >
                  Sync from Video
                  <p className="mt-1 text-xs font-normal text-fuchsia-200/70">MP4, MOV, WebM</p>
                </button>
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={handleAudioUpload}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={handleVideoUpload}
              />
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white/80">
                    {audioName ?? 'No audio loaded'}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-slate-400">
                    {formatDuration(audioDuration)}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 transition-all"
                    style={{ width: `${playbackPercent}%` }}
                  />
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {isLoadingAudio && (
                    <span className="inline-flex items-center gap-2">
                      <LoadingDots />
                      Decoding audio
                    </span>
                  )}
                  {isProcessingVideo && (
                    <span className="inline-flex items-center gap-2">
                      <LoadingDots />
                      Extracting from video
                    </span>
                  )}
                  {statusMessage && !isLoadingAudio && !isProcessingVideo ? statusMessage : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Avatar Studio" description="Select a preset or upload a custom face.">
              <div className="grid gap-3 sm:grid-cols-2">
                {AVATAR_PRESETS.map((preset: AvatarPreset) => (
                  <button
                    key={preset.id}
                    onClick={() => setPreset(preset.id)}
                    className={clsx(
                      'rounded-2xl border px-3 py-3 text-left transition hover:border-white/30 hover:bg-white/10',
                      face.id === preset.id
                        ? 'border-white/40 bg-white/10 shadow-lg shadow-indigo-500/20'
                        : 'border-white/5 bg-white/5',
                    )}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
                      <Image
                        src={preset.thumbnail}
                        alt={preset.name}
                        fill
                        sizes="200px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-semibold text-white">{preset.name}</p>
                      <p className="text-xs text-slate-400">{preset.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => faceInputRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/10"
              >
                Upload Custom Face Texture
              </button>
              <input
                ref={faceInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFaceUpload}
              />
            </SectionCard>

            <SectionCard title="Emotion Mixer" description="Blend expression layers and body language.">
              <div className="space-y-4">
                {(Object.keys(emotions) as EmotionKey[]).map((key) => (
                  <EmotionSlider
                    key={key}
                    label={EMOTION_LABELS[key]}
                    value={emotions[key]}
                    onChange={(value) => setEmotionValue(key, value)}
                    accent={emotionAccent.get(key)!}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(event) => updateVolume(Number(event.target.value) / 100)}
                  className="h-1.5 w-40 cursor-pointer rounded-full bg-slate-700 accent-indigo-400"
                />
              </div>
            </SectionCard>

            <SectionCard title="Scene Settings" description="Camera, backgrounds, and styling.">
              <div className="flex flex-wrap gap-2">
                {CAMERA_ANGLES.map((option) => (
                  <ChipToggle
                    key={option.id}
                    label={option.label}
                    active={cameraAngle.id === option.id}
                    onClick={() => setCameraAngle(option)}
                  />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setBackground(option)}
                    className={clsx(
                      'relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition',
                      background.id === option.id
                        ? 'border-white/40 bg-white/10 shadow-[0_10px_40px_-20px_rgba(99,102,241,0.8)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20',
                    )}
                  >
                    <div className="mb-3 h-20 overflow-hidden rounded-xl border border-white/10">
                      <div className={clsx('relative h-full w-full', option.className)} />
                    </div>
                    <p className="text-sm font-semibold text-white">{option.label}</p>
                    <p className="text-xs text-slate-400">{option.description}</p>
                  </button>
                ))}
              </div>
            </SectionCard>
          </aside>

          <section className="space-y-6">
            <div className="relative">
              <AvatarPreview
                face={face}
                animation={animationState}
                background={background}
                camera={cameraAngle}
                showHud
                onCanvasReady={(canvas) => {
                  canvasRef.current = canvas;
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-lg shadow-indigo-500/10 backdrop-blur">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Live Status</p>
                <div className="flex items-center gap-3 text-sm text-slate-200">
                  <span
                    className={clsx(
                      'inline-flex h-2 w-2 rounded-full',
                      isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500',
                    )}
                  />
                  <span>
                    {isPlaying
                      ? 'Animating in real-time'
                      : hasAudio
                        ? 'Standing by'
                        : 'Awaiting audio input'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <IconButton
                  label={isPlaying ? 'Pause' : 'Play'}
                  icon={isPlaying ? '⏸' : '▶️'}
                  onClick={handlePlayToggle}
                  disabled={isLoadingAudio || isProcessingVideo || !hasAudio}
                />
                <IconButton
                  label="Regenerate Gestures"
                  icon="🔁"
                  tone="secondary"
                  onClick={regenerateGestures}
                />
                <IconButton
                  label="Export WebM"
                  icon={isExporting ? <LoadingDots /> : '📼'}
                  tone="secondary"
                  disabled={isExporting}
                  onClick={() => handleExport('webm')}
                />
                <IconButton
                  label="Export MP4"
                  icon={isExporting ? <LoadingDots /> : '🎬'}
                  tone="primary"
                  disabled={isExporting}
                  onClick={() => handleExport('mp4')}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">
                Emotion Spectrum
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-5">
                {(Object.keys(animationState.emotionMix) as EmotionKey[]).map((key) => (
                  <div
                    key={key}
                    className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-center"
                  >
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                      {EMOTION_LABELS[key]}
                    </p>
                    <div className="relative h-16 overflow-hidden rounded-xl bg-white/10">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-white/90 via-white/60 to-transparent transition-all"
                        style={{ height: `${Math.round(animationState.emotionMix[key] * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-white">
                      {Math.round(animationState.emotionMix[key] * 100)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

