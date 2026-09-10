script = r"""import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://buamxwaihyecycloiuba.supabase.co';
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1YW14d2FpaHllY3ljbG9pdWJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5NTUwMiwiZXhwIjoyMDgxODcxNTAyfQ.Ua5U-6-S5etZeJf2pRFL2Ny-sLwTS2mtefh0pC273os';
const supabase = createClient(SUPABASE_URL, SRK);

// Find the most recent backup folder
const backupBase = path.join(__dirname, '..');
const backupFolders = fs.readdirSync(backupBase)
  .filter(f => f.startsWith('thev_backup_'))
  .sort()
  .reverse();

if (backupFolders.length === 0) {
  console.error('No backup folder found! Expected a folder starting with thev_backup_');
  process.exit(1);
}

const BACKUP_DIR = path.join(backupBase, backupFolders[0]);
console.log('Using backup:', BACKUP_DIR);

async function restore() {
  const backupFile = path.join(BACKUP_DIR, 'thev_transactions_FULL_BACKUP.json');
  if (!fs.existsSync(backupFile)) {
    console.error('Backup file not found:', backupFile);
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  console.log('Restoring', rows.length, 'rows to thev_transactions...');
  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('thev_transactions').upsert(batch, { onConflict: 'id' });
    if (error) { console.error('ERROR at batch', i, ':', error.message); process.exit(1); }
    done += batch.length;
    console.log('Restored', done, '/', rows.length);
  }
  console.log('Restore complete! All', done, 'rows restored.');
}
restore().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
"""
with open(r'd:\top\main_desktop_app\scripts\restore_thev_backup.mjs', 'w', encoding='utf-8') as f:
    f.write(script)
print('Written OK')
