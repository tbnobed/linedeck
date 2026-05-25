import { useState, useEffect, useRef } from "react";
import { Vm, Line } from "@workspace/api-client-react/src/generated/api.schemas";
import { Maximize2, Phone, User, Activity } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface VmTileProps {
  vm: Vm;
  lineState: Line;
  onStateChange: () => void;
  onLabelChange: (label: string) => void;
}

export function VmTile({ vm, lineState, onStateChange, onLabelChange }: VmTileProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localLabel, setLocalLabel] = useState(lineState.label);
  const labelTimerRef = useRef<NodeJS.Timeout>();

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

  const isAir = lineState.state === 'onair';
  const isStandby = lineState.state === 'standby';

  const TileContent = () => (
    <div className={`relative flex flex-col h-full bg-card rounded-md border transition-all duration-200 overflow-hidden ${
      isAir ? 'border-destructive shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 
      isStandby ? 'border-yellow-500/50' : 'border-border'
    }`}>
      {/* Header */}
      <div className={`h-10 px-3 flex items-center justify-between shrink-0 border-b ${
        isAir ? 'bg-destructive/10 border-destructive/20 text-destructive-foreground' : 
        isStandby ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-muted/30 border-border'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-mono font-bold truncate">{vm.name}</div>
          {vm.phoneNumber && (
            <div className="flex items-center gap-1 text-xs opacity-70">
              <Phone className="w-3 h-3" />
              <span>{vm.phoneNumber}</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsExpanded(true)}
          className="p-1 hover:bg-background/20 rounded opacity-50 hover:opacity-100 transition-opacity"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Video / Iframe area */}
      <div className="flex-1 bg-black min-h-[200px] relative">
        <iframe 
          src={vm.url} 
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          title={vm.name}
        />
        {/* Overlay to prevent iframe interaction stealing focus unless needed */}
        <div className="absolute inset-0 z-10" />
      </div>

      {/* Footer Controls */}
      <div className="h-12 border-t border-border bg-card flex items-center p-1 shrink-0">
        <button
          onClick={onStateChange}
          className={`h-full px-4 rounded-sm font-bold tracking-widest uppercase text-xs transition-colors shrink-0 flex items-center justify-center ${
            isAir ? 'bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]' :
            isStandby ? 'bg-yellow-500 text-black' :
            'bg-muted text-muted-foreground hover:bg-muted/80'
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

  return (
    <>
      <div className="h-[300px]">
        <TileContent />
      </div>
      
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-[90vw] h-[90vh] p-0 overflow-hidden border-border bg-black gap-0 flex flex-col">
          <TileContent />
        </DialogContent>
      </Dialog>
    </>
  );
}
