(function () {
  "use strict";

  const TURN_SECONDS = 45;
  const SCORE_TABLE = { 0: 8, 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

  const screens = {
    setup: document.getElementById("setup-screen"),
    pick: document.getElementById("pick-screen"),
    game: document.getElementById("game-screen"),
    result: document.getElementById("result-screen"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
  }

  // ---------- Global state ----------
  let players = []; // [{ name, totalScore }]
  let currentPlayerIndex = 0;
  let roundOriginalNumbers = [];
  let target = null;
  let roundResults = []; // per-player results for the current round
  let authenticMode = false; // true: true-random target, not guaranteed solvable, as in the real show

  // pick-screen state
  let largePool = [];
  let smallPool = [];
  let pickedNumbers = [];

  // game-screen state
  let boardTiles = [];
  let history = [];
  let nextTileId = 0;
  let selectedTileId = null;
  let selectedOp = null;
  let turnActive = false;
  let remainingSeconds = TURN_SECONDS;
  let timerInterval = null;
  let paused = false;
  let elapsedSeconds = 0;
  let elapsedInterval = null;

  // hint state
  let hintSteps = [];
  let hintStepIndex = 0;
  let hintCheckpoint = null; // { boardTiles, history } snapshot right after the last applied hint step

  // ---------- Setup screen ----------
  document.getElementById("start-setup-btn").addEventListener("click", () => {
    const count = parseInt(document.getElementById("player-count").value, 10);
    authenticMode = document.getElementById("difficulty-mode").value === "authentic";
    players = [];
    for (let i = 0; i < count; i++) {
      players.push({ name: `Jugador ${i + 1}`, totalScore: 0 });
    }
    startPickPhase();
  });

  // ---------- Pick screen ----------
  function freshPools() {
    largePool = [25, 50, 75, 100];
    smallPool = [];
    for (let v = 1; v <= 10; v++) {
      smallPool.push(v, v);
    }
  }

  function startPickPhase() {
    freshPools();
    pickedNumbers = [];
    document.getElementById("pick-title").textContent =
      players.length > 1
        ? "Elegid los 6 números (compartidos por ambos jugadores)"
        : "Elige tus 6 números";
    renderPickScreen();
    showScreen("pick");
  }

  function renderPickScreen() {
    document.getElementById(
      "large-pool-status"
    ).textContent = `Grandes restantes: ${largePool.length}`;
    document.getElementById(
      "small-pool-status"
    ).textContent = `Pequeñas restantes: ${smallPool.length}`;

    const remainingSlots = 6 - pickedNumbers.length;
    document.getElementById("pick-large-btn").disabled =
      remainingSlots === 0 || largePool.length === 0;
    document.getElementById("pick-small-btn").disabled =
      remainingSlots === 0 || smallPool.length === 0;
    document.getElementById("pick-random-btn").disabled = remainingSlots === 0;
    document.getElementById("confirm-numbers-btn").disabled =
      pickedNumbers.length !== 6;

    const tilesEl = document.getElementById("picked-tiles");
    tilesEl.innerHTML = "";
    pickedNumbers.forEach((n) => {
      const tile = document.createElement("div");
      tile.className = "tile static";
      tile.textContent = n;
      tilesEl.appendChild(tile);
    });
  }

  function drawFrom(pool) {
    const idx = Math.floor(Math.random() * pool.length);
    return pool.splice(idx, 1)[0];
  }

  document.getElementById("pick-large-btn").addEventListener("click", () => {
    if (pickedNumbers.length >= 6 || largePool.length === 0) return;
    pickedNumbers.push(drawFrom(largePool));
    renderPickScreen();
  });

  document.getElementById("pick-small-btn").addEventListener("click", () => {
    if (pickedNumbers.length >= 6 || smallPool.length === 0) return;
    pickedNumbers.push(drawFrom(smallPool));
    renderPickScreen();
  });

  document.getElementById("pick-random-btn").addEventListener("click", () => {
    while (pickedNumbers.length < 6 && (largePool.length || smallPool.length)) {
      const canLarge = largePool.length > 0;
      const canSmall = smallPool.length > 0;
      let useLarge;
      if (canLarge && canSmall) useLarge = Math.random() < 0.3;
      else useLarge = canLarge;
      pickedNumbers.push(drawFrom(useLarge ? largePool : smallPool));
    }
    renderPickScreen();
  });

  document.getElementById("confirm-numbers-btn").addEventListener("click", () => {
    roundOriginalNumbers = [...pickedNumbers];
    target = authenticMode
      ? 101 + Math.floor(Math.random() * (999 - 101 + 1))
      : window.NumbersSolver.pickAchievableTarget(roundOriginalNumbers, 101, 999);
    document.getElementById("target-value").textContent = target;
    const badge = document.getElementById("mode-badge");
    badge.textContent = "Modo auténtico";
    badge.classList.toggle("hidden", !authenticMode);
    document.getElementById("elapsed-value").classList.toggle("hidden", authenticMode);
    roundResults = [];
    currentPlayerIndex = 0;
    startTurn();
  });

  // ---------- Game screen ----------
  function startTurn() {
    boardTiles = roundOriginalNumbers.map((v) => ({
      id: nextTileId++,
      value: v,
      expr: String(v),
    }));
    history = [];
    selectedTileId = null;
    selectedOp = null;
    turnActive = true;

    document.getElementById("current-player").textContent =
      players[currentPlayerIndex].name;

    const solution = window.NumbersSolver.solve(roundOriginalNumbers, target);
    hintSteps = window.NumbersSolver.solutionSteps(solution);
    hintStepIndex = 0;
    hintCheckpoint = {
      boardTiles: boardTiles.map((t) => ({ ...t })),
      history: [],
    };
    updateHintButton();

    renderBoard();
    renderPendingOp();
    startTimer();
    showScreen("game");
  }

  function startTimer() {
    remainingSeconds = TURN_SECONDS;
    paused = false;
    const pauseCheckbox = document.getElementById("pause-checkbox");
    if (pauseCheckbox) pauseCheckbox.checked = false;
    updateTimerUI();
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);

    // Stopwatch: always counts up from zero, unaffected by the pause
    // checkbox above (that only pauses the 45s countdown). Only shown in
    // practice mode, but kept running regardless so it's accurate whenever
    // shown.
    elapsedSeconds = 0;
    updateElapsedUI();
    clearInterval(elapsedInterval);
    elapsedInterval = setInterval(() => {
      elapsedSeconds++;
      updateElapsedUI();
    }, 1000);
  }

  function updateElapsedUI() {
    document.getElementById("elapsed-value").textContent = `Tiempo real: ${elapsedSeconds}s`;
  }

  function tick() {
    remainingSeconds--;
    updateTimerUI();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      endTurn();
    }
  }

  document.getElementById("pause-checkbox").addEventListener("change", (e) => {
    if (!turnActive) return;
    paused = e.target.checked;
    clearInterval(timerInterval);
    if (!paused) {
      timerInterval = setInterval(tick, 1000);
    }
  });

  function updateTimerUI() {
    const bar = document.getElementById("timer-bar");
    const pct = Math.max(0, (remainingSeconds / TURN_SECONDS) * 100);
    bar.style.width = pct + "%";
    bar.style.backgroundColor = remainingSeconds <= 10 ? "#e0524d" : "";
    document.getElementById("timer-value").textContent = Math.max(
      0,
      remainingSeconds
    );
  }

  function renderBoard() {
    const tilesEl = document.getElementById("board-tiles");
    tilesEl.innerHTML = "";
    boardTiles.forEach((tile) => {
      const el = document.createElement("div");
      el.className = "tile";
      if (tile.id === selectedTileId) el.classList.add("selected");
      el.dataset.tileId = tile.id;

      const valueEl = document.createElement("span");
      valueEl.textContent = tile.value;
      el.appendChild(valueEl);

      if (tile.expr !== String(tile.value)) {
        const exprEl = document.createElement("span");
        exprEl.className = "expr";
        exprEl.textContent = tile.expr;
        el.appendChild(exprEl);
      }

      tilesEl.appendChild(el);
    });
  }

  function renderPendingOp() {
    const el = document.getElementById("pending-op-display");
    if (selectedTileId === null) {
      el.textContent = "Selecciona un número para empezar.";
    } else if (selectedOp === null) {
      const tile = boardTiles.find((t) => t.id === selectedTileId);
      el.textContent = `${tile.value}  →  elige una operación`;
    } else {
      const tile = boardTiles.find((t) => t.id === selectedTileId);
      const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[selectedOp];
      el.textContent = `${tile.value} ${opSymbol} ?  →  elige el segundo número`;
    }
  }

  document.getElementById("board-tiles").addEventListener("click", (e) => {
    if (!turnActive) return;
    const tileEl = e.target.closest(".tile");
    if (!tileEl) return;
    const id = parseInt(tileEl.dataset.tileId, 10);
    onTileClick(id);
  });

  document.querySelectorAll(".op-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!turnActive) return;
      if (selectedTileId === null) return;
      const op = btn.dataset.op;
      selectedOp = selectedOp === op ? null : op;
      document
        .querySelectorAll(".op-btn")
        .forEach((b) => b.classList.toggle("selected", b.dataset.op === selectedOp));
      renderPendingOp();
    });
  });

  function onTileClick(id) {
    if (selectedTileId === null) {
      selectedTileId = id;
      renderBoard();
      renderPendingOp();
      return;
    }

    if (id === selectedTileId) {
      selectedTileId = null;
      selectedOp = null;
      document.querySelectorAll(".op-btn").forEach((b) => b.classList.remove("selected"));
      renderBoard();
      renderPendingOp();
      return;
    }

    if (selectedOp === null) {
      // switch selection to the newly clicked tile
      selectedTileId = id;
      renderBoard();
      renderPendingOp();
      return;
    }

    // combine selectedTileId (A) with id (B) using selectedOp
    const a = boardTiles.find((t) => t.id === selectedTileId);
    const b = boardTiles.find((t) => t.id === id);
    const combined = tryCombine(a, b, selectedOp);
    if (!combined) return; // invalid op, message already shown

    history.push(boardTiles.map((t) => ({ ...t })));
    boardTiles = boardTiles.filter((t) => t.id !== a.id && t.id !== b.id);
    boardTiles.push(combined);

    selectedTileId = null;
    selectedOp = null;
    document.querySelectorAll(".op-btn").forEach((b) => b.classList.remove("selected"));
    renderBoard();
    renderPendingOp();
  }

  function tryCombine(a, b, op) {
    const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[op];
    let value;
    if (op === "+") {
      value = a.value + b.value;
    } else if (op === "-") {
      if (a.value <= b.value) {
        flashMessage("El resultado debe ser positivo: elige el número mayor primero.");
        return null;
      }
      value = a.value - b.value;
    } else if (op === "*") {
      value = a.value * b.value;
    } else if (op === "/") {
      if (b.value === 0 || a.value % b.value !== 0) {
        flashMessage("Esa división no es exacta.");
        return null;
      }
      value = a.value / b.value;
    }
    return {
      id: nextTileId++,
      value,
      expr: `(${a.expr}${opSymbol}${b.expr})`,
    };
  }

  function flashMessage(msg) {
    const el = document.getElementById("pending-op-display");
    el.textContent = msg;
    setTimeout(renderPendingOp, 1500);
  }

  document.getElementById("undo-btn").addEventListener("click", () => {
    if (!turnActive || history.length === 0) return;
    boardTiles = history.pop();
    selectedTileId = null;
    selectedOp = null;
    document.querySelectorAll(".op-btn").forEach((b) => b.classList.remove("selected"));
    renderBoard();
    renderPendingOp();
  });

  document.getElementById("finish-turn-btn").addEventListener("click", () => {
    if (!turnActive) return;
    clearInterval(timerInterval);
    endTurn();
  });

  // Finds two distinct board tiles matching the step's two operand values.
  // Returns null if either operand isn't currently available on the board.
  function findStepTiles(step, tiles) {
    const remaining = [...tiles];
    const aIdx = remaining.findIndex((t) => t.value === step.left.value);
    if (aIdx === -1) return null;
    const aTile = remaining.splice(aIdx, 1)[0];
    const bIdx = remaining.findIndex((t) => t.value === step.right.value);
    if (bIdx === -1) return null;
    return { aTile, bTile: remaining[bIdx] };
  }

  function updateHintButton() {
    const btn = document.getElementById("hint-btn");
    const exhausted = hintStepIndex >= hintSteps.length;
    btn.disabled = exhausted;
    btn.textContent = exhausted ? "Sin más pistas" : "Pista";
  }

  document.getElementById("hint-btn").addEventListener("click", () => {
    if (!turnActive || hintStepIndex >= hintSteps.length) return;

    const step = hintSteps[hintStepIndex];
    let match = findStepTiles(step, boardTiles);
    if (!match) {
      // The numbers this hint needs were used up by the player's own moves:
      // undo back to the state right after the last applied hint step.
      boardTiles = hintCheckpoint.boardTiles.map((t) => ({ ...t }));
      history = hintCheckpoint.history.map((snap) => snap.map((t) => ({ ...t })));
      match = findStepTiles(step, boardTiles);
      if (!match) return; // shouldn't happen; safety net
    }

    const { aTile, bTile } = match;
    const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[step.op];
    history.push(boardTiles.map((t) => ({ ...t })));
    boardTiles = boardTiles.filter((t) => t.id !== aTile.id && t.id !== bTile.id);
    const combinedTile = {
      id: nextTileId++,
      value: step.value,
      expr: `(${aTile.expr}${opSymbol}${bTile.expr})`,
    };
    boardTiles.push(combinedTile);

    hintStepIndex++;
    hintCheckpoint = {
      boardTiles: boardTiles.map((t) => ({ ...t })),
      history: history.map((snap) => snap.map((t) => ({ ...t }))),
    };

    selectedTileId = null;
    selectedOp = null;
    document.querySelectorAll(".op-btn").forEach((b) => b.classList.remove("selected"));
    renderBoard();
    renderPendingOp();
    updateHintButton();
    flashMessage(`Pista: ${aTile.value} ${opSymbol} ${bTile.value} = ${combinedTile.value}`);
  });

  function scoreFromDiff(diff) {
    return SCORE_TABLE[diff] !== undefined ? SCORE_TABLE[diff] : 0;
  }

  function endTurn() {
    turnActive = false;
    clearInterval(elapsedInterval);
    let best = boardTiles[0];
    boardTiles.forEach((t) => {
      if (Math.abs(t.value - target) < Math.abs(best.value - target)) best = t;
    });
    const diff = Math.abs(best.value - target);
    const points = scoreFromDiff(diff);

    roundResults.push({
      playerName: players[currentPlayerIndex].name,
      achievedValue: best.value,
      expr: best.expr,
      diff,
      points,
    });
    players[currentPlayerIndex].totalScore += points;

    if (currentPlayerIndex + 1 < players.length) {
      currentPlayerIndex++;
      startTurn();
    } else {
      showRoundResult();
    }
  }

  // ---------- Result screen ----------
  function showRoundResult() {
    const summaryEl = document.getElementById("round-summary");
    summaryEl.innerHTML = "";
    roundResults.forEach((r) => {
      const row = document.createElement("div");
      row.className = "player-result";
      const diffText =
        r.diff === 0 ? "¡Número exacto!" : `a ${r.diff} del objetivo`;
      row.innerHTML = `<span>${r.playerName}: ${r.achievedValue} (${diffText})</span><span class="points">${r.points} pts</span>`;
      summaryEl.appendChild(row);
    });

    document.getElementById("solution-box").classList.add("hidden");
    document.getElementById("solution-box").innerHTML = "";

    const totalsEl = document.getElementById("total-scores");
    totalsEl.innerHTML = "";
    players.forEach((p) => {
      const item = document.createElement("div");
      item.className = "total-score-item";
      item.innerHTML = `<span class="score">${p.totalScore}</span>${p.name}`;
      totalsEl.appendChild(item);
    });

    showScreen("result");
  }

  function formatSolution(solution) {
    if (!solution) return "No se encontró ninguna solución.";
    const readable = solution.expr
      .replace(/\*/g, " × ")
      .replace(/\//g, " ÷ ")
      .replace(/\+/g, " + ")
      .replace(/-/g, " − ");
    const diffText =
      solution.diff === 0 ? "(exacto)" : `(a ${solution.diff} del objetivo ${target})`;
    return `${solution.value} = ${readable} ${diffText}`;
  }

  document.getElementById("show-solution-btn").addEventListener("click", () => {
    const solution = window.NumbersSolver.solve(roundOriginalNumbers, target);
    const box = document.getElementById("solution-box");
    box.textContent = formatSolution(solution);
    box.classList.remove("hidden");
  });

  document.getElementById("show-solution-ingame-btn").addEventListener("click", () => {
    const solution = window.NumbersSolver.solve(roundOriginalNumbers, target);
    const box = document.getElementById("ingame-solution-box");
    box.textContent = formatSolution(solution);
    box.classList.toggle("hidden");
  });

  document.getElementById("next-round-btn").addEventListener("click", () => {
    startPickPhase();
  });

  document.getElementById("replay-round-btn").addEventListener("click", () => {
    // Same roundOriginalNumbers and target as the round just played; only
    // per-round state resets.
    roundResults = [];
    currentPlayerIndex = 0;
    startTurn();
  });
})();
