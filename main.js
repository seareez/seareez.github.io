const tableHeader = document.querySelector("#table-header");
const table = document.querySelector("#main-table");
var runs;

const inputs = {
  "sort-by": document.querySelector("#sort-by"),
  "f-level": document.querySelector("#f-level"),
  "f-difficulty": document.querySelector("#f-difficulty"),
  "f-time-from": document.querySelector("#f-time-from"),
  "f-time-to": document.querySelector("#f-time-to"),
  "f-tps-from": document.querySelector("#f-tps-from"),
  "f-tps-to": document.querySelector("#f-tps-to"),
  "f-authors-name": document.querySelector("#f-authors-name"),
  "f-authors-from": document.querySelector("#f-authors-from"),
  "f-authors-to": document.querySelector("#f-authors-to"),
  "f-has-video": document.querySelector("#f-has-video"),
  "f-has-download": document.querySelector("#f-has-download"),
  "f-date-from": document.querySelector("#f-date-from"),
  "f-date-to": document.querySelector("#f-date-to"),
  "f-id-from": document.querySelector("#f-id-from"),
  "f-id-to": document.querySelector("#f-id-to")
};

// Cache Geometry Dash level information for seven days.
const LEVEL_CACHE_KEY = "gdTasLevelInfoCache";
const LEVEL_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const levelInfoCache = new Map();

function readSavedLevelCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEVEL_CACHE_KEY) || "{}");
    const now = Date.now();

    for (const [id, entry] of Object.entries(saved)) {
      if (entry && now - entry.savedAt < LEVEL_CACHE_MAX_AGE && entry.info) {
        levelInfoCache.set(String(id), entry.info);
      }
    }
  } catch (_) {
    // Continue without persistent caching if storage is unavailable.
  }
}

function saveLevelInfo(id, info) {
  levelInfoCache.set(String(id), info);

  try {
    const saved = JSON.parse(localStorage.getItem(LEVEL_CACHE_KEY) || "{}");
    saved[String(id)] = { savedAt: Date.now(), info };
    localStorage.setItem(LEVEL_CACHE_KEY, JSON.stringify(saved));
  } catch (_) {
    // Continue without persistent caching if storage is unavailable.
  }
}

function formatLevelDifficulty(level) {
  if (!level || typeof level.difficulty !== "string") return null;

  const difficulty = level.difficulty.trim();

  if (!difficulty || /^(n\/a|unrated)$/i.test(difficulty)) {
    return "Unrated";
  }

  // Demon levels always award 10 stars.
  if (/demon/i.test(difficulty)) {
    return `${difficulty.replace(/\s+/g, " ")} 10*`;
  }

  const stars = Number(level.stars);

  if (!Number.isFinite(stars)) return difficulty;

  return `${difficulty} ${stars}*`;
}

async function fetchLevelInfo(levelId) {
  const id = String(levelId ?? "").trim();

  if (!id || id === "N/A" || !/^\d+$/.test(id)) return null;

  if (levelInfoCache.has(id)) {
    return levelInfoCache.get(id);
  }

  try {
    const response = await fetch(
      `https://gdbrowser.com/api/level/${encodeURIComponent(id)}`
    );

    if (!response.ok) {
      throw new Error(`GDBrowser returned HTTP ${response.status} for level ${id}`);
    }

    const info = await response.json();

    if (!info || typeof info.difficulty !== "string") {
      throw new Error(`GDBrowser returned invalid level data for ${id}`);
    }

    saveLevelInfo(id, info);
    return info;
  } catch (error) {
    console.warn(`Could not look up Geometry Dash level ${id}:`, error);
    return null;
  }
}

async function enrichRunDifficulties(runList) {
  readSavedLevelCache();

  const ids = [...new Set(
    runList
      .map(run => String(run.level_id ?? "").trim())
      .filter(id => /^\d+$/.test(id) && !levelInfoCache.has(id))
  )];

  // Limit concurrent requests to avoid flooding the API.
  let nextIndex = 0;
  const workerCount = Math.min(4, ids.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < ids.length) {
      const id = ids[nextIndex++];
      await fetchLevelInfo(id);
    }
  });

  await Promise.all(workers);

  for (const run of runList) {
    const info = levelInfoCache.get(String(run.level_id ?? "").trim());

    if (info && typeof info.name === "string" && info.name.trim()) {
      run.displayLevelName = info.name.trim();
    }

    const formatted = formatLevelDifficulty(info);

    if (formatted) {
      run.displayDifficulty = formatted;
    }
  }
}

