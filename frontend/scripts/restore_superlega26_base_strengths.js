const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wqxikajjsqskwvemmqze.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGlrYWpqc3Fza3d2ZW1tcXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE4ODMsImV4cCI6MjA5MDYyNzg4M30.ozmkU8ePsFirJKJjsLhcXFUJhSiHtaeSoYIJ2it4MbM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const baseStrengths = {
  "Alan": 8.0,
  "Ale": 10.0,
  "Alfio": 7.0,
  "Alessio": 7.0,
  "Aly": 8.5,
  "Andy": 7.0,
  "Angelo": 7.5,
  "Bacca": 3.5,
  "Beppe": 6.5,
  "Canna": 5.5,
  "Cappe": 6.0,
  "Care": 8.5,
  "Chri": 7.0,
  "Cisco": 6.0,
  "Cip": 8.0,
  "Cola": 8.5,
  "Corra": 3.5,
  "Dani": 6.5,
  "Dave": 6.0,
  "Denny": 7.0,
  "Diba": 4.5,
  "Diego": 4.0,
  "Doc": 6.5,
  "Dritan": 7.5,
  "Edo": 7.0,
  "Elia": 6.5,
  "Emy": 2.0,
  "Fabio": 7.0,
  "Fede": 4.5,
  "Franatu": 6.5,
  "Gege": 6.0,
  "Giorgio": 6.0,
  "Giuse": 4.5,
  "Giuseppe": 10.0,
  "Grassi": 7.0,
  "Ianna": 6.5,
  "Lorenzo": 6.5,
  "Lory": 9.0,
  "Lucini": 6.0,
  "Lucio": 6.0,
  "Manu": 6.5,
  "Marino": 8.0,
  "Masca": 8.5,
  "Mauro": 5.5,
  "Modu": 6.5,
  "Neve": 5.5,
  "Nico": 6.5,
  "Pane": 7.0,
  "Paolo": 8.0,
  "Pape": 8.5,
  "Pizzi": 6.5,
  "Rey": 6.0,
  "Riki": 6.5,
  "Roby": 8.0,
  "Scali": 6.5,
  "Sergio": 7.0,
  "Simone": 7.5,
  "Stefano": 8.5,
  "Tino": 8.5,
  "Vale": 9.0,
  "Viga": 5.5,
  "Vitto": 7.5,
  "Zenni": 7.5
};

async function restore() {
  const groupId = 'ee821814-e4c6-4ffa-90ca-ddfe7fea7a49'; // Superlega26

  // 1. Turn off use_dynamic_form in groups table
  await supabase.from('groups').update({ use_dynamic_form: false }).eq('id', groupId);

  // 2. Fetch all players in Superlega26
  const { data: players } = await supabase.from('players').select('*').eq('group_id', groupId);

  if (players) {
    for (const p of players) {
      const correctBase = baseStrengths[p.nickname];
      if (correctBase !== undefined) {
        console.log(`Restoring ${p.nickname} from ${p.strength} to ${correctBase}`);
        await supabase.from('players').update({ strength: correctBase }).eq('id', p.id);
      }
    }
  }

  console.log("Restoration of Superlega26 completed successfully!");
}

restore();
