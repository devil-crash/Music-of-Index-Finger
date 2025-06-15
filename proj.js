//settings:
//p5.js version - 1.4.2
//p5.sound.js Add-on Library - open
//others - close
let video;
let hands;
let cam;
let indexTip = null;

let sounds = {};
let notes = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];
let noteCircles = [];

let particles = [];

let gameState = 'freePlay'; // 'freePlay' or 'melodyChallenge'
let melodyButton;

let targetMelody = ['Do', 'Do', 'Sol', 'Sol', 'La', 'La', 'Sol'];
let userMelody = [];
let feedbackMsg = "";

let melodyIndex = 0;
let melodyTimer = 0;
let melodyInterval = 60;
let showNextHint = true;

let bg_L3;

function preload() {
  soundFormats('mp3', 'wav');
  sounds['Do'] = loadSound('do.mp3');
  sounds['Re'] = loadSound('re.mp3');
  sounds['Mi'] = loadSound('mi.mp3');
  sounds['Fa'] = loadSound('fa.mp3');
  sounds['Sol'] = loadSound('sol.mp3');
  sounds['La'] = loadSound('la.mp3');
  sounds['Ti'] = loadSound('ti.mp3');
  bg_L3 = loadImage("bg_L3.jpg");
}

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  // let spacing = width / (notes.length + 1);
  // let y = height / 2 - 30;
  // for (let i = 0; i < notes.length; i++) {
  //   let x = spacing * (i + 1);
  //   noteCircles.push(new NoteCircle(x, y, 35, notes[i]));
  // }
  let centerX = width / 2;
  let centerY = height / 2;
  let radius = 170; // 控制圆的大小

  for (let i = 0; i < notes.length; i++) {
    let angle = TWO_PI / notes.length * i - PI / 2; // 从正上方开始排
    let x = centerX + cos(angle) * radius;
    let y = centerY + sin(angle) * radius;
    noteCircles.push(new NoteCircle(x, y, 45, notes[i]));
  }

  melodyButton = createButton('🎼 Melody Challenge');
  melodyButton.position(10, height - 40);
  melodyButton.mousePressed(() => {
    gameState = (gameState === 'freePlay') ? 'melodyChallenge' : 'freePlay';
    userMelody = [];
    feedbackMsg = "";
    melodyIndex = 0;
  });

  hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });

  hands.onResults(gotHands);

  cam = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: width,
    height: height
  });
  cam.start();
}

function gotHands(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let hand = results.multiHandLandmarks[0];
    let tip = hand[8];
    indexTip = {
      x: width - tip.x * width,
      y: tip.y * height
    };
  } else {
    indexTip = null;
  }
}

function draw() {
  background(0);
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  tint(255, 100);
  image(bg_L3, 0, 0, width, height);
  noTint();

  if (gameState === 'freePlay') {
    drawFreePlay();
  } else if (gameState === 'melodyChallenge') {
    drawMelodyChallenge();
  }

  updateParticles();
}

function drawFreePlay() {
  for (let nc of noteCircles) {
    nc.display();
  }

  if (indexTip) {
    fill(255, 0, 0);
    noStroke();
    ellipse(indexTip.x, indexTip.y, 20, 20);

    for (let nc of noteCircles) {
      nc.checkTrigger(indexTip.x, indexTip.y);
    }
  }
}

function drawMelodyChallenge() {
  for (let i = 0; i < noteCircles.length; i++) {
    let nc = noteCircles[i];
    if (showNextHint && targetMelody[melodyIndex] === nc.note) {
      stroke(255, 255, 0);
      strokeWeight(4);
    } else {
      noStroke();
    }
    nc.display();
  }

  if (indexTip) {
    fill(0, 255, 0);
    noStroke();
    ellipse(indexTip.x, indexTip.y, 20, 20);
    for (let nc of noteCircles) {
      let triggered = nc.checkMelodyTrigger(indexTip.x, indexTip.y);
      if (triggered) break;
    }
  }

  fill(255);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("目标旋律: " + targetMelody.join(" - "), width / 2, 30);
  text("你的输入: " + userMelody.join(" - "), width / 2, 60);
  fill(255, 255, 0);
  text(feedbackMsg, width / 2, 90);

  melodyTimer++;
  if (melodyTimer >= melodyInterval) {
    melodyTimer = 0;
    showNextHint = !showNextHint;
  }
}

class NoteCircle {
  constructor(x, y, r, note) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.note = note;
    this.isInside = false;
    this.highlight = 0;
  }

  display() {
    if (this.highlight > 0) {
      fill(getNoteColor(this.note));
      this.highlight = max(0, this.highlight - 25);
    } else {
      fill(255, 100);
    }

    noStroke();
    ellipse(this.x, this.y, this.r * 2);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(this.note, this.x, this.y);
  }

  checkTrigger(px, py) {
    let d = dist(px, py, this.x, this.y);
    let nowInside = d < this.r;

    if (nowInside && !this.isInside) {
      sounds[this.note].play();
      this.highlight = 255;
      spawnParticle(this.x, this.y);
    }

    this.isInside = nowInside;
  }

  checkMelodyTrigger(px, py) {
    let d = dist(px, py, this.x, this.y);
    let nowInside = d < this.r;

    if (nowInside && !this.isInside) {
      userMelody.push(this.note);
      sounds[this.note].play();
      this.highlight = 255;
      spawnParticle(this.x, this.y);
      checkMelodyProgress();
      this.isInside = true;
      return true;
    }

    this.isInside = nowInside;
    return false;
  }
}

function getNoteColor(name) {
  switch (name) {
    case 'Do': return color(255, 100, 100);
    case 'Re': return color(255, 160, 50);
    case 'Mi': return color(255, 220, 50);
    case 'Fa': return color(100, 200, 100);
    case 'Sol': return color(100, 150, 255);
    case 'La': return color(150, 100, 255);
    case 'Ti': return color(200, 100, 200);
    default: return color(200);
  }
}

function checkMelodyProgress() {
  let i = userMelody.length - 1;

  if (userMelody[i] !== targetMelody[i]) {
    feedbackMsg = `❌ 第 ${i + 1} 个音符错了，应为 ${targetMelody[i]}`;
    userMelody = [];
    melodyIndex = 0;
    return;
  }

  if (userMelody.length === targetMelody.length) {
    feedbackMsg = "✅ 恭喜你成功弹奏小星星前两小节！";
    userMelody = [];
    melodyIndex = 0;
  } else {
    feedbackMsg = `✔ 第 ${i + 1} 个正确，请继续`;
    melodyIndex++;
  }
}

function spawnParticle(x, y) {
  particles.push({ x, y, life: 60 });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    fill(255);
    textSize(20);
    textAlign(CENTER, CENTER);
    text('🎵', p.x, p.y);
    p.y -= 1;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