function ticksToTime(ticks, tps = 240) {
  let output = "";

  const hrs = Math.floor(ticks / (3600 * tps));
  const min = Math.floor(ticks / (60 * tps));
  const sec = (ticks % (60 * tps)) / tps;

  if (hrs !== 0) {
    output += `${hrs}:${min % 60 < 10 ? "0" : ""}${min % 60}:`;
  } else if (min !== 0) {
    output += `${min}:`;
  }

  if (sec < 10) output += "0";
  output += sec.toFixed(3);

  return output;
}

const iVideo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="icon-green"><!--!Font Awesome Free 7.2.0 by @fontawesome - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z"/></svg>`;

const iXmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="icon-red"><!--!Font Awesome Free 7.2.0 by @fontawesome - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>`;

function buildTable(filteredRuns) {
  const fastestTimesByLevel = {};

  if (runs && Array.isArray(runs)) {
    for (const run of runs) {
      const key = String(run.level_id ?? "N/A") !== "N/A"
        ? `id_${run.level_id}`
        : `name_${run.displayLevelName || run.level_name || "Unknown"}`;

      const time = run.ticks / (run.tps || 240);

      if (!(key in fastestTimesByLevel) || time < fastestTimesByLevel[key]) {
        fastestTimesByLevel[key] = time;
      }
    }
  }

  let output = tableHeader.outerHTML;

  for (const run of filteredRuns) {
    let dateString = "????-??-??";

    try {
      const runDate = new Date(run.date);
      const timezoneOffset = runDate.getTimezoneOffset();
      const date = new Date(runDate.getTime() - timezoneOffset * 60 * 1000);
      dateString = date.toISOString().split("T")[0];
    } catch (_) {}

    const key = String(run.level_id ?? "N/A") !== "N/A"
      ? `id_${run.level_id}`
      : `name_${run.displayLevelName || run.level_name || "Unknown"}`;

    const currentTime = run.ticks / (run.tps || 240);
    const isFastest = (
      fastestTimesByLevel[key] !== undefined &&
      Math.abs(currentTime - fastestTimesByLevel[key]) < 0.0001
    );

    const starPrefix = isFastest ? "⭐ " : "";
    const levelName = run.displayLevelName || run.level_name || "Unknown";

    output += `
      <tr>
        <td>${starPrefix}${levelName}<br><sub>${Number.isFinite(Number(run.level_id)) && String(run.level_id).trim() !== "" ? run.level_id : "N/A"}</sub></td>
        <td>${run.displayDifficulty || run.difficulty || "Unknown"}</td>
        <td><span class="mono">${ticksToTime(run.ticks, run.tps)}</span><br><sub>(${run.ticks} ticks)</sub></td>
        <td>${run.tps || 240}</td>
        <td>${run.authors.join(", ") || "unknown"}</td>
        <td>${run.video ? `<a href="${run.video}" target="_blank">${iVideo}</a>` : iXmark}</td>
        <td>${run.download ? `<a href="${run.download}" target="_blank">${run.format || "unknown"}</a>` : iXmark}</td>
        <td>${dateString}<br><sub>YYYY-MM-DD</sub></td>
      </tr>
    `;
  }

  table.innerHTML = output;
}
function filterRuns() {
  let filteredRuns = structuredClone(runs);

  switch (inputs["sort-by"].value) {
    case "time-asc":
      filteredRuns.sort((a, b) =>
        a.ticks / (a.tps || 240) - b.ticks / (b.tps || 240)
      );
      break;
    case "time-desc":
      filteredRuns.sort((b, a) =>
        a.ticks / (a.tps || 240) - b.ticks / (b.tps || 240)
      );
      break;
    case "tps-asc":
      filteredRuns.sort((a, b) => (a.tps || 240) - (b.tps || 240));
      break;
    case "tps-desc":
      filteredRuns.sort((b, a) => (a.tps || 240) - (b.tps || 240));
      break;
    case "authors-asc":
      filteredRuns.sort((a, b) => (a.authors?.length || 0) - (b.authors?.length || 0));
      break;
    case "authors-desc":
      filteredRuns.sort((b, a) => (a.authors?.length || 0) - (b.authors?.length || 0));
      break;
    case "date-asc":
      filteredRuns.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case "date-desc":
      filteredRuns.sort((b, a) => new Date(a.date) - new Date(b.date));
      break;
    case "id-asc":
      filteredRuns.sort((a, b) => {
        if (a.level_id === "N/A") return 1;
        if (b.level_id === "N/A") return -1;
        return a.level_id - b.level_id;
      });
      break;
    case "id-desc":
      filteredRuns.sort((a, b) => {
        if (a.level_id === "N/A") return 1;
        if (b.level_id === "N/A") return -1;
        return b.level_id - a.level_id;
      });
      break;
    default:
      break;
  }

  const fLevel = inputs["f-level"].value.toString().trim().toLowerCase();

  filteredRuns = filteredRuns.filter(r =>
    (r?.displayLevelName || r?.level_name || "").toString().toLowerCase().includes(fLevel) ||
    r?.level_id?.toString().includes(fLevel)
  );

  const fDifficulty = inputs["f-difficulty"].value.toString().trim().toLowerCase();

  filteredRuns = filteredRuns.filter(r =>
    (r.displayDifficulty || r.difficulty || "").toString().toLowerCase().includes(fDifficulty)
  );

  const fTimeFrom = Number(inputs["f-time-from"].value.toString().trim());
  const fTimeTo = Number(inputs["f-time-to"].value.toString().trim());

  filteredRuns = filteredRuns.filter(r => {
    let pass = true;
    const time = r.ticks / (r.tps || 240);

    if (fTimeFrom && time < fTimeFrom) pass = false;
    if (fTimeTo && time > fTimeTo) pass = false;

    return pass;
  });

  const fTPSFrom = Number(inputs["f-tps-from"].value.toString().trim());
  const fTPSTo = Number(inputs["f-tps-to"].value.toString().trim());

  filteredRuns = filteredRuns.filter(r => {
    let pass = true;

    if (fTPSFrom && (r.tps || 240) < fTPSFrom) pass = false;
    if (fTPSTo && (r.tps || 240) > fTPSTo) pass = false;

    return pass;
  });

  const fAuthorName = inputs["f-authors-name"].value.toString().trim().toLowerCase();

  filteredRuns = filteredRuns.filter(r =>
    r.authors.join(", ").toLowerCase().includes(fAuthorName)
  );

  const fAuthorsFrom = Number(inputs["f-authors-from"].value.toString().trim());
  const fAuthorsTo = Number(inputs["f-authors-to"].value.toString().trim());

  filteredRuns = filteredRuns.filter(r => {
    if (!r.authors?.length) return false;

    let pass = true;

    if (fAuthorsFrom && r.authors.length < fAuthorsFrom) pass = false;
    if (fAuthorsTo && r.authors.length > fAuthorsTo) pass = false;

    return pass;
  });

  const fHasVideo = inputs["f-has-video"].value;

  if (fHasVideo === "yes") {
    filteredRuns = filteredRuns.filter(r => r.video);
  } else if (fHasVideo === "no") {
    filteredRuns = filteredRuns.filter(r => !r.video);
  }

  const fDownloadFormat = inputs["f-has-download"].value;

  if (fDownloadFormat !== "either") {
    if (fDownloadFormat === "any-download") {
      filteredRuns = filteredRuns.filter(r => r.download);
    } else if (fDownloadFormat === "no-download") {
      filteredRuns = filteredRuns.filter(r => !r.download);
    } else {
      filteredRuns = filteredRuns.filter(
        r => r.format?.toUpperCase() === fDownloadFormat
      );
    }
  }

  const fDateFrom = Number(new Date(inputs["f-date-from"].value));
  const fDateTo = Number(new Date(inputs["f-date-to"].value));

  filteredRuns = filteredRuns.filter(r => {
    if (!r.date) return false;

    let pass = true;

    if (fDateFrom && Number(new Date(r.date)) < fDateFrom) pass = false;
    if (fDateTo && Number(new Date(r.date)) > fDateTo) pass = false;

    return pass;
  });

  const fIdFrom = Number(inputs["f-id-from"].value.toString().trim());
  const fIdTo = Number(inputs["f-id-to"].value.toString().trim());

  filteredRuns = filteredRuns.filter(r => {
    let pass = true;

    if (fIdFrom && r.level_id < fIdFrom) pass = false;
    if (fIdTo && r.level_id > fIdTo) pass = false;

    return pass;
  });

  return filteredRuns;
}

for (const input in inputs) {
  const element = inputs[input];

  element.addEventListener("change", () => buildTable(filterRuns()));
  element.addEventListener("input", () => buildTable(filterRuns()));
}

async function initTable() {
  const response = await fetch("runs.json");

  if (response.status !== 200) {
    alert("Failed to fetch table of runs.\nTry again later.");
    return;
  }

  try {
    runs = await response.json();
  } catch (_) {
    alert("Failed to fetch table of runs.\nTry again later.");
    return;
  }

  runs.sort((a, b) => {
    return Number(new Date(b.date)) - Number(new Date(a.date));
  });

  const formats = new Set();

  for (const run of runs) {
    if (!run.format) continue;

    const format = run.format.trim().toUpperCase();

    if (!formats.has(format)) formats.add(format);
  }

  for (const format of formats) {
    inputs["f-has-download"].innerHTML +=
      `<option value="${format}">${format}</option>`;
  }

  // Show the existing data immediately, then update names and difficulties
  // as soon as the level metadata has loaded.
  buildTable(filterRuns());
  await enrichRunDifficulties(runs);
  buildTable(filterRuns());
}

initTable();