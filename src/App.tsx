import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ApiKeyProvider, useApiKey } from '@/context/ApiKeyContext';
import Dashboard from '@/pages/Dashboard';
import SessionView from '@/pages/SessionView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

// Component to force API Key entry
function RequireApiKey({ children }: { children: React.ReactNode }) {
  const { apiKey, setApiKey } = useApiKey();
  const [inputKey, setInputKey] = useState('');

  if (apiKey) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Jules API Client</CardTitle>
          <CardDescription>
            Please enter your API key to continue. This key will be stored in your browser's session storage.
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
    <ApiKeyProvider>
      <Router>
        <RequireApiKey>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sessions/:name" element={<SessionView />} />
            {/* Redirect legacy or mismatched routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RequireApiKey>
      </Router>
    </ApiKeyProvider>
  );
}

export default App;
