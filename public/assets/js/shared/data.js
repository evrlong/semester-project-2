export const fallbackListings = [
  {
    id: "sample-1",
    title: "Hand-painted cat portrait",
    description:
      "A cheerful study in gouache ready to brighten any reading nook.",
    media: [
      {
        url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80",
        alt: "Cat portrait",
      },
    ],
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    bids: [{ amount: 48 }, { amount: 72 }],
    _count: { bids: 2 },
    seller: { name: "Sample seller" },
  },
  {
    id: "sample-2",
    title: "Vintage brass collar",
    description:
      "Soft velvet lining with tiny bells collected from a Parisian market.",
    media: [
      {
        url: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=800&q=80",
        alt: "Brass collar",
      },
    ],
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    bids: [
      { amount: 18 },
      { amount: 34 },
      { amount: 55 },
      { amount: 63 },
      { amount: 80 },
    ],
    _count: { bids: 5 },
    seller: { name: "Sample seller" },
  },
];

export const fallbackProfile = {
  name: "Sample Seller",
  email: "sample.seller@stud.noroff.no",
  credits: 0,
  listings: fallbackListings,
  wins: [],
  _count: {
    listings: fallbackListings.length,
    wins: 0,
  },
};
