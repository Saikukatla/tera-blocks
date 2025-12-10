/* Full upgraded game logic
 - SPA navigation
 - playable Tetris-like mechanics
 - scoring, lines, levels, time
 - Game Over overlay
 - High score saved to localStorage
*/

const PAGES = {
  MENU: 'page-menu',
  PLAY: 'page-play',
  SCORES: 'page-scores',
  ABOUT: 'page-about'
};

/* ---------- --- SPA helpers --- ---------- */
function showPage(id){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // update nav active
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id.replace('page-','')));
}

document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click', ()=> {
    const page = b.dataset.page;
    showPage('page-' + page);
    if(page === 'scores') renderHighScores();
  });
});
document.querySelectorAll('[data-page]').forEach(b=>{
  b.addEventListener('click', ()=> showPage('page-' + b.dataset.page));
});

/* ---------- --- High Score storage --- ---------- */
const HS_KEY = 'tera_highscores_v1'; // localStorage key

function loadHighScores(){
  const raw = localStorage.getItem(HS_KEY);
  if(!raw) return [];
  try { return JSON.parse(raw); } catch(e){ return []; }
}

function saveHighScores(list){
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function addScoreRecord(name, score){
  const list = loadHighScores();
  list.push({name: name || 'Player', score: Math.max(0, score), date: (new Date()).toISOString()});
  // sort descending and keep top 10
  list.sort((a,b)=>b.score - a.score);
  saveHighScores(list.slice(0,10));
}

/* ---------- --- Elements --- ---------- */
const startFromMenu = document.getElementById('startFromMenu');
const playerNameInput = document.getElementById('playerName');
const hudScore = document.getElementById('hudScore');
const hudLines = document.getElementById('hudLines');
const hudLevel = document.getElementById('hudLevel');
const hudTime = document.getElementById('hudTime');
const activityLog = document.getElementById('activityLog');
const localBest = document.getElementById('localBest');

const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nctx = nextCanvas.getContext('2d');

const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScore = document.getElementById('finalScore');
const finalBest = document.getElementById('finalBest');
const playAgainBtn = document.getElementById('playAgainBtn');
const toMenuBtn = document.getElementById('toMenuBtn');

const startBtn = document.getElementById('startFromMenu');
const resumeBtn = document.getElementById('resumeBtn');
const pauseBtn = document.getElementById('pauseBtn');
const simulateBtn = document.getElementById('simulateBtn');
const quitBtn = document.getElementById('quitBtn');

const leftTouch = document.getElementById('leftTouch');
const rightTouch = document.getElementById('rightTouch');
const downTouch = document.getElementById('downTouch');
const rotateTouch = document.getElementById('rotateTouch');

const highScoreList = document.getElementById('highScoreList');
const clearScoresBtn = document.getElementById('clearScores');

/* ---------- --- Game constants --- ---------- */
const COLS = 10;
const ROWS = 20;
const CELL = Math.floor(gameCanvas.width / COLS); // automatic sizing
gameCanvas.height = CELL * ROWS;
nextCanvas.width = 120;
nextCanvas.height = 120;

const COLORS = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE138',
  '#3877FF'
];

/* ---------- --- Arena & Player --- ---------- */
function createMatrix(w,h){
  const m=[];
  while(h--) m.push(new Array(w).fill(0));
  return m;
}

let arena = createMatrix(COLS, ROWS);
let player = {
  pos: {x:0,y:0},
  matrix: null,
  next: null,
  score: 0,
  lines: 0,
  level: 1
};

/* ---------- --- Piece factory --- ---------- */
function createPiece(type){
  if(type === 'T') return [
    [0,0,0],
    [1,1,1],
    [0,1,0]
  ];
  if(type === 'O') return [
    [2,2],
    [2,2]
  ];
  if(type === 'L') return [
    [0,3,0],
    [0,3,0],
    [0,3,3]
  ];
  if(type === 'J') return [
    [0,4,0],
    [0,4,0],
    [4,4,0]
  ];
  if(type === 'I') return [
    [0,5,0,0],
    [0,5,0,0],
    [0,5,0,0],
    [0,5,0,0]
  ];
  if(type === 'S') return [
    [0,6,6],
    [6,6,0],
    [0,0,0]
  ];
  if(type === 'Z') return [
    [7,7,0],
    [0,7,7],
    [0,0,0]
  ];
}

