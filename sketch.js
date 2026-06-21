// ======= DEV: mude para 1 ou 2 para pular direto para a fase, null = menu normal =======
const DEBUG_LEVEL = null;
// ========================================================================================

// Variáveis globais

let showMazeMode = false, hasWon = false; // Controle de estado: exibir labirinto (debug/final), e se a fase foi vencida
let showSteps = true; // Controla se as bolinhas do algoritmo de Ray Marching serão desenhadas
let batPos, batVel, batHeading; // Vetores de Posição, Velocidade e Rotação do personagem
let exitPos; // Vetor da posição final que representa a saída do nível
const BAT_DRAG = 0.90; // Atrito/fricção (desacelera o personagem quando as setas não estão apertadas)

// ==== SISTEMA DE COLISÃO E ECOLOCALIZAÇÃO ====
let obstacles = []; // Vetor principal que armazena a geometria (cápsulas, bezier) do cenário atual
let discoveredEchoes = []; // Array que armazena permanentemente as coordenadas dos ecos revelados
let currentPulseRaysData = []; // Guarda dados temporários do pulso (raios, intersecções) para a animação do frame
let pulseTimer = 0; // Contador regressivo de duração do pulso sendo animado
const PULSE_DURATION = 30; // Tempo que leva para o raio de som desaparecer por completo

// ==== CÂMERA ====
let camPos; // Vetor de posição da câmera principal
const CAM_LERP = 0.08; // Suavidade da câmera seguindo o jogador (0 a 1)
const CAM_ZOOM = 3; // Multiplicador de escala da cena durante o jogo

// ==== GERENCIAMENTO DE FLUXO (ESTADOS E FASES) ====
let gameState = 'menu'; // Guarda a tela atual ('menu', 'charSelect', 'playing', 'sandbox', 'sandboxPlay', 'levelComplete')
let currentLevel = 1; // Qual fase normal o jogador está agora
let TOTAL_LEVELS = 3; // Quantidade de níveis fixos contidos no jogo
let customLevels = []; // Array que salva dinamicamente as funções de fases criadas no modo editor
let levelCompleteTimer = 0; // Cronômetro de animação da tela de fase completa
const LEVEL_COMPLETE_DURATION = 180; // Tempo que a tela de "fase completa" dura antes de mudar
let levelStartTimer = 0; // Cronômetro de animação do aviso de controles
let menuParticles = []; // Partículas de fundo usadas apenas nas telas de menu
let ctrlDiv; // Divisão escondida para gerenciar lógicas do DOM pelo p5

// ==== DEFINIÇÃO DE PERSONAGENS E STATUS ====
let selectedChar = 0; // 0 para Morcego, 1 para Golfinho
const CHAR_NAMES = ['Morcego', 'Golfinho']; // Nomes para usar no menu e interface
const CHAR_DESCRIPTIONS = [ // Descrições exibidas na seleção de classe
    'Sonar em cone direcional\nAlcance longo | Foco frontal',
    'Sonar omnidirecional 360°\nAlcance curto | Cobertura total'
];
// ==== DEFINIÇÃO DE ATRIBUTOS DE PERSONAGEM E SONAR ====
const BAT_FOV = 60; // Campo de visão do Morcego em graus
const BAT_RAYS = 45; // Número de raios que o Morcego lança
const BAT_RANGE = 180; // Alcance máximo do sonar do Morcego
const DOLPHIN_RANGE = 65; // Comprimento máximo (alcance) da roda de som do golfinho
const DOLPHIN_RAYS = 60; // Quantidade de raios do círculo do sonar do golfinho

const WALL_THICKNESS = 5; // Espessura padrão de todas as paredes geométricas do jogo

// ==== CONTROLE DE COOLDOWN E EXECUÇÃO DO SONAR ====
let sonarCooldown = 0; // Contador de espera entre um pulso e outro
const SONAR_COOLDOWN = 45; // Quantidade de frames de recarga (cooldown)

// ======== EDITOR DE NÍVEL (SANDBOX) ========
const SB_COLS = 22; // Quantidade de colunas do grid de criação
const SB_ROWS = 14; // Quantidade de linhas do grid de criação
let SB_CELL = 40; // Tamanho em pixels de cada célula (recalculado ao redimensionar a janela)
let SB_OX = 50; // Margem X do editor (recalculado dinamicamente)
let SB_OY = 80; // Margem Y do editor (recalculado dinamicamente)

let sbGrid = []; // Tabela inativa legada ou para usos futuros no grid
let sbRightWall = []; // Grid lógico das paredes localizadas nas bordas direitas
let sbBottomWall = []; // Grid lógico das paredes localizadas nas bordas inferiores

let sbPaintMode = 'wall'; // Ferramenta atualmente selecionada ('wall', 'start', 'curve', etc)
let sbIsPainting = false; // Controle de arrastar do mouse (se está clicado construindo)
let sbLastPainted = null; // Impede que a mesma parede gere mil eventos seguidos no mouse dragged
let sbStartCell = { c: 1, r: 1 }; // Coordenada do grid para nascer no sandbox
let sbExitCell = { c: SB_COLS - 2, r: 0 }; // Coordenada do grid de saída no sandbox
let sbMouseEdge = null; // Calcula qual é a parede virtual em que o mouse paira
let sbHoveredEdge = null; // Parede atual que tá sendo renderizada como hover
let sbUndoStack = []; // Pilha para registrar o histórico (usada no ctrl+z)
const SB_MAX_UNDO = 40; // Número de estados que ficam gravados no Ctrl+Z
let sbExportMsg = ''; // String de feedback quando você gera o código do nível
let sbExportMsgTimer = 0; // Tempo para a mensagem de feedback ficar visível na tela

// Lista base de componentes visuais do painel de controle
let sbActionButtons = [];


// Curvas Bézier no editor
let sbCurves = [];        // Curvas prontas: [{ pts: [{x,y},{x,y},{x,y},{x,y}] }, ...]
let sbCurvePoints = [];   // Pontos de controle sendo colocados em tempo real na criação de curvas
let sbDragCurve = -1;     // Índice de qual curva exata você está segurando (-1 = nenhuma)
let sbDragPt = -1;        // Índice do ponto exato dentro da curva que tá sendo arrastado

// Músicas de Fundo
let bgmMenu, bgmPlaying;
let currentBgm = null;

function preload() {
    bgmMenu = loadSound('Bad Piggies - Game Selection [Extended] - Angry Birds Zone (youtube).mp3');
    bgmPlaying = loadSound('Bad Piggies - Playing the Level [Extended] - Angry Birds Zone (youtube).mp3');
}

// Inicialização geral do p5.js (roda uma vez quando a página carrega)
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace');

    ctrlDiv = createDiv().style('display', 'none');

    for (let i = 0; i < 60; i++) {
        menuParticles.push({
            x: random(width), y: random(height),
            size: random(2, 6), speed: random(0.3, 1.5),
            alpha: random(30, 120), angle: random(TWO_PI)
        });
    }

    initSandbox();
    updateSandboxLayout();

    if (DEBUG_LEVEL !== null) {
        currentLevel = DEBUG_LEVEL;
        startGame();
    }
}

// ==================== SANDBOX INIT ====================
function initSandbox() {
    sbRightWall = [];
    sbBottomWall = [];
    for (let r = 0; r < SB_ROWS; r++) {
        sbRightWall[r] = [];
        sbBottomWall[r] = [];
        for (let c = 0; c < SB_COLS; c++) {
            sbRightWall[r][c] = false;
            sbBottomWall[r][c] = false;
        }
    }
    sbStartCell = { c: 1, r: SB_ROWS - 2 };
    sbExitCell = { c: SB_COLS - 2, r: 0 };
    sbUndoStack = [];
    sbCurves = [];
    sbCurvePoints = [];
    sbDragCurve = -1;
    sbDragPt = -1;
    sbPaintMode = 'wall';
    sbIsPainting = false;
    sbHoveredEdge = null;
}

// Recalcula o tamanho das células e margens do editor pra preencher a tela toda
function updateSandboxLayout() {
    let panelSpace = 190; // espaço reservado pro painel lateral de ferramentas
    let marginX = 40, marginY = 60; // margens mínimas nas bordas da janela
    let availW = width - marginX * 2 - panelSpace;
    let availH = height - marginY - 100; // 100 = título + barra inferior
    SB_CELL = floor(min(availW / SB_COLS, availH / SB_ROWS));
    SB_CELL = max(SB_CELL, 20); // nunca deixa menor que 20px senão fica ilegível
    SB_OX = floor((width - SB_COLS * SB_CELL - panelSpace) / 2);
    SB_OY = 65;
}

// Converte o grid do editor em obstáculos pro jogo
function buildSandboxObstacles() {
    obstacles = [];
    let r = 5;
    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;

    function addSeg(x1, y1, x2, y2) {
        obstacles.push({
            type: 'capsule',
            a: createVector(x1, y1),
            b: createVector(x2, y2),
            r: r
        });
    }

    // Borda externa
    // Topo (com abertura pra saída)
    let exitX = OX + sbExitCell.c * CS;
    addSeg(OX, OY, exitX - CS / 2, OY);
    addSeg(exitX + CS / 2, OY, OX + SB_COLS * CS, OY);
    // Baixo
    addSeg(OX, OY + SB_ROWS * CS, OX + SB_COLS * CS, OY + SB_ROWS * CS);
    // Esquerda
    addSeg(OX, OY, OX, OY + SB_ROWS * CS);
    // Direita
    addSeg(OX + SB_COLS * CS, OY, OX + SB_COLS * CS, OY + SB_ROWS * CS);

    // Paredes internas
    for (let row = 0; row < SB_ROWS; row++) {
        for (let col = 0; col < SB_COLS; col++) {
            let x = OX + col * CS;
            let y = OY + row * CS;
            if (col < SB_COLS - 1 && sbRightWall[row][col]) {
                addSeg(x + CS, y, x + CS, y + CS);
            }
            if (row < SB_ROWS - 1 && sbBottomWall[row][col]) {
                addSeg(x, y + CS, x + CS, y + CS);
            }
        }
    }

    // Curvas Bézier e splines
    for (let curve of sbCurves) {
        if (!curve.type || curve.type === 'curve') {
            obstacles.push({
                type: 'bezier',
                pts: curve.pts.map(p => createVector(p.x, p.y)),
                thickness: r
            });
        } else if (curve.type === 'spline') {
            // Spline = beziers encadeadas, passo 3
            let pts = curve.pts;
            for (let i = 0; i < pts.length - 3; i += 3) {
                obstacles.push({
                    type: 'bezier',
                    pts: [createVector(pts[i].x, pts[i].y), createVector(pts[i + 1].x, pts[i + 1].y), createVector(pts[i + 2].x, pts[i + 2].y), createVector(pts[i + 3].x, pts[i + 3].y)],
                    thickness: r
                });
            }
        }
    }

    batPos = createVector(
        OX + sbStartCell.c * CS + CS / 2,
        OY + sbStartCell.r * CS + CS / 2
    );
    exitPos = createVector(
        OX + sbExitCell.c * CS + CS / 2,
        OY + sbExitCell.r * CS + CS / 2
    );
}

