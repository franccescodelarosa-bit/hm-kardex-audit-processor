export interface Finding {
    ruleId: string;
    month?: number;
    productCode?: string;
    productName?: string;
    errorType: string;
    description: string;
    recommendation: string;
    riskLevel: string;
    metadata?: Record<string, any>;
}