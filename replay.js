(function () {
  const statusEl = document.getElementById('status');
  const fileInput = document.getElementById('pgnFile');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', Boolean(isError));
  }

  if (typeof window.Chess === 'undefined') {
    setStatus('Error: chess.js failed to load. Replay cannot start.', true);
    fileInput.disabled = true;
    startBtn.disabled = true;
    stopBtn.disabled = true;
    return;
  }

  const board = new Chessboard(document.getElementById('board'), {
    position: 'start'
  });

  let parsed = null;
  let stopRequested = false;

  function parseMetadata(pgnText) {
    const timestamps = [];
    const clocks = [];

    const timestampRegex = /\[%timestamp\s+(\d+)]/g;
    const clockRegex = /\[%clk\s+([0-9:\.]+)]/g;

    let match;
    while ((match = timestampRegex.exec(pgnText)) !== null) {
      timestamps.push(Number(match[1]));
    }
    while ((match = clockRegex.exec(pgnText)) !== null) {
      clocks.push(match[1]);
    }

    return { timestamps, clocks };
  }

  function loadPgnText(pgnText) {
    const chess = new window.Chess();
    const loaded = chess.load_pgn(pgnText, { sloppy: true });

    if (!loaded) {
      parsed = null;
      startBtn.disabled = true;
      stopBtn.disabled = true;
      board.setPosition('start');
      setStatus('Error: Could not parse PGN file.', true);
      return;
    }

    const moves = chess.history({ verbose: true });
    const metadata = parseMetadata(pgnText);

    parsed = {
      moves,
      timestamps: metadata.timestamps,
      clocks: metadata.clocks
    };

    board.setPosition('start');
    startBtn.disabled = moves.length === 0;
    stopBtn.disabled = true;

    setStatus(
      `Loaded: plies=${moves.length} timestamps=${metadata.timestamps.length} clocks=${metadata.clocks.length}`,
      false
    );
  }

  async function play() {
    if (!parsed || !parsed.moves.length) {
      return;
    }

    stopRequested = false;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    const replayGame = new window.Chess();
    board.setPosition('start');

    for (let i = 0; i < parsed.moves.length; i += 1) {
      if (stopRequested) {
        break;
      }

      replayGame.move(parsed.moves[i]);
      board.setPosition(replayGame.fen());

      const delaySeconds = Number(parsed.timestamps[i]);
      const delayMs = Number.isFinite(delaySeconds) && delaySeconds >= 0
        ? delaySeconds * 1000
        : 1000;

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    stopBtn.disabled = true;
    startBtn.disabled = false;

    if (stopRequested) {
      setStatus('Replay stopped.', false);
    } else {
      setStatus('Replay finished.', false);
    }
  }

  fileInput.addEventListener('change', async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const pgnText = await file.text();
      loadPgnText(pgnText);
    } catch (error) {
      parsed = null;
      startBtn.disabled = true;
      stopBtn.disabled = true;
      setStatus('Error: Failed to read PGN file.', true);
    }
  });

  startBtn.addEventListener('click', function () {
    if (!parsed) {
      return;
    }
    play();
  });

  stopBtn.addEventListener('click', function () {
    stopRequested = true;
  });
})();
