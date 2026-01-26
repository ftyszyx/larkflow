import type { Context } from "hono";

export type ApiEnvelope<T> = {
    code: number;
    message: string;
    data: T;
};

export const ok = <T>(_c: Context, data: T, status = 200, message = "ok", code = 0) => {
    const body = JSON.stringify({ code, message, data } satisfies ApiEnvelope<T>);
    const headers = new Headers();
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(body, { status, headers });
};

export const fail = (_c: Context, status: number, message: string, code = status, data: unknown = null) => {
    const body = JSON.stringify({ code, message, data } satisfies ApiEnvelope<unknown>);
    const headers = new Headers();
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(body, { status, headers });
};
