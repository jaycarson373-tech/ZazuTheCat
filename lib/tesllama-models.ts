export const tesllamaModels = [
  {
    id: "s", name: "TESLLAMA S", label: "Model S", body: "Sedan",
    finishes: [
      { id: "pearl", name: "Pearl White", swatch: "#e7e0d5", image: "/tesllama-s.jpg" },
      { id: "obsidian", name: "Obsidian", swatch: "#262629", image: "/tesllama-s-obsidian.jpg" },
    ],
  },
  {
    id: "x", name: "TESLLAMA X", label: "Model X", body: "SUV",
    finishes: [
      { id: "obsidian", name: "Obsidian", swatch: "#262629", image: "/tesllama-x.jpg" },
      { id: "ruby", name: "Ruby Red", swatch: "#9d2233", image: "/tesllama-x-ruby.jpg" },
    ],
  },
  {
    id: "ct", name: "TESLLAMA CT", label: "Model CT", body: "Pickup",
    finishes: [
      { id: "silver", name: "Lunar Silver", swatch: "#b1b8c1", image: "/tesllama-ct.jpg" },
      { id: "arctic", name: "Arctic White", swatch: "#f4f4f2", image: "/tesllama-ct-arctic.jpg" },
    ],
  },
] as const;
