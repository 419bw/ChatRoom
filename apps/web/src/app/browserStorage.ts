type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export const safeStorageGetItem = (
  storage: StorageReader | undefined,
  key: string,
) => {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const safeStorageSetItem = (
  storage: StorageWriter | undefined,
  key: string,
  value: string,
) => {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
