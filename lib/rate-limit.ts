import { createHash } from "node:crypto";
import Redis from "ioredis";
type Bucket = { count: number; end: number };
const localBuckets = new Map<string, Bucket>();
let redis: Redis | undefined;
export async function allowSubmission(scope: string): Promise<boolean> {
  const key = `punchbowl:public-enquiry:${createHash("sha256").update(scope).digest("hex")}:${Math.floor(Date.now() / 60000)}`;
  if (process.env.REDIS_URL) {
    if (!redis) {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        commandTimeout: 2000,
        enableOfflineQueue: false,
        lazyConnect: true,
      });
      redis.on("error", () => {});
    }
    if (redis.status === "wait") await redis.connect();
    const count = Number(
      await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
        1,
        key,
      ),
    );
    return count <= (scope === "global" ? 30 : 10);
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Rate limiter not configured");
  const now = Date.now();
  for (const [k, v] of localBuckets) if (v.end < now) localBuckets.delete(k);
  const bucket = localBuckets.get(key) || { count: 0, end: now + 120000 };
  bucket.count++;
  localBuckets.set(key, bucket);
  return bucket.count <= 10;
}