/* ---------- --- Game helpers --- ---------- */
function drawMatrix(matrix, offset, targetCtx = ctx, size = CELL){
  targetCtx.save();
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      const val = matrix[y][x];
      if(val !== 0){
        targetCtx.fillStyle = COLORS[val] || '#999';
        targetCtx.fillRect((x+offset.x)*size + 1, (y+offset.y)*size + 1, size-2, size-2);
        // light stroke
        targetCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        targetCtx.strokeRect((x+offset.x)*size + 1, (y+offset.y)*size + 1, size-2, size-2);
      }
    }
  }
  targetCtx.restore();
}

function merge(arena, player){
  player.matrix.forEach((row,y)=>{
    row.forEach((val,x)=>{
      if(val !== 0) arena[y + player.pos.y][x + player.pos.x] = val;
    });
  });
}

function collide(arena, player){
  const m = player.matrix; const o = player.pos;
  for(let y=0;y<m.length;y++){
    for(let x=0;x<m[y].length;x++){
      if(m[y][x] !== 0 && (arena[y+o.y] && arena[y+o.y][x+o.x]) !== 0){
        return true;
      }
    }
  }
  return false;
}

/* ---------- --- Scoring & level logic --- ---------- */
function arenaSweep(){
  let rowCount = 0;
  for(let y = arena.length - 1; y >= 0; --y){
    if(arena[y].every(v => v !== 0)){
      const row = arena.splice(y,1)[0].fill(0);
      arena.unshift(row);
      rowCount++;
      y++; // re-evaluate this row index after shifting
    }
  }
  if(rowCount > 0){
    // standard tetris scoring per lines
    const points = [0,40,100,300,1200]; // lines 0..4 multiplier
    player.score += (points[rowCount] * player.level);
    player.lines += rowCount;
    // level up for every 10 lines
    const newLevel = Math.floor(player.lines / 10) + 1;
    if(newLevel > player.level){
      player.level = newLevel;
      log(`Leveled up to ${player.level}`);
    }
  }
  updateHUD();
}

/* ---------- --- Player actions --- ---------- */
function playerDrop(){
  player.pos.y++;
  if(collide(arena, player)){
    player.pos.y--;
    merge(arena, player);
    player.matrix = player.next || createPiece(randomPiece());
    player.next = createPiece(randomPiece());
    player.pos.y = 0;
    player.pos.x = Math.floor((COLS - player.matrix[0].length)/2);
    arenaSweep();
    updateHUD();
    if(collide(arena, player)){ // Game over condition: spawn overlaps
      onGameOver();
    }
  }
  dropCounter = 0;
}

function playerMove(dir){
  player.pos.x += dir;
  if(collide(arena, player)) player.pos.x -= dir;
}

function playerRotate(dir){
  rotateMatrix(player.matrix, dir);
  // wall kicks - basic
  let offset = 1;
  while(collide(arena, player)){
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if(Math.abs(offset) > player.matrix[0].length){ rotateMatrix(player.matrix, -dir); return; }
  }
}

