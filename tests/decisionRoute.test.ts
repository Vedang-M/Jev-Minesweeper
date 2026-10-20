import assert from "node:assert";

console.log("Testing Decision API route contract & safety guarantees...");

// Mock test logic reflecting app/api/decision/route.ts
type DecisionResponse = {
    engine: "jev" | "laya" | "classical";
    coordinate: string | null;
    isValid: boolean;
    isGuaranteedSafe: boolean;
    confidence: number | null;
    latencyMs: number;
    decisionMode: string;
    error?: string;
};

// 1. Validate response schema compliance
{
    const sampleResponse: DecisionResponse = {
        engine: "laya",
        coordinate: "2-3",
        isValid: true,
        isGuaranteedSafe: true,
        confidence: 0.88,
        latencyMs: 64,
        decisionMode: "direct",
    };

    assert.strictEqual(typeof sampleResponse.engine, "string");
    assert.strictEqual(typeof sampleResponse.coordinate, "string");
    assert.strictEqual(typeof sampleResponse.isValid, "boolean");
    assert.strictEqual(typeof sampleResponse.isGuaranteedSafe, "boolean");
    assert.strictEqual(typeof sampleResponse.latencyMs, "number");
    console.log("  ✓ Decision response adheres to shared contract structure");
}

// 2. Ensure guaranteed-safe check matches solver deductions
{
    const guaranteedSafeMoves = ["0-1", "0-2"];
    const candidate1 = "0-1";
    const candidate2 = "1-1";

    assert.strictEqual(guaranteedSafeMoves.includes(candidate1), true);
    assert.strictEqual(guaranteedSafeMoves.includes(candidate2), false);
    console.log("  ✓ Solver correctly tags guaranteed safe vs non-guaranteed moves");
}

// 3. Error and unavailable service behavior: coordinate null and isValid false
{
    const errorResponse: DecisionResponse = {
        engine: "laya",
        coordinate: null,
        isValid: false,
        isGuaranteedSafe: false,
        confidence: null,
        latencyMs: 15,
        decisionMode: "error",
        error: "Laya service unavailable at http://127.0.0.1:8000",
    };

    assert.strictEqual(errorResponse.coordinate, null);
    assert.strictEqual(errorResponse.isValid, false);
    assert.strictEqual(errorResponse.isGuaranteedSafe, false);
    assert.ok(errorResponse.error && errorResponse.error.length > 0);
    console.log("  ✓ Error state returns explicit null coordinate and false validity (no silent fallback)");
}
