export interface TransitItem {
    item: number;
    issueDate: Date;
    warehouseDate: Date;
    document: string;
    acquiredCodes: string;          // NUEVO
    supplierRuc: string;
    supplier: string;
    subtotal: number;
    igv: number;
    freight: number;
    otherCosts: number;             // NUEVO
    expectedCost: number;           // antes total
}