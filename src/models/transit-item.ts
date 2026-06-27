export interface TransitItem {
    item: number;
    issueDate: Date;
    warehouseDate: Date;
    document: string;
    supplierRuc: string;
    supplier: string;
    subtotal: number;
    igv: number;
    freight: number;
    total: number;
}