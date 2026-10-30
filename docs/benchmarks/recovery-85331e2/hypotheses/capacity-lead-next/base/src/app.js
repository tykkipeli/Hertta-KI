import {
  deal,
  createState,
  legal,
  play,
  passCards,
  roundScores,
  suit,
  label,
} from "./game.js";
import { observe } from "./observation.js";

const $ = (id) => document.getElementById(id);
const names = ["Du", "West", "Nord", "Ost"];
const positions = ["south", "west", "north", "east"];
const directions = [
  "nach links",
  "nach rechts",
  "gegenüber",
  "keine Weitergabe",
];
let state,
  totals = [0, 0, 0, 0],
  round = 0,
  phase;
let selected = [],
  memories,
  receivedMemories,
  received = [],
  sent = [],
  sender;
let busy = false,
  animating = false,
  hinting = false,
  worker,
  passWorkers = [],
  epoch = 0;
let hinted = null,
  displayedTrick = null,
  latest = null,
  collecting = false,
  won = null;
let trickSignature = "",
  announcements = "",
  moveNumber = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function card(c, { click, disabled = false, extra = "" } = {}) {
  const element = document.createElement(click ? "button" : "div");
  element.className =
    "card" +
    ([1, 3].includes(suit(c)) ? " red" : "") +
    (extra ? " " + extra : "");
  element.dataset.card = c;
  const rank = label(c).slice(0, -1).replace("T", "10"),
    symbol = label(c).slice(-1);
  element.innerHTML = `<span class="card-corner">${rank}<small>${symbol}</small></span><span class="card-suit">${symbol}</span><span class="card-bottom">${rank}${symbol}</span>`;
  const cardName =
    ["Kreuz", "Karo", "Pik", "Herz"][suit(c)] +
    "-" +
    [
      "Zwei",
      "Drei",
      "Vier",
      "Fünf",
      "Sechs",
      "Sieben",
      "Acht",
      "Neun",
      "Zehn",
      "Bube",
      "Dame",
      "König",
      "Ass",
    ][c % 13];
  element.setAttribute("aria-label", cardName);
  element.title = cardName;
  if (click && phase === "pass")
    element.setAttribute("aria-pressed", String(selected.includes(c)));
  if (click) {
    element.disabled = disabled;
    element.onclick = click;
  }
  return element;
}

function renderTrick() {
  const cards = displayedTrick || state.trick,
    element = $("trick");
  const signature = JSON.stringify([cards, latest, won]);
  if (collecting && !element.classList.contains("collecting")) {
    const target = $(positions[won]).getBoundingClientRect();
    for (const slot of element.children) {
      const rect = slot.getBoundingClientRect();
      slot.style.setProperty(
        "--collect-x",
        `${target.x + target.width / 2 - rect.x - rect.width / 2}px`,
      );
      slot.style.setProperty(
        "--collect-y",
        `${target.y + target.height / 2 - rect.y - rect.height / 2}px`,
      );
    }
  }
  element.className =
    "trick" + (collecting ? " collecting to-" + positions[won] : "");
  if (signature === trickSignature) return;
  trickSignature = signature;
  element.replaceChildren();
  for (let p = 0; p < 4; p++) {
    const slot = document.createElement("div");
    slot.className = "trick-slot slot-" + positions[p];
    slot.dataset.player = p;
    const entry = cards.find((x) => x.player === p),
      caption = document.createElement("span");
    caption.className = "card-caption";
    caption.textContent = names[p];
    slot.append(caption);
    let playedCard,
      fresh = false;
    if (entry) {
      fresh = latest?.card === entry.card && latest?.player === p;
      playedCard = card(entry.card, { extra: won === p ? "winning-card" : "" });
      playedCard.dataset.player = p;
      slot.append(playedCard);
    } else {
      const empty = document.createElement("span");
      empty.className = "empty-card";
      empty.textContent = "·";
      slot.append(empty);
    }
    element.append(slot);
    if (fresh) {
      const target = playedCard.getBoundingClientRect();
      if (latest.sourceX !== undefined) {
        playedCard.style.setProperty(
          "--from-x",
          `${latest.sourceX - target.x - target.width / 2}px`,
        );
        playedCard.style.setProperty(
          "--from-y",
          `${latest.sourceY - target.y - target.height / 2}px`,
        );
      }
      playedCard.classList.add("just-played");
    }
  }
}

