import { useEffect, useState, useCallback } from 'react';
import { useApiKey } from '@/context/ApiKeyContext';
import { listSessions, createSession, type Session } from '@/services/jules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { apiKey } = useApiKey();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const loadSessions = useCallback(async () => {
    if (!apiKey) return;
    try {
      setLoading(true);
      const data = await listSessions(apiKey);
      setSessions(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to load sessions. Please check your API key.');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleCreateSession = async () => {
    if (!apiKey) return;
    try {
      setCreating(true);
      const newSession = await createSession(apiKey);
      setSessions([newSession, ...sessions]);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to create session.');
    } finally {
      setCreating(false);
    }
  };

  // Helper to get simple name from resource name
  const getSimpleName = (name: string) => name.split('/').pop();

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Sessions</h1>
        <Button onClick={handleCreateSession} disabled={creating}>
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          New Session
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.length === 0 ? (
            <p className="text-muted-foreground col-span-full text-center py-10">
              No sessions found. Create one to get started!
            </p>
          ) : (
            sessions.map((session) => (
              <Card key={session.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/${session.name}`)}>
                <CardHeader>
                  <CardTitle>Session {getSimpleName(session.name)}</CardTitle>
                  <CardDescription>{session.createTime ? new Date(session.createTime).toLocaleString() : 'No date'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate">{session.name}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
