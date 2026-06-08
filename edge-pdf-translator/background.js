function md5(str) {
  function rl(n,b){return(n<<b)|(n>>>(32-b));}
  function th(n){var s='',v;for(var i=7;i>=0;i--){v=(n>>>(i*4))&0x0f;s+=v.toString(16);}return s;}
  var u=unescape(encodeURIComponent(str)),x=[],i,k;
  for(i=0;i<u.length;i++)x[i>>2]=(x[i>>2]||0)|((u.charCodeAt(i)&0xff)<<(((3-i)%4)*8));
  x[i>>2]=(x[i>>2]||0)|(0x80<<(((3-i)%4)*8));
  if(i*8>0)x[(((i+8)>>6)<<4)+14]=i*8;
  var a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476;
  for(k=0;k<x.length;k+=16){var aa=a,bb=b,cc=c,dd=d,F,g,t;
    for(i=0;i<64;i++){
      if(i<16){F=(b&c)|((~b)&d);g=i;}else if(i<32){F=(d&b)|((~d)&c);g=(5*i+1)%16;}
      else if(i<48){F=b^c^d;g=(3*i+5)%16;}else{F=c^(b|(~d));g=(7*i)%16;}
      t=d;d=c;c=b;
      var kv=[0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391][i];
      var sh=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,1,6,11,0,5,10,15,4,9,14,3,8,13,2,7,12,5,8,11,14,1,4,7,10,13,0,3,6,9,12,15,2,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9][i];
      var m=rl(a+F+(x[k+g]||0)+kv,7+sh);b=m;a=t;
    }
    a=(a+aa)>>>0;b=(b+bb)>>>0;c=(c+cc)>>>0;d=(d+dd)>>>0;
  }
  return th(a)+th(b)+th(c)+th(d);
}

function getVP(l){return{l:'CET-4~4500',cet6:'CET-6~6000',ielts:'IELTS~8000',gaokao:'Gaokao~3500',gre:'GRE~12000'}[l]||'CET-4~4500';}

function buildP(text,mode,vocabLevel){
  var v=getVP(vocabLevel);
  if(mode==='smart')return 'Vocab:'+v+'. Annotate difficult words: word (translation). Preserve original. Only annotated.\n\n'+text;
  if(mode==='wordlist')return 'Vocab:'+v+'. List words above level. Format: word :: translation :: explanation\n\n'+text;
  return 'Translate to Chinese. Preserve paragraphs.\n\n'+text;
}

// === DeepL ===
async function transDeepL(text,key){
  var r=await fetch('https://api-free.deepl.com/v2/translate',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({auth_key:key,text:text,target_lang:'ZH'})
  });
  if(!r.ok)throw Error('DL HTTP '+r.status);
  return(await r.json()).translations[0].text;
}

// === Youdao ===
async function transYD(text,appKey,secret){
  var salt=Date.now(),input=text.length>20?text.substring(0,20):text;
  var sign=md5(appKey+input+salt+secret);
  var r=await fetch('https://openapi.youdao.com/api',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({q:text,from:'auto',to:'zh-CHS',appKey:appKey,salt:salt,sign:sign})
  });
  if(!r.ok)throw Error('YD HTTP '+r.status);
  var d=await r.json();
  if(d.errorCode!=='0'){var ye={'101':'missing','102':'lang','108':'bad AppKey','202':'sign','401':'overdue'};throw Error('YD '+d.errorCode+': '+(ye[d.errorCode]||'?'));}
  return d.translation[0];
}

// === LLM with retry ===
async function callLLM(ep,key,model,prompt,maxTokens,attempt){
  attempt=attempt||1;
  var mt=maxTokens>0?maxTokens:4096;
  var r=await fetch(ep+'/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({model:model||'gpt-4o-mini',messages:[{role:'user',content:prompt}],temperature:0.3,max_tokens:mt})
  });
  if(r.status===429&&attempt<2){await new Promise(function(r){setTimeout(r,2000);});return callLLM(ep,key,model,prompt,maxTokens,2);}
  if(r.status===5e2&&attempt<2){await new Promise(function(r){setTimeout(r,3000);});return callLLM(ep,key,model,prompt,maxTokens,2);}
  if(!r.ok)throw Error('LLM HTTP '+r.status+' '+await r.text());
  var d=await r.json();
  if(!d.choices||!d.choices[0])throw Error('LLM empty response');
  return d.choices[0].message.content.trim();
}

