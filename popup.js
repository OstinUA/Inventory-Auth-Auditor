document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('runBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const targetList = document.getElementById('targetList');
  const refList = document.getElementById('refList');
  const fileTypeSel = document.getElementById('fileType');
  const viewModeSel = document.getElementById('viewMode');
  const statusText = document.getElementById('statusText');
  const tableBody = document.querySelector('#resultsTable tbody');

  let globalResults = [];

  runBtn.addEventListener('click', async () => {
    const targets = targetList.value.split('\n').map(l => l.trim()).filter(l => l);
    const rawRefs = refList.value.split('\n').map(l => l.trim()).filter(l => l);

    if (targets.length === 0 || rawRefs.length === 0) {
      statusText.innerText = "Please fill both Target Websites and Reference Lines.";
      return;
    }

    const references = [];
    for (const r of rawRefs) {
      const parts = r.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        references.push({
          domain: parts[0].toLowerCase(),
          id: parts[1].toLowerCase(),
          type: parts.length > 2 ? parts[2].toUpperCase() : null,
          original: r
        });
      }
    }

    if (references.length === 0) {
      statusText.innerText = "No valid reference lines parsed.";
      return;
    }

    runBtn.disabled = true;
    runBtn.innerText = "Processing...";
    downloadBtn.style.display = 'none';
    tableBody.innerHTML = '';
    globalResults = [];
    
    const fileType = fileTypeSel.value;
    const batchSize = 5;
    let completed = 0;

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await Promise.all(batch.map(target => processDomain(target, fileType, references)));
      
      completed += batch.length;
      if (completed > targets.length) completed = targets.length;
      statusText.innerText = `Processed: ${completed} / ${targets.length}`;
    }

    renderTable();
    runBtn.disabled = false;
    runBtn.innerText = "Start Validation";
    downloadBtn.style.display = 'block';
    statusText.innerText = "Validation Completed.";
  });

  viewModeSel.addEventListener('change', renderTable);

  async function processDomain(domain, filename, references) {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').split('/')[0];
    
    const urls = [
      `https://${cleanDomain}/${filename}`,
      `http://${cleanDomain}/${filename}`
    ];

    let content = null;
    let errorMsg = null;

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(id);

        if (res.status === 200) {
          const text = await res.text();
          if (text.trim().toLowerCase().startsWith('<html') || text.toLowerCase().includes('<!doctype')) {
            errorMsg = "HTML Page returned (Soft 404)";
            continue;
          }
          content = text;
          break; 
        } else {
          errorMsg = `HTTP ${res.status}`;
        }
      } catch (e) {
        errorMsg = "Connection Error";
      }
    }

    if (!content) {
      references.forEach(ref => {
        globalResults.push({
          target: cleanDomain,
          reference: ref.original,
          status: "Error",
          details: errorMsg || "Unreachable",
          isError: true
        });
      });
      return;
    }

    const fetchedLines = parseFileContent(content);

    references.forEach(ref => {
      let status = "Not Found";
      let details = "No Domain+ID match";
      let isError = true; 

      const match = fetchedLines.find(l => l.domain === ref.domain && l.id === ref.id);

      if (match) {
        if (!ref.type) {
          status = "Valid";
          details = "Matched (Domain+ID)";
          isError = false;
        } else if (match.type === ref.type) {
          status = "Valid";
          details = "Full Match";
          isError = false;
        } else {
          status = "Partial";
          details = `Type mismatch: Found ${match.type}, Expected ${ref.type}`;
        }
      }

      globalResults.push({
        target: cleanDomain,
        reference: ref.original,
        status: status,
        details: details,
        isError: isError || status === "Partial"
      });
    });
  }

  function parseFileContent(text) {
    const lines = text.split('\n');
    const parsed = [];
    for (const line of lines) {
      const clean = line.split('#')[0].trim();
      if (!clean) continue;
      const parts = clean.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        parsed.push({
          domain: parts[0].toLowerCase(),
          id: parts[1].toLowerCase(),
          type: parts.length > 2 ? parts[2].toUpperCase().replace(/[^A-Z]/g, '') : null
        });
      }
    }
    return parsed;
  }

  function renderTable() {
    tableBody.innerHTML = '';
    const viewAll = viewModeSel.value === 'all';

    globalResults.forEach(row => {
      if (!viewAll && !row.isError) return;

      const tr = document.createElement('tr');
      
      let statusClass = "";
      if (row.status === "Valid") statusClass = "status-valid";
      else if (row.status === "Partial") statusClass = "status-partial";
      else if (row.status === "Error") statusClass = "status-error";
      else statusClass = "status-missing";

      tr.innerHTML = `
        <td>${row.target}</td>
        <td>${row.reference}</td>
        <td class="${statusClass}">${row.status}</td>
        <td>${row.details}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  downloadBtn.addEventListener('click', () => {
    let csv = "Target Domain,Reference Line,Result,Details\n";
    globalResults.forEach(row => {
      csv += `${row.target},"${row.reference.replace(/"/g, '""')}",${row.status},${row.details}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation_report.csv';
    a.click();
  });
});