const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wqxikajjsqskwvemmqze.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGlrYWpqc3Fza3d2ZW1tcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE4ODMsImV4cCI6MjA5MDYyNzg4M30.ozmkU8ePsFirJKJjsLhcXFUJhSiHtaeSoYIJ2it4MbM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  console.log("Cleaning up fake METADATA matches from Supabase...");
  const { data, error } = await supabase
    .from('matches')
    .delete()
    .or('team_a_name.eq.METADATA,team_b_name.eq.METADATA');

  if (error) {
    console.error("Error deleting METADATA matches:", error);
  } else {
    console.log("Successfully deleted METADATA matches from Supabase!");
  }
}

cleanup();
