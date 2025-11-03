import { logger } from './logger';

export const workerApi = {
  saveData: async (data: any) => {
    try {
      const response = await fetch(
        "https://lovable-dropbox-api.w0504124161.workers.dev/?action=upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(data),
          mode: "cors",
          cache: "no-cache",
          credentials: "omit",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        logger.info("Dropbox save failed");
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info("Data saved to Dropbox");
      return { success: true, data: result };
    } catch (error) {
      logger.info("Failed to reach Dropbox");
      return { success: false, error: (error as Error).message };
    }
  },

  loadData: async () => {
    try {
      const response = await fetch(
        "https://lovable-dropbox-api.w0504124161.workers.dev/?action=download",
        {
          method: "POST",
          headers: {
            "Accept": "application/json",
          },
          mode: "cors",
          cache: "no-cache",
          credentials: "omit",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        logger.info("Dropbox load failed");
        return { success: false, error: text };
      }

      const result = await response.json();
      logger.info("Data loaded from Dropbox");
      return { success: true, data: result };
    } catch (error) {
      logger.info("Failed to load from Dropbox");
      return { success: false, error: (error as Error).message };
    }
  },
};