// ==================== SANDBOX DRAW ====================
function drawSandbox() {
    background(5);
    drawMenuParticles();

    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
    const totalW = SB_COLS * CS;
    const totalH = SB_ROWS * CS;

    // Título do painel
    noStroke(); fill(0, 255, 120);
    textAlign(LEFT, TOP); textSize(18);
    text("EDITOR DE LABIRINTO", OX, 12);
    fill(0, 180, 80, 180); textSize(11);
    text("Clique nas bordas | Arraste para pintar | Z = desfazer | ENTER = testar", OX, 36);

    // Fundo do painel lateral
    let panelX = OX + totalW + 16;
    let panelY = OY;
    let panelW = min(width - panelX - 10, 170);
    let panelH = totalH;

    fill(10, 20, 14); stroke(0, 255, 120, 30); strokeWeight(1);
    rect(panelX, panelY, panelW, panelH, 8);

    // Título do painel de ferramentas
    noStroke(); fill(0, 255, 120); textSize(11); textAlign(LEFT, TOP);
    text("FERRAMENTAS", panelX + 10, panelY + 8);

    // Botões de ferramenta desenhados na mão
    let tools = [
        { id: 'wall', label: 'Parede', icon: '█', color: [0, 255, 120] },
        { id: 'curve', label: 'Curva', icon: '∿', color: [255, 160, 0] },
        { id: 'spline', label: 'Spline', icon: '〰', color: [255, 120, 200] },
        { id: 'erase', label: 'Apagar', icon: '░', color: [255, 100, 50] },
        { id: 'start', label: 'Início', icon: '◉', color: [255, 220, 0] },
        { id: 'exit', label: 'Saída', icon: '★', color: [0, 200, 255] },
    ];
    let btnY = panelY + 28;
    for (let t of tools) {
        let isActive = (sbPaintMode === t.id);
        let bx = panelX + 8, bw = panelW - 16, bh = 28;
        if (isActive) {
            fill(t.color[0], t.color[1], t.color[2], 30);
            stroke(t.color[0], t.color[1], t.color[2]);
            strokeWeight(1.5);
        } else {
            fill(15, 28, 20); stroke(0, 255, 120, 40); strokeWeight(0.5);
        }
        rect(bx, btnY, bw, bh, 5);
        noStroke();
        fill(isActive ? color(t.color[0], t.color[1], t.color[2]) : color(80));
        textSize(11); textAlign(LEFT, CENTER);
        text(t.icon + ' ' + t.label, bx + 8, btnY + 14);
        btnY += bh + 4;
    }

    // Botões de ação (desfazer, limpar, jogar, etc) montados a partir de um array
    let canUndo = sbUndoStack.length > 0;
    sbActionButtons = [
        { id: 'undo', text: '↩ Desfazer (Z)', h: 26, bg: canUndo ? [15, 28, 20] : [10, 15, 12], border: canUndo ? [0, 255, 120, 60] : [40], tCol: canUndo ? [0, 200, 90] : [40], glow: false, isGap: true },
        { id: 'clear', text: '✕ Limpar tudo', h: 26, bg: [20, 10, 10], border: [120, 40, 40], tCol: [180, 60, 60], glow: false, isGap: false },
        { id: 'generate', text: '⚡ Gerar aleatório', h: 26, bg: [10, 18, 30], border: [0, 120, 220, 80], tCol: [0, 140, 255], glow: false, isGap: false },
        { id: 'play', text: '▶ JOGAR', h: 32, bg: [10, 30, 18], border: [0, 255, 120], tCol: [0, 255, 120], glow: true, isGap: true, isCenter: true },
        { id: 'export', text: '💾 EXPORTAR', h: 28, bg: [18, 12, 28], border: [180, 80, 255, 80], tCol: [180, 80, 255], glow: false, isGap: false },
        { id: 'back', text: '← Voltar', h: 24, bg: [15, 15, 15], border: [60], tCol: [80], glow: false, isGap: false }
    ];

    for (let btn of sbActionButtons) {
        if (btn.isGap) { // Desenha o divisor antes do botão
            stroke(0, 255, 120, 20); strokeWeight(1);
            line(panelX + 8, btnY + 2, panelX + panelW - 8, btnY + 2);
            btnY += 8;
        }

        let bx = panelX + 8, bw = panelW - 16;
        btn.rect = { x: bx, y: btnY, w: bw, h: btn.h }; // Grava área de colisão do botão para o click

        if (btn.glow) { // Brilho de destaque
            let glowA = map(sin(frameCount * 0.08), -1, 1, 20, 60);
            fill(0, 255, 120, glowA); noStroke(); rect(bx - 2, btnY - 2, bw + 4, btn.h + 4, 8);
            strokeWeight(1.5);
        } else strokeWeight(0.5);

        // Fundo e borda
        fill(btn.bg); stroke(btn.border);
        rect(bx, btnY, bw, btn.h, 5);

        // Texto
        noStroke(); fill(btn.tCol); textSize(btn.isCenter ? 11 : 10); textAlign(btn.isCenter ? CENTER : LEFT, CENTER);
        text(btn.text, btn.isCenter ? bx + bw / 2 : bx + 8, btnY + btn.h / 2);
        btnY += btn.h + 4;
    }

    // Mensagem de feedback da exportação
    if (sbExportMsgTimer > 0) {
        sbExportMsgTimer--;
        let msgAlpha = map(sbExportMsgTimer, 0, 120, 0, 255);
        fill(180, 80, 255, msgAlpha); noStroke();
        textSize(12); textAlign(CENTER, TOP);
        text(sbExportMsg, OX + totalW / 2, OY + totalH + 40);
    }

    // ---- Desenhar grid ----
    // Fundo das células
    for (let r = 0; r < SB_ROWS; r++) {
        for (let c = 0; c < SB_COLS; c++) {
            let x = OX + c * CS, y = OY + r * CS;
            // Destaca células de início/saída
            if (c === sbStartCell.c && r === sbStartCell.r) {
                fill(255, 220, 0, 18); noStroke(); rect(x, y, CS, CS);
            } else if (c === sbExitCell.c && r === sbExitCell.r) {
                fill(0, 200, 255, 18); noStroke(); rect(x, y, CS, CS);
            } else {
                fill(12, 22, 16); noStroke(); rect(x, y, CS, CS);
            }
        }
    }

    // Pontos do grid
    for (let r = 0; r <= SB_ROWS; r++) {
        for (let c = 0; c <= SB_COLS; c++) {
            fill(0, 255, 120, 25); noStroke();
            circle(OX + c * CS, OY + r * CS, 3);
        }
    }

    // Desenhar bordas (paredes) — usa uma função local pra não repetir código vertical/horizontal
    let drawEdges = (rows, cols, grid, type) => {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let x = OX + (type === 'v' ? c + 1 : c) * CS;
                let y = OY + (type === 'v' ? r : r + 1) * CS;
                let isWall = grid[r][c];
                let isHover = sbHoveredEdge && sbHoveredEdge.type === type && sbHoveredEdge.r === r && sbHoveredEdge.c === c;

                if (isWall) { stroke(0, 255, 120, 200); strokeWeight(4); strokeCap(ROUND); }
                else if (isHover) { stroke(sbPaintMode === 'erase' ? color(255, 80, 50, 120) : color(0, 255, 120, 80)); strokeWeight(3); strokeCap(ROUND); }
                else { stroke(0, 255, 120, 10); strokeWeight(1); }

                if (type === 'v') line(x, y + 4, x, y + CS - 4);
                else line(x + 4, y, x + CS - 4, y);
            }
        }
    };
    drawEdges(SB_ROWS, SB_COLS - 1, sbRightWall, 'v');
    drawEdges(SB_ROWS - 1, SB_COLS, sbBottomWall, 'h');

    // Linhas da borda externa
    stroke(0, 255, 120, 140); strokeWeight(3); strokeCap(ROUND);
    // topo com abertura da saída
    let exitGapX = OX + sbExitCell.c * CS;
    line(OX, OY, exitGapX, OY);
    line(exitGapX + CS, OY, OX + SB_COLS * CS, OY);
    // outros lados
    line(OX + SB_COLS * CS, OY, OX + SB_COLS * CS, OY + SB_ROWS * CS);
    line(OX, OY + SB_ROWS * CS, OX + SB_COLS * CS, OY + SB_ROWS * CS);
    line(OX, OY, OX, OY + SB_ROWS * CS);

    // Marcadores de início/saída
    // Início
    let sx = OX + sbStartCell.c * CS + CS / 2;
    let sy = OY + sbStartCell.r * CS + CS / 2;
    fill(255, 220, 0, 60); noStroke();
    circle(sx, sy, CS * 0.6);
    fill(255, 220, 0); textSize(10); textAlign(CENTER, CENTER);
    text('INÍCIO', sx, sy);
    push();
    translate(sx, sy - CS * 0.05);
    scale((CS * 0.5) / 40);
    if (selectedChar === 0) drawBat(0, 0, -HALF_PI);
    else drawDolphin(0, 0, -HALF_PI);
    pop();

    // Saída
    let ex = OX + sbExitCell.c * CS + CS / 2;
    let ey = OY + sbExitCell.r * CS + CS / 2;
    fill(0, 200, 255, 40); noStroke(); circle(ex, ey, CS * 0.6);
    fill(0, 200, 255); textSize(10); textAlign(CENTER, CENTER);
    text('SAÍDA', ex, ey);

    // ---- Desenhar curvas Bézier e splines ----
    for (let ci = 0; ci < sbCurves.length; ci++) {
        let c = sbCurves[ci];
        let pts = c.pts;
        let isSpline = (c.type === 'spline');
        let curveCol = isSpline ? color(255, 120, 200) : color(255, 160, 0);
        let curveColFade = isSpline ? color(255, 120, 200, 60) : color(255, 160, 0, 60);

        if (!isSpline) {
            // Curva simples
            noFill(); stroke(curveCol); strokeWeight(4); strokeCap(ROUND);
            bezier(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
            stroke(curveColFade); strokeWeight(1);
            line(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
            line(pts[3].x, pts[3].y, pts[2].x, pts[2].y);
        } else {
            // Spline: desenha cada segmento
            for (let s = 0; s < pts.length - 3; s += 3) {
                noFill(); stroke(curveCol); strokeWeight(4); strokeCap(ROUND);
                bezier(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y, pts[s + 2].x, pts[s + 2].y, pts[s + 3].x, pts[s + 3].y);
                stroke(curveColFade); strokeWeight(1);
                line(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);
                line(pts[s + 3].x, pts[s + 3].y, pts[s + 2].x, pts[s + 2].y);
            }
        }
        // Pontos de controle
        for (let pi = 0; pi < pts.length; pi++) {
            let isEndpoint = (pi % 3 === 0);
            let isHover = (sbDragCurve === ci && sbDragPt === pi);
            noStroke();
            if (isHover) { fill(255, 255, 255, 200); circle(pts[pi].x, pts[pi].y, 12); }
            fill(isEndpoint ? curveCol : color(255, 220, 150));
            circle(pts[pi].x, pts[pi].y, isEndpoint ? 8 : 6);
        }
    }

    // Pontos da curva/spline sendo criada
    if (sbCurvePoints.length > 0) {
        let cp = sbCurvePoints;
        let isSplineMode = (sbPaintMode === 'spline');
        let activeCol = isSplineMode ? color(255, 120, 200) : color(255, 160, 0);
        let activeFade = isSplineMode ? color(255, 120, 200, 60) : color(255, 160, 0, 60);

        // Desenha segmentos prontos da spline em progresso
        if (isSplineMode && cp.length >= 4) {
            for (let s = 0; s < cp.length - 3; s += 3) {
                noFill(); stroke(activeCol); strokeWeight(3); strokeCap(ROUND);
                bezier(cp[s].x, cp[s].y, cp[s + 1].x, cp[s + 1].y, cp[s + 2].x, cp[s + 2].y, cp[s + 3].x, cp[s + 3].y);
                stroke(activeFade); strokeWeight(1);
                line(cp[s].x, cp[s].y, cp[s + 1].x, cp[s + 1].y);
                line(cp[s + 3].x, cp[s + 3].y, cp[s + 2].x, cp[s + 2].y);
            }
        }

        // Desenha os pontos
        for (let i = 0; i < cp.length; i++) {
            let isEnd = (i % 3 === 0);
            noStroke(); fill(activeCol);
            circle(cp[i].x, cp[i].y, isEnd ? 10 : 7);
            fill(255, 220, 150); textSize(9); textAlign(LEFT, BOTTOM);
            if (i < 4) {
                let labels = ['P0', 'CP1', 'CP2', 'P1'];
                text(labels[i], cp[i].x + 6, cp[i].y - 4);
            } else {
                let segN = Math.floor((i - 1) / 3);
                let inSeg = (i - 1) % 3; // 0=cp1, 1=cp2, 2=ponto final
                let segLabels = ['CP' + (segN * 2 + 1), 'CP' + (segN * 2 + 2), 'P' + (segN + 1)];
                text(segLabels[inSeg], cp[i].x + 6, cp[i].y - 4);
            }
        }

        // Linha tangente pro último ponto
        if (cp.length >= 2) {
            let lastIdx = cp.length - 1;
            let parentIdx = lastIdx - (lastIdx % 3 === 0 ? 1 : (lastIdx % 3 === 1 ? 1 : 0));
            if (lastIdx > 0) { stroke(activeFade); strokeWeight(1); line(cp[lastIdx].x, cp[lastIdx].y, cp[parentIdx >= 0 ? parentIdx : 0].x, cp[parentIdx >= 0 ? parentIdx : 0].y); }
        }

        // Preview em tempo real do segmento atual
        let segStart = cp.length >= 4 ? cp.length - (cp.length - 1) % 3 - 1 : 0;
        let localCount = cp.length - segStart;
        if (!isSplineMode && cp.length === 3) {
            noFill(); stroke(activeCol); strokeWeight(3);
            bezier(cp[0].x, cp[0].y, cp[1].x, cp[1].y, cp[2].x, cp[2].y, mouseX, mouseY);
            stroke(activeFade); strokeWeight(1);
            line(cp[2].x, cp[2].y, mouseX, mouseY);
        }
        if (isSplineMode && cp.length >= 1 && cp.length < 7) {
            // Preview dos segmentos da spline
            let curSeg = (cp.length < 4) ? cp.length : (cp.length - 1) % 3 + 1;
            if (curSeg === 3 || (cp.length >= 4 && (cp.length - 4) % 3 === 2)) {
                // Preview da próxima bezier com o mouse como ponto final
                let s = cp.length < 4 ? 0 : cp.length - ((cp.length - 4) % 3) - 1;
                if (cp.length === 3) s = 0;
                if (cp.length === 6) s = 3;
                if (s >= 0 && s + 2 < cp.length) {
                    noFill(); stroke(activeCol); strokeWeight(3);
                    bezier(cp[s].x, cp[s].y, cp[s + 1].x, cp[s + 1].y, cp[s + 2].x, cp[s + 2].y, mouseX, mouseY);
                    stroke(activeFade); strokeWeight(1);
                    line(cp[s + 2].x, cp[s + 2].y, mouseX, mouseY);
                }
            }
            stroke(activeFade); strokeWeight(1);
            line(cp[cp.length - 1].x, cp[cp.length - 1].y, mouseX, mouseY);
        }

        // Texto de instrução
        noStroke(); fill(isSplineMode ? color(255, 120, 200, 220) : color(255, 160, 0, 200)); textSize(11); textAlign(LEFT, TOP);
        if (!isSplineMode) {
            let instrMsg = ['Clique P0 (início)', 'Clique CP1 (controle 1)', 'Clique CP2 (controle 2)', 'Clique P1 (fim)'];
            if (cp.length < 4) text(instrMsg[cp.length], OX, OY + totalH + 42);
        } else {
            let instrSpline = ['Clique P0 (início)', 'Clique CP1 (controle 1)', 'Clique CP2 (controle 2)', 'Clique P1 (junção)', 'Clique CP3 (controle 3)', 'Clique CP4 (controle 4)', 'Clique P2 (fim)'];
            if (cp.length < 7) text(instrSpline[cp.length] + '  (' + cp.length + '/7)', OX, OY + totalH + 42);
        }
    }

    // Rótulo do modo
    noStroke();
    let modeColors = { wall: [0, 255, 120], curve: [255, 160, 0], spline: [255, 120, 200], erase: [255, 100, 50], start: [255, 220, 0], exit: [0, 200, 255] };
    let modeLabels = { wall: 'MODO: PAREDE', curve: 'MODO: CURVA BÉZIER', spline: 'MODO: SPLINE (multi-segmento)', erase: 'MODO: APAGAR', start: 'MODO: INÍCIO', exit: 'MODO: SAÍDA' };
    let mc = modeColors[sbPaintMode] || [0, 255, 120];
    fill(mc[0], mc[1], mc[2]);
    textSize(13); textAlign(LEFT, BOTTOM);
    text(modeLabels[sbPaintMode] || '', OX, OY + totalH + 28);

    // Contagem de paredes
    let wcount = 0;
    for (let r = 0; r < SB_ROWS; r++) for (let c = 0; c < SB_COLS - 1; c++) if (sbRightWall[r][c]) wcount++;
    for (let r = 0; r < SB_ROWS - 1; r++) for (let c = 0; c < SB_COLS; c++) if (sbBottomWall[r][c]) wcount++;
    fill(0, 255, 120, 100); textSize(12); textAlign(RIGHT, BOTTOM);
    text('Paredes: ' + wcount + ' | Curvas: ' + sbCurves.length + '  |  Z = desfazer | ESC = cancelar', OX + totalW, OY + totalH + 28);
}

// ==================== SANDBOX INTERACTION ====================
// Verifica qual borda de parede o mouse tá em cima
function edgeAtMouse() {
    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
    const SNAP = 10; // raio de snap em px
    let mx = mouseX, my = mouseY;

    let checkEdge = (rows, cols, type) => {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let x = OX + (type === 'v' ? c + 1 : c) * CS;
                let y = OY + (type === 'h' ? r + 1 : r) * CS;
                let match = type === 'v'
                    ? (abs(mx - x) < SNAP && my > y + 4 && my < y + CS - 4)
                    : (abs(my - y) < SNAP && mx > x + 4 && mx < x + CS - 4);
                if (match) return { type, r, c };
            }
        }
        return null;
    };
    return checkEdge(SB_ROWS, SB_COLS - 1, 'v') || checkEdge(SB_ROWS - 1, SB_COLS, 'h');
}

