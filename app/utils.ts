export function isValidBucket(bucket: string): bucket is BucketRegion {
  return ["eeur", "weur", "wnam", "apac"].includes(bucket);
}
