'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';

// Interface for the TMDB Context
interface TmdbContextType {
  tmdbApiKey: string | null;
  setTmdbApiKey: (key: string | null) => void;
  isLoadingKey: boolean;
  keyError: string | null;
}

// Create the context
const TmdbContext = createContext<TmdbContextType | undefined>(undefined);

// Define a key for local storage
const TMDB_API_KEY_STORAGE_KEY = 'tmdbApiKey';

// Provider component
export const TmdbProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tmdbApiKey, setTmdbApiKeyInternal] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState<boolean>(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Load TMDB API key from local storage on mount
  useEffect(() => {
    setIsLoadingKey(true);
    try {
      const storedKey = localStorage.getItem(TMDB_API_KEY_STORAGE_KEY);
      if (storedKey) {
        setTmdbApiKeyInternal(storedKey);
      }
      setKeyError(null);
    } catch (e) {
      console.error("TmdbContext: Error loading TMDB API key:", e);
      setKeyError('Error loading TMDB API key from storage.');
      setTmdbApiKeyInternal(null);
    } finally {
      setIsLoadingKey(false);
    }
  }, []);

  // Save TMDB API key to local storage whenever it changes
  useEffect(() => {
    if (!isLoadingKey) { // Avoid saving during initial load
      try {
        if (tmdbApiKey) {
          localStorage.setItem(TMDB_API_KEY_STORAGE_KEY, tmdbApiKey);
        } else {
          localStorage.removeItem(TMDB_API_KEY_STORAGE_KEY);
        }
      } catch (e) {
        console.error("TmdbContext: Error saving TMDB API key:", e);
        setKeyError('Error saving TMDB API key.');
      }
    }
  }, [tmdbApiKey, isLoadingKey]);

  // Public setter for the API key
  const setTmdbApiKey = useCallback((key: string | null) => {
    setTmdbApiKeyInternal(key);
  }, []);

  const value = {
    tmdbApiKey,
    setTmdbApiKey,
    isLoadingKey,
    keyError
  };

  return <TmdbContext.Provider value={value}>{children}</TmdbContext.Provider>;
};

// Custom hook for easy consumption
export const useTmdbContext = () => {
  const context = useContext(TmdbContext);
  if (context === undefined) {
    throw new Error('useTmdbContext must be used within a TmdbProvider');
  }
  return context;
}; 