function rotateMatrix(matrix, dir){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<y;x++){
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if(dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function hardDrop(){
  while(!collide(arena, player)){
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  player.matrix = player.next || createPiece(randomPiece());
  player.next = createPiece(randomPiece());
  player.pos.y = 0;
  player.pos.x = Math.floor((COLS - player.matrix[0].length)/2);
  arenaSweep();
  updateHUD();
  if(collide(arena, player)) onGameOver();
}

/* ---------- --- Game loop / timing --- ---------- */
let dropCounter = 0;
let dropInterval = 1000; // ms
let lastTime = 0;
let running = false;
let paused = false;
let startTimestamp = 0;

function update(time = 0){
  if(!running || paused){ lastTime = time; requestAnimationFrame(update); return; }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  // drop faster as level increases:
  dropInterval = Math.max(120, 1000 - (player.level - 1) * 70);
  if(dropCounter > dropInterval){
    playerDrop();
    dropCounter = 0;
  }
  draw();
  requestAnimationFrame(update);
}

/* ---------- --- Draw everything --- ---------- */
function draw(){
  // main canvas
  ctx.fillStyle = '#061726';
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // draw arena (placed)
  drawMatrix(arena, {x:0,y:0});
  // draw current piece
  if(player.matrix) drawMatrix(player.matrix, {x:player.pos.x, y:player.pos.y});

  // next
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  nctx.fillStyle = '#f7fbff';
  nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
  if(player.next) {
    // center next preview
    const size = CELL * 0.8;
    const offsetX = Math.floor((nextCanvas.width/ CELL - player.next[0].length)/2);
    const offsetY = Math.floor((nextCanvas.height/ CELL - player.next.length)/2);
    drawMatrix(player.next, {x:offsetX, y:offsetY}, nctx, Math.floor(nextCanvas.width / 6));
  }
}

/* ---------- --- Utility & UI --- ---------- */
function randomPiece(){
  const pieces = 'TJLOSZI';
  return pieces[Math.floor(Math.random() * pieces.length)];
}

function resetArena(){
  arena = createMatrix(COLS, ROWS);
}

function log(msg){
  const p = document.createElement('div');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  activityLog.prepend(p);
}

function updateHUD(){
  hudScore.textContent = player.score;
  hudLines.textContent = player.lines;
  hudLevel.textContent = player.level;
}

/* ---------- --- Game lifecycle --- ---------- */
function startGame(){
  resetArena();
  player.score = 0; player.lines = 0; player.level = 1;
  player.matrix = createPiece(randomPiece());
  player.next = createPiece(randomPiece());
  player.pos.y = 0;
  player.pos.x = Math.floor((COLS - player.matrix[0].length)/2);
  running = true; paused = false;
  startTimestamp = Date.now();
  lastTime = performance.now();
  dropCounter = 0;
  log('Game started');
  refreshLocalBestDisplay();
  requestAnimationFrame(update);
  showPage(PAGES.PLAY);
  updateHUD();
  updateTimerInterval();
  hideGameOver();
}

function pauseToggle(){
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  if(paused) log('Paused'); else log('Resumed');
}

function onGameOver(){
  running = false;
  paused = false;
  const name = playerNameInput.value || 'Player';
  addScoreRecord(name, player.score);
  finalScore.textContent = `Score: ${player.score}`;
  const best = loadHighScores()[0];
  finalBest.textContent = `Best: ${best ? best.score + ' ('+best.name+')' : '—'}`;
  showGameOver();
  refreshLocalBestDisplay();
  renderHighScores();
  log('Game Over. Score: ' + player.score);
  clearInterval(timerInterval);
}

function showGameOver(){ gameOverOverlay.classList.remove('hidden'); }
function hideGameOver(){ gameOverOverlay.classList.add('hidden'); }

/* ---------- --- Timer for HUD --- ---------- */
let timerInterval = null;
function updateTimerInterval(){
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(!running) return;
    const sec = Math.floor((Date.now() - startTimestamp)/1000);
    const mm = String(Math.floor(sec/60)).padStart(2,'0');
    const ss = String(sec % 60).padStart(2,'0');
    hudTime.textContent = `${mm}:${ss}`;
  }, 1000);
}

/* ---------- --- Game simulation (stability) --- ---------- */
// simplified stability: marks blocks with insufficient support under them as unstable
function updateStability(){
  const threshold = 0.5;
  let unstableCount = 0;
  for(let i=0;i<arena.length;i++){
    for(let j=0;j<arena[i].length;j++){
      // check cell value; only examine top-left of block squares by scanning connected horizontal groups
    }
  }
  // We'll simply compute for each occupied cell whether there's support below it.
  // If many unsupported cells, reduce stability %.
  let occupied = 0, supported = 0;
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(arena[y][x] !== 0){
        occupied++;
        if(y === ROWS - 1) supported++;
        else if(arena[y+1][x] !== 0) supported++;
      }
    }
  }
  const stabilityPct = occupied === 0 ? 100 : Math.round((supported/occupied) * 100);
  document.getElementById('stabilityBar').style.width = `${stabilityPct}%`;
  document.getElementById('stabilityPct').textContent = `${stabilityPct}%`;
  log(`Stability: ${stabilityPct}%`);
  return stabilityPct;
}

