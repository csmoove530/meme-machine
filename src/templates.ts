import type { OverlaidMeme } from './overlay';

interface TopicGroup {
  name: string;
  memes: { meme: OverlaidMeme; imageUrl: string }[];
}

export function buildDashboardHtml(
  topics: TopicGroup[],
  date: string,
  totalCost: number,
  shareUrl: string,
): string {
  let memeId = 0;
  const memeData: {
    id: number; url: string; title: string; caption: string; topic: string;
    storySummary: string; memeRationale: string; sourceArticle: string; sourceUrl: string;
  }[] = [];

  const topicSections = topics.map(topic => {
    const firstMeme = topic.memes[0]?.meme;
    const cards = topic.memes.map(({ meme, imageUrl }) => {
      memeId++;
      const caption = `${meme.concept.topText} / ${meme.concept.bottomText}`;
      memeData.push({
        id: memeId, url: imageUrl, title: `Meme ${memeId}`, caption, topic: topic.name,
        storySummary: '', memeRationale: '', sourceArticle: '', sourceUrl: '',
      });
      return memeId;
    });
    return {
      name: topic.name,
      memeIds: cards,
      formatDescription: firstMeme?.concept.formatDescription || firstMeme?.concept.storySummary || '',
      whyItsFunny: firstMeme?.concept.whyItsFunny || firstMeme?.concept.memeRationale || '',
    };
  });

  // Build the meme data JSON safely (no innerHTML)
  const memesJson = JSON.stringify(memeData);
  const topicsJson = JSON.stringify(topicSections);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meme Machine — ${date}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
  header{text-align:center;padding:40px 20px 20px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-bottom:3px solid #e94560}
  header h1{font-size:2.4rem;background:linear-gradient(90deg,#e94560,#0f3460,#e94560);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s ease-in-out infinite}
  @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
  header p{color:#aaa;margin-top:8px}
  .date-badge{display:inline-block;background:#e94560;color:#fff;padding:4px 16px;border-radius:20px;font-size:0.85rem;font-weight:700;margin-top:12px}
  .topic-section{max-width:1200px;margin:32px auto;padding:0 32px}
  .topic-title{font-size:1.3rem;color:#e94560;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #2a2a4a}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:32px}
  .card{background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a4a;transition:transform 0.2s,box-shadow 0.2s}
  .card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(233,69,96,0.15)}
  .card img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
  .card-body{padding:16px}
  .card-body h3{font-size:0.9rem;color:#e94560;margin-bottom:4px}
  .card-body .caption{font-size:0.8rem;color:#888;margin-bottom:8px}
  .card-body .story-context{font-size:0.75rem;color:#999;margin-bottom:8px;line-height:1.4;padding:8px 10px;background:#0f0f1f;border-radius:8px;border-left:3px solid #e94560}
  .card-body .story-context .story-label{color:#e94560;font-weight:700;font-size:0.7rem;text-transform:uppercase;margin-bottom:4px}
  .card-body .story-context .rationale{color:#aaa;font-style:italic;margin-top:4px}
  .card-body .source-link{font-size:0.7rem;color:#666;text-decoration:none;margin-bottom:10px;display:inline-block}
  .card-body .source-link:hover{color:#e94560}
  .rating-section{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .rating-section label{font-size:0.8rem;color:#ccc}
  .rating-buttons{display:flex;gap:3px}
  .rating-buttons button{width:28px;height:28px;border:1px solid #3a3a5a;background:#0a0a1a;color:#888;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;transition:all 0.15s}
  .rating-buttons button:hover,.rating-buttons button.selected{background:#e94560;color:#fff;border-color:#e94560}
  .score-display{font-size:1.2rem;font-weight:700;color:#e94560;min-width:40px;text-align:center;opacity:0;transition:opacity 0.3s}
  .score-display.visible{opacity:1}
  .summary{max-width:1200px;margin:0 auto 24px;padding:0 32px}
  .summary-box{background:#1a1a2e;border-radius:16px;padding:24px;border:1px solid #2a2a4a;display:none}
  .summary-box.visible{display:block}
  .summary-box h2{color:#e94560;margin-bottom:16px}
  .summary-bar{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .summary-bar .bar-label{width:100px;font-size:0.8rem;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .summary-bar .bar-track{flex:1;height:20px;background:#0a0a1a;border-radius:10px;overflow:hidden}
  .summary-bar .bar-fill{height:100%;background:linear-gradient(90deg,#e94560,#ff6b6b);border-radius:10px;transition:width 0.5s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:0.7rem;font-weight:700}
  .winner-badge{display:inline-block;background:#e94560;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.65rem;font-weight:700;margin-left:4px}
  .actions{max-width:1200px;margin:0 auto;padding:0 32px 24px;display:none;gap:12px}
  .actions.visible{display:flex;flex-wrap:wrap}
  .action-btn{padding:10px 20px;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:all 0.2s}
  .action-btn.primary{background:linear-gradient(135deg,#e94560,#ff6b6b);color:#fff}
  .action-btn.primary:hover{transform:scale(1.03);box-shadow:0 4px 20px rgba(233,69,96,0.4)}
  .action-btn.secondary{background:#2a2a4a;color:#ccc;border:1px solid #3a3a5a}
  .action-btn.secondary:hover{background:#3a3a5a;color:#fff}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:#1a1a2e;color:#e94560;border:1px solid #e94560;padding:12px 24px;border-radius:12px;font-weight:600;font-size:0.9rem;transition:transform 0.3s ease;z-index:100}
  .toast.show{transform:translateX(-50%) translateY(0)}
  footer{text-align:center;padding:24px;color:#444;font-size:0.75rem}
  footer span{color:#e94560}
</style>
</head>
<body>
<header>
  <h1>Meme Machine</h1>
  <p>Daily AI-generated memes — rate your favorites</p>
  <div class="date-badge">${date}</div>
</header>

<div id="content"></div>

<div class="summary">
  <div class="summary-box" id="summary">
    <h2>Leaderboard</h2>
    <div id="summary-bars"></div>
  </div>
</div>

<div class="actions" id="actions">
  <button class="action-btn primary" id="save-btn">Save Ratings to Meme Lord</button>
  <button class="action-btn secondary" id="share-btn">Copy Share Link</button>
</div>

<div class="toast" id="toast"></div>

<footer>
  Generated by <span>Meme Machine</span> via Visa CLI + fal.ai + ImageMagick
  &mdash; Total cost: $${totalCost.toFixed(2)}
</footer>

<script>
var memes = ${memesJson};
var topicSections = ${topicsJson};
var ratings = {};
var formatRatings = {};
var totalMemes = memes.length;

function buildUI() {
  var content = document.getElementById('content');
  topicSections.forEach(function(topic, topicIdx) {
    var section = document.createElement('div');
    section.className = 'topic-section';
    var title = document.createElement('h2');
    title.className = 'topic-title';
    title.textContent = topic.name;
    section.appendChild(title);
    if (topic.formatDescription) {
      var ctx = document.createElement('div');
      ctx.className = 'story-context';
      var lbl2 = document.createElement('div');
      lbl2.className = 'story-label';
      lbl2.textContent = 'Format';
      ctx.appendChild(lbl2);
      var summary = document.createElement('div');
      summary.textContent = topic.formatDescription;
      ctx.appendChild(summary);
      if (topic.whyItsFunny) {
        var rat = document.createElement('div');
        rat.className = 'rationale';
        rat.textContent = topic.whyItsFunny;
        ctx.appendChild(rat);
      }
      section.appendChild(ctx);
    }
    // Format rating
    var formatRating = document.createElement('div');
    formatRating.className = 'rating-section';
    formatRating.style.marginBottom = '16px';
    var fLbl = document.createElement('label');
    fLbl.textContent = 'Rate this format:';
    fLbl.style.fontWeight = '700';
    formatRating.appendChild(fLbl);
    var fBtns = document.createElement('div');
    fBtns.className = 'rating-buttons';
    fBtns.id = 'format-buttons-' + topicIdx;
    for (var fn = 1; fn <= 10; fn++) {
      var fBtn = document.createElement('button');
      fBtn.textContent = fn;
      fBtn.dataset.format = topicIdx;
      fBtn.dataset.score = fn;
      fBtn.addEventListener('click', handleFormatRating);
      fBtns.appendChild(fBtn);
    }
    formatRating.appendChild(fBtns);
    var fDisp = document.createElement('div');
    fDisp.className = 'score-display';
    fDisp.id = 'format-score-' + topicIdx;
    formatRating.appendChild(fDisp);
    section.appendChild(formatRating);
    var grid = document.createElement('div');
    grid.className = 'grid';
    topic.memeIds.forEach(function(mid) {
      var meme = memes.find(function(m) { return m.id === mid; });
      if (!meme) return;
      var card = document.createElement('div');
      card.className = 'card';
      var img = document.createElement('img');
      img.src = meme.url;
      img.alt = meme.title;
      img.loading = 'lazy';
      card.appendChild(img);
      var body = document.createElement('div');
      body.className = 'card-body';
      var h3 = document.createElement('h3');
      h3.textContent = meme.title;
      body.appendChild(h3);
      var cap = document.createElement('p');
      cap.className = 'caption';
      cap.textContent = meme.caption;
      body.appendChild(cap);
      var rs = document.createElement('div');
      rs.className = 'rating-section';
      var lbl = document.createElement('label');
      lbl.textContent = 'Rate:';
      rs.appendChild(lbl);
      var btns = document.createElement('div');
      btns.className = 'rating-buttons';
      btns.id = 'buttons-' + meme.id;
      for (var n = 1; n <= 10; n++) {
        var btn = document.createElement('button');
        btn.textContent = n;
        btn.dataset.meme = meme.id;
        btn.dataset.score = n;
        btn.addEventListener('click', handleRating);
        btns.appendChild(btn);
      }
      rs.appendChild(btns);
      var sd = document.createElement('div');
      sd.className = 'score-display';
      sd.id = 'score-' + meme.id;
      rs.appendChild(sd);
      body.appendChild(rs);
      card.appendChild(body);
      grid.appendChild(card);
    });
    section.appendChild(grid);
    content.appendChild(section);
  });
}

function persistRatings() {
  try {
    localStorage.setItem('meme-machine-ratings-${date}', JSON.stringify({
      date: '${date}',
      ratings: ratings,
      formatRatings: formatRatings,
      memes: memes.map(function(m) {
        return { id: m.id, caption: m.caption, topic: m.topic, score: ratings[m.id] || null };
      }),
      formats: topicSections.map(function(t, idx) {
        return { name: t.name, score: formatRatings[idx] || null };
      })
    }));
  } catch(e) { /* localStorage unavailable */ }
}

function loadPersistedRatings() {
  try {
    var saved = localStorage.getItem('meme-machine-ratings-${date}');
    if (!saved) return;
    var data = JSON.parse(saved);
    if (data.ratings) {
      Object.keys(data.ratings).forEach(function(mid) {
        ratings[parseInt(mid)] = data.ratings[mid];
        var score = data.ratings[mid];
        document.querySelectorAll('#buttons-' + mid + ' button').forEach(function(b) {
          parseInt(b.dataset.score) <= score ? b.classList.add('selected') : b.classList.remove('selected');
        });
        var disp = document.getElementById('score-' + mid);
        if (disp) { disp.textContent = score + '/10'; disp.classList.add('visible'); }
      });
    }
    if (data.formatRatings) {
      Object.keys(data.formatRatings).forEach(function(fid) {
        formatRatings[parseInt(fid)] = data.formatRatings[fid];
        var score = data.formatRatings[fid];
        document.querySelectorAll('#format-buttons-' + fid + ' button').forEach(function(b) {
          parseInt(b.dataset.score) <= score ? b.classList.add('selected') : b.classList.remove('selected');
        });
        var disp = document.getElementById('format-score-' + fid);
        if (disp) { disp.textContent = score + '/10'; disp.classList.add('visible'); }
      });
    }
    updateSummary();
  } catch(e) { /* localStorage unavailable */ }
}

function handleFormatRating(e) {
  var btn = e.currentTarget;
  var fid = parseInt(btn.dataset.format);
  var score = parseInt(btn.dataset.score);
  formatRatings[fid] = score;
  document.querySelectorAll('#format-buttons-' + fid + ' button').forEach(function(b) {
    parseInt(b.dataset.score) <= score ? b.classList.add('selected') : b.classList.remove('selected');
  });
  var disp = document.getElementById('format-score-' + fid);
  disp.textContent = score + '/10';
  disp.classList.add('visible');
  persistRatings();
  updateSummary();
}

function handleRating(e) {
  var btn = e.currentTarget;
  var mid = parseInt(btn.dataset.meme);
  var score = parseInt(btn.dataset.score);
  ratings[mid] = score;
  document.querySelectorAll('#buttons-' + mid + ' button').forEach(function(b) {
    parseInt(b.dataset.score) <= score ? b.classList.add('selected') : b.classList.remove('selected');
  });
  var disp = document.getElementById('score-' + mid);
  disp.textContent = score + '/10';
  disp.classList.add('visible');
  persistRatings();
  updateSummary();
}

function updateSummary() {
  var keys = Object.keys(ratings);
  if (!keys.length) return;
  document.getElementById('summary').classList.add('visible');
  document.getElementById('actions').classList.add('visible');
  var bars = document.getElementById('summary-bars');
  while (bars.firstChild) bars.removeChild(bars.firstChild);
  var maxScore = Math.max.apply(null, Object.values(ratings));
  var allRated = keys.length === totalMemes;
  memes.forEach(function(m) {
    var s = ratings[m.id] || 0;
    if (!s) return;
    var bar = document.createElement('div');
    bar.className = 'summary-bar';
    var label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = m.caption.split('/')[0].trim();
    if (s === maxScore && allRated) {
      var badge = document.createElement('span');
      badge.className = 'winner-badge';
      badge.textContent = 'WINNER';
      label.appendChild(badge);
    }
    bar.appendChild(label);
    var track = document.createElement('div');
    track.className = 'bar-track';
    var fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = (s * 10) + '%';
    fill.textContent = s + '/10';
    track.appendChild(fill);
    bar.appendChild(track);
    bars.appendChild(bar);
  });
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

document.getElementById('save-btn').addEventListener('click', function() {
  var lines = ['## Meme Machine Ratings — ${date}', ''];
  // Format ratings
  lines.push('### Format Ratings');
  topicSections.forEach(function(t, idx) {
    var fs = formatRatings[idx] || 'not rated';
    lines.push('- **' + t.name + '**: ' + fs + '/10');
  });
  lines.push('');
  // Meme ratings
  lines.push('### Individual Meme Ratings');
  var ranked = memes.filter(function(m) { return ratings[m.id]; })
    .sort(function(a, b) { return (ratings[b.id] || 0) - (ratings[a.id] || 0); });
  ranked.forEach(function(m, i) {
    lines.push((i+1) + '. **' + m.caption + '** — ' + ratings[m.id] + '/10 (' + m.topic + ')');
  });
  lines.push('');
  // Key learnings for meme-lord skill
  lines.push('### Learnings');
  var best = ranked.filter(function(m) { return ratings[m.id] >= 7; });
  var worst = ranked.filter(function(m) { return ratings[m.id] <= 3; });
  if (best.length) {
    lines.push('**What worked:** ' + best.map(function(m) { return '"' + m.caption + '" (' + ratings[m.id] + '/10, ' + m.topic + ')'; }).join(', '));
  }
  if (worst.length) {
    lines.push('**What flopped:** ' + worst.map(function(m) { return '"' + m.caption + '" (' + ratings[m.id] + '/10, ' + m.topic + ')'; }).join(', '));
  }
  var ratingText = lines.join('\\n');
  navigator.clipboard.writeText(ratingText).then(function() {
    showToast('Ratings copied! Paste into skills/meme-lord/SKILL.md to train the Meme Lord.');
  });
  // Also persist to localStorage for the feedback loop
  persistRatings();
});

document.getElementById('share-btn').addEventListener('click', function() {
  navigator.clipboard.writeText('${shareUrl}').then(function() {
    showToast('Share link copied!');
  });
});

buildUI();
loadPersistedRatings();
</script>
</body>
</html>`;
}
