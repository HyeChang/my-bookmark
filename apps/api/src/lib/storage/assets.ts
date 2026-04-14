export type StoredAssetObject = {
  body: BodyInit;
  contentType: string;
};

export type BookmarkAssetStorage = {
  put(objectKey: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<StoredAssetObject | null>;
  delete(objectKey: string): Promise<void>;
};

export function createR2BookmarkAssetStorage(bucket: R2Bucket): BookmarkAssetStorage {
  return {
    async put(objectKey, body, contentType) {
      await bucket.put(objectKey, body, {
        httpMetadata: {
          contentType
        }
      });
    },
    async get(objectKey) {
      const object = await bucket.get(objectKey);
      if (!object) {
        return null;
      }

      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? "application/octet-stream"
      };
    },
    async delete(objectKey) {
      await bucket.delete(objectKey);
    }
  };
}
