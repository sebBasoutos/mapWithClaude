// Upstash Redis client (Vercel KV's successor). Reads whichever env-var
// naming the Vercel/Upstash integration provisions.
import { Redis } from '@upstash/redis';

export const store = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const RESTAURANTS_KEY = 'restaurants';
