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

        // Build a fully-qualified WebSocket URL for the tunnel.
        //   - If baseUrl is absolute (http(s)://host/path), swap scheme to ws/wss.
        //   - If baseUrl is same-origin (e.g. "/api/guac-proxy"), derive ws(s)
        //     scheme from the current page so HTTPS pages get wss:// and avoid
        //     mixed-content blocks.
        const tunnelUrl = /^https?:/i.test(baseUrl)
          ? `${baseUrl.replace(/^http/i, "ws")}/websocket-tunnel`
          : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${baseUrl}/websocket-tunnel`;
        // eslint-disable-next-line no-console
        console.log(`[GuacClient #${connectionId}] tunnel URL`, tunnelUrl);

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

        // Fit the (potentially much larger) remote display into our tile.
        const fit = () => {
          if (!containerRef.current) return;
          const dw = display.getWidth();
          const dh = display.getHeight();
          if (!dw || !dh) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const scale = Math.min(cw / dw, ch / dh);
          if (scale > 0 && isFinite(scale)) display.scale(scale);
        };
        display.onresize = fit;
        const ro = new ResizeObserver(fit);
        if (containerRef.current) ro.observe(containerRef.current);
        // expose for cleanup
        (client as unknown as { __ro?: ResizeObserver }).__ro = ro;

        client.onstatechange = (state) => {
          const names = ["idle", "connecting", "waiting", "connected", "disconnecting", "disconnected"];
          // eslint-disable-next-line no-console
          console.log(`[GuacClient #${connectionId}] state →`, names[state] ?? state);
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
        tunnel.onstatechange = (state) => {
          const names = ["connecting", "open", "closed", "unstable"];
          // eslint-disable-next-line no-console
          console.log(`[GuacClient #${connectionId}] tunnel →`, names[state] ?? state);
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

    // ── Clipboard sync (text/plain), bidirectional.
    //   local → remote: poll navigator.clipboard.readText() and push to the
    //     remote whenever it changes. The 'paste' DOM event only fires on
    //     focusable inputs — not on our plain <div> — so polling is the
    //     reliable way to keep clipboards in sync (same approach Apache
    //     Guacamole's own webapp uses). By the time Ctrl+V reaches the remote,
    //     the right text is already in its clipboard.
    //   remote → local: subscribe to client.onclipboard and write the streamed
    //     text into navigator.clipboard.
    let lastPushed = "";
    let pollTick = 0;
    let lastDeniedLogged = 0;
    const tag = `[Clipboard #${connectionId}]`;
    // eslint-disable-next-line no-console
    const log = (...a: unknown[]) => console.log(tag, ...a);

    log("init", {
      secureContext: window.isSecureContext,
      hasClipboardApi: !!navigator.clipboard,
      hasReadText: !!navigator.clipboard?.readText,
      hasWriteText: !!navigator.clipboard?.writeText,
      hasFocus: document.hasFocus(),
      hasStringWriter: !!(Guacamole as unknown as { StringWriter?: unknown }).StringWriter,
      hasStringReader: !!(Guacamole as unknown as { StringReader?: unknown }).StringReader,
      hasCreateClipboardStream: typeof (client as unknown as { createClipboardStream?: unknown }).createClipboardStream === "function",
    });

    // One-shot permission probe.
    try {
      const perms = (navigator as unknown as { permissions?: { query: (q: { name: string }) => Promise<{ state: string }> } }).permissions;
      perms?.query({ name: "clipboard-read" }).then(
        (p) => log("permission clipboard-read =", p.state),
        (e) => log("permission query failed", e),
      );
    } catch (e) {
      log("permission probe threw", e);
    }

    const pushTextToRemote = (text: string, source: string) => {
      try {
        log(`→ remote (${source}, ${text.length} chars)`, JSON.stringify(text.slice(0, 80)));
        const stream = client.createClipboardStream("text/plain");
        const writer = new Guacamole.StringWriter(stream);
        writer.sendText(text);
        writer.sendEnd();
        lastPushed = text;
        log("→ remote: stream end sent");
      } catch (err) {
        log("→ remote PUSH FAILED", err);
      }
    };

    const syncFromLocalClipboard = async (source: string) => {
      pollTick++;
      if (!document.hasFocus()) {
        if (pollTick % 20 === 0) log(`poll skip (no focus) tick=${pollTick}`);
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (pollTick % 20 === 0) log(`poll read ok (${source}) len=${text?.length ?? 0}`);
        if (text && text !== lastPushed) {
          log(`local clipboard changed via ${source}: "${text.slice(0, 80)}"`);
          pushTextToRemote(text, source);
        }
      } catch (err) {
        const now = Date.now();
        if (now - lastDeniedLogged > 5000) {
          log(`readText denied (${source})`, (err as Error)?.name, (err as Error)?.message);
          lastDeniedLogged = now;
        }
      }
    };

    // Inbound: remote copy → local clipboard.
    client.onclipboard = (stream, mimetype) => {
      log(`← remote: clipboard stream opened, mimetype=${mimetype}`);
      if (!mimetype.startsWith("text/")) {
        log("← remote: ignoring non-text mimetype");
        return;
      }
      const reader = new Guacamole.StringReader(stream);
      let buf = "";
      reader.ontext = (text: string) => {
        buf += text;
        log(`← remote: chunk len=${text.length} total=${buf.length}`);
      };
      reader.onend = () => {
        lastPushed = buf;
        log(`← remote: stream end (${buf.length} chars) "${buf.slice(0, 80)}"`);
        navigator.clipboard.writeText(buf).then(
          () => log("← remote: writeText succeeded"),
          (err) => log("← remote: writeText FAILED", err?.name, err?.message),
        );
      };
    };

    const pollInterval = window.setInterval(() => {
      void syncFromLocalClipboard("poll");
    }, 500);

    const onFocus = () => {
      log("event: window focus");
      void syncFromLocalClipboard("focus");
    };
    const onMouseEnter = () => {
      void syncFromLocalClipboard("mouseenter");
    };
    window.addEventListener("focus", onFocus);
    container.addEventListener("mouseenter", onMouseEnter);

    // Fallback paste event.
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      log(`event: paste len=${text.length} target=${(e.target as Element)?.tagName}`);
      if (text && text !== lastPushed) pushTextToRemote(text, "paste-event");
    };
    window.addEventListener("paste", onPaste);

    // Detect Cmd/Ctrl+V keydown — for diagnostic logging only. We can't
    // synchronously read the clipboard here (readText is async), but
    // documenting that the keystroke happened helps debug timing.
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "v" || e.key === "V")) {
        log(`event: Cmd/Ctrl+V keydown — lastPushed len=${lastPushed.length}`);
        void syncFromLocalClipboard("ctrl-v");
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        log("event: Cmd/Ctrl+C keydown");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);

    void syncFromLocalClipboard("mount");

    return () => {
      try {
        mouse.offEach(["mousedown", "mouseup", "mousemove"], () => true);
        keyboard.onkeydown = null;
        keyboard.onkeyup = null;
        client.onclipboard = null;
        window.clearInterval(pollInterval);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("paste", onPaste);
        window.removeEventListener("keydown", onKeyDown, true);
        container.removeEventListener("mouseenter", onMouseEnter);
      } catch {
        // best-effort
      }
    };
  }, [interactive, phase, connectionId]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center"
        style={{ cursor: "none" }}
      />
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
