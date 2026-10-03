"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const POLL_MS = 6000;

type Poll = {
  count: number;
  latestId: string | null;
  latestMessage: string | null;
  assetId: string | null;
  signedIn: boolean;
};

type Toast = { id: string; message: string; assetId: string | null };

/**
 * Keeps the portal live: polls for new notifications, and the moment one
 * arrives it rings a bell tone, shows a toast, and soft-refreshes the page so
 * the sidebar badge and any open list update without a manual reload.
 *
 * The bell is synthesized with the Web Audio API (no audio file to ship).
 * Browsers block audio until the user interacts with the page once, so we
 * arm it on the first click/keypress.
 */
export default function LiveNotifier() {
  const router = useRouter();
  const lastSeen = useRef<string | null>(null);
  const primed = useRef(false); // skip the ring on the very first poll
  const audioReady = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Unlock audio on the first user gesture (autoplay policy).
  useEffect(() => {
    function arm() {
      audioReady.current = true;
      if (!ctxRef.current) {
        try {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          ctxRef.current = new AC();
        } catch {
          /* no audio available */
        }
      }
      ctxRef.current?.resume?.();
    }
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const ring = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !audioReady.current) return;
    // Two short chime notes — a friendly "ding-dong".
    const now = ctx.currentTime;
    [
      { f: 880, t: 0 },
      { f: 1174.66, t: 0.16 },
    ].forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.55);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch("/api/notifications/poll", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: Poll = await res.json();
        if (!alive || !data.signedIn) return;

        if (!primed.current) {
          // First poll after load: record baseline, don't ring.
          lastSeen.current = data.latestId;
          primed.current = true;
        } else if (data.latestId && data.latestId !== lastSeen.current) {
          lastSeen.current = data.latestId;
          ring();
          if (data.latestMessage) {
            const t: Toast = {
              id: data.latestId,
              message: data.latestMessage,
              assetId: data.assetId,
            };
            setToasts((cur) => [t, ...cur].slice(0, 4));
            setTimeout(() => {
              setToasts((cur) => cur.filter((x) => x.id !== t.id));
            }, 8000);
          }
          // Pull fresh server data so the badge + lists update in place.
          router.refresh();
        }
      } catch {
        /* network blip — try again next tick */
      } finally {
        if (alive) timer = setTimeout(poll, POLL_MS);
      }
    }

    // Poll on focus returns too, for snappier updates.
    function onVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ring, router]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "min(360px, calc(100vw - 32px))",
      }}
    >
      {toasts.map((t) => {
        const body = (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderLeft: "4px solid var(--brand)",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.18)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: "var(--brand)",
                marginBottom: 2,
              }}
            >
              🔔 New notification
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              {t.message}
            </div>
          </div>
        );
        return (
          <div key={t.id}>
            {t.assetId ? (
              <Link
                href={`/assets/${t.assetId}`}
                style={{ textDecoration: "none" }}
                onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              >
                {body}
              </Link>
            ) : (
              <Link
                href="/notifications"
                style={{ textDecoration: "none" }}
                onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              >
                {body}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
