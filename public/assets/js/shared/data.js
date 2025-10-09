export const listingSeedData = [
  {
    id: "assignment-1",
    title: "Sprint planning workshop",
    description:
      "Coordinate roles, deadlines and deliverables for the upcoming sprint.",
    category: "event",
    deadline: new Date().setDate(new Date().getDate() + 7),
    status: "Scheduled",
    owner: "Product team",
  },
  {
    id: "resource-2",
    title: "Design system refresh",
    description: "Update spacing, typography tokens and component guidelines.",
    category: "resource",
    deadline: new Date().setDate(new Date().getDate() + 14),
    status: "In progress",
    owner: "Design ops",
  },
  {
    id: "assignment-3",
    title: "Usability testing report",
    description:
      "Summarise feedback from test participants and prioritise fixes.",
    category: "assignment",
    deadline: new Date().setDate(new Date().getDate() + 21),
    status: "Awaiting review",
    owner: "Research team",
  },
];

export const profileSeedData = {
  name: "Avery Johnson",
  email: "avery.johnson@example.com",
  stats: {
    active: 3,
    completed: 8,
  },
};
