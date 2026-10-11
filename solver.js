// Solver for "La prueba de los números" (Cifras y Letras / Countdown numbers game).
// Given up to 6 numbers, finds values reachable via +, -, *, / where every
// intermediate result stays a positive integer, and can pick a target that
// is guaranteed to be exactly reachable.

(function (root) {
  function computeTable(numbers) {
    const n = numbers.length;
    // results[mask] = array of { value, expr }
    const results = new Array(1 << n);
    for (let i = 0; i < n; i++) {
      results[1 << i] = [{ value: numbers[i], expr: String(numbers[i]) }];
    }

    for (let mask = 1; mask < 1 << n; mask++) {
      if (results[mask]) continue; // singleton already set
      const seen = new Map(); // value -> expr (keep first found)
      // iterate over all submasks of mask
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const other = mask ^ sub;
        if (sub < other) continue; // avoid duplicate pair work (sub,other)/(other,sub)
        const subResults = results[sub];
        const otherResults = results[other];
        if (!subResults || !otherResults) continue;
        for (const a of subResults) {
          for (const b of otherResults) {
            combine(a, b, seen);
          }
        }
      }
      results[mask] = Array.from(seen.entries()).map(([value, expr]) => ({
        value,
        expr,
      }));
    }
    return results;
  }

  function solve(numbers, target) {
    const results = computeTable(numbers);
    let best = null;
    for (let mask = 1; mask < 1 << numbers.length; mask++) {
      for (const r of results[mask]) {
        const diff = Math.abs(r.value - target);
        const count = popcount(mask);
        if (!best || diff < best.diff || (diff === best.diff && count < best.count)) {
          best = { value: r.value, expr: r.expr, diff, count };
        }
      }
    }
    return best;
  }

  // Every distinct value reachable from `numbers`, each with one expression
  // that produces it (deduped, so each value appears once).
  function reachableValues(numbers) {
    const results = computeTable(numbers);
    const map = new Map();
    for (let mask = 1; mask < 1 << numbers.length; mask++) {
      for (const r of results[mask]) {
        if (!map.has(r.value)) map.set(r.value, r.expr);
      }
    }
    return Array.from(map.entries()).map(([value, expr]) => ({ value, expr }));
  }

  // Picks a random target in [min, max] that is guaranteed to be exactly
  // reachable from `numbers`. Falls back to the in-range-closest reachable
  // value on the rare set of numbers with nothing reachable in range.
  function pickAchievableTarget(numbers, min, max) {
    const all = reachableValues(numbers);
    const inRange = all.filter((r) => r.value >= min && r.value <= max);
    if (inRange.length > 0) {
      return inRange[Math.floor(Math.random() * inRange.length)].value;
    }
    let best = all[0];
    for (const r of all) {
      const clamped = Math.min(max, Math.max(min, r.value));
      if (Math.abs(r.value - clamped) < Math.abs(best.value - Math.min(max, Math.max(min, best.value)))) {
        best = r;
      }
    }
    return best.value;
  }

  function popcount(x) {
    let c = 0;
    while (x) {
      c += x & 1;
      x >>= 1;
    }
    return c;
  }

  function combine(a, b, seen) {
    addResult(a.value + b.value, `(${a.expr}+${b.expr})`, seen);
    if (a.value > b.value) {
      addResult(a.value - b.value, `(${a.expr}-${b.expr})`, seen);
    } else if (b.value > a.value) {
      addResult(b.value - a.value, `(${b.expr}-${a.expr})`, seen);
    }
    if (a.value !== 1 && b.value !== 1) {
      addResult(a.value * b.value, `(${a.expr}*${b.expr})`, seen);
    }
    if (b.value !== 0 && b.value !== 1 && a.value % b.value === 0) {
      addResult(a.value / b.value, `(${a.expr}/${b.expr})`, seen);
    }
    if (a.value !== 0 && a.value !== 1 && b.value % a.value === 0) {
      addResult(b.value / a.value, `(${b.expr}/${a.expr})`, seen);
    }
  }

  function addResult(value, expr, seen) {
    if (!Number.isInteger(value) || value <= 0) return;
    if (!seen.has(value)) seen.set(value, expr);
  }

  // Parses a fully-parenthesized binary expression (as produced by `combine`,
  // e.g. "((100-3)*7)") into a tree of { type: "leaf", value } and
  // { type: "op", op, left, right, value } nodes.
  function parseExpression(expr) {
    let i = 0;
    function parseNode() {
      if (expr[i] === "(") {
        i++; // consume '('
        const left = parseNode();
        const op = expr[i];
        i++;
        const right = parseNode();
        i++; // consume ')'
        return { type: "op", op, left, right, value: applyOp(left.value, op, right.value) };
      }
      const start = i;
      while (i < expr.length && expr[i] >= "0" && expr[i] <= "9") i++;
      return { type: "leaf", value: parseInt(expr.slice(start, i), 10) };
    }
    return parseNode();
  }

  function applyOp(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return a / b;
    throw new Error("Unknown operator: " + op);
  }

  // Flattens a solver `solve()` result into an ordered list of binary
  // operation steps (post-order: an operand that is itself the output of an
  // earlier step always appears after that step). Each step is
  // { op, left, right, value } where left/right are the operand nodes
  // (each carrying its own `.value`).
  function solutionSteps(solution) {
    if (!solution) return [];
    const tree = parseExpression(solution.expr);
    const steps = [];
    (function walk(node) {
      if (node.type === "leaf") return;
      walk(node.left);
      walk(node.right);
      steps.push(node);
    })(tree);
    return steps;
  }

  const api = { solve, reachableValues, pickAchievableTarget, parseExpression, solutionSteps };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.NumbersSolver = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
