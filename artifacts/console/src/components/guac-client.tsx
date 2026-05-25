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
  const displayElRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string>("");
  const [debug, setDebug] = useState<{ mx: number; my: number; rx: number; ry: number; scale: number; dw: number; dh: number } | null>(null);

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

        // Build a fully-qualified WebSocket URL for the tunnel.
        //   - If baseUrl is absolute (http(s)://host/path), swap scheme to ws/wss.
        //   - If baseUrl is same-origin (e.g. "/api/guac-proxy"), derive ws(s)
        //     scheme from the current page so HTTPS pages get wss:// and avoid
        //     mixed-content blocks.
        const tunnelUrl = /^https?:/i.test(baseUrl)
          ? `${baseUrl.replace(/^http/i, "ws")}/websocket-tunnel`
          : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${baseUrl}/websocket-tunnel`;

        const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
        client = new Guacamole.Client(tunnel);
        clientRef.current = client;

        const display = client.getDisplay();
        displayEl = display.getElement();
        displayElRef.current = displayEl;
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(displayEl);
          // Absolutely position the display at the top-left of the container.
          // Two reasons:
          //   1. Guacamole.Mouse computes coordinates with `offsetLeft` /
          //      `offsetTop`, NOT getBoundingClientRect. Flex-centering the
          //      display element places it at a position the offsetLeft walk
          //      cannot fully account for (especially after `display.scale()`
          //      applies a CSS transform to the inner display div), which is
          //      what made "only the top half" of the tile clickable.
          //   2. With `bounds` (what getElement returns) sized by Guacamole to
          //      the scaled output, top-left anchoring gives a stable, well-
          //      defined offset chain regardless of tile aspect ratio.
          displayEl.style.position = "absolute";
          displayEl.style.top = "0";
          displayEl.style.left = "0";
          displayEl.style.cursor = "none";
        }

        // Fit the (potentially much larger) remote display into our tile,
        // then center the displayEl inside the container using explicit
        // pixel left/top values. Setting position via concrete numbers (not
        // flex or CSS transform) keeps `offsetLeft` / `offsetTop` accurate,
        // which Guacamole.Mouse relies on for translating viewport mouse
        // coordinates into element-relative ones.
        const fit = () => {
          const c = containerRef.current;
          if (!c || !displayEl) return;
          const dw = display.getWidth();
          const dh = display.getHeight();
          if (!dw || !dh) return;
          const cw = c.clientWidth;
          const ch = c.clientHeight;
          const scale = Math.min(cw / dw, ch / dh);
          if (scale > 0 && isFinite(scale)) {
            display.scale(scale);
            displayEl.style.left = `${Math.max(0, Math.round((cw - dw * scale) / 2))}px`;
            displayEl.style.top = `${Math.max(0, Math.round((ch - dh * scale) / 2))}px`;
          }
        };
        display.onresize = fit;
        const ro = new ResizeObserver(fit);
        if (containerRef.current) ro.observe(containerRef.current);
        // expose for cleanup
        (client as unknown as { __ro?: ResizeObserver }).__ro = ro;

        client.onstatechange = (state) => {
          if (state === 3) {
            setPhase("connected");
            fit();
          } else if (state === 5) setPhase("disconnected");
        };
        client.onerror = (status) => {
          // eslint-disable-next-line no-console
          console.error(`[GuacClient #${connectionId}] client error`, status);
          setPhase("error");
          setMessage(
            `client: ${status?.message ?? "unknown"} (code ${(status as { code?: number })?.code ?? "?"})`,
          );
        };
        tunnel.onerror = (status) => {
          // eslint-disable-next-line no-console
          console.error(`[GuacClient #${connectionId}] tunnel error`, status);
          setPhase("error");
          setMessage(
            `tunnel: ${status?.message ?? "unknown"} (code ${(status as { code?: number })?.code ?? "?"})`,
          );
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
        const ro = (client as unknown as { __ro?: ResizeObserver })?.__ro;
        ro?.disconnect();
      } catch {
        // best-effort
      }
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
    const client = clientRef.current;
    const displayEl = displayElRef.current;
    if (!client || !displayEl) return;

    // Attach Mouse to the DISPLAY element, not the surrounding container.
    // The display is centered inside the container with letterbox bars when
    // its scaled size doesn't match the tile (larger tiles at 2-3 columns).
    // Listening on the container would report coordinates relative to the
    // container origin (top-left of the letterbox), which the Guacamole
    // client then forwards to the remote as off-target positions — the
    // remote cursor appears "off-screen" and never renders inside the tile.
    const mouse = new Guacamole.Mouse(displayEl);
    const display = client.getDisplay();
    const fwd = () => {
      client.sendMouseState(mouse.currentState, true);
      const s = display.getScale() || 1;
      const st = mouse.currentState as unknown as { x: number; y: number };
      setDebug({
        mx: Math.round(st.x),
        my: Math.round(st.y),
        rx: Math.round(st.x / s),
        ry: Math.round(st.y / s),
        scale: Math.round(s * 1000) / 1000,
        dw: display.getWidth(),
        dh: display.getHeight(),
      });
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

    // ── Clipboard sync (text/plain), bidirectional.
    //
    //   local → remote: only poll navigator.clipboard.readText() when the
    //     'clipboard-read' permission has been AUTO-GRANTED (Chrome/Edge on
    //     HTTPS). On Firefox the permission is 'prompt' and polling readText
    //     would spawn Firefox's persistent "Paste" UI overlay every 500ms
    //     and block all typing on the page — so we never poll there.
    //     Firefox users still get sync via the native `paste` event.
    //   remote → local: subscribe to client.onclipboard, write the streamed
    //     text into navigator.clipboard.
    //
    // No window-level keydown listener: Guacamole.Keyboard already owns
    // `document` keydown for forwarding keystrokes to the remote VM. Adding
    // a second window-level listener (even one that doesn't preventDefault)
    // has been observed to interfere with key delivery on some browsers.
    let lastSynced = "";
    let polling: number | null = null;
    const tag = `[Clipboard #${connectionId}]`;
    // eslint-disable-next-line no-console
    const warn = (...a: unknown[]) => console.warn(tag, ...a);

    if (!window.isSecureContext || !navigator.clipboard) {
      warn("clipboard sync disabled — page must be served over HTTPS");
    }

    const pushTextToRemote = (text: string) => {
      try {
        const stream = client.createClipboardStream("text/plain");
        const writer = new Guacamole.StringWriter(stream);
        writer.sendText(text);
        writer.sendEnd();
        lastSynced = text;
      } catch (err) {
        warn("push to remote failed", err);
      }
    };

    const tickRead = () => {
      if (!document.hasFocus() || !navigator.clipboard?.readText) return;
      navigator.clipboard.readText().then(
        (text) => {
          if (text && text !== lastSynced) pushTextToRemote(text);
        },
        () => {
          // Permission revoked — stop polling.
          if (polling !== null) {
            window.clearInterval(polling);
            polling = null;
          }
        },
      );
    };

    // Only start polling if clipboard-read is already granted.
    type PermStatus = { state: PermissionState; onchange: ((ev: Event) => void) | null };
    let permStatus: PermStatus | null = null;
    const perms = (navigator as Navigator & {
      permissions?: { query: (q: { name: PermissionName }) => Promise<PermStatus> };
    }).permissions;
    perms
      ?.query({ name: "clipboard-read" as PermissionName })
      .then((status) => {
        permStatus = status;
        const start = () => {
          if (polling === null && status.state === "granted") {
            polling = window.setInterval(tickRead, 500);
            tickRead();
          }
        };
        const stop = () => {
          if (polling !== null) {
            window.clearInterval(polling);
            polling = null;
          }
        };
        status.onchange = () => {
          if (status.state === "granted") start();
          else stop();
        };
        start();
      })
      .catch(() => {
        // Permissions API or 'clipboard-read' not supported — no polling.
      });

    // Inbound: remote copy → local clipboard.
    client.onclipboard = (stream, mimetype) => {
      if (!mimetype.startsWith("text/")) return;
      const reader = new Guacamole.StringReader(stream);
      let buf = "";
      reader.ontext = (text: string) => {
        buf += text;
      };
      reader.onend = () => {
        lastSynced = buf;
        navigator.clipboard?.writeText(buf).catch((err) =>
          warn("writeText failed", err?.name, err?.message),
        );
      };
    };

    // Native paste event — fires when the user pastes into a focusable
    // input on the page (e.g. the guest-label field). Synchronous, no
    // readText() call, no Firefox prompt.
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (text && text !== lastSynced) pushTextToRemote(text);
    };
    window.addEventListener("paste", onPaste);

    return () => {
      try {
        mouse.offEach(["mousedown", "mouseup", "mousemove"], () => true);
        keyboard.onkeydown = null;
        keyboard.onkeyup = null;
        client.onclipboard = null;
        if (polling !== null) window.clearInterval(polling);
        if (permStatus) permStatus.onchange = null;
        window.removeEventListener("paste", onPaste);
      } catch {
        // best-effort
      }
    };
  }, [interactive, phase, connectionId]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full relative"
      />
      {phase === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-black/60 pointer-events-none">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="text-xs">Connecting to VM #{connectionId}…</div>
        </div>
      )}
      {debug && (
        <div className="absolute top-1 left-1 z-10 bg-black/80 text-[10px] font-mono text-green-400 px-1.5 py-0.5 rounded pointer-events-none leading-tight">
          local {debug.mx},{debug.my} → remote {debug.rx},{debug.ry}<br />
          scale {debug.scale} · desktop {debug.dw}×{debug.dh}
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
