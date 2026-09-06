import { TtlCache } from "@/lib/player-stats/cache";
import {
  interpretPsaCertResponse,
  normalizePsaCertNumber,
} from "@/lib/psa/map-cert";
import {
  PSA_CERT_CACHE_TTL_MS,
  PSA_PUBLIC_API_BASE,
  type PsaCertLookupResult,
} from "@/lib/psa/types";

const certCache = new TtlCache<PsaCertLookupResult>(PSA_CERT_CACHE_TTL_MS);

export function clearPsaCertCache(): void {
  certCache.clear();
}

export function getPsaPublicApiToken(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const token = env.PSA_PUBLIC_API_TOKEN
    ?.trim()
    .replace(/^(bearer|Bearer)\s+/, "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
  return token || null;
}

export function psaCertLookupUrl(certNumber: string): string {
  return `${PSA_PUBLIC_API_BASE}/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`;
}

function isCacheable(result: PsaCertLookupResult): boolean {
  return result.status === "found" || result.status === "not_found" || result.status === "invalid";
}

export async function fetchPsaCertByNumber(
  certNumber: string,
  options?: {
    token?: string | null;
    fetch?: typeof fetch;
    timeoutMs?: number;
    skipCache?: boolean;
  }
): Promise<PsaCertLookupResult> {
  const normalized = normalizePsaCertNumber(certNumber);
  if (!normalized) {
    return { status: "invalid", message: "Enter a valid PSA cert number." };
  }

  if (!options?.skipCache) {
    const cached = certCache.get(normalized);
    if (cached) return cached;
  }

  const token = options?.token ?? getPsaPublicApiToken();
  if (!token) {
    return {
      status: "error",
      message: "PSA cert lookup is not configured.",
    };
  }

  const timeoutMs = options?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchFn = options?.fetch ?? fetch;

  try {
    const response = await fetchFn(psaCertLookupUrl(normalized), {
      method: "GET",
      headers: {
        Authorization: `bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    let body: unknown = null;
    if (response.status !== 204) {
      const text = await response.text();
      if (text.trim()) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          return {
            status: "error",
            message: "PSA lookup is temporarily unavailable.",
            retryable: true,
          };
        }
      }
    }

    const result = interpretPsaCertResponse(response.status, body);
    if (isCacheable(result)) {
      certCache.set(normalized, result);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: "error",
        message: "PSA lookup timed out. Try again.",
        retryable: true,
      };
    }
    return {
      status: "error",
      message: "PSA lookup is temporarily unavailable.",
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
