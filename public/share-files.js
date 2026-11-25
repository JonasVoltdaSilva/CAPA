// O PNG chega pronto ao clique para preservar a ativação transitória exigida pela Web Share API.
export function canShareFile(file) {
  if (!window.isSecureContext || !file || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try { return navigator.canShare({files:[file]}); } catch { return false; }
}

export async function shareFile(file) {
  if (!canShareFile(file)) return 'unavailable';
  try {
    await navigator.share({files:[file]});
    return 'handed-off';
  } catch (error) {
    return error.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

export function downloadFile(file, filename) {
  const url=URL.createObjectURL(file), link=document.createElement('a');
  link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export function openShareDestinations(entryId) {
  if (!entryId || document.querySelector('#share-destinations')) return;
  const dialog=document.createElement('dialog'), target='/estudio?entry='+encodeURIComponent(entryId);
  dialog.id='share-destinations';dialog.className='share-destinations';
  dialog.setAttribute('aria-labelledby','share-destinations-heading');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="share-destinations-heading">Compartilhar</h2><button class="icon-btn" type="button" aria-label="Fechar">×</button></div>
    <div class="share-options"><a class="btn primary" href="${target}&amp;destino=instagram">Instagram Stories</a>
    <a class="btn" href="${target}">Outros formatos</a></div>`;
  dialog.querySelector('button').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target.closest('a'))dialog.close();});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('a').focus();
}
