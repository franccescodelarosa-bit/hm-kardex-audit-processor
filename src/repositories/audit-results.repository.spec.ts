
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditResultRepository } from "./audit-results.repository";
import { Finding } from "../models/finding";

function finding(overrides: Partial<Finding>): Finding {
    return {
        ruleId: "RULE_000",
        errorType: "TEST",
        description: "",
        recommendation: "",
        riskLevel: "MEDIO",
        ...overrides
    };
}

test("getMonth: RULE_002 (metadata.fromMonth) -- ya funcionaba", () => {
    const f = finding({ ruleId: "RULE_002", metadata: { fromMonth: 1, toMonth: 2 } });
    assert.equal(AuditResultRepository.getMonth(f), 1);
});

test("getMonth: RULE_003 (metadata.fromIndex) -- reproduce el bug real, antes quedaba en null", () => {
    const f = finding({ ruleId: "RULE_003", metadata: { fromIndex: 1, toIndex: 2 } });
    assert.equal(AuditResultRepository.getMonth(f), 1, "el mes esta en metadata.fromIndex, no deberia perderse");
});

test("getMonth: metadata.month (RULE_001, RULE_005, etc.) -- sigue funcionando", () => {
    const f = finding({ ruleId: "RULE_001", metadata: { month: 3 } });
    assert.equal(AuditResultRepository.getMonth(f), 3);
});

test("getMonth: sin ninguna clave conocida -- sigue devolviendo null", () => {
    const f = finding({ ruleId: "RULE_012", metadata: { document: "Fac-001" } });
    assert.equal(AuditResultRepository.getMonth(f), null);
});
