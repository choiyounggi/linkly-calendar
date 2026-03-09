export const CHAT_NAMESPACE = '/ws/chat';

export const CHAT_EVENTS = {
  connected: 'chat:connected',
  error: 'chat:error',
  send: 'chat:send',
  message: 'chat:message',
  join: 'chat:join',
  sync: 'chat:sync',
  ping: 'chat:ping',
  pong: 'chat:pong',
} as const;

export const roomForCouple = (coupleId: string) => `couple:${coupleId}`;
