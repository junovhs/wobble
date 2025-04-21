// app.js
// tombstone: removed inline event listeners & global arrays from index.html

var matchedDeals = [];
var nonMatchedDeals = [];

document.getElementById("compareButton").addEventListener("click", function() {
  var hqText = document.getElementById("hqDeals").value;
  var jsonText = document.getElementById("jsonDeals").value;
  var threshold = parseInt(document.getElementById("matchThreshold").value, 10);

  var hqDealsArr = parseHQDeals(hqText);
  var jsonDealsArr = parseJSONDeals(jsonText);

  matchedDeals = [];
  nonMatchedDeals = [];

  var result = performMatching(hqDealsArr, jsonDealsArr, threshold);
  matchedDeals = result.matched;
  nonMatchedDeals = result.nonMatched;

  renderAll();
});

document.getElementById("copyButton").addEventListener("click", copyNonMatchedToClipboard);
document.getElementById("matchedFilter").addEventListener("input", renderMatchedDeals);
document.getElementById("nonMatchedFilter").addEventListener("input", renderNonMatchedDeals);