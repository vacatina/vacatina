/** Bounded retry for transient Windows file-handle contention, never for access denial or invalid paths. */
export async function retryLocalFileOperation(action: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await action(); return; }
    catch (error: any) {
      if (!['EPERM', 'EBUSY'].includes(error.code) || attempt >= 7) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
