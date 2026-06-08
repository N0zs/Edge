(function(){
  if(!document.body)return;
  var btn,translating=false,active=false,jobId=0,cache={},allPs=[],scrollTimer=null;

  var s=document.createElement('style');
  s.textContent='@keyframes tp{0%{opacity:1}50%{opacity:0.3}100%{opacity:1}}';
  document.head.appendChild(s);

  function mkBtn(){
    btn=document.createElement('div');
    btn.textContent='译';btn.title='翻译此页面';
    Object.assign(btn.style,{
      position:'fixed',right:'20px',top:'50%',transform:'translateY(-50%)',
      zIndex:'2147483647',width:'48px',height:'48px',borderRadius:'24px',
      background:'#2dd4a8',color:'#fff',fontSize:'20px',fontWeight:'bold',
      display:'flex',alignItems:'center',justifyContent:'center',
      cursor:'pointer',boxShadow:'0 2px 12px rgba(45,212,168,0.4)',
      transition:'all .2s',userSelect:'none',fontFamily:'sans-serif'
    });
    btn.addEventListener('mouseenter',function(){btn.style.transform='translateY(-50%) scale(1.1)';});
    btn.addEventListener('mouseleave',function(){btn.style.transform='translateY(-50%) scale(1)';});
    btn.addEventListener('click',function(){if(active){hide();return;}if(translating)return;translate();});
    document.body.appendChild(btn);
  }

  function hide(){
    document.querySelectorAll('[data-to]').forEach(function(el){
      el.innerHTML=el.getAttribute('data-to');el.removeAttribute('data-to');
    });
    active=false;translating=false;stopScroll();idle();
  }
  function load(m){btn.textContent=m;btn.style.background='#999';btn.style.animation='tp 1.2s ease infinite';}
  function done(){active=true;translating=false;btn.textContent='\u2716';btn.style.background='#e74c3c';btn.style.animation='';startScroll();}
  function idle(){active=false;translating=false;btn.textContent='译';btn.style.background='#2dd4a8';btn.style.animation='';}
  function errShow(){btn.textContent='!';btn.style.background='#e74c3c';btn.style.animation='';setTimeout(function(){if(!active)idle();},2500);}

  function startSW(){stopSW();window.addEventListener('scroll',scrollD,{passive:true});}
  function stopSW(){if(scrollTimer){clearTimeout(scrollTimer);scrollTimer=null;}window.removeEventListener('scroll',scrollD);}
  function scrollD(){if(scrollTimer)clearTimeout(scrollTimer);scrollTimer=setTimeout(scrollTranslate,400);}

  function buildChunks(paras,target){
    var chunks=[],cur=[],cw=0;
    for(var i=0;i<paras.length;i++){
      var el=paras[i];if(el.hasAttribute('data-to'))continue;
      var txt=(el.textContent||'').trim();if(!txt)continue;
      var wc=txt.split(/\s+/).length;
      if(cw+wc>target&&cur.length>0){chunks.push(cur);cur=[el];cw=wc;}
      else{cur.push(el);cw+=wc;}
      if(cw>=1000){chunks.push(cur);cur=[];cw=0;}
    }
    if(cur.length>0)chunks.push(cur);
    return chunks;
  }

  function translate(){
    if(translating)return;jobId++;var jid=jobId;translating=true;load('...');
    var c=document.querySelector('article')||document.querySelector('main')||document.body;
    allPs=Array.from(c.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th'))
      .filter(function(el){return(el.textContent||'').trim().length>10;});
    if(allPs.length===0){var bt=(document.body.textContent||'').trim().replace(/\s+/g,' ').substring(0,50000);if(bt.length>10)allPs=[document.body];}
    if(allPs.length===0){idle();return;}
    var visible=getVisible(allPs);
    if(visible.length===0){idle();return;}
    doTranslate(visible);
  }

  // ===== Core: send each paragraph independently via background =====
  function doTranslate(paras){
    jobId++;var jid=jobId;translating=true;load(paras.length+'段');

    chrome.storage.local.get(['enabled','provider','mode','vocabLevel','deeplKey','youdaoAppKey','youdaoSecret','llmEndpoint','llmKey','llmModel','wordLimit','tokenLimit'],function(config){
      if(jid!==jobId)return;
      if(!config.enabled){idle();return;}
      var mode=config.mode||'smart',vl=config.vocabLevel||'cet4',wl=config.wordLimit||'0',tl=config.tokenLimit||'0';

      // Route: Smart/Wordlist -> LLM only. Full -> user's selected provider
      var effProv = (mode==='smart'||mode==='wordlist') ? 'llm' : (config.provider||'llm');

      // Validate: if Full and DeepL/YD not configured, fallback to LLM
      if(effProv==='deepl'&&!config.deeplKey) effProv='llm';
      if(effProv==='youdao'&&(!config.youdaoAppKey||!config.youdaoSecret)) effProv='llm';

      var apiConfig;
      if(effProv==='deepl') apiConfig={apiKey:config.deeplKey};
      else if(effProv==='youdao') apiConfig={appKey:config.youdaoAppKey,appSecret:config.youdaoSecret};
      else apiConfig={apiKey:config.llmKey,endpoint:config.llmEndpoint||'https://api.openai.com/v1',model:config.llmModel||'gpt-4o-mini'};

      if(!apiConfig.apiKey&&effProv==='llm'){idle();return;}

      var pending=0;
      for(var p=0;p<paras.length;p++){
        (function(para,pIdx){
          var text=(para.textContent||'').trim();if(!text)return;
          var ck=location.href+'|'+mode+'|'+vl+'|p'+pIdx;
          if(cache[ck]){applyRes(para,cache[ck],mode,jid);return;}
          pending++;
          chrome.runtime.sendMessage({
            action:'translate',text:text,provider:effProv,mode:mode,
            vocabLevel:vl,config:apiConfig,wordLimit:wl,tokenLimit:tl
          },function(resp){
            if(jid!==jobId)return;
            pending--;
            if(resp&&resp.success){cache[ck]=resp.result;applyRes(para,resp.result,mode,jid);}else if(resp&&!resp.success){console.error('Tr err:',resp.error);errShow();}
            if(pending<=0)load('...');
          });
        })(paras[p],p);
      }
    });
  }

  function scrollTranslate(){
    if(!active||translating)return;if(!allPs||allPs.length===0)return;
    var untrans=[],vh=window.innerHeight,sy=window.scrollY||window.pageYOffset;
    for(var i=0;i<allPs.length;i++){
      if(allPs[i].hasAttribute('data-to'))continue;
      var rect=allPs[i].getBoundingClientRect(),top=rect.top+sy,bot=rect.bottom+sy;
      if(top<sy+vh+300&&bot>sy-300)untrans.push(allPs[i]);
    }
    if(untrans.length===0)return;
    var chunks=buildChunks(untrans,500);
    if(chunks.length===0)return;
    // Send one chunk (500 words) per scroll
    jobId++;var jid=jobId;translating=true;load('...');
    doTranslate(chunks[0]);
  }

  function applyRes(el,result,mode,jid){
    if(jid!==jobId)return;
    var pars=result.split('\n\n'),tt='';
    if(mode==='wordlist')tt=result;
    else tt=pars[0]||result;
    if(!tt.trim())return;
    if(!el.hasAttribute('data-to'))el.setAttribute('data-to',el.innerHTML);
    var esc=tt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    el.innerHTML=esc.replace(/(\b[\w\u00C0-\u024F\'-]+)\s*(\([^)]+\))/g,
      '<span style="background:#e8faf4;padding:2px 4px;border-radius:3px;text-decoration:underline #0d8a6a;text-underline-offset:3px;text-decoration-thickness:3px">$1</span>$2');
    if(!active)done();
  }

  function getVisible(elements){
    var vh=window.innerHeight,sy=window.scrollY||window.pageYOffset,r=[];
    for(var i=0;i<elements.length;i++){
      var rect=elements[i].getBoundingClientRect(),top=rect.top+sy,bot=rect.bottom+sy;
      if(top<sy+vh+300&&bot>sy-300)r.push(elements[i]);
    }
    return r.length>0?r:elements.slice(0,20);
  }

  function auto(){if(document.hidden)return;chrome.storage.local.get(['enabled'],function(c){if(c.enabled)setTimeout(translate,100);});}

  var lastUrl=location.href;
  var obs=new MutationObserver(function(){
    var url=location.href;
    if(url!==lastUrl){lastUrl=url;cache={};stopSW();if(!document.hidden){hide();setTimeout(auto,100);}}
  });
  obs.observe(document,{subtree:true,childList:true});
  window.addEventListener('popstate',function(){lastUrl=location.href;cache={};stopSW();setTimeout(auto,100);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!active&&!translating)setTimeout(auto,100);});

  mkBtn();
  auto();
})();
