import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/context/ApiKeyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const {
    apiKey,
    setApiKey,
    pageSize,
    setPageSize,
    truncateDiffs,
    setTruncateDiffs,
  } = useSettings();

  const [inputApiKey, setInputApiKey] = useState(apiKey || "");
  const [inputPageSize, setInputPageSize] = useState(pageSize.toString());
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSave = () => {
    if (inputApiKey.trim()) {
      setApiKey(inputApiKey.trim());
    }
    const size = parseInt(inputPageSize, 10);
    if (!isNaN(size)) {
      setPageSize(size);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="container mx-auto py-10 px-4 min-h-screen bg-background">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>
              Your Jules API key for authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Page Size</CardTitle>
            <CardDescription>
              Number of activities to load per page (1-100)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="pageSize">Page Size</Label>
              <Input
                id="pageSize"
                type="number"
                min={1}
                max={100}
                value={inputPageSize}
                onChange={(e) => setInputPageSize(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Truncate Diffs</CardTitle>
            <CardDescription>
              Limit the height of code diffs to prevent large changes from
              dominating the view
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="truncateDiffs">
                Truncate the size of large diffs
              </Label>
              <button
                id="truncateDiffs"
                type="button"
                role="switch"
                aria-checked={truncateDiffs}
                onClick={() => setTruncateDiffs(!truncateDiffs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  truncateDiffs ? "bg-blue-500" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    truncateDiffs ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
          {saved && (
            <span className="text-sm text-green-400">Settings saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}
