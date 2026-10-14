import { networkInterfaces } from "node:os";
export function lanAddresses(port, interfaces = networkInterfaces()) {
  return [
    ...new Set(
      Object.values(interfaces)
        .flat()
        .filter(Boolean)
        .filter(
          (item) =>
            !item.internal &&
            item.family === "IPv4" &&
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address),
        )
        .map((item) => `http://${item.address}:${port}`),
    ),
  ];
}
