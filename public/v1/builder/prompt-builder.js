(function(global){
  /**
   * 指定コンテナ内に、YAML から読み込んだテンプレート UI をステップ単位で
   * 「フォーム｜生成プロンプト」 並びで展開する。
   * @param {HTMLElement} container
   * @param {string} yamlUrl
   */
  async function initPromptBuilder(container, yamlUrl) {
    // 1. YAML 読み込み
    let doc;
    try {
      const res  = await fetch(yamlUrl);
      const text = await res.text();
      doc = jsyaml.load(text);
    } catch (err) {
      container.textContent = 'テンプレート読み込みに失敗しました';
      console.error(err);
      return;
    }

    // 2. テンプレート情報整形
    const promptName = doc.prompt_name || 'テンプレート';
    // doc.templates は [{ template: { phase, form, prompt }}…]
    const templates = Array.isArray(doc.templates)
      ? doc.templates.map(e => e.template || {})
      : [];

    // 3. コンテナ初期化
    container.innerHTML = `<h2 class="page-title">${promptName}</h2>`;

    // 4. 各ステップの UI を生成
    const stepInfos = [];  // { tpl, formDiv, promptDiv }
    templates.forEach((tpl, idx) => {
      // ステップコンテナ
      const stepDiv = document.createElement('div');
      stepDiv.className = 'step-container';

      // フォーム側
      const formDiv = document.createElement('div');
      formDiv.className = 'step-form';
      formDiv.innerHTML = `<h3>ステップ ${idx+1}：${tpl.phase||''}</h3>`;

      (tpl.form || []).forEach(fw => {
        const it = fw.item;
        const gp = document.createElement('div');
        gp.className = 'form-group';

        const lb = document.createElement('label');
        lb.htmlFor = `in-${idx}-${it.name}`;
        lb.textContent = it.description || it.name;

        let fld;
        if (it.input === 'multiline_text') {
          fld = document.createElement('textarea');
        } else if (/^date/.test(it.input)) {
          fld = document.createElement('input');
          fld.type = 'date';
          const m = it.input.match(/^date\((.+)\)$/);
          if (m) fld.placeholder = m[1];
        } else {
          fld = document.createElement('input');
          fld.type = it.input || 'text';
        }
        fld.id    = `in-${idx}-${it.name}`;
        fld.name  = it.name;
        fld.value = it.default || '';

        gp.append(lb, fld);
        formDiv.appendChild(gp);
      });

      // プロンプト側
      const promptDiv = document.createElement('div');
      promptDiv.className = 'step-prompt';
      // 見出しはフォームと同じく phase 表示
      promptDiv.innerHTML = `<h3>ステップ ${idx+1} プロンプト：${tpl.phase||''}</h3><div class="prompt-text">読み込み中…</div>`;

      // 両方をステップコンテナに追加
      stepDiv.appendChild(formDiv);
      stepDiv.appendChild(promptDiv);
      container.appendChild(stepDiv);

      stepInfos.push({ tpl, formDiv, promptDiv });
    });

    // 5. 再構築ロジック
    function rebuild() {
      stepInfos.forEach(({ tpl, formDiv, promptDiv }, idx) => {
        // そのステップのフォームから値を収集
        const vals = {};
        formDiv.querySelectorAll('input,textarea').forEach(el => {
          vals[el.name] = el.value;
        });

        // テンプレート埋め込み
        const raw  = tpl.prompt || '';
        const text = raw.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vals[k] || '');

        // 出力更新
        const outDiv = promptDiv.querySelector('.prompt-text');
        outDiv.textContent = text;
      });
    }

    // 6. イベント登録
    container.querySelectorAll('input,textarea').forEach(el => {
      el.addEventListener('input', rebuild);
    });

    // 初回レンダリング
    rebuild();
  }

  // グローバルに公開
  global.initPromptBuilder = initPromptBuilder;

  // DOM 読み込み後、自動でスタンドアロン版・ウィジェット版両方を検出
  document.addEventListener('DOMContentLoaded', () => {
    // スタンドアロン：#builder-root
    const root = document.getElementById('builder-root');
    if (root) {
      const params = new URLSearchParams(location.search);
      const tpl    = params.get('template') || params.get('url') || root.getAttribute('data-yaml');
      if (tpl) initPromptBuilder(root, tpl);
    }
    // ウィジェット版：<div yaml="…">
    document.querySelectorAll('div[yaml]').forEach(div => {
      const yamlUrl = div.getAttribute('yaml');
      if (yamlUrl) initPromptBuilder(div, yamlUrl);
    });
  });

  // CSS 動的注入
  const style = document.createElement('style');
  style.textContent = `
    .page-title { font-family: sans-serif; margin-bottom:1em; }
    .step-container { display: flex; gap: 1em; margin-bottom: 2em; }
    .step-form, .step-prompt { flex: 1; box-sizing: border-box; }
    .step-form { border-right:1px solid #ccc; padding-right:1em; }
    .step-prompt { padding-left:1em; }
    .template-container h3,
    .step-form h3,
    .step-prompt h3 { margin-top:0; font-size:1.1em; }
    .form-group { margin-bottom:.75em; }
    .form-group label { display:block; margin-bottom:.25em; }
    .form-group input, .form-group textarea { width:100%; padding:.5em; box-sizing:border-box; }
    .form-group textarea { min-height:100px; resize:vertical; }
    .prompt-text { white-space: pre-wrap; background:#f1f1f1; padding:.5em; border-radius:3px; }
  `;
  document.head.appendChild(style);

})(window);
