import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Monitor, Settings, LayoutGrid } from "lucide-react";
import { useListVms } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: vms } = useListVms();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col bg-card shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 font-bold tracking-tight text-primary uppercase">
            <Monitor className="w-5 h-5 text-destructive" />
            <span>ViP Dante Console</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Views
          </div>
          <Link href="/" className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-sm ${location === '/' ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
            <LayoutGrid className="w-4 h-4" />
            <span>All Systems</span>
          </Link>
          
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-2 px-2">
            Systems
          </div>
          {vms?.map(vm => (
            <Link key={vm.id} href={`/?vm=${vm.id}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground`}>
              <Monitor className="w-3.5 h-3.5" />
              <span className="truncate">{vm.name}</span>
            </Link>
          ))}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Link href="/vms" className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-sm ${location === '/vms' ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
            <Settings className="w-4 h-4" />
            <span>Configuration</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
