import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { GridPage } from "@/pages/grid";
import { ConfigPage } from "@/pages/config";
import { RoomPage } from "@/pages/room";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Standalone per-room view: no sidebar, no other PCRs visible */}
      <Route path="/room/:id" component={RoomPage} />

      {/* Everything else uses the main layout with sidebar */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={GridPage} />
            <Route path="/vms" component={ConfigPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
