import { useEffect, useRef, useState } from "react";
import Guacamole from "guacamole-common-js";
import { createGuacToken } from "@workspace/api-client-react";
import { Loader2, AlertTriangle } from "lucide-react";

interface GuacClientProps {
  connectionId: number;
  dataSource: string;
  interactive?: boolean;
}

type Phase = "connecting" | "connected" | "error" | "disconnected";

export function GuacClient({ connectionId, dataSource, interactive = false }: GuacClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Guacamole.Client | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string>("");

  // ── Connection lifecycle: depends ONLY on connection identity.
  // Toggling `interactive` (expand/collapse) must NOT tear down the tunnel.
  useEffect(() => {
    let cancelled = false;
    let client: Guacamole.Client | null = null;
    let displayEl: HTMLElement | null = null;

    (async () => {
      try {
        const tokenResp = await createGuacToken();
        if (cancelled) return;

        const { authToken, dataSource: ds, baseUrl } = tokenResp;
        const effectiveDs = ds || dataSource;

        // Convert http(s):// → ws(s):// for the tunnel endpoint.
        const wsBase = baseUrl.replace(/^http/i, "ws");
        const tunnelUrl = `${wsBase}/websocket-tunnel`;

        const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
        client = new Guacamole.Client(tunnel);
        clientRef.current = client;

        const display = client.getDisplay();
        displayEl = display.getElement();
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(displayEl);
          displayEl.style.display = "block";
          displayEl.style.margin = "0 auto";
        }

        client.onstatechange = (state) => {
          // 0=IDLE 1=CONNECTING 2=WAITING 3=CONNECTED 4=DISCONNECTING 5=DISCONNECTED
          if (state === 3) setPhase("connected");
          else if (state === 5) setPhase("disconnected");
        };
        client.onerror = (status) => {
          setPhase("error");
          setMessage(status?.message ?? "Guacamole connection error");
        };

        // Build connect string the way Apache Guacamole's own frontend does.
        // URLSearchParams collapses repeated keys, so build manually so the
        // multi-value GUAC_AUDIO / GUAC_VIDEO / GUAC_IMAGE lists survive.
        const supportedImages = ["image/png", "image/jpeg", "image/webp"];
        const supportedAudio: string[] = [];
        const supportedVideo: string[] = [];
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const enc = encodeURIComponent;
        const width = Math.max(640, containerRef.current?.clientWidth ?? 1024);
        const height = Math.max(360, containerRef.current?.clientHeight ?? 768);
        const dpi = Math.round(window.devicePixelRatio * 96) || 96;
        const connectStr =
          `token=${enc(authToken)}` +
          `&GUAC_DATA_SOURCE=${enc(effectiveDs)}` +
          `&GUAC_ID=${enc(String(connectionId))}` +
          `&GUAC_TYPE=c` +
          `&GUAC_WIDTH=${width}` +
          `&GUAC_HEIGHT=${height}` +
          `&GUAC_DPI=${dpi}` +
          `&GUAC_TIMEZONE=${enc(tz)}` +
          supportedAudio.map((m) => `&GUAC_AUDIO=${enc(m)}`).join("") +
          supportedVideo.map((m) => `&GUAC_VIDEO=${enc(m)}`).join("") +
          supportedImages.map((m) => `&GUAC_IMAGE=${enc(m)}`).join("");

        client.connect(connectStr);
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (client) client.disconnect();
      } catch {
        // best-effort
      }
      clientRef.current = null;
      if (displayEl && displayEl.parentNode) {
        displayEl.parentNode.removeChild(displayEl);
      }
    };
  }, [connectionId, dataSource]);

  // ── Input binding: layered on top of the live client. Toggles cleanly
  // with `interactive` without touching the tunnel.
  useEffect(() => {
    if (!interactive) return;
    const container = containerRef.current;
    const client = clientRef.current;
    if (!container || !client) return;

    const mouse = new Guacamole.Mouse(container);
    const fwd = () => {
      client.sendMouseState(mouse.currentState, true);
    };
    mouse.on("mousedown", fwd);
    mouse.on("mouseup", fwd);
    mouse.on("mousemove", fwd);

    const keyboard = new Guacamole.Keyboard(document);
    keyboard.onkeydown = (sym) => {
      client.sendKeyEvent(1, sym);
    };
    keyboard.onkeyup = (sym) => {
      client.sendKeyEvent(0, sym);
    };

    return () => {
      try {
        mouse.offEach(["mousedown", "mouseup", "mousemove"], () => true);
        keyboard.onkeydown = null;
        keyboard.onkeyup = null;
      } catch {
        // best-effort
      }
    };
  }, [interactive, phase]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" />
      {phase === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-black/60 pointer-events-none">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="text-xs">Connecting to VM #{connectionId}…</div>
        </div>
      )}
      {(phase === "error" || phase === "disconnected") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive bg-black/70 p-4 text-center pointer-events-none">
          <AlertTriangle className="w-6 h-6 mb-2" />
          <div className="text-xs font-mono">
            {phase === "error" ? "Connection error" : "Disconnected"}
          </div>
          {message && <div className="text-[10px] mt-1 opacity-70 max-w-full break-words">{message}</div>}
        </div>
      )}
    </div>
  );
}
