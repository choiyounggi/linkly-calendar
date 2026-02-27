export const redisConfig = () => {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
  const db = Number.parseInt(process.env.REDIS_DB ?? '0', 10);
  const password = process.env.REDIS_PASSWORD;

  return {
    host,
    port,
    db,
    password,
  };
};
