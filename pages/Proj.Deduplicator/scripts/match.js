// match.js
// tombstone: removed inline match and scoring functions from index.html

// Remember last inputs for non-matched hover
let _lastHQDeals = [], _lastJSONDeals = [], _lastThreshold = 150;

// Extract all numeric values from text (money, percentages, special numbers)
function extractAllNumbers(text) {
  return [
    ...extractMoneyValues(text),
    ...extractPercentageValues(text),
    ...extractSpecialNumericAll(text)
  ].sort((a,b) => a-b);
}

// Extract deal category keywords
function extractDealCategories(text) {
  const t = text.toLowerCase();
  const cats = [];
  if (/\bonboard credit\b|\bon[-\s]?board credit\b|\bobc\b|\bdining credit\b/i.test(t)) cats.push("obc");
  if (/\bgratuities?\b|\bpre[-\s]?paid gratuities\b|\bppg\b/i.test(t)) cats.push("gratuities");
  if (/\b(second|2nd)\s+guest\b/i.test(t)) cats.push("second-guest");
  if (/\bkids?\b|\bchild\b|\bchildren\b|\b3rd guest\b|\b4th guest\b/i.test(t)) cats.push("kids");
  if (/\bdining\b/i.test(t)) cats.push("dining");
  if (/\bfree\b|\bcomplimentary\b|\bcomplementary\b/i.test(t)) cats.push("free");
  if (/\bsail\s+free\b/i.test(t)) cats.push("sail-free");
  if (/\bdiscount\b/i.test(t)) cats.push("discount");
  if (/\bnrd\b/i.test(t)) cats.push("nrd");
  if (/\bdeposit\b/i.test(t)) cats.push("deposit");
  if (/\bfare\b/i.test(t)) cats.push("fare");
  return [...new Set(cats)];
}

// Check if dates match exactly
function sameExpiry(hqText, jsonDateStr) {
  const hq = extractNormalizedExpiry(hqText);
  const js = normalizeJSONExpiry(jsonDateStr);
  return hq && js && hq.ymd === js.ymd;
}

// Strict matching using exact number+category+date matching
function strictMatch(hqDeal, jsonDeal) {
  // Must have same vendor
  if (hqDeal.vendor !== jsonDeal.vendor) return false;
  
  const jsAllText = `${jsonDeal.title} ${jsonDeal.shopListing}`.trim();
  
  // 1. Check numbers match exactly
  const numsHQ = extractAllNumbers(hqDeal.text);
  const numsJS = extractAllNumbers(jsAllText);
  
  // If we have numbers on both sides, they must match
  if (numsHQ.length > 0 && numsJS.length > 0) {
    if (numsHQ.length !== numsJS.length || 
        !numsHQ.every((n,i) => Math.abs(n - numsJS[i]) < 0.01)) {
      return false;
    }
  }
  
  // 2. Check deal categories match
  const catHQ = extractDealCategories(hqDeal.text);
  const catJS = extractDealCategories(jsAllText);
  
  // Must have at least one category in common
  if (catHQ.length > 0 && catJS.length > 0) {
    if (!catHQ.some(c => catJS.includes(c))) {
      return false;
    }
  } else {
    // If no categories found, don't match through strict mode
    return false;
  }
  
  // 3. Check expiry date matches (either exact match or no date in one)
  if (jsonDeal.expiryDate) {
    if (!sameExpiry(hqDeal.text, jsonDeal.expiryDate)) {
      return false;
    }
  }
  
  // All criteria met!
  return true;
}

