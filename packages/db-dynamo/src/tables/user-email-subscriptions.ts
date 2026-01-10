import { createTenantClient } from "../tenant-client-factory";
import { getTableName } from "../table";

export const userEmailSubscriptionsTable = createTenantClient({
  tableName: getTableName("user_email_subscriptions"),
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
} = userEmailSubscriptionsTable;


