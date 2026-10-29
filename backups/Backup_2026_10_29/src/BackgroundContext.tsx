import React, { createContext, useContext, useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { getBackgroundImage, setBackgroundImage as saveBackgroundImageUri } from './api';

interface BackgroundContextType {
  bgImage: string | null;
  updateBackground: (uri: string | null) => Promise<void>;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

// Usiamo un percorso fisso per lo sfondo
const BG_FILENAME = 'custom_background.jpg';

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [bgImage, setBgImage] = useState<string | null>(null);

  useEffect(() => {
    loadBackground();
  }, []);

  const loadBackground = async () => {
    try {
      const fileUri = `${FileSystem.documentDirectory}${BG_FILENAME}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (fileInfo.exists) {
        // Aggiungiamo un timestamp per forzare il ricaricamento dell'immagine
        setBgImage(`${fileUri}?t=${Date.now()}`);
      } else {
        const savedBg = await getBackgroundImage();
        if (savedBg) setBgImage(`${savedBg}?t=${Date.now()}`);
      }
    } catch (e) {
      console.error("Errore caricamento sfondo:", e);
    }
  };

  const updateBackground = async (uri: string | null) => {
    try {
      const fileUri = `${FileSystem.documentDirectory}${BG_FILENAME}`;

      if (uri) {
        // Rimuoviamo il vecchio file se esiste
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(fileUri);
        }

        // Copiamo la nuova immagine
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri
        });

        await saveBackgroundImageUri(fileUri);
        // Forziamo l'aggiornamento dello stato con un nuovo timestamp
        setBgImage(`${fileUri}?t=${Date.now()}`);
      } else {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(fileUri);
        }
        await saveBackgroundImageUri(null);
        setBgImage(null);
      }
    } catch (e) {
      console.error("Errore aggiornamento sfondo:", e);
      throw e;
    }
  };

  return (
    <BackgroundContext.Provider value={{ bgImage, updateBackground }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
}