// Retorna qual célula do grid o cursor tá, null se fora
function cellAtMouse() {
    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
    let c = floor((mouseX - OX) / CS);
    let r = floor((mouseY - OY) / CS);
    if (c >= 0 && c < SB_COLS && r >= 0 && r < SB_ROWS) return { c, r };
    return null;
}

// Descobre qual botão do painel lateral foi clicado
function buttonAtMouse() {
    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
    const totalW = SB_COLS * CS;
    let panelX = OX + totalW + 16;
    let panelW = min(width - panelX - 10, 170);
    let bx = panelX + 8, bw = panelW - 16;
    let btnY = OY + 28;
    // Botões de ferramenta
    let tools = ['wall', 'curve', 'spline', 'erase', 'start', 'exit'];
    for (let t of tools) {
        if (mouseX >= bx && mouseX <= bx + bw && mouseY >= btnY && mouseY <= btnY + 28) return t;
        btnY += 32;
    }

    // Verifica ações mapeadas dinamicamente
    for (let btn of sbActionButtons) {
        if (btn.rect && mouseX >= btn.rect.x && mouseX <= btn.rect.x + btn.rect.w && mouseY >= btn.rect.y && mouseY <= btn.rect.y + btn.rect.h) {
            return btn.id;
        }
    }

    return null;
}

// Pinta ou apaga uma borda do grid quando o jogador clica ou arrasta
function sbPaintEdge(edge) {
    if (!edge) return;
    if (sbPaintMode === 'wall' || sbPaintMode === 'erase') {
        let newVal = (sbPaintMode === 'wall');
        let key = edge.type + '_' + edge.r + '_' + edge.c;
        if (sbLastPainted === key) return;
        sbLastPainted = key;
        // Salva no undo
        if (sbUndoStack.length >= SB_MAX_UNDO) sbUndoStack.shift();
        sbUndoStack.push({
            type: edge.type, r: edge.r, c: edge.c,
            prev: edge.type === 'v' ? sbRightWall[edge.r][edge.c] : sbBottomWall[edge.r][edge.c]
        });
        if (edge.type === 'v') sbRightWall[edge.r][edge.c] = newVal;
        else sbBottomWall[edge.r][edge.c] = newVal;
    }
}

// Desfaz a última ação feita no editor (ctrl+z)
function sbUndoLast() {
    if (sbUndoStack.length === 0) return;
    let a = sbUndoStack.pop();
    if (a.type === 'v') sbRightWall[a.r][a.c] = a.prev;
    else if (a.type === 'h') sbBottomWall[a.r][a.c] = a.prev;
    else if (a.type === 'addCurve') sbCurves.splice(a.idx, 1);
    else if (a.type === 'delCurve') sbCurves.splice(a.idx, 0, a.curve);
}

// Limpa todas as paredes e curvas do editor de uma vez
function sbClearAll() {
    for (let r = 0; r < SB_ROWS; r++) for (let c = 0; c < SB_COLS; c++) { sbRightWall[r][c] = false; sbBottomWall[r][c] = false; }
    sbCurves = [];
    sbCurvePoints = [];
    sbUndoStack = [];
}

// Gera um labirinto aleatório preenchendo paredes com 28% de chance
function sbGenerateRandom() {
    sbClearAll();
    randomSeed(millis());
    let prob = 0.28;
    for (let r = 0; r < SB_ROWS; r++) for (let c = 0; c < SB_COLS - 1; c++) if (random() < prob) sbRightWall[r][c] = true;
    for (let r = 0; r < SB_ROWS - 1; r++) for (let c = 0; c < SB_COLS; c++) if (random() < prob) sbBottomWall[r][c] = true;
    randomSeed(millis());
}

// Monta os obstáculos do sandbox e entra no modo de jogo pra testar o nível
function sbPlayLevel() {
    buildSandboxObstacles();
    discoveredEchoes = [];
    currentPulseRaysData = [];
    pulseTimer = 0;
    hasWon = false;
    showMazeMode = false;
    batVel = createVector(0, 0);
    batHeading = 0;
    camPos = batPos.copy();
    gameState = 'sandboxPlay';
    levelStartTimer = 300;
}

