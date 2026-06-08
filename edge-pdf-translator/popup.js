var toggle = document.getElementById('toggle');
var provider = document.getElementById('provider');
var deeplKey = document.getElementById('deepl-key');
var deeplSettings = document.getElementById('deepl-settings');
var youdaoAppKey = document.getElementById('youdao-appkey');
var youdaoSecret = document.getElementById('youdao-secret');
var youdaoSettings = document.getElementById('youdao-settings');
var llmSettings = document.getElementById('llm-settings');
var llmEndpoint = document.getElementById('llm-endpoint');
var llmKey = document.getElementById('llm-key');
var llmModel = document.getElementById('llm-model');
var vocabSection = document.getElementById('vocab-section');
var tokenSection = document.getElementById('token-section');
var wordLimitEl = document.getElementById('word-limit');
var tokenLimitEl = document.getElementById('token-limit');
var saveBtn = document.getElementById('save-btn');
var testBtn = document.getElementById('test-btn');
var statusEl = document.getElementById('status');
var modeBtns = document.querySelectorAll('#mode-selector .seg-item');
var vocabBtns = document.querySelectorAll('#vocab-selector .seg-item');
var currentMode = 'smart';
var currentLevel = 'cet4';

modeBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    modeBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    vocabSection.style.display = (currentMode === 'smart' || currentMode === 'wordlist') ? 'block' : 'none';
    // Auto-switch provider: Smart/Wordlist -> LLM, Full -> DeepL/Youdao
    if (currentMode === 'smart' || currentMode === 'wordlist') {
      provider.value = 'llm';
    } else if (provider.value === 'llm') {
      // Full mode: prefer DeepL, fallback Youdao
      provider.value = document.getElementById('deepl-key').value.trim() ? 'deepl' : 'youdao';
    }
    toggleProviderSettings();
  });
});
vocabBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    vocabBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    currentLevel = btn.dataset.level;
  });
});

function toggleProviderSettings() {
  var val = provider.value;
  deeplSettings.style.display = val === 'deepl' ? 'block' : 'none';
  youdaoSettings.style.display = val === 'youdao' ? 'block' : 'none';
  llmSettings.style.display = val === 'llm' ? 'block' : 'none';
  tokenSection.style.display = val === 'llm' ? 'block' : 'none';
}
provider.addEventListener('change', toggleProviderSettings);

chrome.storage.local.get([
  'enabled', 'provider', 'mode', 'vocabLevel',
  'deeplKey', 'youdaoAppKey', 'youdaoSecret',
  'llmEndpoint', 'llmKey', 'llmModel',
  'wordLimit', 'tokenLimit'
], function(data) {
  if (data.enabled !== undefined) toggle.checked = data.enabled;
  if (data.provider) provider.value = data.provider;
  if (data.mode) {
    currentMode = data.mode;
    modeBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.mode === data.mode); });
  }
  if (data.vocabLevel) {
    currentLevel = data.vocabLevel;
    vocabBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.level === data.vocabLevel); });
  }
  if (data.deeplKey) deeplKey.value = data.deeplKey;
  if (data.youdaoAppKey) youdaoAppKey.value = data.youdaoAppKey;
  if (data.youdaoSecret) youdaoSecret.value = data.youdaoSecret;
  if (data.llmEndpoint) llmEndpoint.value = data.llmEndpoint;
  if (data.llmKey) llmKey.value = data.llmKey;
  if (data.llmModel) llmModel.value = data.llmModel;
  if (data.wordLimit) wordLimitEl.value = data.wordLimit;
  if (data.tokenLimit) tokenLimitEl.value = data.tokenLimit;
  vocabSection.style.display = (currentMode === 'smart' || currentMode === 'wordlist') ? 'block' : 'none';
  toggleProviderSettings();
});

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

saveBtn.addEventListener('click', function() {
  var cfg = {
    enabled: toggle.checked, provider: provider.value, mode: currentMode, vocabLevel: currentLevel,
    deeplKey: deeplKey.value.trim(), youdaoAppKey: youdaoAppKey.value.trim(), youdaoSecret: youdaoSecret.value.trim(),
    llmEndpoint: llmEndpoint.value.trim(), llmKey: llmKey.value.trim(), llmModel: llmModel.value.trim(),
    wordLimit: wordLimitEl.value, tokenLimit: tokenLimitEl.value
  };
  if (cfg.provider === 'deepl' && !cfg.deeplKey) { setStatus('请输入 DeepL API Key', 'error'); return; }
  if (cfg.provider === 'youdao' && (!cfg.youdaoAppKey || !cfg.youdaoSecret)) { setStatus('请填写完整的有道翻译信息', 'error'); return; }
  if (cfg.provider === 'llm' && (!cfg.llmKey || !cfg.llmEndpoint || !cfg.llmModel)) { setStatus('请填写完整的 LLM 配置', 'error'); return; }
  chrome.storage.local.set(cfg, function() {
    setStatus('设置已保存', 'success');
    setTimeout(function() { setStatus(''); }, 2000);
  });
});

toggle.addEventListener('change', function() {
  chrome.storage.local.set({ enabled: toggle.checked });
});

testBtn.addEventListener('click', function() {
  var cfg = {
    provider: provider.value,
    deeplKey: deeplKey.value.trim(), youdaoAppKey: youdaoAppKey.value.trim(), youdaoSecret: youdaoSecret.value.trim(),
    llmEndpoint: llmEndpoint.value.trim(), llmKey: llmKey.value.trim(), llmModel: llmModel.value.trim()
  };
  if (cfg.provider === 'deepl' && !cfg.deeplKey) { setStatus('请先输入 API Key', 'error'); return; }
  if (cfg.provider === 'youdao' && (!cfg.youdaoAppKey || !cfg.youdaoSecret)) { setStatus('请先填写完整的信息', 'error'); return; }
  if (cfg.provider === 'llm' && (!cfg.llmKey || !cfg.llmEndpoint || !cfg.llmModel)) { setStatus('请先填写完整的 LLM 配置', 'error'); return; }
  testBtn.textContent = '测试中...';
  testBtn.classList.add('testing');
  setStatus('');
  chrome.runtime.sendMessage({ action: 'test', provider: cfg.provider, config: {
    apiKey: cfg.deeplKey || cfg.llmKey, appKey: cfg.youdaoAppKey, appSecret: cfg.youdaoSecret,
    endpoint: cfg.llmEndpoint, model: cfg.llmModel
  }}, function(response) {
    testBtn.textContent = '测试连接';
    testBtn.classList.remove('testing');
    if (response.success) { setStatus('连接成功: ' + response.result, 'success'); }
    else { setStatus('连接失败: ' + response.error, 'error'); }
  });
});
