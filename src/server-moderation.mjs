import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openStore } from './server-db.mjs';

const reportTargets = {
  user: {table:'users',excerpt:'name || char(10) || bio'},
  list: {table:'lists',excerpt:'title || char(10) || description'},
  entry: {table:'entries',excerpt:'review'},
  comment: {table:'comments',excerpt:'text'}
};

export function moderate(store, action, id) {
  const {run,all,get,atomic} = store;
  if (action === 'listar') {
    return all('SELECT id,userId,targetType,targetId,reason,createdAt FROM reports ORDER BY createdAt').map(r => {
      const target = reportTargets[r.targetType];
      const text = get(`SELECT ${target.excerpt} AS body FROM ${target.table} WHERE id=?`,r.targetId)?.body;
      return {...r,conteudo:text ?? ''};
    });
  }
  if (action === 'reativar') {
    const removed = run('DELETE FROM suspensions WHERE userId=?',id);
    if (!removed.changes) throw new Error('Suspensão não encontrada.');
    return {contaReativada:id};
  }
  if (!['arquivar','remover','suspender'].includes(action)) {
    throw new Error('Use listar, arquivar <denúncia>, remover <denúncia>, suspender <denúncia> ou reativar <conta>.');
  }
  const r = get('SELECT * FROM reports WHERE id=?',id);
  if (!r) throw new Error('Denúncia não encontrada.');
  return atomic(() => {
    if (action === 'arquivar') {
      run('DELETE FROM reports WHERE id=?',id);
      return {denunciaArquivada:id};
    }
    if (action === 'suspender' && r.targetType === 'user') {
      run('INSERT OR IGNORE INTO suspensions VALUES(?,?)',r.targetId,new Date().toISOString());
      run('DELETE FROM sessions WHERE userId=?',r.targetId);
    } else if (action === 'remover' && r.targetType !== 'user') {
      run(`DELETE FROM ${reportTargets[r.targetType].table} WHERE id=?`,r.targetId);
    } else throw new Error('Use suspender para contas ou remover para conteúdo.');
    run('DELETE FROM reports WHERE targetType=? AND targetId=?',r.targetType,r.targetId);
    return {acao:action,alvo:r.targetId};
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const filename = join(resolve(process.env.DATA_DIR ?? join(root,'data')),'capa.sqlite');
  const [action = 'listar',id = ''] = process.argv.slice(2);
  if (!existsSync(filename)) {
    console.error('Banco inexistente neste DATA_DIR.');
    process.exitCode = 1;
  } else {
    const store = openStore(filename);
    try { console.log(JSON.stringify(moderate(store,action,id),null,2)); }
    catch (err) { console.error(err.message); process.exitCode = 1; }
    finally { store.db.close(); }
  }
}