// ==================== EXPORTAR FASE ====================
function sbExportLevel() {
    const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
    let levelNum = TOTAL_LEVELS + 1;
    let lines = [];

    lines.push('');
    lines.push('// ==================== NÍVEL ' + levelNum + ' (Exportado do Sandbox) ====================');
    lines.push('function buildLevel' + levelNum + '() {');

    // Posição inicial do jogador
    let sx = OX + sbStartCell.c * CS + CS / 2;
    let sy = OY + sbStartCell.r * CS + CS / 2;
    lines.push('    batPos = createVector(' + sx + ', ' + sy + ');');

    // Posição da saída
    let ex = OX + sbExitCell.c * CS + CS / 2;
    let ey = OY + sbExitCell.r * CS + CS / 2;
    lines.push('    exitPos = createVector(' + ex + ', ' + ey + ');');
    lines.push('');

    // Borda externa
    lines.push('    // Paredes externas');
    let exitGapX1 = OX + sbExitCell.c * CS - CS / 2;
    let exitGapX2 = OX + sbExitCell.c * CS + CS / 2;
    let totalW = SB_COLS * CS;
    let totalH = SB_ROWS * CS;
    // Parede do topo com abertura da saída
    if (exitGapX1 > OX) lines.push('    addPoly([[' + OX + ', ' + OY + '], [' + exitGapX1 + ', ' + OY + ']]);');
    if (exitGapX2 < OX + totalW) lines.push('    addPoly([[' + exitGapX2 + ', ' + OY + '], [' + (OX + totalW) + ', ' + OY + ']]);');
    // Baixo
    lines.push('    addPoly([[' + OX + ', ' + (OY + totalH) + '], [' + (OX + totalW) + ', ' + (OY + totalH) + ']]);');
    // Esquerda
    lines.push('    addPoly([[' + OX + ', ' + OY + '], [' + OX + ', ' + (OY + totalH) + ']]);');
    // Direita
    lines.push('    addPoly([[' + (OX + totalW) + ', ' + OY + '], [' + (OX + totalW) + ', ' + (OY + totalH) + ']]);');
    lines.push('');

    // Paredes horizontais internas
    lines.push('    // Paredes horizontais internas');
    for (let row = 0; row < SB_ROWS - 1; row++) {
        for (let col = 0; col < SB_COLS; col++) {
            if (sbBottomWall[row][col]) {
                let wx = OX + col * CS;
                let wy = OY + (row + 1) * CS;
                lines.push('    addPoly([[' + wx + ', ' + wy + '], [' + (wx + CS) + ', ' + wy + ']]);');
            }
        }
    }
    lines.push('');

    // Paredes verticais internas
    lines.push('    // Paredes verticais internas');
    for (let col = 0; col < SB_COLS - 1; col++) {
        for (let row = 0; row < SB_ROWS; row++) {
            if (sbRightWall[row][col]) {
                let wx = OX + (col + 1) * CS;
                let wy = OY + row * CS;
                lines.push('    addPoly([[' + wx + ', ' + wy + '], [' + wx + ', ' + (wy + CS) + ']]);');
            }
        }
    }

    // Curvas Bézier
    let singleCurves = sbCurves.filter(c => !c.type || c.type === 'curve');
    let splineCurves = sbCurves.filter(c => c.type === 'spline');
    if (singleCurves.length > 0) {
        lines.push('');
        lines.push('    // Curvas Bézier');
        for (let curve of singleCurves) {
            let p = curve.pts;
            lines.push('    addCurve(' + Math.round(p[0].x) + ', ' + Math.round(p[0].y) + ', ' + Math.round(p[1].x) + ', ' + Math.round(p[1].y) + ', ' + Math.round(p[2].x) + ', ' + Math.round(p[2].y) + ', ' + Math.round(p[3].x) + ', ' + Math.round(p[3].y) + ');');
        }
    }
    if (splineCurves.length > 0) {
        lines.push('');
        lines.push('    // Splines (múltiplos segmentos Bézier)');
        for (let curve of splineCurves) {
            let ptsStr = curve.pts.map(p => '[' + Math.round(p.x) + ', ' + Math.round(p.y) + ']').join(', ');
            lines.push('    addSpline([' + ptsStr + ']);');
        }
    }

    lines.push('}');

    let codeToAppend = lines.join('\n');

    // Registra como fase jogável na hora
    let buildFn = new Function(codeToAppend.replace('function buildLevel' + levelNum + '()', ''));
    // Vamos usar eval pra simplificar:
    eval(codeToAppend);

    customLevels.push(window['buildLevel' + levelNum] || eval('buildLevel' + levelNum));
    TOTAL_LEVELS = 2 + customLevels.length;

    // Copia o código pro clipboard
    let blob = new Blob([codeToAppend], { type: 'text/plain' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeToAppend).then(() => {
            sbExportMsg = '✓ Fase ' + levelNum + ' exportada! Código copiado para o clipboard.';
            sbExportMsgTimer = 180;
            console.log('=== COLE ESTE CÓDIGO NO FINAL DO sketch.js (antes do último }) ===');
            console.log(codeToAppend);
            console.log('=== FIM DO CÓDIGO DA FASE ' + levelNum + ' ===');
            console.log('IMPORTANTE: Altere TOTAL_LEVELS para ' + TOTAL_LEVELS + ' e adicione "else if (level === ' + levelNum + ') buildLevel' + levelNum + '();" no initLevel()');
        });
    } else {
        sbExportMsg = '✓ Fase ' + levelNum + ' registrada! Código no console (F12).';
        sbExportMsgTimer = 180;
        console.log('=== COLE ESTE CÓDIGO NO FINAL DO sketch.js ===');
        console.log(codeToAppend);
        console.log('=== INSTRUÇÕES ===');
        console.log('1. Cole o código acima no final do sketch.js (antes do último })');
        console.log('2. Altere TOTAL_LEVELS para ' + TOTAL_LEVELS);
        console.log('3. Adicione no initLevel(): else if (level === ' + levelNum + ') buildLevel' + levelNum + '();');
    }

    return levelNum;
}



// ==================== MENU ====================
function drawMenu() {
    background(5);
    drawMenuParticles();

    let pulseCount = 3;
    for (let i = 0; i < pulseCount; i++) {
        let radius = ((frameCount * 1.5 + i * 80) % 300);
        let alpha = map(radius, 0, 300, 80, 0);
        noFill(); stroke(0, 255, 140, alpha); strokeWeight(2);
        circle(width / 2, height / 2 - 40, radius * 2);
    }

    drawBat(width / 2, height / 2 - 40, sin(frameCount * 0.03) * 0.3);

    noStroke(); textAlign(CENTER, CENTER);
    fill(0, 180, 80, 60); textSize(58);
    text("ECOLOCALIZAÇÃO", width / 2 + 3, height / 2 + 73);
    fill(0, 255, 120); textSize(58);
    text("ECOLOCALIZAÇÃO", width / 2, height / 2 + 70);
    fill(0, 200, 100, 180); textSize(18);
    text("Navegue na escuridão usando o sonar", width / 2, height / 2 + 115);

    let blinkAlpha = map(sin(frameCount * 0.06), -1, 1, 80, 255);
    fill(0, 255, 150, blinkAlpha); textSize(22);
    text("PRESSIONE  ENTER  PARA  ESCOLHER  PERSONAGEM", width / 2, height / 2 + 170);

    // Botão do sandbox
    fill(0, 150, 255, blinkAlpha * 0.7); textSize(16);
    text("S  —  EDITOR DE LABIRINTO", width / 2, height / 2 + 210);

    fill(100); textSize(14);
    text("Fase " + currentLevel + " de " + TOTAL_LEVELS, width / 2, height - 30);
}

// ==================== CHAR SELECT ====================
function drawCharSelect() {
    background(5);
    drawMenuParticles();

    noStroke(); textAlign(CENTER, CENTER);
    fill(0, 255, 120); textSize(36);
    text("ESCOLHA SEU PERSONAGEM", width / 2, 60);
    fill(0, 200, 100, 150); textSize(14);
    text("← →  para navegar  |  ENTER  para confirmar", width / 2, 100);

    let cardW = 320, cardH = 400, gap = 80;
    let totalW = cardW * 2 + gap;
    let startX = (width - totalW) / 2;
    let cardY = 160;

    for (let i = 0; i < 2; i++) {
        let cx = startX + i * (cardW + gap);
        let isSelected = (i === selectedChar);

        if (isSelected) {
            let glowAlpha = map(sin(frameCount * 0.08), -1, 1, 30, 80);
            fill(0, 255, 120, glowAlpha); noStroke();
            rect(cx - 8, cardY - 8, cardW + 16, cardH + 16, 20);
            stroke(0, 255, 120); strokeWeight(3);
        } else {
            stroke(60); strokeWeight(1);
        }
        fill(isSelected ? color(15, 30, 20) : color(15, 15, 18));
        rect(cx, cardY, cardW, cardH, 16);

        let previewX = cx + cardW / 2, previewY = cardY + 100;
        if (isSelected) {
            noFill();
            let isBat = (i === 0);
            let clr = isBat ? [0, 255, 140] : [0, 150, 255];
            for (let w = 1; w <= 3; w++) {
                let waveR = isBat ? 40 + w * 25 + sin(frameCount * 0.05 + w) * 8 : 30 + w * 18 + sin(frameCount * 0.05 + w) * 6;
                let wAlpha = map(w, 1, 3, isBat ? 80 : 60, isBat ? 20 : 15);
                stroke(clr[0], clr[1], clr[2], wAlpha); strokeWeight(1.5);
                if (isBat) arc(previewX, previewY, waveR * 2, waveR * 2, -PI / 3 - PI / 2, PI / 3 - PI / 2);
                else circle(previewX, previewY, waveR * 2);
            }
        }
        if (i === 0) drawBat(previewX, previewY, -PI / 2);
        else drawDolphin(previewX, previewY, -PI / 2);

        noStroke();
        fill(isSelected ? color(0, 255, 120) : color(120));
        textSize(26); text(CHAR_NAMES[i], cx + cardW / 2, cardY + 200);

        stroke(isSelected ? color(0, 255, 120, 40) : color(40)); strokeWeight(1);
        line(cx + 30, cardY + 225, cx + cardW - 30, cardY + 225);

        noStroke(); fill(isSelected ? color(0, 200, 100, 220) : color(80));
        textSize(14);
        let descLines = CHAR_DESCRIPTIONS[i].split('\n');
        for (let l = 0; l < descLines.length; l++) text(descLines[l], cx + cardW / 2, cardY + 255 + l * 24);

        let iconY = cardY + 320;
        noFill(); strokeWeight(2);
        if (i === 0) {
            stroke(isSelected ? color(0, 255, 140, 150) : color(60));
            let iconCX = cx + cardW / 2;
            line(iconCX, iconY, iconCX - 25, iconY - 30);
            line(iconCX, iconY, iconCX + 25, iconY - 30);
            arc(iconCX, iconY, 50, 60, -PI / 2 - 0.5, -PI / 2 + 0.5);
        } else {
            stroke(isSelected ? color(0, 150, 255, 150) : color(60));
            let iconCX = cx + cardW / 2;
            circle(iconCX, iconY - 15, 40); circle(iconCX, iconY - 15, 25);
            fill(isSelected ? color(0, 150, 255, 80) : color(40));
            circle(iconCX, iconY - 15, 8);
        }

        if (isSelected) {
            noStroke();
            let selAlpha = map(sin(frameCount * 0.1), -1, 1, 150, 255);
            fill(i === 0 ? color(0, 255, 120, selAlpha) : color(0, 150, 255, selAlpha));
            textSize(16); text("▶  SELECIONADO  ◀", cx + cardW / 2, cardY + cardH - 25);
        }
    }
}

// ==================== LEVEL COMPLETE ====================
function drawLevelComplete() {
    background(5);
    let progress = levelCompleteTimer / LEVEL_COMPLETE_DURATION;
    let radius = progress * 600;
    for (let i = 5; i >= 0; i--) {
        let r = radius - i * 40;
        if (r > 0) { noFill(); stroke(0, 255, 120, map(i, 0, 5, 60, 5)); strokeWeight(3); circle(width / 2, height / 2, r * 2); }
    }
    noStroke(); textAlign(CENTER, CENTER);
    fill(0, 255, 120); textSize(52);
    text("FASE " + currentLevel + " COMPLETA!", width / 2, height / 2 - 30);

    if (currentLevel < TOTAL_LEVELS) {
        let blinkAlpha = map(sin(frameCount * 0.08), -1, 1, 80, 255);
        fill(0, 200, 100, blinkAlpha); textSize(22);
        text("PRESSIONE  ENTER  PARA  A  PRÓXIMA  FASE", width / 2, height / 2 + 40);
    }
    levelCompleteTimer++;
}