function simulateStabilityFall(){
  // naive: remove cells that are unsupported and drop them straight down
  const toDrop = [];
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(arena[y][x] !== 0){
        const below = (y === ROWS - 1) ? 1 : (arena[y+1][x] !== 0 ? 1 : 0);
        if(!below) toDrop.push({x,y,val:arena[y][x]});
      }
    }
  }
  if(toDrop.length === 0){ log('No unstable cells to drop'); return; }
  // clear them
  toDrop.forEach(c => { arena[c.y][c.x] = 0; });
  // drop each
  toDrop.forEach(c => {
    let ny = c.y;
    while(ny + 1 < ROWS && arena[ny + 1][c.x] === 0) ny++;
    arena[ny][c.x] = c.val;
  });
  log('Simulated falling of unstable cells');
  draw();
}

/* ---------- --- High Scores UI --- ---------- */
function renderHighScores(){
  const list = loadHighScores();
  highScoreList.innerHTML = '';
  if(list.length === 0){
    highScoreList.innerHTML = '<li>No high scores yet</li>';
    return;
  }
  list.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = `${rec.name} — ${rec.score} (${(new Date(rec.date)).toLocaleDateString()})`;
    highScoreList.appendChild(li);
  });
}

clearScoresBtn.addEventListener('click', ()=>{
  if(confirm('Clear all high scores?')) {
    saveHighScores([]);
    renderHighScores();
    refreshLocalBestDisplay();
  }
});

/* ---------- --- Local best display --- ---------- */
function refreshLocalBestDisplay(){
  const top = loadHighScores()[0];
  localBest.textContent = top ? `${top.name} — ${top.score}` : '—';
}

/* ---------- --- Input handlers (keyboard & touch) --- */
document.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key === 'ArrowLeft') playerMove(-1);
  else if(e.key === 'ArrowRight') playerMove(1);
  else if(e.key === 'ArrowDown') playerDrop();
  else if(e.key === 'ArrowUp') playerRotate(1);
  else if(e.key === ' ') { e.preventDefault(); hardDrop(); }
  else if(e.key.toLowerCase() === 'p') pauseToggle();
});

leftTouch.addEventListener('click', ()=>playerMove(-1));
rightTouch.addEventListener('click', ()=>playerMove(1));
downTouch.addEventListener('click', ()=>playerDrop());
rotateTouch.addEventListener('click', ()=>playerRotate(1));

startFromMenu.addEventListener('click', ()=> {
  const name = playerNameInput.value || 'Player';
  startGame();
});

playAgainBtn.addEventListener('click', ()=>{
  hideGameOver();
  startGame();
});

toMenuBtn.addEventListener('click', ()=>{
  hideGameOver();
  showPage(PAGES.MENU);
});

pauseBtn.addEventListener('click', pauseToggle);
simulateBtn.addEventListener('click', ()=>{ const pct = updateStability(); if(pct < 100) simulateStabilityFall(); });

resumeBtn.addEventListener('click', ()=>{ paused = false; log('Resumed'); });

quitBtn.addEventListener('click', ()=>{
  if(confirm('Quit current game and return to menu?')) { running = false; hideGameOver(); showPage(PAGES.MENU); }
});

/* ---------- --- Init & start defaults --- */
function init(){
  showPage(PAGES.MENU);
  refreshLocalBestDisplay();
  renderHighScores();
  draw(); // initial draw
}
init();
