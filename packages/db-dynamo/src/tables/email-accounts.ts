import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const emailAccountsTable = createTenantClient({
  tableName: getTableName("email_accounts"),
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
} = emailAccountsTable;


