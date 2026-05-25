import { Link } from "wouter";
import {
  LayoutGrid,
  Tv2,
  Settings,
  Monitor,
  Maximize2,
  Phone,
  User,
  Radio,
  Keyboard,
  Clipboard,
  Lock,
  Wifi,
  AlertTriangle,
} from "lucide-react";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
        {children}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-xs font-mono rounded border border-border bg-secondary text-foreground">
      {children}
    </kbd>
  );
}

function Pill({
  color,
  children,
}: {
  color: "idle" | "standby" | "onair";
  children: React.ReactNode;
}) {
  const styles = {
    idle: "bg-zinc-700 text-zinc-200",
    standby: "bg-amber-500 text-black",
    onair: "bg-red-600 text-white animate-pulse",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[color]}`}
    >
      {children}
    </span>
  );
}

export default function HelpPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-2">LineDeck Help</h1>
        <p className="text-muted-foreground mb-8">
          Broadcast operations console for monitoring Dante VMs, controlling
          line states, and managing guest assignments across multiple PCRs.
        </p>

        <Section icon={LayoutGrid} title="The All Systems view">
          <p>
            The home page (<Link href="/" className="text-primary underline">All Systems</Link>) shows
            every configured VM as a live tile. Each tile is a real Apache
            Guacamole desktop session — what you see is what the operator on
            that VM sees, updating live.
          </p>
          <p>Each tile has four interactive elements:</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              <strong>Line state pill</strong> — click to cycle through{" "}
              <Pill color="idle">IDLE</Pill> →{" "}
              <Pill color="standby">STANDBY</Pill> →{" "}
              <Pill color="onair">ON AIR</Pill>. The change syncs to every
              other open browser within ~100ms via SSE.
            </li>
            <li>
              <strong>Guest label</strong> (<User className="inline w-3.5 h-3.5" />) — type the
              guest's name. Auto-saves and broadcasts to all operators after
              you stop typing.
            </li>
            <li>
              <strong>Phone number</strong> (<Phone className="inline w-3.5 h-3.5" />) — read-only,
              set in Configuration.
            </li>
            <li>
              <strong>Maximize</strong> (<Maximize2 className="inline w-3.5 h-3.5" />) — opens the
              tile fullscreen with keyboard and mouse passed through to the
              remote desktop. Press <Kbd>Esc</Kbd> or click the X to exit.
            </li>
          </ul>
        </Section>

        <Section icon={Tv2} title="PCR rooms">
          <p>
            Each VM can be assigned to a PCR (Production Control Room). PCRs
            appear in the sidebar under <strong>Rooms</strong> — clicking one
            filters the grid to just that room's VMs.
          </p>
          <p>
            Each PCR also has a <strong>standalone room view</strong> at{" "}
            <code className="text-xs">/room/&lt;id&gt;</code> with no sidebar
            and no other PCRs visible — ideal for dedicated room dashboards or
            a wall-mounted display.
          </p>
        </Section>

        <Section icon={Monitor} title="Focusing a single VM">
          <p>
            Clicking a VM in the sidebar's <strong>Systems</strong> list opens
            it in a full-page focused view with keyboard and mouse fully
            interactive. Use the close button or back arrow to return to the
            grid.
          </p>
        </Section>

        <Section icon={Settings} title="Configuration">
          <p>
            The <Link href="/vms" className="text-primary underline">Configuration</Link> page is
            where you manage VMs and PCRs.
          </p>
          <p><strong>Add or edit a VM:</strong></p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Name</strong> — display name (e.g. "ViP 101")</li>
            <li>
              <strong>Guacamole Connection ID</strong> — the numeric ID of the
              connection in your Guacamole admin console. Find it by editing
              the connection in Guacamole and looking at the URL — it's the
              number after <code className="text-xs">/connections/</code>.
            </li>
            <li>
              <strong>Phone number</strong> — shown on the tile for the
              operator to dial
            </li>
            <li>
              <strong>PCR</strong> — which room this VM belongs to
            </li>
            <li>
              <strong>Position</strong> — sort order within the grid
            </li>
          </ul>
          <p><strong>PCR management:</strong> add, rename, or delete PCRs at the bottom of the same page.</p>
        </Section>

        <Section icon={Keyboard} title="Keyboard & mouse">
          <p>
            Keyboard and mouse are only forwarded to the remote VM when a
            tile is <strong>focused</strong> (maximized or opened as a single-VM view).
            In the grid view, tiles are read-only previews — click the
            maximize button first if you need to interact.
          </p>
          <p>
            Special keystrokes like <Kbd>Ctrl</Kbd>+<Kbd>Alt</Kbd>+<Kbd>Del</Kbd>{" "}
            are intercepted by your local OS, not the remote. Use the on-screen
            keyboard inside Guacamole or your VM's hypervisor console for those.
          </p>
        </Section>

        <Section icon={Clipboard} title="Clipboard sharing">
          <p>
            Text copied locally (<Kbd>Ctrl</Kbd>+<Kbd>C</Kbd>) is pushed to
            the focused remote VM, and text copied on the remote is written
            back to your local clipboard. Both directions are plain text only.
          </p>
          <p className="flex gap-2 items-start">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span>
              <strong>Clipboard requires HTTPS.</strong> If you're on plain
              HTTP, the browser blocks clipboard access and you'll see a
              warning in the dev console. Access LineDeck via its{" "}
              <code className="text-xs">https://</code> URL.
            </span>
          </p>
          <p>
            On first paste, Firefox may prompt for clipboard permission —
            click <strong>Allow</strong>. Chrome and Edge grant it silently
            on HTTPS origins.
          </p>
        </Section>

        <Section icon={Radio} title="Real-time sync">
          <p>
            Line states, guest labels, and VM configuration changes broadcast
            to every connected browser via Server-Sent Events. You should
            never need to refresh the page to see another operator's changes.
          </p>
          <p>
            If a tile shows <span className="text-destructive">Disconnected</span> or{" "}
            <span className="text-destructive">Connection error</span>, the
            Guacamole tunnel to that VM dropped. The most common causes are:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The VM is powered off or guacd can't reach it</li>
            <li>The Guacamole Connection ID in Configuration is wrong</li>
            <li>The Guacamole server is unreachable from the LineDeck host</li>
          </ul>
        </Section>

        <Section icon={Wifi} title="When something looks wrong">
          <p>Try these in order before escalating:</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Hard-refresh the page (<Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>R</Kbd>)</li>
            <li>Confirm the URL starts with <code className="text-xs">https://</code></li>
            <li>Check the tile shows "Connecting…" then "Connected" — if it stays on Connecting, the Guacamole connection is unreachable</li>
            <li>Open another VM's tile — if all VMs fail, it's the Guacamole server or the proxy; if only one fails, it's that VM</li>
          </ol>
        </Section>

        <Section icon={AlertTriangle} title="HTTPS / certificate setup (admin)">
          <p>
            Because LineDeck runs on an internal hostname
            (<code className="text-xs">line.trinity.local</code>) with no
            public DNS, a public CA like Let's Encrypt can't issue a
            certificate. The deployment uses{" "}
            <a
              href="https://github.com/FiloSottile/mkcert"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >mkcert</a> to generate a locally-trusted certificate, served by Nginx Proxy Manager.
          </p>
          <p>
            To trust the LineDeck cert on a new operator workstation, install{" "}
            <code className="text-xs">linedeck-rootCA.crt</code> (available
            from the admin):
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong>Windows (Chrome, Edge):</strong> double-click the file
              → Install Certificate → Local Machine → Place all certificates
              in <strong>Trusted Root Certification Authorities</strong>.
              Restart the browser.
            </li>
            <li>
              <strong>Firefox:</strong> Firefox has its own certificate store.
              Either set{" "}
              <code className="text-xs">security.enterprise_roots.enabled = true</code>{" "}
              in <code className="text-xs">about:config</code>, or import the
              CA via Settings → Privacy &amp; Security → Certificates → View
              Certificates → Authorities → Import.
            </li>
            <li>
              <strong>macOS:</strong> double-click → add to System keychain
              → set "Always Trust" for SSL.
            </li>
          </ul>
        </Section>

        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground">
          LineDeck v1 · Need help? Contact your broadcast engineering team.
        </div>
      </div>
    </div>
  );
}
