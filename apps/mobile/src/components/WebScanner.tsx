// Strekkodeskanner for webappen.
// expo-camera på web ber om lav oppløsning og slår ikke på kontinuerlig fokus, så strekkoder
// blir uskarpe på nært hold. Her ber vi om høy oppløsning, kontinuerlig fokus og litt zoom
// (der nettleseren støtter det), og et trykk på bildet fokuserer på nytt.
import { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';

type Props = {
  /** false = pause (arket er åpent eller oppslag pågår). Kameraet står på. */
  active: boolean;
  onCode: (code: string) => void;
  onError: (message: string) => void;
};

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const FORMATS = ['ean_13', 'ean_8', 'upc_a'];

async function makeDetector(): Promise<Detector> {
  // Innebygd BarcodeDetector (Chrome på Android) er raskest. Ellers WASM-dekoderen fra barcode-detector,
  // som ScanOverlay peker til /zxing_reader.wasm.
  const Native = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;
  if (Native?.getSupportedFormats) {
    const supported: string[] = await Native.getSupportedFormats().catch(() => []);
    if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: FORMATS });
  }
  const { BarcodeDetector } = await import('barcode-detector');
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

export function WebScanner({ active, onCode, onError }: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const activeRef = useRef(active);
  const onCodeRef = useRef(onCode);
  activeRef.current = active;
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        track.current = stream.getVideoTracks()[0];
        await tune(track.current);

        const v = video.current!;
        v.srcObject = stream;
        v.muted = true;
        v.setAttribute('playsinline', '');
        await v.play();

        const detector = await makeDetector();
        const tick = async () => {
          if (stopped) return;
          if (activeRef.current && v.readyState >= 2) {
            try {
              const hit = (await detector.detect(v))[0];
              if (hit?.rawValue) onCodeRef.current(hit.rawValue);
            } catch {
              // Enkeltbilder som ikke kan dekodes, ignoreres.
            }
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        const err = e as DOMException;
        onError(
          err?.name === 'NotAllowedError' ? 'Vinskap har ikke tilgang til kameraet. Tillat kamera for denne siden i nettleseren.'
            : err?.name === 'NotFoundError' ? 'Fant ikke noe kamera.'
            : 'Kameraet kunne ikke starte: ' + (err?.message || String(e)),
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {createElement('video', {
        ref: video,
        playsInline: true,
        muted: true,
        // Trykk for å fokusere på nytt
        onClick: () => track.current && refocus(track.current),
        style: { width: '100%', height: '100%', objectFit: 'cover', background: '#2A2520' },
      })}
    </View>
  );
}

type Caps = MediaTrackCapabilities & { focusMode?: string[]; zoom?: { min: number; max: number } };

/** Kontinuerlig fokus og ca. 2× zoom der det støttes, så man kan holde flasken litt unna og fortsatt få skarpt bilde. */
async function tune(t: MediaStreamTrack) {
  const caps = (t.getCapabilities?.() ?? {}) as Caps;
  const adv: Record<string, unknown> = {};
  if (caps.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
  if (caps.zoom && caps.zoom.max >= 1.5) adv.zoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2));
  if (Object.keys(adv).length) await t.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }).catch(() => {});
}

async function refocus(t: MediaStreamTrack) {
  const caps = (t.getCapabilities?.() ?? {}) as Caps;
  if (!caps.focusMode) return;
  const set = (focusMode: string) => t.applyConstraints({ advanced: [{ focusMode } as MediaTrackConstraintSet] }).catch(() => {});
  if (caps.focusMode.includes('single-shot')) await set('single-shot');
  if (caps.focusMode.includes('continuous')) await set('continuous');
}
