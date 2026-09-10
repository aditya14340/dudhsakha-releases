import os

script = r"""import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://buamxwaihyecycloiuba.supabase.co';
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1YW14d2FpaHllY3ljbG9pdWJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5NTUwMiwiZXhwIjoyMDgxODcxNTAyfQ.Ua5U-6-S5etZeJf2pRFL2Ny-sLwTS2mtefh0pC273os';
const supabase = createClient(SUPABASE_URL, SRK);
const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const BACKUP_DIR = path.join(__dirname, '..', 'thev_backup_' + ts);

async function fetchAll(table) {
  const PAGE = 1000; let from = 0, all = [];
  while(true){
    const { data, error } = await supabase.from(table).select('*').range(from, from+PAGE-1).order('id',{ascending:true});
    if(error) throw error;
    if(!data || !data.length) break;
    all = all.concat(data);
    if(data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function run(){
  console.log('=== THEV BACKUP + MIGRATION ===');
  fs.mkdirSync(BACKUP_DIR, {recursive:true});

  console.log('Step 1: Backing up thev_transactions...');
  const allTxns = await fetchAll('thev_transactions');
  fs.writeFileSync(path.join(BACKUP_DIR,'thev_transactions_FULL_BACKUP.json'), JSON.stringify(allTxns,null,2));
  console.log('Saved', allTxns.length, 'rows.');

  console.log('Backing up farmer_thev_accounts...');
  const allAccts = await fetchAll('farmer_thev_accounts');
  fs.writeFileSync(path.join(BACKUP_DIR,'farmer_thev_accounts_FULL_BACKUP.json'), JSON.stringify(allAccts,null,2));
  console.log('Saved', allAccts.length, 'rows.');

  const toDelete = allTxns.filter(t => t.transaction_type === 'deposit');
  const toKeep   = allTxns.filter(t => t.transaction_type !== 'deposit');
  const byType = {};
  allTxns.forEach(t => { byType[t.transaction_type] = (byType[t.transaction_type]||0)+1; });

  console.log('\nStep 2: Breakdown:');
  Object.entries(byType).forEach(([k,v]) => console.log(' ', k, ':', v, k==='deposit' ? '<-- WILL DELETE' : '<-- WILL KEEP'));
  console.log('\nWILL DELETE:', toDelete.length, 'rows (auto-deposits from milk entries)');
  console.log('WILL KEEP:  ', toKeep.length,   'rows (opening / interest / refund)');

  fs.writeFileSync(path.join(BACKUP_DIR,'rows_to_delete_BACKUP.json'), JSON.stringify(toDelete,null,2));

  if(toDelete.length === 0){ console.log('Nothing to delete!'); return; }

  console.log('\nStep 3: Deleting deposit rows...');
  const BATCH = 500; let done = 0;
  for(let i = 0; i < toDelete.length; i += BATCH){
    const ids = toDelete.slice(i,i+BATCH).map(t => t.id);
    const { error } = await supabase.from('thev_transactions').delete().in('id', ids);
    if(error){ console.error('ERROR:', error.message); process.exit(1); }
    done += ids.length;
    console.log('  Deleted', done, '/', toDelete.length);
  }
  console.log('\nDone! Deleted', done, 'auto-deposit rows.');
  console.log('Kept intact:', toKeep.length, 'manual rows (opening/interest/refund).');
  console.log('Backup saved at:', BACKUP_DIR);
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
"""

with open(r'd:\top\main_desktop_app\scripts\migrate_thev.mjs', 'w', encoding='utf-8') as f:
    f.write(script)
print('Written OK')
