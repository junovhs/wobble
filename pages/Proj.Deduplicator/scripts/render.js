// tombstone: removed inline render functions and global arrays from index.html

// Highlight HQ & JSON text (dates, money, percent)
function highlightText(text) {
  let r = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  r = r.replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g,'<span class="expiry-date">$1</span>');
  r = r.replace(/(\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$\s*\d+(?:\.\d+)?)/g,'<span class="price-value">$1</span>');
  r = r.replace(/(\d+\s*%|\d+\s*percent)/gi,'<span class="percentage-value">$1</span>');
  return r;
}

function highlightTextJSON(text) {
  return highlightText(text); // same rules
}

// Filter matched deals
function filterDeals(deals, searchText) {
  if (!searchText) return deals;
  const terms = searchText.toLowerCase().split(/\s+/);
  return deals.filter(m=> terms.every(t=> (m.hqDeal.vendor+" "+m.hqDeal.text).toLowerCase().includes(t)));
}

// Filter non-matched deals
function filterNonMatched(deals, searchText) {
  if (!searchText) return deals;
  const terms = searchText.toLowerCase().split(/\s+/);
  return deals.filter(d=> terms.every(t=> (d.vendor+" "+d.text).toLowerCase().includes(t)));
}

// Render matched deals
function renderMatchedDeals() {
  const container = document.getElementById("matchedDealsContainer");
  const fb = document.getElementById("matchedFilter").value.trim();
  const list = filterDeals(matchedDeals, fb);
  document.getElementById("matchedCount").textContent = matchedDeals.length;
  container.innerHTML = list.length ? "" : "<div class='no-matches'>No matched deals found.</div>";

  list.forEach(match=>{
    const res = compareDealScore(match.hqDeal, match.jsonDeal);
    const row = document.createElement("div");
    row.className = res.dateFlag ? "matched-deal possible-date-change" : "matched-deal";

    const scoreDiv = document.createElement("div");
    scoreDiv.className="match-score"; 
    scoreDiv.textContent=match.isStrictMatch ? "✓" : match.score;
    if (match.isStrictMatch) {
      scoreDiv.style.backgroundColor = "#2ecc71"; // Green for strict matches
      scoreDiv.style.fontWeight = "bold";
      scoreDiv.title = "Perfect Match";
    }

    const left = document.createElement("div"); left.className="deal-info";
    if (match.isStrictMatch) {
      const s = document.createElement("span"); s.className="date-flag"; 
      s.style.backgroundColor = "#d5f5e3"; s.style.color = "#27ae60";
      s.textContent="PERFECT MATCH"; left.appendChild(s);
    }
    else if ((res.percentMatch||res.moneyMatch) && res.commonKW.length){
      const s = document.createElement("span"); s.className="date-flag"; s.textContent="SYNERGY"; left.appendChild(s);
    }
    if (res.dateFlag){
      const s = document.createElement("span"); s.className="date-flag";
      s.textContent = res.dateDiffDays<=5?"POSSIBLE DATE CHANGE":"DATE MISMATCH";
      left.appendChild(s);
    }
    if (res.flags.exclusiveFlag){
      const s = document.createElement("span"); s.className="exclusive-flag"; s.textContent="Exclusive listed on JSON";
      left.appendChild(s);
    }
    left.innerHTML += `<span class="deal-vendor">${match.hqDeal.vendor}:</span> `;
    let rendered = match.hqDeal.text.replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g,m=>{
      const info=extractAllDatesWithInfo(match.hqDeal.text).find(d=>d.raw===m);
      if (!info) return m;
      if (res.dateFlag && res.hqExp && info.ymd===res.hqExp.ymd){
        return `<span class="hq-date-mismatch">${info.display}<br><small>(${info.raw})</small></span>`;
      }
      return `<span class="expiry-date">${info.display}<br><small style="color:#aaa;">(${info.raw})</small></span>`;
    });
    res.commonKW && res.commonKW.forEach(kw=>{
      rendered = rendered.replace(new RegExp(`\\b(${kw})\\b`,"gi"),`<span class="keyword-flag">$1</span>`);
    });
    rendered = rendered.replace(/(\$\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,'<span class="price-value">$1</span>');
    rendered = rendered.replace(/(\d+\s*%|\d+\s*percent)/gi,'<span class="percentage-value">$1</span>');
    left.innerHTML += rendered;

    const right = document.createElement("div"); right.className="json-match";
    if (match.jsonDeal){
      right.innerHTML = `<strong>Vendor:</strong> ${match.jsonDeal.vendor}<br>
        <strong>Expiry:</strong> <span class="expiry-date">${match.jsonDeal.expiryDate?formatDate(new Date(match.jsonDeal.expiryDate)):"N/A"}</span><br>
        <strong>Title:</strong> ${highlightTextJSON(match.jsonDeal.title)}<br>
        <strong>Listing:</strong> ${highlightTextJSON(match.jsonDeal.shopListing)}`;
      if (res.flags.exclusiveFlag) right.innerHTML+=`<div style="margin-top:4px;"><span class="exclusive-flag">EXCLUSIVE</span> Present in JSON</div>`;
    } else {
      right.textContent="No JSON match details.";
    }

    const tooltip = document.createElement("div"); tooltip.className="tooltip"; tooltip.innerHTML="👁️";
    const tip = document.createElement("span"); tip.className="tooltiptext"; tip.innerHTML = match.reasons.join("<br>");
    tooltip.appendChild(tip);

    const btn = document.createElement("button"); btn.textContent="👎"; btn.title="Move to non-matched";
    btn.addEventListener("click",()=>{
      matchedDeals.splice(matchedDeals.indexOf(match),1);
      nonMatchedDeals.push(match.hqDeal);
      renderAll();
    });

    [scoreDiv,left,right,tooltip,btn].forEach(el=>row.appendChild(el));
    container.appendChild(row);
  });
}

