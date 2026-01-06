import React, { createContext, useContext, useState } from "react";

interface SettingsContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  truncateDiffs: boolean;
  setTruncateDiffs: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    return localStorage.getItem("jules_api_key");
  });

  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = localStorage.getItem("jules_page_size");
    return stored ? parseInt(stored, 10) : 100;
  });

  const [truncateDiffs, setTruncateDiffsState] = useState<boolean>(() => {
    const stored = localStorage.getItem("jules_truncate_diffs");
    return stored !== "false"; // Default to true
  });

  const setApiKey = (key: string) => {
    localStorage.setItem("jules_api_key", key);
    setApiKeyState(key);
  };

  const clearApiKey = () => {
    localStorage.removeItem("jules_api_key");
    setApiKeyState(null);
  };

  const setPageSize = (size: number) => {
    const validSize = Math.max(1, Math.min(100, size));
    localStorage.setItem("jules_page_size", validSize.toString());
    setPageSizeState(validSize);
  };

  const setTruncateDiffs = (value: boolean) => {
    localStorage.setItem("jules_truncate_diffs", value.toString());
    setTruncateDiffsState(value);
  };

  return (
    <SettingsContext.Provider
      value={{
        apiKey,
        setApiKey,
        clearApiKey,
        pageSize,
        setPageSize,
        truncateDiffs,
        setTruncateDiffs,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// Keep the old hook name for backwards compatibility
export function useApiKey() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useApiKey must be used within a SettingsProvider");
  }
  return context;
}

export function useSettings() {
  return useApiKey();
}
