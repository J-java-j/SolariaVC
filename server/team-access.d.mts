import type { IncomingMessage, ServerResponse } from 'node:http';
export function guardTeamDestination(req: IncomingMessage, res: ServerResponse, portal?: string): Promise<boolean>;
