interface IMigrateResult {
  urls: Array<{
    original: string;
    new: string;
  }>
  success: number //  count of which was migrated
  total: number // total count of which should migrate
}

export { IMigrateResult }