function render() {
  document.body.dataset.phase = phase;
  $("status").classList.toggle("sr-only", won !== null);
  document.querySelector(".received-key").hidden = !received.length;
  const roundPoints = ["round", "end"].includes(phase)
    ? roundScores(state.taken)
    : state.taken;
  const wins = names.map(
    (_, p) => state.history.filter((t) => t.winner === p).length,
  );
  positions.forEach((id, p) => {
    const active = phase === "play" && state.turn === p && won === null;
    $(id).className =
      "seat " + id + (active ? " active" : "") + (won === p ? " won" : "");
    $(id).innerHTML =
      `<div class="seat-name"><span class="avatar">${p === 0 ? "D" : names[p][0]}</span><b>${names[p]}</b><span class="turn-label">${won === p ? "STICH GEWONNEN" : active ? (busy ? "DENKT …" : "AM ZUG") : ""}</span></div><div class="seat-stats"><div><strong>${wins[p]}</strong><span>${wins[p] === 1 ? "Stich" : "Stiche"}</span></div><div><strong>${roundPoints[p]}</strong><span title="Strafpunkte">Punkte</span></div></div><div class="trick-meter" role="img" aria-label="${wins[p]} von 13 Stichen">${Array.from({ length: 13 }, (_, i) => '<i class="' + (i < wins[p] ? "filled" + (won === p && i === wins[p] - 1 ? " just-won" : "") : "") + '"></i>').join("")}</div><small>${state.hands[p].length} Karten · Gesamt ${totals[p]}</small>`;
  });
  renderTrick();
  const allowed = legal(state),
    locked = busy || animating || phase !== "play" || state.turn !== 0;
  const focusCard = document.activeElement?.dataset.card;
  $("hand").replaceChildren(
    ...state.hands[0].map((c) =>
      card(c, {
        click: () => human(c),
        disabled: phase === "pass" ? false : locked || !allowed.includes(c),
        extra: [
          selected.includes(c) ? "selected" : "",
          (Array.isArray(hinted) ? hinted.includes(c) : hinted === c)
            ? "hinted"
            : "",
          received.includes(c) ? "received-card" : "",
        ].join(" "),
      }),
    ),
  );
  if (focusCard)
    $("hand")
      .querySelector(`[data-card="${focusCard}"]`)
      ?.focus({ preventScroll: true });
  $("round-number").textContent = "Runde " + (round + 1);
  $("pass-info").textContent = directions[round % 4];
  $("progress").textContent = state.completed + " / 13 Stiche";
  $("hearts-status").textContent = state.broken
    ? "♥ Herzen sind frei"
    : "♡ Herzen noch gesperrt";
  $("hearts-status").classList.toggle("broken", state.broken);
  $("hint").disabled = phase === "pass" ? busy || hinting : locked;
  $("action").hidden = true;
  $("exchange").hidden = phase !== "receive";
  $("selection-help").hidden = phase !== "pass";
  $("selection-count").textContent = selected.length + " / 3 ausgewählt";
  $("winner-banner").hidden = won === null;
  if (won !== null)
    $("winner-banner").textContent =
      `${won === 0 ? "Du gewinnst" : names[won] + " gewinnt"} den Stich · +${state.history.at(-1).points} Strafpunkte`;
  if (phase === "pass") {
    status(`Wähle drei Karten zum Weitergeben ${directions[round % 4]}.`);
    action("3 Karten weitergeben", busy || selected.length !== 3);
  } else if (phase === "passing") {
    status("Die Gegner wählen ihre Karten …");
  } else if (phase === "receive") {
    status(`Du erhältst drei Karten von ${names[sender]}.`);
    action("Karten aufnehmen & spielen");
  } else if (phase === "play") {
    status(
      won !== null
        ? `${won === 0 ? "Du gewinnst" : names[won] + " gewinnt"} den Stich.`
        : hinting
          ? "Dein Tipp wird berechnet …"
          : animating && latest
            ? `${latest.player === 0 ? "Du spielst" : names[latest.player] + " spielt"} ${label(latest.card)}.`
            : state.turn === 0
              ? "Du bist am Zug. Wähle eine helle Karte."
              : `${names[state.turn]} ${busy ? "denkt nach" : "ist am Zug"} …`,
    );
  } else {
    const scores = roundScores(state.taken),
      moon = state.taken.indexOf(26);
    const winners = names.filter((_, p) => totals[p] === Math.min(...totals));
    status(
      phase === "end"
        ? `${winners.join(" & ")} ${winners.length > 1 ? "gewinnen" : winners[0] === "Du" ? "gewinnst" : "gewinnt"} das Spiel!`
        : moon >= 0
          ? `${moon === 0 ? "Du schaffst" : names[moon] + " schafft"} den Durchmarsch!`
          : "Runde beendet. Die Punkte sind abgerechnet.",
    );
    action(phase === "end" ? "Neues Spiel starten" : "Nächste Runde");
    $("round-summary").hidden = false;
    $("round-summary").innerHTML =
      `<h2>${phase === "end" ? "Endstand" : "Runde " + (round + 1) + " beendet"}</h2>` +
      names
        .map(
          (name, p) =>
            `<div class="summary-row"><b>${name}</b><span>${wins[p]} ${wins[p] === 1 ? "Stich" : "Stiche"}</span><span>+${scores[p]} Punkte</span><strong>${totals[p]} gesamt</strong></div>`,
        )
        .join("");
  }
  if (
    phase === "play" ||
    phase === "pass" ||
    phase === "receive" ||
    phase === "passing"
  )
    $("round-summary").hidden = true;
  $("scores").innerHTML = names
    .map(
      (name, p) =>
        `<div class="score-row"><span>${name}</span><span>${wins[p]} <small>${wins[p] === 1 ? "Stich" : "Stiche"}</small></span><span>${roundPoints[p]} <small>Runde</small></span><b>${totals[p]}</b></div>`,
    )
    .join("");
  $("history").replaceChildren(
    ...[...state.history].reverse().map((t, index) => {
      const entry = document.createElement("div");
      entry.className = "history-row";
      const title = document.createElement("div");
      title.innerHTML = `<b>${state.history.length - index}. Stich → ${names[t.winner]}</b><span>+${t.points}</span>`;
      const cards = document.createElement("p");
      cards.textContent = t.trick
        .map((x) => `${names[x.player]} ${label(x.card)}`)
        .join(" · ");
      entry.append(title, cards);
      return entry;
    }),
  );
  $("history-empty").hidden = state.history.length > 0;
}
function status(text) {
  if (announcements !== text) {
    $("status").textContent = text;
    announcements = text;
  }
}
function action(text, disabled = false) {
  $("action").hidden = false;
  $("action").textContent = text;
  $("action").disabled = disabled;
}

