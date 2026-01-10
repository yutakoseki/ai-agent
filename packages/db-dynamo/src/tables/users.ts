import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const usersTable = createTenantClient({
  tableName: getTableName("users"),
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
} = usersTable;


