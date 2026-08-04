export type PortfolioCompany = {
  name: string;
  tagline: string;
  tags: string[];
  status: 'Pipeline' | 'Diligence' | 'Portfolio' | 'Open';
  stage: string;
  imageUrl: string;
  /** Logo mark — contain + center on dark frame instead of photo cover crop. */
  imageFit?: 'cover' | 'logo';
};

/** Set false when real portfolio companies are ready — removes overlay and restores scroll depth. */
export const PORTFOLIO_COMING_SOON = false;

export const portfolioCompanies: PortfolioCompany[] = [
  {
    name: 'Ssam.ai',
    tagline:
      'An AI study workspace that reads handwritten work, understands where students get stuck, and delivers personalized hints instead of answers—keeping students engaged in the learning process.',
    tags: ['EdTech', 'B2C', 'B2B'],
    status: 'Portfolio',
    stage: 'Pre-seed',
    imageUrl: '/portfolio/ssam-ai.png',
    imageFit: 'logo',
  },
  {
    name: 'Match\u2019a',
    tagline:
      "An AI agent-to-agent social matching platform that introduces the right people before they ever meet. Match'a builds rich context, evaluates mutual compatibility and intent, and delivers explained introductions across dating, friendship, and professional networking.",
    tags: ['Consumer AI', 'Social', 'B2C'],
    status: 'Portfolio',
    stage: 'Pre-seed',
    imageUrl: '/portfolio/matcha.png',
    imageFit: 'logo',
  },
  {
    name: 'Stealth',
    tagline:
      'Currently operating in stealth while building an ambitious new product. The team is focused on validating the technology and preparing for public launch.',
    tags: ['Stealth'],
    status: 'Portfolio',
    stage: 'Pre-seed',
    imageUrl:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Your company',
    tagline: 'The next breakthrough.',
    tags: ['Frontier tech'],
    status: 'Open',
    stage: 'Pre-seed / Seed',
    imageUrl:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',
  },
];

export type CommunityProgram = {
  title: string;
  description: string;
};

export const communityPrograms: CommunityProgram[] = [
  {
    title: 'Founder circles',
    description: 'Small-group dinners with builders, operators, and guest founders.',
  },
  {
    title: 'Research nights',
    description: 'Student-led deep dives on markets, models, and emerging technology.',
  },
  {
    title: 'Build sessions',
    description: 'Weekly working blocks for teams shipping demos, decks, and prototypes.',
  },
  {
    title: 'Campus sourcing',
    description: 'Scouting across UC San Diego labs, hackathons, and founder networks.',
  },
];

export const experienceDisciplines: CommunityProgram[] = [
  {
    title: 'Team-based decision-making',
    description:
      'Pitch ideas, debate theses, and reach conviction together — the way a real investment committee would.',
  },
  {
    title: 'Investment strategy',
    description:
      'Develop top-down views on sectors, themes, and risk, then pressure-test them against live markets.',
  },
  {
    title: 'Portfolio management',
    description:
      'Track exposure, rebalance positions, and learn how construction and sizing shape outcomes over time.',
  },
  {
    title: 'Market analysis',
    description:
      'Follow macro and sector trends, monitor catalysts, and translate research into actionable insight.',
  },
  {
    title: 'Quantitative strategy',
    description:
      'Build and backtest systematic approaches alongside fundamental work on the venture and public side.',
  },
  {
    title: 'Financial modeling',
    description:
      'Structure revenue, unit economics, and scenario cases for companies and strategies alike.',
  },
  {
    title: 'Equity research',
    description:
      'Write memos, build conviction, and present recommendations backed by primary diligence.',
  },
  {
    title: 'Startup evaluation',
    description:
      'Source campus founders, run diligence, and learn what separates fundable teams from great ideas.',
  },
];
