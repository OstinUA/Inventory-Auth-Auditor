document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('runBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const targetList = document.getElementById('targetList');
  const refList = document.getElementById('refList');
  const fileTypeSel = document.getElementById('fileType');
  const viewModeSel = document.getElementById('viewMode');
  const batchSizeSel = document.getElementById('batchSize');
  const statusText = document.getElementById('statusText');
  const statsBar = document.getElementById('statsBar');
  const tableBody = document.querySelector('#resultsTable tbody');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const targetLabel = document.getElementById('targetLabel');

  let globalResults = [];
  let aborted = false;

  loadState();
  updatePlaceholder();

  function saveState() {
    chrome.storage.local.set({
      targets: targetList.value,
      refs: refList.value,
      fileType: fileTypeSel.value,
      viewMode: viewModeSel.value,
      batchSize: batchSizeSel.value
    });
  }

  function loadState() {
    chrome.storage.local.get(['targets', 'refs', 'fileType', 'viewMode', 'batchSize'], (data) => {
      if (data.targets) targetList.value = data.targets;
      if (data.refs) refList.value = data.refs;
      if (data.fileType) fileTypeSel.value = data.fileType;
      if (data.viewMode) viewModeSel.value = data.viewMode;
      if (data.batchSize) batchSizeSel.value = data.batchSize;
      updatePlaceholder();
    });
  }

  function updatePlaceholder() {
    const mode = fileTypeSel.value;
    if (mode === 'url') {
      targetLabel.textContent = 'Target URLs (direct links)';
      targetList.placeholder = 'https://rakuten.com/app-ads.txt\nhttps://www.voodoo.io/app-ads.txt\npicsart.com/app-ads.txt';
    } else {
      targetLabel.textContent = 'Target Websites';
      targetList.placeholder = 'example.com\nanother-site.com';
    }
  }

  targetList.addEventListener('input', saveState);
  refList.addEventListener('input', saveState);
  fileTypeSel.addEventListener('change', () => { saveState(); updatePlaceholder(); });
  viewModeSel.addEventListener('change', () => { saveState(); renderTable(); });
  batchSizeSel.addEventListener('change', saveState);

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeCSV(str) {
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return '"' + str + '"';
  }

  function isLikelyNotPlainText(content, contentType) {
    if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/csv')) {
      if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('application/xml')) {
        return true;
      }
    }
    const trimmed = content.trim().toLowerCase();
    if (trimmed.startsWith('<html') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<?xml')) {
      return true;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { JSON.parse(trimmed); return true; } catch (e) {}
    }
    const firstLines = trimmed.split('\n').slice(0, 5).join(' ');
    if (firstLines.includes('<head') || firstLines.includes('<body') || firstLines.includes('<meta') || firstLines.includes('<title')) {
      return true;
    }
    return false;
  }

  async function fetchWithRetry(url, retries = 3) {
    let lastError = null;
    for (let i = 0; i < retries; i++) {
      if (aborted) throw new Error('Aborted');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store', redirect: 'follow' });
        clearTimeout(timeoutId);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        return { text, contentType };
      } catch (e) {
        lastError = e;
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    throw lastError || new Error('Fetch failed');
  }

  function parseDomain(input) {
    let d = input.trim();
    d = d.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/[\/:?#].*$/, '');
    d = d.toLowerCase();
    if (!d || d.includes(' ')) return null;
    return d;
  }

  function buildUrlFromInput(input) {
    let url = input.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  function getDisplayName(input, mode) {
    if (mode === 'url') {
      return input.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
    return parseDomain(input) || input.trim();
  }

  async function processDirectUrl(rawUrl, references) {
    const url = buildUrlFromInput(rawUrl);
    const display = getDisplayName(rawUrl, 'url');

    if (!url) {
      references.forEach(ref => {
        globalResults.push({ target: display || rawUrl.trim(), reference: ref.original, status: "Error", details: "Invalid URL", owner: "", isError: true });
      });
      return;
    }

    let result = null;
    let error = "Unreachable";

    try {
      result = await fetchWithRetry(url);
    } catch (e) {
      if (/^https:\/\//i.test(url)) {
        try {
          result = await fetchWithRetry(url.replace(/^https:\/\//i, 'http://'));
        } catch (e2) {
          error = e2.message === 'Aborted' ? 'Aborted' : (e2.message.startsWith('HTTP') ? e2.message : "Connection Error");
        }
      } else {
        error = e.message === 'Aborted' ? 'Aborted' : (e.message.startsWith('HTTP') ? e.message : "Connection Error");
      }
    }

    if (result && isLikelyNotPlainText(result.text, result.contentType)) {
      result = null;
      error = "Soft 404 / Not a text file";
    }

    if (!result) {
      references.forEach(ref => {
        globalResults.push({ target: display, reference: ref.original, status: "Error", details: error, owner: "", isError: true });
      });
      return;
    }

    processFileContent(result.text, display, references);
  }

  async function processDomain(domain, filename, references) {
    const cleanDomain = parseDomain(domain);
    if (!cleanDomain) {
      references.forEach(ref => {
        globalResults.push({ target: domain, reference: ref.original, status: "Error", details: "Invalid domain", owner: "", isError: true });
      });
      return;
    }

    let result = null;
    let error = "Unreachable";

    try {
      result = await fetchWithRetry(`https://${cleanDomain}/${filename}`);
    } catch (e) {
      try {
        result = await fetchWithRetry(`http://${cleanDomain}/${filename}`);
      } catch (e2) {
        error = e2.message === 'Aborted' ? 'Aborted' : (e2.message.startsWith('HTTP') ? e2.message : "Connection Error");
      }
    }

    if (result && isLikelyNotPlainText(result.text, result.contentType)) {
      result = null;
      error = "Soft 404 / Not a text file";
    }

    if (!result) {
      references.forEach(ref => {
        globalResults.push({ target: cleanDomain, reference: ref.original, status: "Error", details: error, owner: "", isError: true });
      });
      return;
    }

    processFileContent(result.text, cleanDomain, references);
  }

  function processFileContent(content, targetDisplay, references) {
    const ownerMatch = content.match(/OWNERDOMAIN\s*=\s*([^\s#]+)/i);
    const managerMatch = content.match(/MANAGERDOMAIN\s*=\s*([^\s#]+)/i);
    const owner = ownerMatch ? ownerMatch[1].toLowerCase() : '';
    const manager = managerMatch ? managerMatch[1].toLowerCase() : '';
    const ownerDisplay = [owner ? `Owner: ${owner}` : '', manager ? `Manager: ${manager}` : ''].filter(Boolean).join(', ');

    const lines = content.split('\n').map(l => {
      const c = l.split('#')[0].trim().replace(/[\u200B-\u200D\uFEFF\r]/g, '');
      const p = c.split(',').map(s => s.trim());
      if (p.length >= 2 && p[0] && p[1]) {
        return {
          d: p[0].toLowerCase(),
          i: p[1].toLowerCase(),
          t: p[2] ? p[2].toUpperCase().replace(/[^A-Z]/g, '') : null,
          tagid: p[3] ? p[3].trim() : null
        };
      }
      return null;
    }).filter(Boolean);

    const seen = new Set();
    const duplicates = new Set();
    lines.forEach(l => {
      const key = `${l.d}|${l.i}|${l.t}`;
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    });

    references.forEach(ref => {
      const match = lines.find(l => l.d === ref.domain && l.i === ref.id);
      let res = { target: targetDisplay, reference: ref.original, status: "Not Found", details: "Missing", owner: ownerDisplay, isError: true };

      if (match) {
        const key = `${match.d}|${match.i}|${match.t}`;
        const isDuplicate = duplicates.has(key);
        if (!ref.type || match.t === ref.type) {
          res.status = "Valid";
          res.details = "Matched" + (isDuplicate ? " (duplicate in file)" : "");
          res.isError = false;
        } else {
          res.status = "Partial";
          res.details = `Type Mismatch: found ${match.t || 'NONE'}, expected ${ref.type}`;
          res.isError = true;
        }
      }
      globalResults.push(res);
    });
  }

  function updateStats() {
    const total = globalResults.length;
    const valid = globalResults.filter(r => r.status === 'Valid').length;
    const partial = globalResults.filter(r => r.status === 'Partial').length;
    const notFound = globalResults.filter(r => r.status === 'Not Found').length;
    const errors = globalResults.filter(r => r.status === 'Error').length;
    statsBar.innerHTML = `<span class="stat-total">Total: ${total}</span> | ` +
      `<span class="stat-valid">Valid: ${valid}</span> | ` +
      `<span class="stat-partial">Partial: ${partial}</span> | ` +
      `<span class="stat-missing">Missing: ${notFound}</span> | ` +
      `<span class="stat-error">Errors: ${errors}</span>`;
  }

  function renderTable() {
    tableBody.innerHTML = '';
    const onlyErrors = viewModeSel.value === 'errors';
    let visibleCount = 0;
    globalResults.forEach(row => {
      if (onlyErrors && !row.isError) return;
      visibleCount++;
      const tr = document.createElement('tr');
      const cls = row.status === 'Valid' ? 'status-valid' : row.status === 'Partial' ? 'status-partial' : 'status-error';
      tr.innerHTML = `<td>${escapeHtml(row.target)}</td><td>${escapeHtml(row.reference)}</td><td class="${cls}">${escapeHtml(row.status)}</td><td>${escapeHtml(row.details)}</td><td>${escapeHtml(row.owner)}</td>`;
      tableBody.appendChild(tr);
    });
    updateStats();
    if (globalResults.length > 0) {
      statusText.innerText = onlyErrors ? `Showing ${visibleCount} errors/warnings of ${globalResults.length} total` : `Showing all ${globalResults.length} results`;
    }
  }

  runBtn.addEventListener('click', async () => {
    const targets = targetList.value.split('\n').map(l => l.trim()).filter(l => l);
    const rawRefs = refList.value.split('\n').map(l => l.trim()).filter(l => l);
    const mode = fileTypeSel.value;

    if (targets.length === 0 || rawRefs.length === 0) {
      statusText.innerText = 'Please fill in both fields.';
      return;
    }

    const references = rawRefs.map(r => {
      const parts = r.split(',').map(p => p.trim().replace(/[\u200B-\u200D\uFEFF]/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { domain: parts[0].toLowerCase(), id: parts[1].toLowerCase(), type: parts[2] ? parts[2].toUpperCase().replace(/[^A-Z]/g, '') : null, original: r };
      }
      return null;
    }).filter(Boolean);

    if (references.length === 0) {
      statusText.innerText = 'No valid reference lines found. Format: domain, pubId, type';
      return;
    }

    aborted = false;
    runBtn.disabled = true;
    stopBtn.disabled = false;
    progressContainer.style.display = 'block';
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';
    tableBody.innerHTML = '';
    statsBar.innerHTML = '';
    globalResults = [];

    const BATCH_SIZE = parseInt(batchSizeSel.value, 10);
    const startTime = Date.now();

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      if (aborted) break;
      const batch = targets.slice(i, i + BATCH_SIZE);

      if (mode === 'url') {
        await Promise.all(batch.map(t => processDirectUrl(t, references)));
      } else {
        await Promise.all(batch.map(t => processDomain(t, mode, references)));
      }

      const done = Math.min(i + batch.length, targets.length);
      const percent = Math.round((done / targets.length) * 100);
      progressBar.style.width = `${percent}%`;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      statusText.innerText = `Processed: ${done} / ${targets.length} (${elapsed}s)`;
    }

    renderTable();
    runBtn.disabled = false;
    stopBtn.disabled = true;
    downloadBtn.style.display = 'inline-block';
    copyBtn.style.display = 'inline-block';

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    if (aborted) {
      statusText.innerText = `Stopped after ${globalResults.length} results (${totalTime}s)`;
    } else {
      statusText.innerText = `Done: ${globalResults.length} results in ${totalTime}s`;
    }
  });

  stopBtn.addEventListener('click', () => {
    aborted = true;
    stopBtn.disabled = true;
    statusText.innerText = 'Stopping...';
  });

  downloadBtn.addEventListener('click', () => {
    let csv = '\uFEFFTarget,Reference,Status,Details,Owner\n';
    globalResults.forEach(r => {
      csv += `${escapeCSV(r.target)},${escapeCSV(r.reference)},${escapeCSV(r.status)},${escapeCSV(r.details)},${escapeCSV(r.owner)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adstxt_report_${new Date().toISOString().slice(0, 10)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  copyBtn.addEventListener('click', () => {
    const lines = ['Target\tReference\tStatus\tDetails\tOwner'];
    globalResults.forEach(r => {
      lines.push(`${r.target}\t${r.reference}\t${r.status}\t${r.details}\t${r.owner}`);
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1500);
    });
  });

  viewModeSel.addEventListener('change', renderTable);
});