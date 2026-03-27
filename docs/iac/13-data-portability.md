# Data Portability

BetterBase makes it easy to export, import, and backup your data.

## Export Data

```bash
# Export all tables to JSON
bb iac export --format json --output ./backup

# Export specific table
bb iac export --table users --output ./users.json

# Export to SQL (for migration)
bb iac export --format sql --output ./migration.sql
```

## Import Data

```bash
# Import from JSON backup
bb iac import ./backup

# Preview without applying (dry run)
bb iac import --dry-run ./backup

# Import specific table
bb iac import --table users ./users.json
```

## Programmatic Export/Import

```typescript
// In a function - export query results
export const exportUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return JSON.stringify(users, null, 2);
  },
});
```

## Backup Scheduling

```typescript
// bbf/cron.ts
import { cron } from "@betterbase/core/iac";
import { api } from "./_generated/api";

// Daily backup at 2 AM UTC
cron("daily-backup", "0 2 * * *", api.mutations.system.backup, {});
```

## Data Formats

| Format | Use Case |
|--------|----------|
| JSON | Developer backup, inspection |
| SQL | Migration to other databases |
| CSV | Spreadsheet import/export |

## Best Practices

1. **Regular backups**: Schedule daily backups for production
2. **Test restores**: Periodically test importing backups
3. **Offsite storage**: Copy backups to S3/Google Cloud Storage
4. **Version schema**: Include schema version in backup filename