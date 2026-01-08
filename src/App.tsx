import React, { useState } from "react";
import { Routes, Route, Navigate, HashRouter } from "react-router-dom";
import { SettingsProvider, useApiKey } from "@/context/ApiKeyContext";
import Dashboard from "@/pages/Dashboard";
import SessionView from "@/pages/SessionView";
import NewSession from "@/pages/NewSession";
import Settings from "@/pages/Settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Toaster } from "sonner";

// Component to force API Key entry
function RequireApiKey({ children }: { children: React.ReactNode }) {
  const { apiKey, setApiKey } = useApiKey();
  const [inputKey, setInputKey] = useState("");

  if (apiKey) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Jules API Client</CardTitle>
          <CardDescription>
            Please enter your API key to continue. This key will be stored in
            your browser's session storage.
            <br />
            <br />
            <a
              href="https://jules.google.com/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Get your API key
            </a>
            {" • "}
            <a
              href="https://github.com/LachlanBWWright/jules-alt-website"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GitHub Repository
            </a>
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputKey.trim()) setApiKey(inputKey.trim());
          }}
        >
          <CardContent>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  placeholder="Paste your key here..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={!inputKey.trim()}>
              Start Session
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <Toaster position="top-right" offset="60px" />
      <HashRouter>
        <RequireApiKey>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-session" element={<NewSession />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sessions/:name" element={<SessionView />} />
            {/* Redirect legacy or mismatched routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RequireApiKey>
      </HashRouter>
    </SettingsProvider>
  );
}

export default App;
