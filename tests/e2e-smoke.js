#!/usr/bin/env node
/**
 * End-to-End smoke test for the SunStore production deployment.
 *
 * Hits every public route, asserts HTTP 200, and checks that key content
 * is present. Designed to run against the Vercel production URL.
 *
 * Usage:
 *   node e2e-smoke.js https://frontend-orcin-seven-95.vercel.app
 */

const TARGET = process.argv[2] || "https://frontend-orcin-seven-95.vercel.app";

if (!TARGET.startsWith("http")) {
  console.error("✗ Target must be a URL starting with http(s)://");
  process.exit(1);
}

const base = TARGET.replace(/\/+$/, "");

const routes = [
  {
    path: "/",
    name: "Home",
    expects: [
      { type: "status", value: 200 },
      { type: "body-contains", value: "Тихая роскошь" },
      { type: "body-contains", value: "Sun.store" },
      { type: "header-contains", value: "permissions-policy" }
    ]
  },
  {
    path: "/catalog",
    name: "Catalog",
    expects: [
      { type: "status", value: 200 },
      { type: "body-contains", value: "Каталог" },
      { type: "body-contains", value: "filter-chip" }
    ]
  },
  {
    path: "/catalog?category=signature",
    name: "Catalog with category filter",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/catalog?sort=price_asc",
    name: "Catalog with sort",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/products/amber-solar-drop",
    name: "Product detail (mock slug)",
    expects: [
      { type: "status", value: [200, 404] } // 404 acceptable if mock not used
    ]
  },
  {
    path: "/checkout",
    name: "Checkout (empty cart)",
    expects: [
      { type: "status", value: 200 },
      { type: "body-contains", value: "checkout" }
    ]
  },
  {
    path: "/checkout/status",
    name: "Checkout status (success)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/checkout/status?status=rejected",
    name: "Checkout status (rejected)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/checkout/status?status=mock",
    name: "Checkout status (mock)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/admin/login",
    name: "Admin login",
    expects: [
      { type: "status", value: 200 },
      { type: "body-contains", value: "Вход в админ-панель" }
    ]
  },
  {
    path: "/admin/products",
    name: "Admin products (gated)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/admin/orders",
    name: "Admin orders (gated)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/central/login",
    name: "Super admin login",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/central/dashboard",
    name: "Super admin dashboard (gated)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/central/setup",
    name: "Super admin setup wizard",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/central/email",
    name: "Platform email config (gated)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/central/sites/1",
    name: "Shop detail page (gated)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/sites/jewelry",
    name: "Multi-site storefront (jewelry theme)",
    expects: [{ type: "status", value: 200 }]
  },
  {
    path: "/sites/sunvolt",
    name: "Solar panels flagship storefront",
    expects: [
      { type: "status", value: 200 },
      { type: "body-contains", value: "SunVolt" }
    ]
  },
  {
    path: "/nonexistent-route-xyz",
    name: "404 page",
    expects: [
      { type: "status", value: 404 },
      { type: "body-contains", value: "Страница не найдена" }
    ]
  }
];

async function checkRoute(route) {
  const url = base + route.path;
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const elapsed = Date.now() - start;
    // Always read body — 404 responses still need content checks.
    const body = await res.text().catch(() => "");

    const failures = [];
    for (const expectation of route.expects) {
      if (expectation.type === "status") {
        const expected = Array.isArray(expectation.value)
          ? expectation.value
          : [expectation.value];
        if (!expected.includes(res.status)) {
          failures.push(
            `status: expected ${expected.join("|")}, got ${res.status}`
          );
        }
      } else if (expectation.type === "body-contains") {
        if (!body.includes(expectation.value)) {
          failures.push(`body missing: "${expectation.value}"`);
        }
      } else if (expectation.type === "header-contains") {
        const has = [...res.headers.keys()].some((k) =>
          k.toLowerCase().includes(expectation.value.toLowerCase())
        );
        if (!has) {
          failures.push(`header missing: "${expectation.value}"`);
        }
      }
    }

    return {
      route,
      ok: failures.length === 0,
      status: res.status,
      elapsed,
      failures
    };
  } catch (e) {
    return {
      route,
      ok: false,
      status: 0,
      elapsed: Date.now() - start,
      failures: [`fetch error: ${e.message}`]
    };
  }
}

async function main() {
  console.log(`\n☉ Sunstore E2E smoke test`);
  console.log(`  Target: ${base}\n`);

  let pass = 0;
  let fail = 0;
  const results = [];

  for (const route of routes) {
    const r = await checkRoute(route);
    results.push(r);
    if (r.ok) {
      console.log(
        `  ✓ ${route.name.padEnd(40)} ${String(r.status).padEnd(4)} ${r.elapsed}ms`
      );
      pass++;
    } else {
      console.log(
        `  ✗ ${route.name.padEnd(40)} ${String(r.status).padEnd(4)} ${r.elapsed}ms`
      );
      for (const f of r.failures) {
        console.log(`      → ${f}`);
      }
      fail++;
    }
  }

  console.log(`\n── Summary ─────────────────────────`);
  console.log(`  Passed: ${pass}`);
  console.log(`  Failed: ${fail}`);
  console.log(`  Total:  ${pass + fail}`);
  console.log(`  Pass rate: ${((pass / (pass + fail)) * 100).toFixed(1)}%\n`);

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(2);
});
