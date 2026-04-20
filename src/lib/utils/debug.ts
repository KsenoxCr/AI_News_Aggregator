import os from "node:os";

export function logMem(tag: string) {
  const m = process.memoryUsage();
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + "MB";
  console.log(
    `[mem][${tag}] rss=${mb(m.rss)} heap=${mb(m.heapUsed)}/${mb(m.heapTotal)} ext=${mb(m.external)} avail=${mb(os.freemem())}`,
  );
}
