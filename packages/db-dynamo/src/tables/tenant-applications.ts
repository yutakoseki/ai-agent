import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const tenantApplicationsTable = createTenantClient({
  tableName: getTableName("tenant_applications"),
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
} = tenantApplicationsTable;


