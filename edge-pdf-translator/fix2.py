import os
B = r'C:\Users\T0po1\edge-pdf-translator'
with open(os.path.join(B,'content.js'),'r',encoding='utf-8') as f:
    c = f.read()

sq = chr(39)

# 1. Add 30s timeout to callAPI
old1 = 'return new Promise(function(resolve, reject) {'
new1 = 'return new Promise(function(resolve, reject) {\n      var to=setTimeout(function(){reject(Error(' + sq + 'API timeout 30s' + sq + '));},30000);\n      function done(r){clearTimeout(to);resolve(r);}\n      function fail(e){clearTimeout(to);reject(e);}'
c = c.replace(old1, new1)

# 2. Replace resolve/reject with done/fail in all three API branches
c = c.replace("resolve(d.translations[0].text);else reject('DeepL error');","done(d.translations[0].text);else fail('DeepL error');")
c = c.replace("resolve(d.translation[0]);else reject(d.errorCode);","done(d.translation[0]);else fail(d.errorCode);")
c = c.replace("resolve(d.choices[0].message.content.trim());\n          else reject('LLM error');","done(d.choices[0].message.content.trim());\n          else fail('LLM error');")

# 3. Replace silent catch
old2 = '}).catch(function(err){\n          // silent fail\n        });'
new2 = '}).catch(function(err){\n          console.error(' + sq + 'Translate error:' + sq + ',err);\n          B.textContent=' + sq + '!' + sq + ';\n          B.style.background=' + sq + '#e74c3c' + sq + ';\n          setTimeout(function(){if(!A)btnIdle();},2000);\n        });'
c = c.replace(old2, new2)

with open(os.path.join(B,'content.js'),'w',encoding='utf-8') as f:
    f.write(c)

print('Done')
for ch in ['Timeout 30s','function done','function fail','console.error','btnIdle']:
    print('  ' + ch + ': ' + str(ch in c))
import os, json
B = r'C:\Users\T0po1\edge-pdf-translator'
with open(os.path.join(B,'manifest.json'),'r',encoding='utf-8') as f:
    m = json.load(f)
if 'https://api.openai.com/*' not in m.get('host_permissions',[]):
    m['host_permissions'].append('https://api.openai.com/*')
    with open(os.path.join(B,'manifest.json'),'w',encoding='utf-8') as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
    print('Manifest: +openai')
else:
    print('Manifest: already has openai')

with open(os.path.join(B,'content.js'),'r',encoding='utf-8') as f:
    c = f.read()

# Increase timeout
c = c.replace('30000', '60000')
c = c.replace('API timeout 30s', 'API timeout 60s')

# Add HTTP status check to all fetch calls
c = c.replace('.then(function(r){return r.json();}).then(function(d){if(d.choices',
              '.then(function(r){if(!r.ok)throw Error(' + "'HTTP '+r.status);return r.json();}).then(function(d){if(d.choices")
c = c.replace('.then(function(r){return r.json();}).then(function(d){if(d.translations',
              '.then(function(r){if(!r.ok)throw Error(' + "'HTTP '+r.status);return r.json();}).then(function(d){if(d.translations")
c = c.replace('.then(function(r){return r.json();}).then(function(d){if(d.errorCode',
              '.then(function(r){if(!r.ok)throw Error(' + "'HTTP '+r.status);return r.json();}).then(function(d){if(d.errorCode")

with open(os.path.join(B,'content.js'),'w',encoding='utf-8') as f:
    f.write(c)

checks = {'API timeout 60s':c,'HTTP status check':"throw Error('HTTP '+r.status)"}
for name,val in checks.items():
    print(name + ': ' + str(val in c))
