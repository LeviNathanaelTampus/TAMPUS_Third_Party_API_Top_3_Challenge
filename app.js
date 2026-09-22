const POKEAPI = "https://pokeapi.co/api/v2";
const MAX_RESULTS = 24;
const ALL_TYPES = Object.keys(TYPE_COLORS);
const STAT_LABELS = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  "special-attack": "Sp. Atk",
  "special-defense": "Sp. Def",
  speed: "Speed",
};

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const typeSelect = document.getElementById("type-select");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const pickButtons = document.querySelectorAll("[data-pick]");

let pokemonIndexCache = null;
const effectivenessCache = new Map();

function setStatus(message, kind = "info") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
}

function titleCase(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(term) {
  return term.trim().toLowerCase().replace(/\s+/g, "-");
}

async function tryFetchPokemon(nameOrId) {
  const res = await fetch(`${POKEAPI}/pokemon/${nameOrId}`);
  if (!res.ok) return null;
  return res.json();
}

async function ensurePokemonIndex() {
  if (pokemonIndexCache) return pokemonIndexCache;
  const res = await fetch(`${POKEAPI}/pokemon?limit=100000&offset=0`);
  if (!res.ok) throw new Error("Couldn't load the Pokémon index.");
  const data = await res.json();
  pokemonIndexCache = data.results;
  return pokemonIndexCache;
}

async function loadTypeOptions() {
  try {
    const res = await fetch(`${POKEAPI}/type?limit=40`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const names = data.results
      .map((t) => t.name)
      .filter((name) => !HIDDEN_TYPES.has(name))
      .sort();
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = titleCase(name);
      typeSelect.appendChild(option);
    });
  } catch (err) {
    setStatus("Couldn't load the element list, but name search still works.", "error");
  }
}

async function searchByName(term) {
  const slug = slugify(term);
  const direct = await tryFetchPokemon(slug);
  if (direct) return { details: [direct], total: 1 };

  const index = await ensurePokemonIndex();
  const matches = index.filter((p) => p.name.includes(slug));
  const capped = matches.slice(0, MAX_RESULTS);
  const details = await Promise.all(capped.map((m) => tryFetchPokemon(m.name)));
  return { details: details.filter(Boolean), total: matches.length };
}

async function searchByType(type, nameSlug) {
  const res = await fetch(`${POKEAPI}/type/${type}`);
  if (!res.ok) throw new Error("Couldn't load that element.");
  const data = await res.json();
  let names = data.pokemon.map((p) => p.pokemon.name);
  if (nameSlug) {
    names = names.filter((name) => name.includes(nameSlug));
  }
  const capped = names.slice(0, MAX_RESULTS);
  const details = await Promise.all(capped.map((n) => tryFetchPokemon(n)));
  return { details: details.filter(Boolean), total: names.length };
}

async function getTypeDamageRelations(type) {
  const res = await fetch(`${POKEAPI}/type/${type}`);
  if (!res.ok) throw new Error(`Couldn't load type data for ${type}.`);
  const data = await res.json();
  return data.damage_relations;
}

async function computeEffectiveness(types) {
  const key = [...types].sort().join("+");
  if (effectivenessCache.has(key)) return effectivenessCache.get(key);

  const relations = await Promise.all(types.map(getTypeDamageRelations));

  const multiplier = {};
  ALL_TYPES.forEach((t) => (multiplier[t] = 1));
  const strongAgainst = new Set();

  relations.forEach((rel) => {
    rel.double_damage_from.forEach((t) => (multiplier[t.name] *= 2));
    rel.half_damage_from.forEach((t) => (multiplier[t.name] *= 0.5));
    rel.no_damage_from.forEach((t) => (multiplier[t.name] = 0));
    rel.double_damage_to.forEach((t) => strongAgainst.add(t.name));
  });

  const weaknesses = [];
  const resistances = [];
  const immunities = [];
  ALL_TYPES.forEach((t) => {
    if (multiplier[t] === 0) immunities.push(t);
    else if (multiplier[t] > 1) weaknesses.push({ type: t, mult: multiplier[t] });
    else if (multiplier[t] < 1) resistances.push({ type: t, mult: multiplier[t] });
  });

  const result = { weaknesses, resistances, immunities, strongAgainst: [...strongAgainst] };
  effectivenessCache.set(key, result);
  return result;
}

function statBar(label, value) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const labelEl = document.createElement("span");
  labelEl.className = "stat-label";
  labelEl.textContent = label;

  const track = document.createElement("div");
  track.className = "stat-track";
  const fill = document.createElement("div");
  fill.className = "stat-fill";
  fill.style.width = `${Math.min(100, (value / 150) * 100)}%`;
  track.appendChild(fill);

  const valueEl = document.createElement("span");
  valueEl.className = "stat-value";
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(track);
  row.appendChild(valueEl);
  return row;
}

