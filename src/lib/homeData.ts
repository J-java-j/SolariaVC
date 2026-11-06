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

/**
 * While true, the Portfolio showcase sits dimmed under a "Coming Soon" stamp.
 * Set false once real portfolio companies are listed below — removes the overlay and restores scroll depth.
 */
export const PORTFOLIO_COMING_SOON = true;

/** Ssam.ai and Match'a were removed on purpose; they remain in git history. */
export const portfolioCompanies: PortfolioCompany[] = [
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
