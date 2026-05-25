import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useListVms, useGetLines, useUpdateLine, useResetLines, useListPcrs } from "@workspace/api-client-react";
import { useSSE } from "@/hooks/use-sse";
import { VmTile } from "@/components/vm-tile";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MonitorPlay } from "lucide-react";

export function GridPage() {
  const [columns, setColumns] = useState(3);
  const search = useSearch();
  const params = new URLSearchParams(search);
  const pcrFilter = params.get("pcr") ? Number(params.get("pcr")) : null;

  const { data: vms, isLoading: loadingVms } = useListVms();
  const { data: pcrs } = useListPcrs();
  const { data: initialLines } = useGetLines();
  const resetLines = useResetLines();
  const updateLine = useUpdateLine();

  const { lines, status, updateLineLocal } = useSSE();

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResetAll = () => {
    if (confirm("Reset all lines to idle? This will clear all guest labels and states.")) {
      resetLines.mutate(undefined);
    }
  };

  const getLineState = (vmId: number) => {
    const stringId = `vm-${vmId}`;
    return (
      lines[stringId] ||
      initialLines?.find((l) => l.id === stringId) || {
        id: stringId,
        state: "idle",
        label: "",
        updatedAt: new Date().toISOString(),
      }
    );
  };

  const cycleState = (current: string) => {
    if (current === "idle") return "standby";
    if (current === "standby") return "onair";
    return "idle";
  };

  const handleStateChange = (vmId: number, currentState: string) => {
    const stringId = `vm-${vmId}`;
    const nextState = cycleState(currentState);
    updateLineLocal(stringId, { state: nextState as any });
    updateLine.mutate({ lineId: stringId, data: { state: nextState as any } });
  };

  const handleLabelChange = (vmId: number, label: string) => {
    const stringId = `vm-${vmId}`;
    updateLineLocal(stringId, { label });
    updateLine.mutate({ lineId: stringId, data: { label } });
  };

  const sortedVms = vms?.slice().sort((a, b) => a.position - b.position) ?? [];
  const filteredVms = pcrFilter !== null
    ? sortedVms.filter((v) => v.pcrId === pcrFilter)
    : sortedVms;

  const currentPcr = pcrFilter !== null ? pcrs?.find((p) => p.id === pcrFilter) : null;

  if (loadingVms) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">LOADING COGITATORS...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Top Bar */}
      <header className="h-14 px-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {currentPcr && (
            <span className="text-sm font-semibold text-foreground mr-2">{currentPcr.name}</span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="h-8 gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <AlertTriangle className="w-4 h-4" />
            Reset All Lines
          </Button>

          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-background">
            {[2, 3, 4, 5].map((c) => (
              <button
                key={c}
                onClick={() => setColumns(c)}
                className={`w-8 h-7 text-xs rounded-sm font-medium transition-colors ${
                  columns === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status === "SYNCED"
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                  : status === "OFFLINE"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-500"
              }`}
            />
            <span className="text-xs font-bold tracking-widest text-muted-foreground">{status}</span>
          </div>

          <div className="font-mono text-lg font-bold tracking-wider text-primary">
            {time.toLocaleTimeString("en-US", { hour12: false })}
          </div>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredVms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <MonitorPlay className="w-16 h-16 mb-4 opacity-20" />
            {pcrFilter !== null ? (
              <>
                <h2 className="text-xl font-medium text-foreground mb-2">No Systems in This Room</h2>
                <p className="max-w-md text-center mb-6">
                  Go to Configuration → Systems to assign VMs to this room.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-medium text-foreground mb-2">No Virtual Machines Configured</h2>
                <p className="max-w-md text-center mb-6">
                  Go to Configuration to add Dante VMs to the console.
                </p>
              </>
            )}
          </div>
        ) : (
          <div
            className="grid gap-4 auto-rows-max"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {filteredVms.map((vm) => {
              const lineState = getLineState(vm.id);
              return (
                <VmTile
                  key={vm.id}
                  vm={vm}
                  lineState={lineState as any}
                  onStateChange={() => handleStateChange(vm.id, lineState.state)}
                  onLabelChange={(label) => handleLabelChange(vm.id, label)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
