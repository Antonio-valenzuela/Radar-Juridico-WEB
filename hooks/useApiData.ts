"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type ApiStatus = "idle" | "loading" | "success" | "empty" | "error" | "unconfigured" | "timeout";

export interface UseApiDataOptions<T> {
  timeoutMs?: number;
  initialData?: T | null;
  transform?: (data: any) => T;
  isEmpty?: (data: T) => boolean;
  isUnconfigured?: (res: Response, data: any) => boolean;
}

export interface UseApiDataResult<T> {
  data: T | null;
  status: ApiStatus;
  loading: boolean;
  error: string | null;
  empty: boolean;
  unconfigured: boolean;
  refetch: () => void;
}

export function useApiData<T = any>(
  url: string | null,
  options: UseApiDataOptions<T> = {}
): UseApiDataResult<T> {
  const {
    timeoutMs = 10000,
    initialData = null,
    transform = (d) => d,
    isEmpty = (d) => Array.isArray(d) ? d.length === 0 : !d,
    isUnconfigured = (res, d) => res.status === 401 || res.status === 403 || Boolean(d?.unconfigured),
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!url) {
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => null);

      if (!isMounted.current) return;

      if (isUnconfigured(res, json)) {
        setStatus("unconfigured");
        setError(json?.error || json?.message || "Configuración pendiente en servidor.");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setError(json?.error || json?.message || `Error del servidor (${res.status})`);
        return;
      }

      const transformed = transform(json?.data ?? json);
      setData(transformed);

      if (isEmpty(transformed)) {
        setStatus("empty");
      } else {
        setStatus("success");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!isMounted.current) return;

      if (err.name === "AbortError") {
        setStatus("timeout");
        setError(`Tiempo de espera agotado (${timeoutMs / 1000}s)`);
      } else {
        setStatus("error");
        setError(err.message || "Error de red o conexión.");
      }
    }
  }, [url, timeoutMs, transform, isEmpty, isUnconfigured]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    status,
    loading: status === "loading",
    error,
    empty: status === "empty",
    unconfigured: status === "unconfigured",
    refetch: fetchData,
  };
}
