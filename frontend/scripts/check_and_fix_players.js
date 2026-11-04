const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wqxikajjsqskwvemmqze.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGlrYWpqc3Fza3d2ZW1tcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE4ODMsImV4cCI6MjA5MDYyNzg4M30.ozmkU8ePsFirJKJjsLhcXFUJhSiHtaeSoYIJ2it4MbM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const { data: groups } = await supabase.from('groups').select('*');
  console.log("Groups found:", groups ? groups.length : 0);

  if (groups) {
    for (const g of groups) {
      console.log(`Group: ${g.name} (${g.id}), use_dynamic_form: ${g.use_dynamic_form}`);
      const { data: players } = await supabase.from('players').select('*').eq('group_id', g.id);
      if (players) {
        players.forEach(p => console.log(`  Player: ${p.nickname}, role: ${p.role}, strength: ${p.strength}`));
      }
    }
  }
}

inspect();