// ==================== GAME COMPLETE ====================
function drawGameComplete() {
    background(5);
    for (let p of menuParticles) {
        p.x += cos(p.angle) * p.speed * 2; p.y += sin(p.angle) * p.speed * 2;
        p.angle += random(-0.05, 0.05);
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0; if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
        fill(0, 255, random(80, 200), p.alpha * 1.5); noStroke(); circle(p.x, p.y, p.size * 1.5);
    }
    if (selectedChar === 0) drawBat(width / 2, height / 2 - 80, sin(frameCount * 0.05) * 0.5);
    else drawDolphin(width / 2, height / 2 - 80, sin(frameCount * 0.05) * 0.5);
    noStroke(); textAlign(CENTER, CENTER);
    fill(0, 255, 120); textSize(56); text("VOCÊ ESCAPOU!", width / 2, height / 2 + 30);
    fill(0, 200, 100, 200); textSize(20);
    text("Todas as fases foram concluídas com o " + CHAR_NAMES[selectedChar] + "!", width / 2, height / 2 + 80);
    let blinkAlpha = map(sin(frameCount * 0.06), -1, 1, 80, 255);
    fill(0, 255, 150, blinkAlpha); textSize(18);
    text("PRESSIONE  ENTER  PARA  RECOMEÇAR", width / 2, height / 2 + 130);
}

// ==================== INIT LEVEL ====================
function initLevel(level) {
    obstacles = []; discoveredEchoes = []; currentPulseRaysData = [];
    pulseTimer = 0; hasWon = false; showMazeMode = false;
    batVel = createVector(0, 0); batHeading = 0;
    if (level === 1) buildLevel1();
    else if (level === 2) buildLevel2();
    else if (level === 3) buildLevel3();
    else if (level > 3 && customLevels[level - 4]) customLevels[level - 4]();
    camPos = batPos.copy();
    levelStartTimer = 300;
}

// Inicia o jogo a partir do nível atual selecionado
function startGame() {
    initLevel(currentLevel);
    // Na fase 1, exibe o mini-tutorial antes de liberar o movimento
    if (currentLevel === 1) gameState = 'tutorial';
    else gameState = 'playing';
}

// ==================== NÍVEL 1 (FIZ NO BRAÇO) ====================
function buildLevel1() {

    batPos = createVector(430, 415);
    exitPos = createVector(1110, 75);

    // 1. Quadrado Central
    addPoly([[350, 350], [560, 350]]); // Topo
    addPoly([[350, 480], [560, 480]]); // Fundo
    addPoly([[350, 350], [350, 420]]); // Esquerda Cima
    addPoly([[560, 350], [560, 380]]); // Direita Cima
    addPoly([[560, 480], [560, 440]]); // Direita Baixo

    // 2. Setor Superior Esquerdo
    addPoly([[350, 420], [260, 420], [260, 280], [450, 280], [450, 200], [260, 200], [260, 140], [520, 140], [520, 60], [20, 60], [20, 280], [180, 280], [180, 200], [100, 200]]);

    // Parede inferior do corredor esquerdo
    addPoly([[280, 480], [180, 480], [180, 280], [20, 370], [20, 780], [520, 780], [520, 720], [100, 720], [100, 520], [220, 520], [220, 650], [450, 650], [450, 700], [550, 700], [550, 780], [650, 780]]);

    // Curvas de conexão abaixo da sala
    addCurve(350, 480, 350, 600, 520, 500, 520, 650);
    addPoly([[520, 650], [650, 650], [650, 720], [650, 720], [850, 720]]);

    // 3. Corredores Centrais Orgânicos (Caminho sinuoso com múltiplos picos usando Spline)
    addSpline([
        [560, 380], [650, 250], [650, 500], // Segmento 1
        [670, 380],                          // Ponto de conexão (suave)
        [700, 260], [750, 620], [780, 500]  // Segmento 2
    ]);
    addSpline([
        [560, 440], [620, 320], [820, 780], // Segmento 1
        [640, 580],                          // Ponto de conexão (suave)
        [640, 580], [720, 780], [780, 570]  // Segmento 2
    ]);

    // 4. Setor Direito e Saída
    addPoly([[780, 570], [780, 600], [850, 600], [850, 720]]);
    addPoly([[650, 780], [920, 780], [920, 620], [1220, 620], [1220, 50], [1060, 50], [1060, 100], [1160, 100]]);
    addPoly([[780, 500], [780, 450], [880, 450], [880, 350], [700, 350], [700, 150], [1080, 150], [1080, 240], [850, 240], [850, 300], [1120, 300], [1120, 380], [920, 380], [920, 550], [1020, 550], [1020, 450], [1160, 450], [1160, 100]]);
}


// ==================== NÍVEL 2 (CRIADO COM SANDBOX) ====================

function buildLevel2() {

    batPos = createVector(108, 454);
    exitPos = createVector(500, 286);

    // Paredes externas
    addPoly([[80, 90], [864, 90]]);
    addPoly([[80, 650], [864, 650]]);
    addPoly([[80, 90], [80, 650]]);
    addPoly([[864, 90], [864, 650]]);

    // Paredes horizontais internas
    addPoly([[416, 146], [472, 146]]);
    addPoly([[528, 146], [584, 146]]);
    addPoly([[640, 202], [696, 202]]);
    addPoly([[192, 258], [248, 258]]);
    addPoly([[248, 258], [304, 258]]);
    addPoly([[360, 258], [416, 258]]);
    addPoly([[416, 258], [472, 258]]);
    addPoly([[528, 258], [584, 258]]);
    addPoly([[584, 258], [640, 258]]);
    addPoly([[696, 258], [752, 258]]);
    addPoly([[752, 258], [808, 258]]);
    addPoly([[304, 314], [360, 314]]);
    addPoly([[360, 314], [416, 314]]);
    addPoly([[472, 314], [528, 314]]);
    addPoly([[136, 370], [192, 370]]);
    addPoly([[304, 370], [360, 370]]);
    addPoly([[472, 370], [528, 370]]);
    addPoly([[80, 426], [136, 426]]);
    addPoly([[136, 426], [192, 426]]);
    addPoly([[304, 426], [360, 426]]);
    addPoly([[416, 426], [472, 426]]);
    addPoly([[528, 426], [584, 426]]);
    addPoly([[584, 426], [640, 426]]);
    addPoly([[80, 482], [136, 482]]);
    addPoly([[248, 482], [304, 482]]);
    addPoly([[416, 482], [472, 482]]);
    addPoly([[528, 482], [584, 482]]);
    addPoly([[584, 482], [640, 482]]);
    addPoly([[696, 482], [752, 482]]);
    addPoly([[192, 538], [248, 538]]);
    addPoly([[248, 538], [304, 538]]);
    addPoly([[416, 538], [472, 538]]);
    addPoly([[472, 538], [528, 538]]);
    addPoly([[584, 538], [640, 538]]);
    addPoly([[136, 594], [192, 594]]);
    addPoly([[192, 594], [248, 594]]);
    addPoly([[248, 594], [304, 594]]);
    addPoly([[304, 594], [360, 594]]);
    addPoly([[360, 594], [416, 594]]);
    addPoly([[416, 594], [472, 594]]);
    addPoly([[472, 594], [528, 594]]);
    addPoly([[584, 594], [640, 594]]);
    addPoly([[640, 594], [696, 594]]);
    addPoly([[696, 594], [752, 594]]);
    addPoly([[808, 594], [864, 594]]);

    // Paredes verticais internas
    addPoly([[136, 370], [136, 426]]);
    addPoly([[136, 482], [136, 538]]);
    addPoly([[136, 538], [136, 594]]);
    addPoly([[192, 258], [192, 314]]);
    addPoly([[192, 314], [192, 370]]);
    addPoly([[248, 258], [248, 314]]);
    addPoly([[248, 314], [248, 370]]);
    addPoly([[248, 370], [248, 426]]);
    addPoly([[248, 426], [248, 482]]);
    addPoly([[304, 90], [304, 146]]);
    addPoly([[304, 146], [304, 202]]);
    addPoly([[304, 202], [304, 258]]);
    addPoly([[304, 258], [304, 314]]);
    addPoly([[304, 370], [304, 426]]);
    addPoly([[304, 482], [304, 538]]);
    addPoly([[360, 146], [360, 202]]);
    addPoly([[360, 202], [360, 258]]);
    addPoly([[360, 258], [360, 314]]);
    addPoly([[360, 426], [360, 482]]);
    addPoly([[360, 538], [360, 594]]);
    addPoly([[416, 146], [416, 202]]);
    addPoly([[416, 202], [416, 258]]);
    addPoly([[416, 258], [416, 314]]);
    addPoly([[416, 314], [416, 370]]);
    addPoly([[416, 426], [416, 482]]);
    addPoly([[416, 538], [416, 594]]);
    addPoly([[472, 146], [472, 202]]);
    addPoly([[472, 202], [472, 258]]);
    addPoly([[472, 258], [472, 314]]);
    addPoly([[472, 370], [472, 426]]);
    addPoly([[528, 146], [528, 202]]);
    addPoly([[528, 202], [528, 258]]);
    addPoly([[528, 258], [528, 314]]);
    addPoly([[528, 314], [528, 370]]);
    addPoly([[528, 594], [528, 650]]);
    addPoly([[584, 146], [584, 202]]);
    addPoly([[584, 202], [584, 258]]);
    addPoly([[584, 258], [584, 314]]);
    addPoly([[584, 314], [584, 370]]);
    addPoly([[584, 370], [584, 426]]);
    addPoly([[584, 482], [584, 538]]);
    addPoly([[640, 90], [640, 146]]);
    addPoly([[640, 146], [640, 202]]);
    addPoly([[640, 426], [640, 482]]);
    addPoly([[640, 538], [640, 594]]);
    addPoly([[696, 202], [696, 258]]);
    addPoly([[696, 370], [696, 426]]);
    addPoly([[696, 426], [696, 482]]);
    addPoly([[696, 538], [696, 594]]);
    addPoly([[752, 370], [752, 426]]);
    addPoly([[752, 426], [752, 482]]);
    addPoly([[752, 482], [752, 538]]);
    addPoly([[752, 538], [752, 594]]);
    addPoly([[808, 258], [808, 314]]);
    addPoly([[808, 314], [808, 370]]);
    addPoly([[808, 370], [808, 426]]);
    addPoly([[808, 426], [808, 482]]);
    addPoly([[808, 482], [808, 538]]);
    addPoly([[808, 538], [808, 594]]);
}

