import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const emailMessagesTable = createTenantClient({
  tableName: getTableName("email_messages"),
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
} = emailMessagesTable;