async function transLLM(text,ep,key,model,mode,vocabLevel,tokenLimit){
  var prompt=buildP(text,mode,vocabLevel);
  return await callLLM(ep,key,model,prompt,tokenLimit);
}

// === Timeout wrapper ===
function withTimeout(promise,ms){
  return Promise.race([
    promise,
    new Promise(function(_,reject){setTimeout(function(){reject(Error('TIMEOUT '+ms+'ms'));},ms);})
  ]);
}

// === Main translate handler ===
chrome.runtime.onMessage.addListener(function(req,sender,sendResponse){
  if(req.action==='test'){
    testConn(req).then(function(r){sendResponse({success:true,result:r});}).catch(function(e){sendResponse({success:false,error:e.message});});
    return true;
  }
  if(req.action==='translate'){
    translateChunk(req).then(function(r){sendResponse({success:true,result:r});}).catch(function(e){sendResponse({success:false,error:e.message});});
    return true;
  }
});

async function translateChunk(req){
  var text=req.text,provider=req.provider,mode=req.mode||'full',vl=req.vocabLevel||'cet4',tl=req.tokenLimit||'0';
  var wl=parseInt(req.wordLimit)||0;
  if(wl>0){var ws=text.split(/\s+/);if(ws.length>wl){ws=ws.slice(0,wl);text=ws.join(' ')+'...';}}

  if(provider==='deepl') return await withTimeout(transDeepL(text,req.config.apiKey),30000);
  if(provider==='youdao') return await withTimeout(transYD(text,req.config.appKey,req.config.appSecret),30000);
  // LLM
  var ep=(req.config.endpoint||'https://api.openai.com/v1').replace(/\/+$/,'');
  return await withTimeout(transLLM(text,ep,req.config.apiKey,req.config.model||'gpt-4o-mini',mode,vl,parseInt(tl)),120000);
}

// === Test ===
async function testConn(req){
  if(req.provider==='llm') return await testLLM(req.config);
  if(req.provider==='deepl') return await testDeepL(req.config.apiKey);
  if(req.provider==='youdao') return await testYoudao(req.config.appKey,req.config.appSecret);
  throw Error('Unknown provider');
}
async function testLLM(cfg){
  var ep=(cfg.endpoint||'https://api.openai.com/v1').replace(/\/+$/,'');
  var r=await fetch(ep+'/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey},
    body:JSON.stringify({model:cfg.model||'gpt-4o-mini',messages:[{role:'user',content:'Reply: OK'}],max_tokens:10})
  });
  if(!r.ok)throw Error('HTTP '+r.status);
  return(await r.json()).choices[0].message.content;
}
async function testDeepL(key){
  var r=await fetch('https://api-free.deepl.com/v2/translate',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({auth_key:key,text:'hello',target_lang:'ZH'})
  });
  if(!r.ok)throw Error('HTTP '+r.status);
  return(await r.json()).translations[0].text;
}
async function testYoudao(appKey,secret){
  var salt=Date.now(),sign=md5(appKey+'test'+salt+secret);
  var r=await fetch('https://openapi.youdao.com/api',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({q:'test',from:'auto',to:'zh-CHS',appKey:appKey,salt:salt,sign:sign})
  });
  if(!r.ok)throw Error('HTTP '+r.status);
  var d=await r.json();
  if(d.errorCode!=='0'){var ye={'101':'missing','108':'AppKey not found','202':'sign fail','401':'overdue'};throw Error('YD '+d.errorCode+': '+(ye[d.errorCode]||'?'));}
  return d.translation[0];
}