function meterBadge(type, suffix) {
  const badge = document.createElement("span");
  badge.className = "meter-badge";
  badge.style.background = TYPE_COLORS[type] || "#999";
  badge.textContent = `${titleCase(type)}${suffix ? " " + suffix : ""}`;
  return badge;
}

function meterRow(label, className, items) {
  const row = document.createElement("div");
  row.className = `meter-row ${className}`;

  const labelEl = document.createElement("span");
  labelEl.className = "meter-label";
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const icons = document.createElement("div");
  icons.className = "meter-icons";
  if (items.length === 0) {
    const none = document.createElement("span");
    none.className = "meter-none";
    none.textContent = "—";
    icons.appendChild(none);
  } else {
    items.forEach((item) => icons.appendChild(item));
  }
  row.appendChild(icons);
  return row;
}

async function buildCard(detail) {
  const types = detail.types.map((t) => t.type.name);
  const primaryType = types[0];
  const stats = {};
  detail.stats.forEach((s) => (stats[s.stat.name] = s.base_stat));

  const card = document.createElement("article");
  card.className = "poke-card";
  card.style.setProperty("--type-color", TYPE_COLORS[primaryType] || "#999");

  const header = document.createElement("div");
  header.className = "poke-card-header";
  const name = document.createElement("span");
  name.className = "poke-name";
  name.textContent = titleCase(detail.name);
  const hp = document.createElement("span");
  hp.className = "poke-hp";
  hp.textContent = `HP ${stats.hp ?? "?"}`;
  header.appendChild(name);
  header.appendChild(hp);
  card.appendChild(header);

  const art = document.createElement("div");
  art.className = "poke-art";
  const img = document.createElement("img");
  const artwork =
    detail.sprites?.other?.["official-artwork"]?.front_default || detail.sprites?.front_default;
  img.src = artwork || "";
  img.alt = detail.name;
  img.loading = "lazy";
  art.appendChild(img);
  card.appendChild(art);

  const typesRow = document.createElement("div");
  typesRow.className = "poke-types";
  types.forEach((t) => {
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.style.background = TYPE_COLORS[t] || "#999";
    badge.textContent = titleCase(t);
    typesRow.appendChild(badge);
  });
  card.appendChild(typesRow);

  const statsBox = document.createElement("div");
  statsBox.className = "poke-stats";
  ["attack", "defense", "special-attack", "special-defense", "speed"].forEach((key) => {
    if (stats[key] !== undefined) {
      statsBox.appendChild(statBar(STAT_LABELS[key], stats[key]));
    }
  });
  card.appendChild(statsBox);

  const meter = document.createElement("div");
  meter.className = "poke-meter";
  try {
    const eff = await computeEffectiveness(types);
    meter.appendChild(
      meterRow(
        "Weakness",
        "weak",
        eff.weaknesses.map((w) => meterBadge(w.type, `×${w.mult}`))
      )
    );
    meter.appendChild(
      meterRow(
        "Resistance",
        "resist",
        eff.resistances.map((r) => meterBadge(r.type, r.mult === 0.25 ? "×¼" : "×½"))
      )
    );
    if (eff.immunities.length > 0) {
      meter.appendChild(meterRow("No Effect", "immune", eff.immunities.map((t) => meterBadge(t))));
    }
    meter.appendChild(meterRow("Strong vs", "strong", eff.strongAgainst.map((t) => meterBadge(t))));
  } catch (err) {
    const errRow = document.createElement("p");
    errRow.className = "meter-error";
    errRow.textContent = "Couldn't load type matchups.";
    meter.appendChild(errRow);
  }
  card.appendChild(meter);

  return card;
}

async function renderCards(details) {
  resultsEl.innerHTML = "";
  const cards = await Promise.all(details.map(buildCard));
  cards.forEach((c) => resultsEl.appendChild(c));
}

async function handleSearch(rawTerm, type) {
  const term = rawTerm.trim().toLowerCase();
  const slug = term ? slugify(term) : "";

  if (!term && !type) {
    setStatus("Enter a name or choose an element first.", "error");
    return;
  }

  setStatus("Loading...", "loading");
  resultsEl.innerHTML = "";

  try {
    let outcome;
    if (term && !type) {
      outcome = await searchByName(term);
    } else if (type && !term) {
      outcome = await searchByType(type);
    } else {
      outcome = await searchByType(type, slug);
    }

    if (outcome.details.length === 0) {
      resultsEl.innerHTML = '<p class="empty">No Pokémon matched. Try a different name or element.</p>';
      setStatus("No results found.", "error");
      return;
    }

    await renderCards(outcome.details);
    const shown = outcome.details.length;
    const note = outcome.total > shown ? ` (showing first ${shown} of ${outcome.total})` : "";
    setStatus(`Showing ${shown} result${shown === 1 ? "" : "s"}${note}.`, "success");
  } catch (err) {
    setStatus(err.message || "Something went wrong.", "error");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSearch(searchInput.value, typeSelect.value);
});

pickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.pick;
    typeSelect.value = "";
    handleSearch(button.dataset.pick, "");
  });
});

loadTypeOptions();
