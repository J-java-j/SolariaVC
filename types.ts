export interface MarketData {
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
}

export interface TerminalLine {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'system';
  timestamp: string;
}

export enum ConnectionStatus {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  FAILED
}