// ==================== NÍVEL 3 (CRIADO COM SANDBOX AGORA COM BEZIER) ====================
function buildLevel3() {

    batPos = createVector(510, 380);
    exitPos = createVector(550, 100);

    // Paredes externas
    addPoly([[50, 80], [510, 80]]);
    addPoly([[550, 80], [930, 80]]);
    addPoly([[50, 640], [930, 640]]);
    addPoly([[50, 80], [50, 640]]);
    addPoly([[930, 80], [930, 640]]);

    // Paredes horizontais internas
    addPoly([[530, 120], [570, 120]]);
    addPoly([[570, 120], [610, 120]]);
    addPoly([[610, 120], [650, 120]]);
    addPoly([[650, 120], [690, 120]]);
    addPoly([[690, 120], [730, 120]]);
    addPoly([[730, 120], [770, 120]]);
    addPoly([[770, 120], [810, 120]]);
    addPoly([[490, 160], [530, 160]]);
    addPoly([[610, 160], [650, 160]]);
    addPoly([[650, 160], [690, 160]]);
    addPoly([[690, 160], [730, 160]]);
    addPoly([[730, 160], [770, 160]]);
    addPoly([[490, 200], [530, 200]]);
    addPoly([[570, 200], [610, 200]]);
    addPoly([[650, 200], [690, 200]]);
    addPoly([[690, 200], [730, 200]]);
    addPoly([[530, 240], [570, 240]]);
    addPoly([[570, 240], [610, 240]]);
    addPoly([[610, 240], [650, 240]]);
    addPoly([[650, 240], [690, 240]]);
    addPoly([[530, 280], [570, 280]]);
    addPoly([[570, 280], [610, 280]]);
    addPoly([[610, 280], [650, 280]]);
    addPoly([[490, 320], [530, 320]]);
    addPoly([[570, 320], [610, 320]]);
    addPoly([[610, 320], [650, 320]]);
    addPoly([[650, 320], [690, 320]]);
    addPoly([[690, 320], [730, 320]]);
    addPoly([[730, 320], [770, 320]]);
    addPoly([[770, 320], [810, 320]]);
    addPoly([[810, 320], [850, 320]]);
    addPoly([[50, 400], [90, 400]]);
    addPoly([[90, 400], [130, 400]]);
    addPoly([[170, 400], [210, 400]]);
    addPoly([[210, 400], [250, 400]]);
    addPoly([[250, 400], [290, 400]]);
    addPoly([[330, 400], [370, 400]]);
    addPoly([[370, 400], [410, 400]]);
    addPoly([[50, 440], [90, 440]]);
    addPoly([[90, 440], [130, 440]]);
    addPoly([[170, 440], [210, 440]]);
    addPoly([[210, 440], [250, 440]]);
    addPoly([[250, 440], [290, 440]]);
    addPoly([[290, 440], [330, 440]]);
    addPoly([[330, 440], [370, 440]]);
    addPoly([[370, 440], [410, 440]]);
    addPoly([[490, 440], [530, 440]]);
    addPoly([[570, 480], [610, 480]]);
    addPoly([[530, 520], [570, 520]]);
    addPoly([[570, 520], [610, 520]]);

    // Paredes verticais internas
    addPoly([[130, 320], [130, 360]]);
    addPoly([[130, 360], [130, 400]]);
    addPoly([[130, 440], [130, 480]]);
    addPoly([[130, 480], [130, 520]]);
    addPoly([[130, 520], [130, 560]]);
    addPoly([[170, 320], [170, 360]]);
    addPoly([[170, 360], [170, 400]]);
    addPoly([[170, 440], [170, 480]]);
    addPoly([[170, 480], [170, 520]]);
    addPoly([[170, 520], [170, 560]]);
    addPoly([[290, 360], [290, 400]]);
    addPoly([[330, 360], [330, 400]]);
    addPoly([[410, 400], [410, 440]]);
    addPoly([[450, 360], [450, 400]]);
    addPoly([[450, 400], [450, 440]]);
    addPoly([[530, 80], [530, 120]]);
    addPoly([[530, 120], [530, 160]]);
    addPoly([[530, 200], [530, 240]]);
    addPoly([[530, 280], [530, 320]]);
    addPoly([[530, 440], [530, 480]]);
    addPoly([[530, 480], [530, 520]]);
    addPoly([[570, 120], [570, 160]]);
    addPoly([[570, 160], [570, 200]]);
    addPoly([[570, 320], [570, 360]]);
    addPoly([[570, 360], [570, 400]]);
    addPoly([[570, 400], [570, 440]]);
    addPoly([[570, 440], [570, 480]]);
    addPoly([[610, 120], [610, 160]]);
    addPoly([[650, 160], [650, 200]]);
    addPoly([[650, 240], [650, 280]]);
    addPoly([[690, 240], [690, 280]]);
    addPoly([[690, 280], [690, 320]]);
    addPoly([[730, 200], [730, 240]]);
    addPoly([[730, 240], [730, 280]]);
    addPoly([[770, 160], [770, 200]]);
    addPoly([[770, 240], [770, 280]]);
    addPoly([[770, 280], [770, 320]]);
    addPoly([[810, 120], [810, 160]]);
    addPoly([[810, 160], [810, 200]]);
    addPoly([[810, 200], [810, 240]]);
    addPoly([[810, 280], [810, 320]]);
    addPoly([[850, 80], [850, 120]]);
    addPoly([[850, 120], [850, 160]]);
    addPoly([[850, 160], [850, 200]]);
    addPoly([[850, 200], [850, 240]]);
    addPoly([[850, 240], [850, 280]]);
    addPoly([[850, 280], [850, 320]]);

    // Splines (múltiplos segmentos Bézier)
    addSpline([[492, 440], [490, 749], [310, 329], [274, 568], [248, 658], [118, 617], [132, 564]]);
    addSpline([[449, 439], [491, 622], [318, 352], [253, 499], [217, 653], [174, 561], [170, 559]]);
    addSpline([[449, 362], [450, 283], [371, 264], [402, 352], [408, 438], [338, 276], [330, 363]]);
    addSpline([[290, 362], [289, 270], [175, 392], [212, 300], [338, 170], [397, 241], [491, 320]]);
    addSpline([[608, 519], [692, 631], [966, 615], [727, 502], [937, 374], [665, 392], [607, 479]]);
    addSpline([[170, 323], [206, 182], [-1, 107], [294, 192], [540, 305], [575, 299], [493, 200]]);
    addSpline([[130, 324], [154, 210], [96, 193], [68, 154], [-24, 66], [323, 172], [492, 161]]);
}

// ==================== MÚSICA DE FUNDO ====================
function manageMusic() {
    if (!bgmMenu || !bgmMenu.isLoaded() || !bgmPlaying || !bgmPlaying.isLoaded()) return;

    if (getAudioContext().state !== 'running') {
        return; // Aguarda o navegador liberar o áudio antes de tentar tocar qualquer coisa
    }

    // Define qual música deve tocar baseado no estado atual
    let targetBgm = (gameState === 'playing' || gameState === 'tutorial' || gameState === 'sandboxPlay') ? bgmPlaying : bgmMenu;

    if (currentBgm !== targetBgm) {
        if (currentBgm) currentBgm.stop();
        currentBgm = targetBgm;
        currentBgm.setVolume(0.4); // Volume médio
        currentBgm.loop();
    } else if (!currentBgm.isPlaying()) {
        currentBgm.setVolume(0.4);
        currentBgm.loop(); // Failsafe para garantir que está tocando
    }
}

// ==================== DRAW PRINCIPAL ====================
function draw() {
    manageMusic();

    if (gameState === 'menu') { drawMenu(); return; }
    if (gameState === 'charSelect') { drawCharSelect(); return; }
    if (gameState === 'levelComplete') { drawLevelComplete(); return; }
    if (gameState === 'gameComplete') { drawGameComplete(); return; }
    if (gameState === 'sandbox') { drawSandbox(); return; }

    // sandboxPlay ou jogando
    background(10);
    moveBat();
    batVel.mult(BAT_DRAG);

    // Colisão com empurrão pra não ficar preso nas paredes Bézier
    const PLAYER_R = 8;
    let newPos = createVector(batPos.x + batVel.x, batPos.y + batVel.y);
    let d = sceneSDF(newPos);
    if (d > PLAYER_R) {
        // Livre pra mover
        batPos = newPos;
    } else {
        // Tenta cada eixo separado
        let nx = createVector(batPos.x + batVel.x, batPos.y);
        let ny = createVector(batPos.x, batPos.y + batVel.y);
        let dx = sceneSDF(nx);
        let dy = sceneSDF(ny);
        if (dx > PLAYER_R) batPos.x += batVel.x; else batVel.x = 0;
        if (dy > PLAYER_R) batPos.y += batVel.y; else batVel.y = 0;

        // Se o jogador entrou na parede, empurra ele pra fora
        let curD = sceneSDF(batPos);
        if (curD < PLAYER_R) {
            // Calcula o gradiente (direção pra longe da parede)
            let eps = 1.0;
            let gx = sceneSDF(createVector(batPos.x + eps, batPos.y)) - sceneSDF(createVector(batPos.x - eps, batPos.y));
            let gy = sceneSDF(createVector(batPos.x, batPos.y + eps)) - sceneSDF(createVector(batPos.x, batPos.y - eps));
            let glen = Math.sqrt(gx * gx + gy * gy);
            if (glen > 0.001) {
                gx /= glen; gy /= glen;
                let pushDist = PLAYER_R - curD + 0.5;
                batPos.x += gx * pushDist;
                batPos.y += gy * pushDist;
            }
        }
    }

    if (p5.Vector.dist(batPos, exitPos) < 40) {
        if (gameState === 'sandboxPlay') {
            // Ganhou a fase sandbox — volta pro editor
            gameState = 'sandbox';
            return;
        }
        if (currentLevel < TOTAL_LEVELS) { gameState = 'levelComplete'; levelCompleteTimer = 0; }
        else { gameState = 'gameComplete'; }
        return;
    }

    camPos.x = lerp(camPos.x, batPos.x, CAM_LERP);
    camPos.y = lerp(camPos.y, batPos.y, CAM_LERP);

    push();
    translate(width / 2, height / 2);
    scale(CAM_ZOOM);
    translate(-camPos.x, -camPos.y);

    if (showMazeMode) drawFullMaze();
    drawEchoes();
    if (pulseTimer > 0) { drawPulse(); pulseTimer--; } else { currentPulseRaysData = []; }
    if (sonarCooldown > 0) sonarCooldown--;

    fill(0, 150, 50, 100); circle(exitPos.x, exitPos.y, 60);

    if (selectedChar === 0) drawBat(batPos.x, batPos.y, batHeading);
    else drawDolphin(batPos.x, batPos.y, batHeading);
    pop();

    // HUD
    noStroke(); fill(0, 255, 120, 150); textAlign(LEFT, TOP); textSize(14);
    let hudLabel = gameState === 'sandboxPlay' ? 'SANDBOX  |  ' + CHAR_NAMES[selectedChar] : 'Fase ' + currentLevel + ' / ' + TOTAL_LEVELS + '  |  ' + CHAR_NAMES[selectedChar];
    text(hudLabel, 15, 15);

    // Barra de cooldown
    let barW = 120, barH = 6, barX = 15, barY = 36;
    let cooldownProgress = 1 - (sonarCooldown / SONAR_COOLDOWN);
    fill(40); noStroke(); rect(barX, barY, barW, barH, 3);
    if (cooldownProgress >= 1) fill(selectedChar === 0 ? color(0, 255, 120) : color(0, 150, 255));
    else fill(selectedChar === 0 ? color(0, 120, 60) : color(0, 70, 130));
    rect(barX, barY, barW * cooldownProgress, barH, 3);
    fill(cooldownProgress >= 1 ? 200 : 80); textSize(10);
    text(cooldownProgress >= 1 ? 'SONAR PRONTO' : 'RECARREGANDO...', barX + barW + 8, barY - 1);

    // HUD extras do sandbox
    if (gameState === 'sandboxPlay') {
        fill(0, 150, 255, 180); textSize(13); textAlign(RIGHT, TOP);
        text('ESC → voltar ao editor', width - 15, 15);
    }

    // Instruções no início da fase
    if (levelStartTimer > 0 && gameState !== 'tutorial') {
        let alphaFade = map(levelStartTimer, 0, 60, 0, 180, true);
        fill(0, 255, 120, alphaFade); textSize(11); textAlign(LEFT, TOP);
        text('Mover usando as setas, e apenas M para usar raio', barX, barY + 15);
        levelStartTimer--;
    }

    if (gameState === 'tutorial') {
        drawTutorialOverlay();
    }
}

