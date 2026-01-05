import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiKey } from '@/context/ApiKeyContext';
import { getSession, sendMessage, listActivities, type Activity } from '@/services/jules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowLeft, Send } from 'lucide-react';

export default function SessionView() {
  const { apiKey } = useApiKey();
  const { name } = useParams<{ name: string }>(); // This will be the ID part usually
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reconstruct full resource name if needed, or rely on service to handle it
  // Route is defined as /sessions/:id, so name is just the ID.
  const sessionName = `sessions/${name}`;

  const loadData = useCallback(async () => {
    if (!apiKey || !name) return;
    try {
      setLoading(true);
      // Verify session exists
      await getSession(apiKey, sessionName);
      // Load activities
      const acts = await listActivities(apiKey, sessionName);
      setActivities(acts);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to load session data.');
    } finally {
      setLoading(false);
    }
  }, [apiKey, name, sessionName]);

  useEffect(() => {
    if (apiKey && name) {
      void loadData();
    }
  }, [apiKey, name, loadData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !apiKey) return;

    try {
      setSending(true);
      // Optimistically add user message (though API structure might differ, this is for UI feel)
      // Actually, better to just wait for reload as we don't know the activity structure fully to mock it.
      await sendMessage(apiKey, sessionName, prompt);
      setPrompt('');
      // Reload activities to see response
      const acts = await listActivities(apiKey, sessionName);
      setActivities(acts);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="mr-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-xl font-bold">Session {name}</h1>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden mb-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {activities.length === 0 ? (
              <p className="text-center text-muted-foreground mt-10">No activity yet. Start a conversation!</p>
            ) : (
              activities.map((act, index) => (
                <div key={index} className="border-b pb-2 mb-2 last:border-0">
                   {/* Render activity based on its type if known, for now just dump content */}
                   <p className="font-semibold text-xs text-muted-foreground mb-1">{act.type || 'Activity'}</p>
                   <div className="whitespace-pre-wrap">{act.content || JSON.stringify(act)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your message..."
          disabled={sending || loading}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || loading || !prompt.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
