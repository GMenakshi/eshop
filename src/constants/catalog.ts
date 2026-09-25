export const imageBase = "https://api-palette-project.lovable.app/assets/";

export const catalog = {
  pack: {
    name: "Vault-01 Tactical Pack",
    variant: "Matte Black / OS",
    price: 189,
    image: `${imageBase}p-pack-EQw1NN7b.jpg`,
  },
  headphones: {
    name: "Sonic Frame Gen 2",
    variant: "Obsidian",
    price: 349,
    image: `${imageBase}p-headphones-ThTGGjdI.jpg`,
  },
  keyboard: {
    name: "Matrix Core 65%",
    variant: "Stealth / Green switch",
    price: 210,
    image: `${imageBase}p-keyboard-DqtRvNSu.jpg`,
  },
} as const;

export type CatalogItem = (typeof catalog)[keyof typeof catalog];
