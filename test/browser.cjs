const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync, existsSync } = require("node:fs");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
mkdirSync("artifacts", { recursive: true });
(async () => {
  let server, browser;
  try {
    let baseURL = process.env.BASE_URL;
    if (!baseURL) {
      server = spawn(process.execPath, ["server.js"], {
        cwd: resolve(__dirname, ".."),
        env: { ...process.env, PORT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      baseURL = await new Promise((resolve, reject) => {
        let stdout = "",
          stderr = "",
          done = false;
        const timer = setTimeout(() => {
          done = true;
          reject(Error("Test server did not start"));
        }, 10000);
        const fail = (error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(error);
        };
        server.on("error", fail);
        server.on("exit", (code) =>
          fail(Error("Test server exited " + code + ": " + stderr)),
        );
        server.stderr.on("data", (chunk) => (stderr += chunk));
        server.stdout.on("data", (chunk) => {
          stdout += chunk;
          const match = stdout.match(/Port (\d+)/);
          if (match && !done) {
            done = true;
            clearTimeout(timer);
            resolve("http://127.0.0.1:" + match[1]);
          }
        });
      });
    }
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1050 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      window.observations = [];
      window.passRequests = [];
      const Original = window.Worker;
      window.Worker = class extends Original {
        postMessage(message, ...rest) {
          if (message.observation)
            window.observations.push(structuredClone(message.observation));
          if (message.type === "pass")
            window.passRequests.push(structuredClone(message));
          return super.postMessage(message, ...rest);
        }
      };
    });
    // A legal full-deck permutation reconstructs the reported pattern without
    // adding test hooks or access to private game state in the application.
    const regressionHand = [0, 5, 9, 19, 20, 26, 27, 28, 29, 30, 31, 37, 49];
    const deck = Array.from({ length: 52 }, (_, c) => c);
    const wanted = [
      ...regressionHand,
      ...deck.filter((c) => !regressionHand.includes(c)),
    ];
    const draws = [];
    for (let i = 51; i > 0; i--) {
      const j = deck.indexOf(wanted[i]);
      assert.ok(j <= i);
      draws.push((j + 0.25) / (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    await page.addInitScript((values) => {
      const original = Math.random;
      let at = 0;
      Math.random = () => (at < values.length ? values[at++] : original());
    }, draws);
    await page.goto(baseURL);
    await page.locator("#strength").selectOption("200");
    assert.equal(await page.locator("#hand .card").count(), 13);
    assert.ok(await page.locator("#hint").isEnabled());
    const originalHand = await page
      .locator("#hand .card")
      .evaluateAll((cards) => cards.map((c) => c.dataset.card));
    assert.deepEqual(originalHand.map(Number), regressionHand);
    await page.locator("#hint").click();
    await page.waitForFunction(() => !document.querySelector("#hint").disabled);
    assert.equal(await page.locator("#hand .hinted").count(), 3);
    const passHint = await page
      .locator("#hand .hinted")
      .evaluateAll((cards) => cards.map((c) => Number(c.dataset.card)));
    assert.deepEqual(new Set(passHint), new Set([19, 20, 49]));
    assert.ok(!passHint.includes(37));
    assert.match(await page.locator("#analysis").textContent(), /Karo/);
    assert.match(
      await page.locator("#analysis").textContent(),
      /6 kleinen Pik/,
    );
    await page.screenshot({
      path: "artifacts/passing-hint-expert.png",
      fullPage: true,
    });
    assert.equal(await page.locator("#hand .selected").count(), 0);
    assert.match(
      await page.locator("#analysis").textContent(),
      /Tipp zum Weitergeben:/,
    );
    assert.deepEqual(
      await page
        .locator("#hand .card")
        .evaluateAll((cards) => cards.map((c) => c.dataset.card)),
      originalHand,
    );
    assert.equal(await page.locator("body").getAttribute("data-phase"), "pass");
    const sent = [];
    for (let i = 0; i < 3; i++) {
      sent.push(
        Number(
          await page.locator("#hand .card").nth(i).getAttribute("data-card"),
        ),
      );
      await page.locator("#hand .card").nth(i).click();
    }
    await page.locator("#action").click();
    await page.locator("#exchange").waitFor({ state: "visible" });
    assert.ok(await page.locator("#exchange").isVisible());
    const passRequests = await page.evaluate(() => window.passRequests);
    assert.equal(passRequests.length, 4);
    const { choosePass } = await import("../src/ai.js");
    assert.deepEqual(
      await page
        .locator("#hand .hinted")
        .evaluateAll((cards) => cards.map((c) => Number(c.dataset.card))),
      [],
    );
    assert.equal(passRequests[0].direction, 1);
    assert.deepEqual(
      new Set(passHint),
      new Set(choosePass(passRequests[0].hand, { direction: 1 })),
    );
    for (const message of passRequests) {
      assert.equal(message.hand.length, 13);
      assert.equal(message.hands, undefined);
      assert.equal(message.observation, undefined);
    }
    assert.equal(await page.locator("#received .card").count(), 3);
    assert.equal(await page.locator("#sent .card").count(), 3);
    const incoming = await page
      .locator("#received .card")
      .evaluateAll((el) => el.map((x) => Number(x.dataset.card)));
    const hand = await page
      .locator("#hand .card")
      .evaluateAll((el) => el.map((x) => Number(x.dataset.card)));
    incoming.forEach((c) => assert.ok(hand.includes(c)));
    sent.forEach((c) => assert.ok(!hand.includes(c)));
    assert.equal(await page.locator("#hand .received-card").count(), 3);
    await page.screenshot({
      path: "artifacts/exchange-desktop.png",
      fullPage: true,
    });
    await page.locator("#action").click();
    let moves = 0,
      hint = false;
    for (let i = 0; i < 1800; i++) {
      if (await page.locator("#action").isVisible()) break;
      const cards = page.locator("#hand button:not(:disabled)");
      if (await cards.count()) {
        if (!hint) {
          await page.locator("#hint").click();
          await page.waitForFunction(
            () => !document.querySelector("#hint").disabled,
          );
          assert.equal(await page.locator("#hand .hinted").count(), 1);
          hint = true;
        }
        await cards.first().click();
        moves++;
      } else await page.waitForTimeout(50);
    }
    assert.equal(moves, 13);
    assert.ok(await page.locator("#round-summary").isVisible());
    const counts = await page
      .locator(".seat-stats div:first-child strong")
      .allTextContents();
    assert.equal(
      counts.map(Number).reduce((a, b) => a + b),
      13,
    );
    assert.equal(await page.locator(".trick-meter .filled").count(), 13);
    assert.equal(await page.locator(".history-row").count(), 13);
    const observations = await page.evaluate(() => window.observations);
    assert.ok(new Set(observations.map((o) => o.player)).size === 4);
    for (const o of observations) {
      assert.equal(o.hands, undefined);
      assert.equal(o.hand.length, o.counts[o.player]);
      const owners = Object.keys(o.known);
      assert.equal(owners.length, 1);
      assert.equal(Number(owners[0]), (o.player + 1) % 4);
      assert.equal(o.known[owners[0]].length, 3);
    }
    console.log({
      moves,
      counts,
      observations: observations.length,
      status: await page.locator("#status").innerText(),
      errors,
    });
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: "artifacts/round-result.png",
      fullPage: true,
    });
    await page.locator("#action").click();
    await page.locator("#new").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Overflow at " + width,
      );
    }
    // Verify a visible trick and its collection with normal motion enabled.
    await page.setViewportSize({ width: 1280, height: 1050 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#new").click();
    for (let i = 0; i < 3; i++)
      await page.locator("#hand .card").nth(i).click();
    await page.locator("#action").click();
    await page.locator("#exchange").waitFor({ state: "visible" });
    await page.locator("#action").click();
    for (let i = 0; i < 1200; i++) {
      if (await page.locator("#winner-banner").isVisible()) break;
      const cards = page.locator("#hand button:not(:disabled)");
      if (await cards.count()) await cards.first().click();
      else await page.waitForTimeout(20);
    }
    assert.ok(await page.locator("#winner-banner").isVisible());
    assert.equal(await page.locator("#trick .card").count(), 4);
    const flying = page.locator("#trick .just-played");
    assert.equal(await flying.count(), 1);
    assert.equal(
      await flying.evaluate((el) => getComputedStyle(el).animationName),
      "play-card",
    );
    assert.ok(
      await flying.evaluate(
        (el) => el.style.getPropertyValue("--from-y").length > 0,
      ),
    );
    await page.waitForTimeout(400);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: "artifacts/trick-winner.png" });
    await page
      .locator("#trick.collecting")
      .waitFor({ state: "attached", timeout: 4000 });
    assert.equal(await page.locator(".seat.won").count(), 1);
    assert.ok(
      await page
        .locator("#trick .trick-slot")
        .first()
        .evaluate((el) => el.style.getPropertyValue("--collect-x").length > 0),
    );
    await page.locator("#new").click();
    await page.waitForTimeout(650);
    assert.equal(await page.locator("#hand .card").count(), 13);
    assert.equal(await page.locator("#trick .card").count(), 0);
    const resetCounts = await page
      .locator(".seat-stats div:first-child strong")
      .allTextContents();
    assert.deepEqual(resetCounts, ["0", "0", "0", "0"]);
    console.log({ normalMotion: true, cancelDuringCollection: true });
  } finally {
    await browser?.close();
    server?.kill("SIGTERM");
  }
})();
