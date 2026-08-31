import { describe, expect, it } from "vitest";
import { safeFetch, SsrfBlockedError } from "./safe-fetch";

// These exercise the IP-literal path in assertPublicHost, which throws SsrfBlockedError before
// any real fetch() call is attempted — no network mocking needed, and nothing here makes an
// actual HTTP request. DNS-based blocking (a hostname that *resolves* to a private IP) isn't
// covered here since that needs a real/mocked resolver; the IP-literal path is the part an
// attacker controls directly (both career-source URLs and job-link imports accept raw user
// input), so it's the highest-value slice to lock down with a fast, deterministic test.
describe("safeFetch — SSRF guard", () => {
  it.each([
    ["127.0.0.1", "IPv4 loopback"],
    ["10.0.0.1", "IPv4 private (10.0.0.0/8)"],
    ["172.16.0.1", "IPv4 private (172.16.0.0/12)"],
    ["192.168.1.1", "IPv4 private (192.168.0.0/16)"],
    ["169.254.169.254", "IPv4 link-local — the classic cloud-metadata SSRF target"],
    ["100.64.0.1", "IPv4 carrier-grade NAT (100.64.0.0/10)"],
    ["0.0.0.0", "IPv4 unspecified"],
  ])("blocks a URL whose host is the IP literal %s (%s)", async (ip) => {
    await expect(safeFetch(`http://${ip}/`)).rejects.toThrow(SsrfBlockedError);
  });

  it.each([
    ["[::1]", "IPv6 loopback"],
    ["[fd00::1]", "IPv6 unique local (fc00::/7)"],
    ["[fe80::1]", "IPv6 link-local (fe80::/10)"],
    ["[::ffff:127.0.0.1]", "IPv4-mapped IPv6 loopback — must unwrap before checking"],
  ])("blocks a URL whose host is the IPv6 literal %s (%s)", async (ip) => {
    await expect(safeFetch(`http://${ip}/`)).rejects.toThrow(SsrfBlockedError);
  });

  it("refuses a non-http(s) scheme before ever resolving the host", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/non-http/i);
  });

  it("refuses a gopher/ftp-style scheme sometimes used to bypass naive http(s) checks", async () => {
    await expect(safeFetch("ftp://internal.example.com/")).rejects.toThrow(/non-http/i);
  });
});