function begin() {
  epoch++;
  worker?.terminate();
  worker = null;
  passWorkers.forEach((w) => w.terminate());
  passWorkers = [];
  busy = false;
  animating = false;
  hinting = false;
  hinted = null;
  // Each object is private to a single player's own passing history.
  memories = Array.from({ length: 4 }, () => ({}));
  receivedMemories = Array(4).fill(null);
  selected = [];
  received = [];
  sent = [];
  displayedTrick = null;
  latest = null;
  won = null;
  collecting = false;
  trickSignature = "";
  state = createState(deal());
  phase = round % 4 === 3 ? "play" : "pass";
  $("analysis").textContent = "";
  $("last").textContent = "";
  render();
  if (phase === "play") advance(epoch);
}
function newGame() {
  totals = [0, 0, 0, 0];
  round = 0;
  begin();
}

async function human(c) {
  if (phase === "pass") {
    if (selected.includes(c)) selected = selected.filter((x) => x !== c);
    else if (selected.length < 3) selected.push(c);
    render();
    return;
  }
  if (
    phase !== "play" ||
    state.turn !== 0 ||
    busy ||
    animating ||
    !legal(state).includes(c)
  )
    return;
  hinted = null;
  const stamp = epoch;
  await move(c, stamp);
  if (stamp === epoch) advance(stamp);
}

$("action").onclick = async () => {
  if (phase === "pass" && !busy && selected.length === 3) {
    const direction = [1, 3, 2, 0][round % 4];
    const stamp = epoch;
    phase = "passing";
    busy = true;
    render();
    let selections;
    try {
      const others = await Promise.all(
        state.hands.slice(1).map((hand) => computePass(hand, direction)),
      );
      if (stamp !== epoch) return;
      selections = [[...selected], ...others];
    } catch (error) {
      if (stamp !== epoch) return;
      passWorkers.forEach((w) => w.terminate());
      passWorkers = [];
      busy = false;
      phase = "pass";
      render();
      status("Kartentausch fehlgeschlagen: " + error.message);
      return;
    }
    busy = false;
    passWorkers = [];
    for (let p = 0; p < 4; p++)
      memories[p][(p + direction) % 4] = [...selections[p]];
    for (let p = 0; p < 4; p++) {
      const from = (p - direction + 4) % 4;
      receivedMemories[p] = { from, cards: [...selections[from]] };
    }
    sender = (4 - direction) % 4;
    sent = [...selected];
    received = [...selections[sender]];
    passCards(state.hands, selections, direction);
    state = createState(state.hands);
    selected = [];
    hinted = null;
    phase = "receive";
    $("received-from").textContent = `Von ${names[sender]}`;
    $("sent-to").textContent = `An ${names[direction]}`;
    $("received").replaceChildren(...received.map((c) => card(c)));
    $("sent").replaceChildren(...sent.map((c) => card(c)));
    render();
  } else if (phase === "passing") {
    status("Die Gegner wählen ihre Karten …");
  } else if (phase === "receive") {
    phase = "play";
    render();
    advance(epoch);
  } else if (phase === "round") {
    round++;
    begin();
  } else if (phase === "end") newGame();
};

