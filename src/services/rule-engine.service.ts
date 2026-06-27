import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { Rule001 } from "../rules/rule-001";
import { Rule002 } from "../rules/rule-002";
import { Rule003 } from "../rules/rule-003";
import { Rule004 } from "../rules/rule-004";
import { Rule005 } from "../rules/rule-005";
import { Rule006 } from "../rules/rule-006";
import { Rule007 } from "../rules/rule-007";
import { Rule008 } from "../rules/rule-008";
import { Rule009 } from "../rules/rule-009";
import { Rule010 } from "../rules/rule-010";
import { Rule011 } from "../rules/rule-011";
export class RuleEngine {
    static execute(data: AuditData): Finding[] {
        return [
            ...Rule001.execute(data),
            ...Rule002.execute(data),
            ...Rule003.execute(data),
            ...Rule004.execute(data),
            ...Rule005.execute(data),
            ...Rule006.execute(data),
            ...Rule007.execute(data),
            ...Rule008.execute(data),
            ...Rule009.execute(data),
            ...Rule010.execute(data),
            ...Rule011.execute(data)
        ];
    }
}