// Render non-matched deals
function renderNonMatchedDeals() {
  const container = document.getElementById("nonMatchedDealsContainer");
  const fb = document.getElementById("nonMatchedFilter").value.trim();
  const list = filterNonMatched(nonMatchedDeals, fb);
  document.getElementById("nonMatchedCount").textContent = nonMatchedDeals.length;
  container.innerHTML = list.length ? "" : "<div class='no-matches'>No non-matched deals found.</div>";

  list.forEach(deal=>{
    const row = document.createElement("div"); row.className="non-matched-deal";
    const info = document.createElement("div"); info.className="deal-info";
    info.innerHTML = `<span class="deal-vendor">${deal.vendor}:</span> ${highlightText(deal.text)}`;
    const nearest = findClosestMatch(deal, _lastJSONDeals, _lastThreshold);
    if (nearest){
      const tip = document.createElement("div"); tip.className="tooltip"; tip.innerHTML="👁️";
      const tt = document.createElement("span"); tt.className="tooltiptext";
      tt.innerHTML = `<strong>Best Possible Match (Score: ${nearest.score}):</strong><br>
        <span style="color:#3498db"><b>Vendor:</b> ${nearest.jsonDeal.vendor}</span><br>
        ${nearest.jsonDeal.expiryDate?`<b>Expiry:</b> <span class="expiry-date">${formatDate(new Date(nearest.jsonDeal.expiryDate))}</span><br>`:""}
        <b>Title:</b> ${highlightTextJSON(nearest.jsonDeal.title)}<br>
        <b>Listing:</b> ${highlightTextJSON(nearest.jsonDeal.shopListing)}<hr style="margin:5px 0;">${nearest.reasons.map(r=>"• "+r).join("<br>")}`;
      tip.appendChild(tt); info.appendChild(tip);
    }
    const btn = document.createElement("button"); btn.textContent="👍"; btn.title="Move to matched";
    btn.addEventListener("click",()=>{
      nonMatchedDeals.splice(nonMatchedDeals.indexOf(deal),1);
      matchedDeals.push({ hqDeal: deal, jsonDeal: null, score: 0, jsonIndex: null, reasons:["Manually matched"] });
      renderAll();
    });
    row.appendChild(info); row.appendChild(btn);
    container.appendChild(row);
  });
}

// Render both lists
function renderAll() {
  renderMatchedDeals();
  renderNonMatchedDeals();
}

// Copy non-matched back to clipboard
function copyNonMatchedToClipboard() {
  const groups = {};
  nonMatchedDeals.forEach(d=>{
    groups[d.vendor] = groups[d.vendor]||[];
    groups[d.vendor].push(d.original);
  });
  let out = "";
  for (let v in groups){
    out += `v\t${v}:\n` + groups[v].map(line=>line+"\n").join("");
  }
  navigator.clipboard.writeText(out).then(()=>alert("Copied!"),()=>alert("Copy failed."));
}