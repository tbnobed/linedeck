import { useState, useEffect, useRef } from "react";
import type { Vm, Line } from "@workspace/api-client-react";
import { Maximize2, Phone, User, Minimize2 } from "lucide-react";
import { GuacClient } from "./guac-client";

interface VmTileProps {
  vm: Vm;
  lineState: Line;
  pcrName?: string | null;
  /** When true, fills the parent (no fixed height, no expand-overlay). Used by the focused-VM view. */
  fill?: boolean;
  /** Replaces the maximize button. When provided, this callback is called when the user clicks the chrome's primary action. */
  onPrimaryAction?: () => void;
  /** Custom icon for the primary action button. */
  primaryActionIcon?: React.ReactNode;
  primaryActionTitle?: string;
  onStateChange: () => void;
  onLabelChange: (label: string) => void;
}

export function VmTile({
  vm,
  lineState,
  pcrName,
  fill,
  onPrimaryAction,
  primaryActionIcon,
  primaryActionTitle,
  onStateChange,
  onLabelChange,
}: VmTileProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localLabel, setLocalLabel] = useState(lineState.label);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalLabel(lineState.label);
  }, [lineState.label]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalLabel(val);

    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => {
      onLabelChange(val);
    }, 400);
  };

  const isAir = lineState.state === "onair";
  const isStandby = lineState.state === "standby";
  const isIdle = !isAir && !isStandby;

  // Render the screen surface (Guacamole if configured, else legacy iframe fallback)
  // ONCE per tile. CSS-only fullscreen so the connection isn't torn down on expand.
  const ScreenSurface = (
    <div className="flex-1 bg-black min-h-[200px] relative">
      {vm.guacConnectionId != null ? (
        <GuacClient
          connectionId={vm.guacConnectionId}
          dataSource={vm.guacDataSource || "mysql"}
          interactive={isExpanded}
        />
      ) : vm.url ? (
        <iframe
          src={vm.url}
          className="absolute inset-0 w-full h-full border-0"
          title={vm.name}
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
          No source configured
        </div>
      )}
      {!isExpanded && vm.guacConnectionId == null && (
        <div className="absolute inset-0 z-10" />
      )}
    </div>
  );

  const TileChrome = (
    <div
      className={`relative flex flex-col h-full bg-card rounded-md border transition-all duration-200 overflow-hidden ${
        isAir
          ? "border-destructive shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          : isStandby
            ? "border-yellow-500/50"
            : "border-border/60 opacity-80 hover:opacity-100"
      }`}
    >
      {/* Header */}
      <div
        className={`h-10 px-3 flex items-center justify-between shrink-0 border-b ${
          isAir
            ? "bg-destructive/10 border-destructive/20 text-destructive-foreground"
            : isStandby
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-muted/15 border-border/60 text-muted-foreground"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`font-mono font-bold truncate ${isIdle ? "text-foreground/80" : ""}`}>{vm.name}</div>
          {pcrName && (
            <span className="font-mono text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded-sm border border-border/60 text-muted-foreground/80 shrink-0">
              {pcrName}
            </span>
          )}
          {vm.phoneNumber && (
            <div className="flex items-center gap-1 text-xs opacity-60">
              <Phone className="w-3 h-3" />
              <span>{vm.phoneNumber}</span>
            </div>
          )}
        </div>
        <button
          onClick={onPrimaryAction ?? (() => setIsExpanded(!isExpanded))}
          className="p-1 hover:bg-background/20 rounded opacity-50 hover:opacity-100 transition-opacity"
          title={primaryActionTitle ?? (isExpanded ? "Collapse" : "Expand")}
        >
          {primaryActionIcon ?? (isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />)}
        </button>
      </div>

      {ScreenSurface}

      {/* Footer Controls */}
      <div className="h-12 border-t border-border bg-card flex items-center p-1 shrink-0">
        <button
          onClick={onStateChange}
          className={`h-full px-4 rounded-sm font-bold tracking-widest uppercase text-xs transition-colors shrink-0 flex items-center justify-center ${
            isAir
              ? "bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]"
              : isStandby
                ? "bg-yellow-500 text-black"
                : "bg-transparent text-muted-foreground/70 border border-border/60 hover:text-foreground hover:border-border"
          }`}
        >
          {lineState.state}
        </button>

        <div className="flex-1 flex items-center h-full ml-1 px-3 bg-background rounded-sm border border-border focus-within:border-primary/50 transition-colors">
          <User className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
          <input
            type="text"
            value={localLabel}
            onChange={handleLabelChange}
            placeholder="Guest Label..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50 h-full w-full"
            maxLength={120}
          />
        </div>
      </div>
    </div>
  );

  // Two modes: standard 300px grid-slot tile, or `fill` mode (used by the
  // focused-VM view) where the tile fills its parent container.
  if (fill) {
    return <div className="h-full w-full">{TileChrome}</div>;
  }

  return (
    <div className="h-[300px] relative">
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/80"
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div
        className={
          isExpanded
            ? "fixed inset-[5vh] z-50 shadow-2xl"
            : "absolute inset-0"
        }
      >
        {TileChrome}
      </div>
    </div>
  );
}
