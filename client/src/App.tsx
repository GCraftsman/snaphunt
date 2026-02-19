import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { GameProvider } from "@/context/GameContext";

import Home from "@/pages/Home";
import ProctorDashboard from "@/pages/ProctorDashboard";
import HuntResults from "@/pages/HuntResults";
import Lobby from "@/pages/Lobby";
import Game from "@/pages/Game";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/proctor" component={ProctorDashboard} />
      <Route path="/proctor/hunt/:id" component={HuntResults} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/game" component={Game} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GameProvider>
        <Router />
        <Toaster />
      </GameProvider>
    </QueryClientProvider>
  );
}

export default App;
