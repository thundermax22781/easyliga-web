import { createClient } from '@supabase/supabase-js';

// URL del tuo progetto Supabase
const supabaseUrl = 'https://wqxikajjsqskwvemmqze.supabase.co';

// La chiave anonima corretta
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGlrYWpqc3Fza3d2ZW1tcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE4ODMsImV4cCI6MjA5MDYyNzg4M30.ozmkU8ePsFirJKJjsLhcXFUJhSiHtaeSoYIJ2it4MbM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Inizializza l'autenticazione anonima.
 * Ogni dispositivo riceverà un ID univoco segreto da Supabase.
 */
export const initializeAuth = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Errore recupero sessione:', sessionError);
  }

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Errore login anonimo:', error.message);
    } else {
      console.log('Login anonimo effettuato con successo:', data.user?.id);
    }
  } else {
    console.log('Sessione esistente trovata:', session.user?.id);
  }
};
