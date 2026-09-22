// Standard Pokémon type colors, used for badges, card frames and meters.
// This is fixed reference data (not fetched) since it's purely a UI color map.
const TYPE_COLORS = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
};

// Types PokeAPI returns that aren't real battle elements — hidden from the dropdown.
const HIDDEN_TYPES = new Set(["unknown", "shadow"]);
