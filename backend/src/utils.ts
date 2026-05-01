import WebSocket from 'ws';

export const NOT_FOUND = 'NOT_FOUND';
export const INVALID_REQUEST = 'INVALID_REQUEST';

export class ErrorResponse {
  public statusCode: number;
  public message: string;
  public errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.message = message;
  }
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface BroadcastOptions {
  exclude?: Set<WebSocket>;
}
