import { InventoryItem } from "../models/inventory-item";
import { TransitItem } from "./transit-item";
import { KardexProduct } from "./kardex-product";
export interface AuditContext {
    initialInventoryKey?: string;
    finalInventoryKey?: string;
    transitKey?: string;
    kardexKeys: string[];
}