// Lê as setas do teclado e move o morcego
function moveBat() {
    // Impede o movimento do jogador enquanto a tela de tutorial estiver aberta
    if (gameState === 'tutorial') return;
    if (keyIsDown(LEFT_ARROW)) { batVel.x -= 0.5; batHeading = PI; }
    if (keyIsDown(RIGHT_ARROW)) { batVel.x += 0.5; batHeading = 0; }
    if (keyIsDown(UP_ARROW)) { batVel.y -= 0.5; batHeading = -PI / 2; }
    if (keyIsDown(DOWN_ARROW)) { batVel.y += 0.5; batHeading = PI / 2; }
    if (keyIsDown(UP_ARROW) && keyIsDown(RIGHT_ARROW)) batHeading = -PI / 4;
    if (keyIsDown(UP_ARROW) && keyIsDown(LEFT_ARROW)) batHeading = -3 * PI / 4;
    if (keyIsDown(DOWN_ARROW) && keyIsDown(RIGHT_ARROW)) batHeading = PI / 4;
    if (keyIsDown(DOWN_ARROW) && keyIsDown(LEFT_ARROW)) batHeading = 3 * PI / 4;
}

// Desenha os pontos deixados pelos hits do sonar
function drawEchoes() {
    noStroke();
    if (selectedChar === 0) fill(0, 255, 100); else fill(0, 150, 255);
    for (let pt of discoveredEchoes) circle(pt.x, pt.y, 4);
}

// Desenha o labirinto inteiro (modo debug ou quando o nível é vencido)
function drawFullMaze() {
    noFill(); stroke(100); strokeCap(ROUND); strokeJoin(ROUND);
    for (let obs of obstacles) {
        if (obs.type === 'capsule') { strokeWeight(obs.r * 2); line(obs.a.x, obs.a.y, obs.b.x, obs.b.y); }
        else if (obs.type === 'bezier') { strokeWeight(obs.thickness * 2); bezier(obs.pts[0].x, obs.pts[0].y, obs.pts[1].x, obs.pts[1].y, obs.pts[2].x, obs.pts[2].y, obs.pts[3].x, obs.pts[3].y); }
    }
    strokeWeight(1);
}

// Desenha os raios do sonar e marcadores de hit durante o pulso
function drawPulse() {
    let sonarR = selectedChar === 0 ? 0 : 0, sonarG = selectedChar === 0 ? 255 : 150, sonarB = selectedChar === 0 ? 150 : 255;
    for (let rayData of currentPulseRaysData) {
        stroke(sonarR, sonarG, sonarB, map(pulseTimer, 0, PULSE_DURATION, 0, 80));
        line(rayData.ro.x, rayData.ro.y, rayData.hitPos.x, rayData.hitPos.y);
        if (showSteps) { for (let step of rayData.stepsData) { stroke(sonarR, sonarG + 50, sonarB, map(pulseTimer, 0, PULSE_DURATION, 0, 30)); noFill(); circle(step.pos.x, step.pos.y, step.radius * 2); } }
        if (rayData.hit) { fill(selectedChar === 0 ? color(255, 0, 0) : color(0, 100, 255), map(pulseTimer, 0, PULSE_DURATION, 0, 255)); noStroke(); circle(rayData.hitPos.x, rayData.hitPos.y, 6); }
    }
}

// ==================== SONAR ====================
// Dispara o sonar se o cooldown já acabou
function emitSonar() {
    if (sonarCooldown > 0) return;
    currentPulseRaysData = [];
    if (selectedChar === 0) emitBatSonar(); else emitDolphinSonar();
    pulseTimer = PULSE_DURATION; sonarCooldown = SONAR_COOLDOWN;
}

// Sonar em cone — só cobre a direção que o morcego tá olhando
function emitBatSonar() {
    let fov = radians(BAT_FOV), numRays = BAT_RAYS, maxRange = BAT_RANGE;
    for (let i = 0; i <= numRays; i++) {
        let angle = map(i, 0, numRays, batHeading - fov / 2, batHeading + fov / 2);
        let rd = p5.Vector.fromAngle(angle);
        let result = rayMarch(batPos, rd, maxRange, showSteps);
        currentPulseRaysData.push({ ro: batPos.copy(), hitPos: result.pos, hit: result.hit, stepsData: result.stepsData });
        if (result.hit) discoveredEchoes.push(result.pos.copy());
    }
}

// Sonar 360° — alcance menor mas cobre todas as direções
function emitDolphinSonar() {
    let numRays = DOLPHIN_RAYS, maxRange = DOLPHIN_RANGE;
    for (let i = 0; i < numRays; i++) {
        let angle = map(i, 0, numRays, 0, TWO_PI);
        let rd = p5.Vector.fromAngle(angle);
        let result = rayMarch(batPos, rd, maxRange, showSteps);
        currentPulseRaysData.push({ ro: batPos.copy(), hitPos: result.pos, hit: result.hit, stepsData: result.stepsData });
        if (result.hit) discoveredEchoes.push(result.pos.copy());
    }
}

// Caminha ao longo de um raio usando sphere tracing (algoritmo de ray marching)
function rayMarch(ro, rd, maxRange, collectSteps) {
    let totalDist = 0, currentPos = ro.copy(), stepsData = [];
    for (let i = 0; i < 35; i++) {
        currentPos = p5.Vector.add(ro, p5.Vector.mult(rd, totalDist));
        let d = sceneSDF(currentPos);
        if (collectSteps) stepsData.push({ pos: currentPos.copy(), radius: d });
        if (d < 1.5) return { hit: true, pos: currentPos, stepsData };
        totalDist += d;
        if (totalDist > maxRange) break;
    }
    return { hit: false, pos: currentPos, stepsData };
}

// ==================== CONSTRUÇÃO GEOMÉTRICA GERAL ====================
// Adiciona uma polilinha (sequência de segmentos retos) aos obstáculos
function addPoly(pts) { for (let i = 0; i < pts.length - 1; i++) obstacles.push({ type: 'capsule', a: createVector(pts[i][0], pts[i][1]), b: createVector(pts[i + 1][0], pts[i + 1][1]), r: WALL_THICKNESS }); }
// Adiciona uma curva bézier aos obstáculos do cenário
function addCurve(x1, y1, cx1, cy1, cx2, cy2, x2, y2) { obstacles.push({ type: 'bezier', pts: [createVector(x1, y1), createVector(cx1, cy1), createVector(cx2, cy2), createVector(x2, y2)], thickness: WALL_THICKNESS }); }
// Adiciona uma spline (cadeia de curvas bézier conectadas) aos obstáculos
function addSpline(ptsArray) { for (let i = 0; i < ptsArray.length - 3; i += 3) addCurve(ptsArray[i][0], ptsArray[i][1], ptsArray[i + 1][0], ptsArray[i + 1][1], ptsArray[i + 2][0], ptsArray[i + 2][1], ptsArray[i + 3][0], ptsArray[i + 3][1]); }

// Distância do ponto p até o segmento de reta a→b
function sdfSegment(p, a, b) {
    let pa = p5.Vector.sub(p, a), ba = p5.Vector.sub(b, a);
    let h = constrain(p5.Vector.dot(pa, ba) / p5.Vector.dot(ba, ba), 0, 1);
    return p5.Vector.dist(pa, p5.Vector.mult(ba, h));
}

// Cápsula = segmento com espessura (raio r)
function sdfCapsule(p, a, b, r) { return sdfSegment(p, a, b) - r; }

// SDF pra uma bezier — quebra a curva em pedacinhos e checa cada um
function sdfBezier(p, pts, thickness) {
    let minDist = Infinity; const steps = 15;
    let prev = createVector(bezierPoint(pts[0].x, pts[1].x, pts[2].x, pts[3].x, 0), bezierPoint(pts[0].y, pts[1].y, pts[2].y, pts[3].y, 0));
    for (let i = 1; i <= steps; i++) { let t = i / steps; let curr = createVector(bezierPoint(pts[0].x, pts[1].x, pts[2].x, pts[3].x, t), bezierPoint(pts[0].y, pts[1].y, pts[2].y, pts[3].y, t)); minDist = Math.min(minDist, sdfCapsule(p, prev, curr, thickness)); prev = curr; }
    return minDist;
}

// Distância mínima do ponto p até qualquer obstáculo da cena
function sceneSDF(p) {
    let minDist = sdfBoundary(p);
    for (let obs of obstacles) {
        if (obs.type === 'capsule') minDist = Math.min(minDist, sdfCapsule(p, obs.a, obs.b, obs.r));
        else if (obs.type === 'bezier') minDist = Math.min(minDist, sdfBezier(p, obs.pts, obs.thickness));
    }
    return minDist;
}

// ==================== SPRITES ====================
function drawBat(x, y, angle) {
    push(); translate(x, y); rotate(angle + PI / 2); scale(0.8); fill(80); noStroke();
    let wingBounce = sin(frameCount * 0.3) * 15;
    ellipse(0, 0, 12, 25);
    triangle(-4, -10, -8, -18, -2, -8); triangle(4, -10, 8, -18, 2, -8);
    fill(60);
    beginShape(); vertex(-6, -3); bezierVertex(-15, -7, -35, wingBounce, -35, wingBounce + 15); bezierVertex(-20, 15, -10, 10, -3, 7); endShape();
    beginShape(); vertex(6, -3); bezierVertex(15, -7, 35, wingBounce, 35, wingBounce + 15); bezierVertex(20, 15, 10, 10, 3, 7); endShape();
    pop();
}

// Desenha o sprite do golfinho com animação das nadadeiras
function drawDolphin(x, y, angle) {
    push(); translate(x, y); rotate(angle + PI / 2); scale(0.8); noStroke();
    fill(90, 130, 170);
    beginShape(); vertex(0, -18); bezierVertex(-6, -14, -10, -4, -9, 6); bezierVertex(-8, 12, -4, 18, 0, 22); bezierVertex(4, 18, 8, 12, 9, 6); bezierVertex(10, -4, 6, -14, 0, -18); endShape(CLOSE);
    fill(140, 180, 210);
    beginShape(); vertex(0, -10); bezierVertex(-4, -6, -6, 0, -5, 8); bezierVertex(-3, 14, -1, 18, 0, 20); bezierVertex(1, 18, 3, 14, 5, 8); bezierVertex(6, 0, 4, -6, 0, -10); endShape(CLOSE);
    fill(90, 130, 170);
    beginShape(); vertex(-2, -18); vertex(0, -26); vertex(2, -18); endShape(CLOSE);
    fill(70, 110, 150);
    beginShape(); vertex(0, -6); bezierVertex(-2, -8, -10, -14, -12, -10); bezierVertex(-10, -6, -4, -2, 0, 0); endShape(CLOSE);
    let finBounce = sin(frameCount * 0.25) * 8;
    fill(70, 110, 150);
    beginShape(); vertex(-6, 0); bezierVertex(-10, 2, -22, finBounce, -20, finBounce + 8); bezierVertex(-14, 8, -8, 6, -5, 4); endShape(CLOSE);
    beginShape(); vertex(6, 0); bezierVertex(10, 2, 22, finBounce, 20, finBounce + 8); bezierVertex(14, 8, 8, 6, 5, 4); endShape(CLOSE);
    let tailSwing = sin(frameCount * 0.2) * 4;
    fill(70, 110, 150);
    beginShape(); vertex(-1, 20); bezierVertex(-4, 24, -12 + tailSwing, 28, -14 + tailSwing, 24); bezierVertex(-10 + tailSwing, 22, -4, 20, 0, 22); endShape(CLOSE);
    beginShape(); vertex(1, 20); bezierVertex(4, 24, 12 + tailSwing, 28, 14 + tailSwing, 24); bezierVertex(10 + tailSwing, 22, 4, 20, 0, 22); endShape(CLOSE);
    fill(20); ellipse(-5, -12, 3, 3); fill(255); ellipse(-4.5, -12.5, 1.2, 1.2);
    pop();
}

