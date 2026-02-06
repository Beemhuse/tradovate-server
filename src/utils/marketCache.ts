const marketCache = new Map<
  string,
  { data: number[]; expires: number }
>();

export const getCachedMarket = (key: string) => {
  const cached = marketCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expires) {
    marketCache.delete(key);
    return null;
  }
  return cached.data;
};

export const setCachedMarket = (
  key: string,
  data: number[],
  ttlSeconds = 60
) => {
  marketCache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
};
