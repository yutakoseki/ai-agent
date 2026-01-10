import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const tenantsTable = createTenantClient({
  tableName: getTableName("tenants"),
});

export const {
  getItem,
  putItem,
  queryByPrefix,
  queryByPrefixPage,
  queryGSI1,
  queryGSI1Page,
  queryGSI2,
  updateItem,
  deleteItem,
  transactWrite,
  indexes,
} = tenantsTable;


