import express from 'express';
const app=express();
app.set('trust proxy', 1);
const enabled=process.env.GEOBLOCK_ENABLED !== 'false';
app.use((req,res,next)=>{
  // Mobile-only is a usability gate, not a security boundary: user agents can be spoofed.
  if(process.env.MOBILE_ONLY !== 'false' && !/Android/i.test(req.get('user-agent') || '')) {
    return res.status(403).send('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#0b1220;color:white;text-align:center;padding:15vh 20px"><h1>📱 Только Android</h1><p>Откройте магазин в приложении на телефоне.</p></body></html>');
  }

  if(!enabled) return next();
  // Only trust Cloudflare's country header when requests are restricted to Cloudflare at infrastructure level.
  // For Render, use a server-side GeoIP lookup instead of trusting client-supplied headers.
  const ip=(req.ip||'').replace(/^::ffff:/,'');
  const local=['127.0.0.1','::1'].includes(ip);
  if(local) return next();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3500);
  fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`,{signal:controller.signal})
    .then(r=>r.json()).then(data=>{
      clearTimeout(timeout);
      if(data.success!==true || !data.country_code) return res.status(503).send('Проверка региона временно недоступна. Попробуйте позже.');
      if(data.country_code==='KG') return res.status(403).sendFile(process.cwd()+'/public/blocked.html');
      next();
    }).catch(()=>{clearTimeout(timeout);res.status(503).send('Не удалось проверить регион. Попробуйте позже.');});
});
app.use(express.static('public'));
app.listen(process.env.PORT||3000,()=>console.log('VPN Shop KG running'));