// Compare HQ vs JSON deal and compute a score + reasons + flags
function compareDealScore(hqDeal, jsonDeal) {
  if (hqDeal.vendor !== jsonDeal.vendor) {
    return { score: 0, reasons: ["Vendor mismatch"], flags: {} };
  }
  let reasons = [], score = 0, flags = {};
  reasons.push(`Vendor: ${hqDeal.vendor} (required)`);

  const jsAllText = `${jsonDeal.title} ${jsonDeal.shopListing}`.trim();
  const hqExp = extractNormalizedExpiry(hqDeal.text);
  const jsExp = normalizeJSONExpiry(jsonDeal.expiryDate);
  const hqPerc = extractPercentageValues(hqDeal.text);
  const jsPerc = extractPercentageValues(jsAllText);
  const hqMoney = extractMoneyValues(hqDeal.text);
  const jsMoney = extractMoneyValues(jsAllText);
  const hqSpecials = extractSpecialNumericAll(hqDeal.text);
  const jsSpecials = extractSpecialNumericAll(jsAllText);
  const hqOBC = hasOBC(hqDeal.text), jsOBC = hasOBC(jsAllText);
  const hqGrat = hasGratuity(hqDeal.text), jsGrat = hasGratuity(jsAllText);
  const hqKids = hasKids(hqDeal.text), jsKids = hasKids(jsAllText);

  function arraysEqual(a,b){
    if (a.length!==b.length) return false;
    let A=a.slice().sort(), B=b.slice().sort();
    for (let i=0;i<A.length;i++) {
      // Use strict equality for monetary/percent (so $200 ≠ $2000)
      if (A[i] !== B[i]) return false;
    }
    return true;
  }

  // Helper function for fuzzy money comparison with tolerance
  function moneyArraysEqual(a, b, tolerance = 0.01) {
    if (a.length !== b.length) return false;
    const aSort = a.slice().sort((x, y) => x - y);
    const bSort = b.slice().sort((x, y) => x - y);
    for (let i = 0; i < aSort.length; i++) {
      if (Math.abs(aSort[i] - bSort[i]) > tolerance) {
        return false;
      }
    }
    return true;
  }

  let reject = false;
  // --- strict numeric match enforcement (except money) ---
  if ((hqPerc.length > 0 || jsPerc.length > 0)) {
    if (!arraysEqual(hqPerc, jsPerc)) {
      reasons.push("Percentage value mismatch - automatic rejection");
      reject = true;
    }
  }
  if (hqSpecials.length>0&&jsSpecials.length>0&&!arraysEqual(hqSpecials,jsSpecials)) {
    reasons.push("Special numeric value mismatch - automatic rejection"); reject = true;
  }
  // OBC specific match must agree
  if ((hqOBC||jsOBC) && !(hqOBC&&jsOBC)) { reasons.push("OBC term mismatch - automatic rejection"); reject = true; }
  if ((hqGrat||jsGrat) && !(hqGrat&&jsGrat)) { reasons.push("Gratuity term mismatch - automatic rejection"); reject = true; }
  if ((hqKids||jsKids) && !(hqKids&&jsKids)) { reasons.push("Kids term mismatch - automatic rejection"); reject = true; }
  if (reject) return { score: 0, reasons, flags: {} };

  // Special numeric
  if (hqSpecials.length||jsSpecials.length) {
    if (arraysEqual(hqSpecials,jsSpecials)) {
      score+=60; reasons.push("Special numeric match (+60)");
    }
  }
  // Percent
  if (hqPerc.length||jsPerc.length) {
    if (arraysEqual(hqPerc,jsPerc)) {
      score+=60; reasons.push("Percentage match (+60)");
    }
  }
  // Money - scored instead of auto-rejected
  if (hqMoney.length||jsMoney.length) {
    // Try exact match first
    if (arraysEqual(hqMoney.map(x=>x.toFixed(2)), jsMoney.map(x=>x.toFixed(2)))) {
      score+=60; 
      reasons.push(`Money match: $${hqMoney.map(x=>x.toFixed(2)).join(', $')} (+60)`);
    } 
    // Then try fuzzy match with small tolerance
    else if (moneyArraysEqual(hqMoney, jsMoney, 0.01)) {
      score+=55; 
      reasons.push(`Money match (with tolerance): $${hqMoney.map(x=>x.toFixed(2)).join(', $')} (+55)`);
    } 
    else {
      // Don't auto-reject, just note the mismatch and subtract points
      reasons.push(`Money mismatch: HQ $${hqMoney.map(x=>x.toFixed(2)).join(', $')} vs JSON $${jsMoney.map(x=>x.toFixed(2)).join(', $')}`);
      score = Math.max(0, score - 15);
    }
  }
  // Half-off synonyms (should remain after numeric is removed from keyword)
  if (isHalfOffDeal(hqDeal.text) && isHalfOffDeal(jsAllText)) {
    score+=60; reasons.push('"Half off"/50% match (+60)');
  }
  // OBC/gratuity/kids presence
  if (hqOBC&&jsOBC) { score+=35; reasons.push("OBC present (+35)"); }
  if (hqGrat&&jsGrat) { score+=35; reasons.push("Gratuities present (+35)"); }
  if (hqKids&&jsKids) { score+=35; reasons.push("Kids present (+35)"); }

  // --- Keyword overlap ---
  // Money values can be slightly mismatched and we'll still consider keywords
  let kwsHQ = extractNormalizedKeywords(hqDeal.text,{noExclusive:true});
  let kwsJS = extractNormalizedKeywords(jsAllText,{noExclusive:true});
  let commonKW = keywordSetOverlap(kwsHQ, kwsJS);
  
  if (commonKW.length) {
    score += commonKW.length*15;
    reasons.push(`${commonKW.length} keyword(s) match (+${commonKW.length*15})`);
  }
  
  // 24/48 hour/limited time logic is handled in normalization -> synonym mapping.
  if (commonKW.includes("limited time")) {
    score+=16;
    reasons.push('Limited time/24/48-hour match (+16)');
  }

  // Synergy: numeric+keyword (if both matched non-empty numeric and at least one keyword)
  const hasNumeric = (hqMoney.length && jsMoney.length) || 
                     (hqPerc.length && jsPerc.length) || 
                     (hqSpecials.length && jsSpecials.length);
  if (hasNumeric && commonKW.length) {
    score+=25; reasons.push("Synergy bonus: numeric+keyword (+25)");
  }

  // Date logic
  if (hqExp && jsExp) {
    const diff = Math.round(Math.abs(hqExp.dateObj - jsExp.dateObj)/(1000*60*60*24));
    if (hqExp.ymd===jsExp.ymd) {
      score+=50; reasons.push("Exact date match (+50)");
    } else if (diff<=5) {
      score+=22; flags.dateFlag=true; reasons.push(`Date within 5 days (+22)`);
    } else {
      flags.dateFlag=true; reasons.push("Date mismatch");
    }
  }

  // High-confidence synergy of value+date+keyword
  if ((hqPerc.length||hqMoney.length) && hqExp && jsExp && hqExp.ymd===jsExp.ymd && commonKW.length) {
    score+=60; flags.highConfidence=true; reasons.push("All-match synergy (+60)");
  }

  // Exclusive note
  flags.exclusiveFlag = exclusiveFlag(hqDeal.text, jsAllText);

  score = Math.max(0, Math.min(score, 510));
  return { score, reasons, flags, commonKW, percentMatch: !!hqPerc.length, moneyMatch: !!hqMoney.length, dateFlag: !!flags.dateFlag, dateDiffDays: hqExp&&jsExp?Math.round(Math.abs(hqExp.dateObj-jsExp.dateObj)/(1000*60*60*24)):null, hqExp };
}