async function move(c, stamp) {
  animating = true;
  const source =
    state.turn === 0
      ? $("hand").querySelector(`[data-card="${c}"]`)
      : $(positions[state.turn]);
  const origin = source?.getBoundingClientRect();
  latest = {
    player: state.turn,
    card: c,
    move: ++moveNumber,
    sourceX: origin ? origin.x + origin.width / 2 : undefined,
    sourceY: origin ? origin.y + origin.height / 2 : undefined,
  };
  const result = play(state, c);
  displayedTrick = result ? result.trick : null;
  won = result ? result.winner : null;
  render();
  if (result) {
    $("last").textContent =
      `${state.completed}. Stich: ${names[result.winner]} · +${result.points} Strafpunkte`;
    await wait(1350);
    if (stamp !== epoch) return;
    collecting = true;
    renderTrick();
    await wait(reducedMotion() ? 50 : 480);
    if (stamp !== epoch) return;
    collecting = false;
    displayedTrick = null;
    won = null;
    latest = null;
    if (state.completed === 13) {
      totals = totals.map((n, p) => n + roundScores(state.taken)[p]);
      phase = totals.some((n) => n >= 100) ? "end" : "round";
    }
  } else {
    await wait(reducedMotion() ? 100 : 350);
    if (stamp !== epoch) return;
  }
  animating = false;
  render();
}

function computePass(hand, direction, explain = false) {
  const current = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  passWorkers.push(current);
  return new Promise((resolve, reject) => {
    current.onmessage = (event) => {
      current.terminate();
      passWorkers = passWorkers.filter((w) => w !== current);
      if (event.data.error) reject(Error(event.data.error));
      else resolve(explain ? event.data : event.data.cards);
    };
    current.onerror = (event) => {
      current.terminate();
      passWorkers = passWorkers.filter((w) => w !== current);
      reject(Error(event.message));
    };
    current.postMessage({
      id: ++moveNumber,
      type: "pass",
      hand: [...hand],
      direction,
    });
  });
}

function compute(p) {
  worker?.terminate();
  const current = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  worker = current;
  // No other memory, hand or future card is sent to the worker.
  const observation = observe(
    state,
    p,
    memories[p],
    totals,
    receivedMemories[p],
  );
  observation.humanPlayer = 0;
  return new Promise((resolve, reject) => {
    current.onmessage = (event) => {
      current.terminate();
      if (event.data.error) reject(Error(event.data.error));
      else resolve(event.data);
    };
    current.onerror = (event) => {
      current.terminate();
      reject(Error(event.message));
    };
    current.postMessage({
      id: ++moveNumber,
      observation,
      milliseconds: Number($("strength").value),
    });
  });
}
async function advance(stamp) {
  if (busy || animating) return;
  while (stamp === epoch && phase === "play" && state.turn !== 0) {
    busy = true;
    render();
    try {
      const result = await compute(state.turn);
      if (stamp !== epoch) return;
      busy = false;
      $("analysis").textContent =
        result.method === "exact"
          ? `${names[state.turn]} hat das bekannte Endspiel exakt geprüft (${result.nodes} Stellungen).`
          : result.samples
            ? `${names[state.turn]} hat ${result.samples} mögliche Kartenverteilungen geprüft.`
            : "Nur ein legaler Zug.";
      await move(result.card, stamp);
    } catch (error) {
      if (stamp !== epoch) return;
      busy = false;
      render();
      status("KI-Fehler: " + error.message);
      return;
    }
  }
}
$("hint").onclick = async () => {
  if (
    busy ||
    animating ||
    (phase !== "pass" && (phase !== "play" || state.turn !== 0))
  )
    return;
  const passing = phase === "pass";
  busy = true;
  hinting = true;
  const stamp = epoch;
  render();
  try {
    const result = passing
      ? await computePass(state.hands[0], [1, 3, 2, 0][round % 4], true)
      : await compute(0);
    if (stamp !== epoch) return;
    hinted = passing ? result.cards : result.card;
    $("analysis").textContent = passing
      ? `Tipp zum Weitergeben: ${result.cards.map(label).join(" · ")}. ${result.explanation} Die markierten Karten bleiben frei wählbar.`
      : result.method === "exact"
        ? `Tipp: ${label(result.card)} · Bekanntes Endspiel exakt geprüft.`
        : `Tipp: ${label(result.card)} · ${result.samples} Kartenverteilungen geprüft.`;
  } catch (error) {
    if (stamp === epoch) $("analysis").textContent = error.message;
  } finally {
    if (stamp === epoch) {
      busy = false;
      hinting = false;
      render();
    }
  }
};
$("new").onclick = newGame;
begin();