// Distância do jogador até a borda da área jogável
function sdfBoundary(p) {
    // Sandbox usa os limites do grid, jogo normal usa área maior
    if (gameState === 'sandboxPlay') {
        const OX = SB_OX, OY = SB_OY, CS = SB_CELL;
        let margin = 10;
        return Math.min(p.x - (OX - margin), p.y - (OY - margin), (OX + SB_COLS * CS + margin) - p.x, (OY + SB_ROWS * CS + margin) - p.y);
    }
    let margin = 10;
    return Math.min(p.x - margin, p.y - margin, (width * 2 - margin) - p.x, (height * 2 - margin) - p.y);
}

// ==================== INPUT ====================
function keyPressed() {
    if (getAudioContext().state !== 'running') userStartAudio(); // Força desbloqueio do áudio
    
    if (gameState === 'sandbox') {
        if (key === 'z' || key === 'Z') sbUndoLast();
        if (keyCode === ESCAPE && sbCurvePoints.length > 0) { sbCurvePoints = []; return; }
        if ((keyCode === ENTER || keyCode === RETURN) && sbCurvePoints.length === 0) { sbPlayLevel(); }
        return;
    }
    if (gameState === 'sandboxPlay') {
        if (keyCode === ESCAPE) { gameState = 'sandbox'; return; }
        if (key === 'm' || key === 'M') emitSonar();
        if ((key === 'v' || key === 'V') && keyIsDown(SHIFT)) showMazeMode = !showMazeMode;
        if (key === 'p' || key === 'P') showSteps = !showSteps;
        return;
    }
    if (gameState === 'charSelect') {
        if (keyCode === LEFT_ARROW) selectedChar = 0;
        if (keyCode === RIGHT_ARROW) selectedChar = 1;
    }
    if ((key === 'v' || key === 'V') && keyIsDown(SHIFT)) { if (gameState === 'playing') showMazeMode = !showMazeMode; }
    if (key === 'm' || key === 'M') { if (gameState === 'playing') emitSonar(); }
    if (key === 'p' || key === 'P') { if (gameState === 'playing') showSteps = !showSteps; }
    if (key === 's' || key === 'S') { if (gameState === 'menu') { gameState = 'sandbox'; } }

    if (keyCode === ENTER || keyCode === RETURN) {
        if (gameState === 'tutorial') gameState = 'playing';
        else if (gameState === 'menu') gameState = 'charSelect';
        else if (gameState === 'charSelect') startGame();
        else if (gameState === 'levelComplete') { currentLevel++; startGame(); }
        else if (gameState === 'gameComplete') { currentLevel = 1; gameState = 'menu'; }
    }
}

// Lida com cliques do mouse no editor (botões, paredes e curvas)
function mousePressed() {
    if (getAudioContext().state !== 'running') userStartAudio(); // Força desbloqueio do áudio
    
    if (gameState !== 'sandbox') return;

    // Checa os botões do painel primeiro
    let btn = buttonAtMouse();
    if (btn) {
        if (btn === 'wall' || btn === 'curve' || btn === 'spline' || btn === 'erase' || btn === 'start' || btn === 'exit') { sbPaintMode = btn; sbCurvePoints = []; return; }
        if (btn === 'undo') { sbUndoLast(); return; }
        if (btn === 'clear') { sbClearAll(); return; }
        if (btn === 'generate') { sbGenerateRandom(); return; }
        if (btn === 'play') { sbPlayLevel(); return; }
        if (btn === 'export') { sbExportLevel(); return; }
        if (btn === 'back') { gameState = 'menu'; return; }
        return;
    }

    // Pintura por célula (início/saída)
    if (sbPaintMode === 'start' || sbPaintMode === 'exit') {
        let cell = cellAtMouse();
        if (cell) {
            if (sbPaintMode === 'start') sbStartCell = { c: cell.c, r: cell.r };
            else sbExitCell = { c: cell.c, r: cell.r };
        }
        return;
    }

    // Modo curva Bézier: coloca pontos de controle ou arrasta existentes
    if (sbPaintMode === 'curve') {
        let nearPt = sbCurvePointAt(mouseX, mouseY);
        if (nearPt) {
            sbDragCurve = nearPt.ci;
            sbDragPt = nearPt.pi;
            return;
        }
        sbCurvePoints.push({ x: mouseX, y: mouseY });
        if (sbCurvePoints.length === 4) {
            sbCurves.push({ type: 'curve', pts: sbCurvePoints.slice() });
            if (sbUndoStack.length >= SB_MAX_UNDO) sbUndoStack.shift();
            sbUndoStack.push({ type: 'addCurve', idx: sbCurves.length - 1 });
            sbCurvePoints = [];
        }
        return;
    }

    // Modo spline: coloca pontos, primeiros 4 = primeiro segmento, depois a cada 3
    if (sbPaintMode === 'spline') {
        let nearPt = sbCurvePointAt(mouseX, mouseY);
        if (nearPt) {
            sbDragCurve = nearPt.ci;
            sbDragPt = nearPt.pi;
            return;
        }
        sbCurvePoints.push({ x: mouseX, y: mouseY });
        // Finaliza automático com 7 pontos (2 segmentos Bézier: 4 + 3)
        if (sbCurvePoints.length === 7) {
            sbCurves.push({ type: 'spline', pts: sbCurvePoints.slice() });
            if (sbUndoStack.length >= SB_MAX_UNDO) sbUndoStack.shift();
            sbUndoStack.push({ type: 'addCurve', idx: sbCurves.length - 1 });
            sbCurvePoints = [];
        }
        return;
    }

    // Modo apagar: checa curvas também
    if (sbPaintMode === 'erase') {
        let nearC = sbCurveAt(mouseX, mouseY);
        if (nearC >= 0) {
            let removed = sbCurves.splice(nearC, 1)[0];
            if (sbUndoStack.length >= SB_MAX_UNDO) sbUndoStack.shift();
            sbUndoStack.push({ type: 'delCurve', idx: nearC, curve: removed });
            return;
        }
    }

    // Pintura de bordas
    let edge = edgeAtMouse();
    if (edge) {
        sbIsPainting = true;
        sbLastPainted = null;
        sbPaintEdge(edge);
    }
}

// O mouse tá perto de algum ponto de controle de uma curva?
function sbCurvePointAt(mx, my) {
    for (let ci = 0; ci < sbCurves.length; ci++) {
        for (let pi = 0; pi < sbCurves[ci].pts.length; pi++) {
            let p = sbCurves[ci].pts[pi];
            if (dist(mx, my, p.x, p.y) < 12) return { ci, pi };
        }
    }
    return null;
}

// O mouse tá perto de alguma curva? (pra apagar)
function sbCurveAt(mx, my) {
    for (let ci = 0; ci < sbCurves.length; ci++) {
        let pts = sbCurves[ci].pts;
        // Checa cada segmento (passo 3 pras beziers encadeadas)
        for (let s = 0; s < pts.length - 3; s += 3) {
            for (let t = 0; t <= 1; t += 0.04) {
                let bx = bezierPoint(pts[s].x, pts[s + 1].x, pts[s + 2].x, pts[s + 3].x, t);
                let by = bezierPoint(pts[s].y, pts[s + 1].y, pts[s + 2].y, pts[s + 3].y, t);
                if (dist(mx, my, bx, by) < 15) return ci;
            }
        }
    }
    return -1;
}

// Chamada enquanto o mouse é arrastado (pintar paredes ou mover pontos de curva)
function mouseDragged() {
    if (gameState !== 'sandbox') return;
    if (sbDragCurve >= 0 && sbDragPt >= 0) {
        sbCurves[sbDragCurve].pts[sbDragPt] = { x: mouseX, y: mouseY };
        return;
    }
    if (!sbIsPainting) return;
    if (sbPaintMode !== 'wall' && sbPaintMode !== 'erase') return;
    let edge = edgeAtMouse();
    if (edge) sbPaintEdge(edge);
}

// Quando o botão do mouse é solto, para de pintar e soltar curvas
function mouseReleased() {
    sbIsPainting = false;
    sbLastPainted = null;
    sbDragCurve = -1;
    sbDragPt = -1;
}

// Atualiza o hover das bordas do grid quando o mouse se move
function mouseMoved() {
    if (gameState !== 'sandbox') return;
    sbHoveredEdge = edgeAtMouse();
}

// Partículas verdes flutuando no fundo
function drawMenuParticles() {
    for (let p of menuParticles) {
        p.x += cos(p.angle) * p.speed; p.y += sin(p.angle) * p.speed; p.angle += random(-0.02, 0.02);
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0; if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
        fill(0, 255, 120, p.alpha); noStroke(); circle(p.x, p.y, p.size);
    }
}

// Redimensiona o canvas quando a janela muda de tamanho
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    updateSandboxLayout();
}

// ==================== TUTORIAL ====================
// Desenha a tela de tutorial sobreposta ao jogo na primeira fase
function drawTutorialOverlay() {
    // Fundo escuro com baixa opacidade
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    let boxW = 380;
    let boxH = 250;
    let bx = width / 2 - boxW / 2;
    let by = height / 2 - boxH / 2;

    // Quadrado com baixa opacidade e borda
    fill(15, 25, 20, 230);
    stroke(0, 255, 120, 100);
    strokeWeight(2);
    rect(bx, by, boxW, boxH, 15);

    noStroke();
    fill(0, 255, 120);
    textAlign(CENTER, TOP);
    textSize(24);
    text("COMO JOGAR", width / 2, by + 25);

    // Texto Setas
    fill(200);
    textSize(16);
    textAlign(LEFT, CENTER);
    text("Mover o personagem", bx + 160, by + 105);

    // Desenho Setas
    let arrowX = bx + 80;
    let arrowY = by + 105;
    drawKeyBox(arrowX, arrowY - 25, "↑");
    drawKeyBox(arrowX - 25, arrowY, "←");
    drawKeyBox(arrowX, arrowY, "↓");
    drawKeyBox(arrowX + 25, arrowY, "→");

    // Texto Sonar
    text("Usar Raio Sonar", bx + 160, by + 165);

    // Desenho M
    drawKeyBox(bx + 80, by + 165, "M");

    // Dica de Enter
    let blinkAlpha = map(sin(frameCount * 0.08), -1, 1, 80, 255);
    fill(0, 200, 100, blinkAlpha);
    textAlign(CENTER, BOTTOM);
    textSize(14);
    text("Pressione ENTER para começar", width / 2, by + boxH - 20);
}

// Função auxiliar para desenhar o quadrado das teclas (setas e 'M') no painel de tutorial
function drawKeyBox(x, y, label) {
    fill(30, 40, 35);
    stroke(0, 255, 120, 150);
    strokeWeight(1.5);
    rect(x - 12, y - 12, 24, 24, 4);
    noStroke();
    fill(0, 255, 120);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(label, x, y + 1); // +1 para compensar o alinhamento visual
}
