export function uploadFile(url: string, file: File, onProgress: (pct: number) => void) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("failed")));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("cancelled"));
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file); // Supabase expects an empty field name
    xhr.send(fd);
  });
  return { promise, cancel: () => xhr.abort() };
}