// Perform full matching and enforce unique assignment
function performMatching(hqDeals, jsonDeals, threshold) {
  _lastHQDeals = hqDeals;
  _lastJSONDeals = jsonDeals;
  _lastThreshold = threshold;
  const candidate = [], nonMatched = [];

  hqDeals.forEach(hq => {
    let best = {score: 0}, idx = null, isStrictMatch = false;
    
    jsonDeals.forEach((js, i) => {
      // First try strict matching - follows user's manual matching logic
      if (strictMatch(hq, js)) {
        best = { 
          score: threshold + 100, // Higher than threshold
          reasons: ["Strict match: exact numbers, categories and dates"],
          jsonDeal: js
        };
        idx = i;
        isStrictMatch = true;
        return; // Break early if strict match found
      }
      
      // Fall back to regular scoring if no strict match
      if (!isStrictMatch) {
        const res = compareDealScore(hq, js);
        if (res.score > best.score) {
          best = res;
          idx = i;
          best.jsonDeal = js;
        }
      }
    });
    
    if (best.score >= threshold) {
      candidate.push({ 
        hqDeal: hq, 
        jsonDeal: best.jsonDeal, 
        score: best.score, 
        jsonIndex: idx, 
        reasons: best.reasons,
        isStrictMatch: isStrictMatch
      });
    } else {
      nonMatched.push(hq);
    }
  });

  const unique = {};
  candidate.forEach(c => {
    const i = c.jsonIndex;
    // Strict matches always win
    if (c.isStrictMatch && (!unique[i] || !unique[i].isStrictMatch)) {
      unique[i] = c;
    }
    // Otherwise highest score wins
    else if (!unique[i] || c.score > unique[i].score) {
      unique[i] = c;
    }
  });
  
  candidate.forEach(c => { 
    if (unique[c.jsonIndex] !== c) nonMatched.push(c.hqDeal); 
  });
  
  return { matched: Object.values(unique), nonMatched };
}

// Find closest match below threshold (for hover)
function findClosestMatch(hqDeal, jsonDeals, minThreshold) {
  let best={score:0}, idx=null;
  jsonDeals.forEach((js,i)=>{
    const res = compareDealScore(hqDeal, js);
    if (res.score>best.score){ best=res; idx=i; best.jsonDeal=js; }
  });
  return best.score>0&&best.score<minThreshold ? best : null;
}