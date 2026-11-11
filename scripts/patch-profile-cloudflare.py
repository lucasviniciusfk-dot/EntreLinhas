from pathlib import Path

p = Path("index.html")
html = p.read_text(encoding="utf-8")
sdk = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
client_tag = '<script src="./cloudflare/entrelinhas-api-client.js"></script>'
if sdk not in html:
    raise SystemExit("Supabase SDK tag not found; aborting.")
if client_tag not in html:
    html = html.replace(sdk, sdk + "\\n" + client_tag, 1)

start_marker = "window.saveProfileV166=window.saveProfileV165=window.saveProfileV59=async function(){"
start = html.find(start_marker)
if start < 0:
    raise SystemExit("Latest profile save function not found; aborting.")
end = html.find(";\\n  function profileHTML", start)
if end < 0:
    raise SystemExit("Profile function boundary not found; aborting.")
fn = html[start:end + 1]
anchor = "const r=await c.from('usuarios').upsert(row,{onConflict:'id'}).select().maybeSingle(); if(r.error)throw r.error;"
if anchor not in fn:
    raise SystemExit("Expected Supabase profile upsert not found; aborting.")
bridge = """ if(window.EntreLinhasCloudflareApi){try{const cf=window.EntreLinhasCloudflareApi.create();await cf.updateMe({nome:row.nome,bio:row.bio,livro_favorito:row.livro_favorito,foto_url:row.foto_url,perfil_privado:row.perfil_privado,biblioteca_publica:row.biblioteca_publica,moldura_atual:row.moldura_atual});window.__ENTREL_PROFILE_CLOUDFLARE_SYNC__={status:'ok',at:new Date().toISOString()};}catch(cfError){window.__ENTREL_PROFILE_CLOUDFLARE_SYNC__={status:'pending',at:new Date().toISOString(),error:String(cfError&&cfError.message||cfError)};console.warn('[Entre Linhas] Perfil salvo no Supabase; sincronização Cloudflare pendente:',cfError);}}"""
if "__ENTREL_PROFILE_CLOUDFLARE_SYNC__" not in fn:
    fn = fn.replace(anchor, anchor + bridge, 1)
    html = html[:start] + fn + html[end + 1:]
    p.write_text(html, encoding="utf-8")
    print("Patched index.html: profile update dual-writes to Cloudflare staging after Supabase succeeds.")
else:
    print("Profile bridge already present; no change.")
