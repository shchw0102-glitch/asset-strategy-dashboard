import { expect, it } from "vitest";
import { lanAddresses } from "./network.mjs";
it("휴대폰용 주소는 중복 없는 사설 IPv4 주소만 표시한다", () => {
  const item = (address, internal = false) => ({
    address,
    family: "IPv4",
    internal,
  });
  expect(
    lanAddresses(5173, {
      wifi: [item("192.168.0.5"), item("192.168.0.5")],
      loop: [item("127.0.0.1", true)],
      vpn: [item("10.1.0.4")],
      public: [item("8.8.8.8")],
    }),
  ).toEqual(["http://192.168.0.5:5173", "http://10.1.0.4:5173"]);
});
