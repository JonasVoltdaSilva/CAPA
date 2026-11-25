import { DatabaseSync, backup } from 'node:sqlite';
import { open, unlink } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function backupDatabase(source, destination) {
  if (!destination || extname(destination).toLowerCase() !== '.sqlite') {
    throw new Error('Indique um arquivo de destino novo com extensão .sqlite.');
  }
  const sourceDb = new DatabaseSync(source,{readOnly:true});
  let created = false, copy;
  try {
    // Exclusive creation protects a previous snapshot, including the live database.
    const file = await open(destination,'wx',0o600);
    created = true;
    await file.close();
    await backup(sourceDb,destination);
    copy = new DatabaseSync(destination);
    copy.exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; DELETE FROM sessions; VACUUM');
    const integrity = copy.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok' || copy.prepare('PRAGMA foreign_key_check').get()) {
      throw new Error('A cópia não passou na verificação de integridade.');
    }
    return {arquivo:resolve(destination),integridade:'ok',sessoes:0};
  } catch(error) {
    copy?.close();
    copy = undefined;
    if (created) await unlink(destination);
    throw error;
  } finally {
    copy?.close();
    sourceDb.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const source = join(resolve(process.env.DATA_DIR ?? join(root,'data')),'capa.sqlite');
  try { console.log(JSON.stringify(await backupDatabase(source,process.argv[2]),null,2)); }
  catch(error) { console.error('Backup não concluído.',error.message); process.exitCode=1; }
}

