import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { apiNotFound } from "./api-not-found";

// Same order as server/index.ts: API routes, then this, then the SPA catch-all.
const app = express();
app.get("/api/real", (_req, res) => res.json({ ok: true }));
app.use("/api", apiNotFound);
app.use("*", (_req, res) => res.type("html").send("<!doctype html><title>app</title>"));

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("apiNotFound", () => {
  it("answers an unknown API path with a JSON 404, not the app's HTML", async () => {
    for (const p of ["/api/earnings", "/api/no/such/thing?x=1", "/api"]) {
      const res = await fetch(base + p);
      expect(res.status, p).toBe(404);
      expect(res.headers.get("content-type"), p).toMatch(/application\/json/);
      expect(await res.json()).toEqual({ error: "Not found" });
    }
  });

  it("leaves real API routes and app pages alone", async () => {
    expect(await (await fetch(base + "/api/real")).json()).toEqual({ ok: true });
    const page = await fetch(base + "/books");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    // A page whose path merely starts with "api" is still the app
    expect((await fetch(base + "/apiary")).status).toBe(200);
  });
});
